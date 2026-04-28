-- ============= PLANS =============
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  author_id uuid NOT NULL,
  employee_id uuid,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  plan_type text NOT NULL DEFAULT 'daily' CHECK (plan_type IN ('daily','weekly','monthly','quarterly')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  due_date date,
  mentioned_user_ids uuid[] DEFAULT '{}',
  attachment_urls text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_author ON public.plans(author_id);
CREATE INDEX idx_plans_tenant_type ON public.plans(tenant_id, plan_type);
CREATE INDEX idx_plans_due ON public.plans(due_date) WHERE due_date IS NOT NULL;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER plans_set_tenant BEFORE INSERT ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View plans" ON public.plans FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Insert own plans" ON public.plans FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND author_id = auth.uid());
CREATE POLICY "Update own or HR plans" ON public.plans FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (author_id = auth.uid() OR is_hr_staff(auth.uid())));
CREATE POLICY "Delete own or HR plans" ON public.plans FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (author_id = auth.uid() OR is_hr_staff(auth.uid())));

-- ============= PLAN COMMENTS =============
CREATE TABLE public.plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  plan_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_comments_plan ON public.plan_comments(plan_id);

ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER plan_comments_set_tenant BEFORE INSERT ON public.plan_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER plan_comments_updated_at BEFORE UPDATE ON public.plan_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View plan comments" ON public.plan_comments FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Insert plan comments" ON public.plan_comments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND author_id = auth.uid());
CREATE POLICY "Update own plan comments" ON public.plan_comments FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (author_id = auth.uid() OR is_hr_staff(auth.uid())));
CREATE POLICY "Delete own plan comments" ON public.plan_comments FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (author_id = auth.uid() OR is_hr_staff(auth.uid())));

-- ============= PLAN REACTIONS =============
CREATE TABLE public.plan_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('thumbs_up','thumbs_down','acknowledge')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, user_id)
);
CREATE INDEX idx_plan_reactions_plan ON public.plan_reactions(plan_id);

ALTER TABLE public.plan_reactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER plan_reactions_set_tenant BEFORE INSERT ON public.plan_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE POLICY "View reactions" ON public.plan_reactions FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage own reactions" ON public.plan_reactions FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = current_tenant_id() AND user_id = auth.uid());

-- ============= PLAN PERFORMANCE RECORDS =============
CREATE TABLE public.plan_performance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  staff_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  plan_type text NOT NULL DEFAULT 'daily',
  period_key text NOT NULL,
  planned_value numeric NOT NULL DEFAULT 100,
  actual_value numeric NOT NULL DEFAULT 0,
  achievement_pct numeric GENERATED ALWAYS AS (
    CASE WHEN planned_value > 0 THEN ROUND((actual_value / planned_value) * 100, 2) ELSE 0 END
  ) STORED,
  grade numeric NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','recorded','reviewed')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, plan_id)
);
CREATE INDEX idx_perf_records_staff_period ON public.plan_performance_records(staff_id, plan_type, period_key);

ALTER TABLE public.plan_performance_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER perf_records_set_tenant BEFORE INSERT ON public.plan_performance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER perf_records_updated_at BEFORE UPDATE ON public.plan_performance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View perf records" ON public.plan_performance_records FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage perf records" ON public.plan_performance_records FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (staff_id = auth.uid() OR is_hr_staff(auth.uid())))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

-- ============= PERFORMANCE SUMMARIES =============
CREATE TABLE public.performance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  staff_id uuid NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly','yearly')),
  period_key text NOT NULL,
  average_grade numeric NOT NULL DEFAULT 0,
  total_plans integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'auto',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, period_type, period_key)
);
CREATE INDEX idx_perf_summary_staff ON public.performance_summaries(staff_id, period_type);

ALTER TABLE public.performance_summaries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER perf_summary_set_tenant BEFORE INSERT ON public.performance_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE TRIGGER perf_summary_updated_at BEFORE UPDATE ON public.performance_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View perf summaries" ON public.performance_summaries FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage perf summaries" ON public.performance_summaries FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (staff_id = auth.uid() OR is_hr_staff(auth.uid())))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

-- ============= PLAN ATTACHMENTS BUCKET =============
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-attachments', 'plan-attachments', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload plan attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authenticated read plan attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plan-attachments');
CREATE POLICY "Owner delete plan attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plan-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);