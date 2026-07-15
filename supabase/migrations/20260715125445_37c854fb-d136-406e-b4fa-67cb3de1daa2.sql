
-- ============== MESSAGING ==============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','group','channel')),
  title text,
  description text,
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  muted boolean NOT NULL DEFAULT false,
  last_read_at timestamptz DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Helper to avoid RLS recursion between conversations & members
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id=_conv AND user_id=_user);
$$;

CREATE POLICY conv_select ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY conv_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY conv_update ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY cm_select ON public.conversation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY cm_insert ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY cm_update ON public.conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY cm_delete ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  mentions uuid[] DEFAULT '{}',
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY msg_select ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY msg_update ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_select ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id=message_id AND public.is_conversation_member(m.conversation_id, auth.uid())));
CREATE POLICY mr_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY mr_delete ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_cm_user ON public.conversation_members(user_id);

CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();

CREATE TRIGGER trg_conv_tenant BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- ============== DEPARTMENTS ==============
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  budget numeric(14,2) DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dept_select ON public.departments FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY dept_write ON public.departments FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
CREATE TRIGGER trg_dept_tenant BEFORE INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER trg_dept_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend profiles with editor fields (add if missing)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS emergency_contact jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS socials jsonb DEFAULT '{}'::jsonb;

-- ============== PERFORMANCE ==============
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  unit text,
  weight_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight_pct >= 0 AND weight_pct <= 100),
  target numeric(14,2),
  direction text NOT NULL DEFAULT 'higher' CHECK (direction IN ('higher','lower')),
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_definitions TO authenticated;
GRANT ALL ON public.kpi_definitions TO service_role;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_select ON public.kpi_definitions FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY kpi_write ON public.kpi_definitions FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
CREATE TRIGGER trg_kpi_tenant BEFORE INSERT ON public.kpi_definitions FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER trg_kpi_updated BEFORE UPDATE ON public.kpi_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','calibration','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cycles TO authenticated;
GRANT ALL ON public.review_cycles TO service_role;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_select ON public.review_cycles FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY rc_write ON public.review_cycles FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
CREATE TRIGGER trg_rc_tenant BEFORE INSERT ON public.review_cycles FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  self_score numeric(5,2),
  manager_score numeric(5,2),
  peer_score numeric(5,2),
  final_score numeric(5,2),
  rating text,
  self_notes text,
  manager_notes text,
  calibration_notes text,
  kpi_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','self_done','manager_done','calibrated','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_select ON public.performance_reviews FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (
    is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)
    OR employee_id = get_employee_id_for_user(auth.uid())
  ));
CREATE POLICY pr_write ON public.performance_reviews FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (
    is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)
    OR employee_id = get_employee_id_for_user(auth.uid())
  ))
  WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER trg_pr_tenant BEFORE INSERT ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.review_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  relation text NOT NULL CHECK (relation IN ('peer','manager','subordinate','self')),
  is_anonymous boolean NOT NULL DEFAULT false,
  score numeric(5,2),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_feedback TO authenticated;
GRANT ALL ON public.review_feedback TO service_role;
ALTER TABLE public.review_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY rf_select ON public.review_feedback FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR reviewer_id = auth.uid()));
CREATE POLICY rf_insert ON public.review_feedback FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND reviewer_id = auth.uid());
CREATE TRIGGER trg_rf_tenant BEFORE INSERT ON public.review_feedback FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.review_cycles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_value numeric(14,2),
  achieved_value numeric(14,2) DEFAULT 0,
  weight_pct numeric(5,2) DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','missed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY g_select ON public.goals FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())));
CREATE POLICY g_write ON public.goals FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())))
  WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER trg_g_tenant BEFORE INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER trg_g_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== SALARY ==============
CREATE TABLE public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('earning','deduction')),
  category text NOT NULL DEFAULT 'allowance' CHECK (category IN ('basic','allowance','bonus','overtime','deduction','statutory')),
  is_taxable boolean NOT NULL DEFAULT true,
  is_pensionable boolean NOT NULL DEFAULT false,
  formula text,
  default_amount numeric(14,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_components TO authenticated;
GRANT ALL ON public.salary_components TO service_role;
ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_select ON public.salary_components FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY sc_write ON public.salary_components FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER trg_sc_tenant BEFORE INSERT ON public.salary_components FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE public.employee_salary_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  percent_of_basic numeric(5,2),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_structure TO authenticated;
GRANT ALL ON public.employee_salary_structure TO service_role;
ALTER TABLE public.employee_salary_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY ess_select ON public.employee_salary_structure FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())));
CREATE POLICY ess_write ON public.employee_salary_structure FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND is_hr_staff(auth.uid()));
CREATE TRIGGER trg_ess_tenant BEFORE INSERT ON public.employee_salary_structure FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE public.salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  reason text,
  installments integer NOT NULL DEFAULT 1,
  recovered_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','recovering','settled','cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_advances TO authenticated;
GRANT ALL ON public.salary_advances TO service_role;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_select ON public.salary_advances FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())));
CREATE POLICY sa_insert ON public.salary_advances FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())));
CREATE POLICY sa_update ON public.salary_advances FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND is_hr_staff(auth.uid()));
CREATE TRIGGER trg_sa_tenant BEFORE INSERT ON public.salary_advances FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE public.bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  reason text,
  is_taxable boolean NOT NULL DEFAULT true,
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonuses TO authenticated;
GRANT ALL ON public.bonuses TO service_role;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY b_select ON public.bonuses FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_hr_staff(auth.uid()) OR employee_id = get_employee_id_for_user(auth.uid())));
CREATE POLICY b_write ON public.bonuses FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND is_hr_staff(auth.uid()));
CREATE TRIGGER trg_b_tenant BEFORE INSERT ON public.bonuses FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- messaging bucket policies happen via storage tool
