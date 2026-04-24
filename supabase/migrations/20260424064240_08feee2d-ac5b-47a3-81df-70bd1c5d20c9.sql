-- =========================================================================
-- PHASE 2: MULTI-TENANCY FOUNDATION
-- =========================================================================

-- 1. COMPANIES + MEMBERSHIP -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  logo_url text DEFAULT '',
  country text DEFAULT 'ET',
  currency text NOT NULL DEFAULT 'ETB',
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.company_member_role AS ENUM ('owner','admin','member');

CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role public.company_member_role NOT NULL DEFAULT 'member',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- updated_at trigger for companies
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SEED THE DEFAULT COMPANY + MIGRATE EXISTING USERS --------------------
INSERT INTO public.companies (id, name, code, currency, plan, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company', 'DEFAULT', 'ETB', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

-- every existing auth user becomes a member of the default company
INSERT INTO public.company_members (company_id, user_id, member_role, is_default)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       u.id,
       CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') THEN 'owner'::public.company_member_role
            ELSE 'member'::public.company_member_role END,
       true
FROM auth.users u
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 3. HELPER FUNCTIONS -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  _t text;
BEGIN
  -- session var set by the client (PostgREST passes through GUCs prefixed with 'request.')
  BEGIN
    _t := current_setting('app.tenant_id', true);
  EXCEPTION WHEN OTHERS THEN
    _t := NULL;
  END;
  IF _t IS NULL OR _t = '' THEN
    -- fallback: user's default company
    SELECT company_id::text INTO _t
    FROM public.company_members
    WHERE user_id = auth.uid() AND is_default = true
    LIMIT 1;
  END IF;
  IF _t IS NULL OR _t = '' THEN
    -- last-resort fallback: first company the user belongs to
    SELECT company_id::text INTO _t
    FROM public.company_members
    WHERE user_id = auth.uid()
    ORDER BY created_at LIMIT 1;
  END IF;
  RETURN _t::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid() AND company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = _company_id
      AND member_role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- 4. RLS FOR companies + company_members ----------------------------------
CREATE POLICY "View companies I belong to"
  ON public.companies FOR SELECT TO authenticated
  USING (public.belongs_to_company(id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages companies"
  ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "View members of my companies"
  ON public.company_members FOR SELECT TO authenticated
  USING (public.belongs_to_company(company_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins manage members"
  ON public.company_members FOR ALL TO authenticated
  USING (public.is_company_admin(company_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_company_admin(company_id) OR public.is_super_admin(auth.uid()));

-- 5. ADD tenant_id TO ALL BUSINESS TABLES + BACKFILL ----------------------
-- Helper macro-style approach via DO block
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','asset_maintenance','assets','attendance','audit_logs','branches',
    'category_field_schemas','credit_payments','credit_sales','customers',
    'employee_loans','employees','exchange_rates','goods_receipts','import_jobs',
    'import_rows','inventory_alerts','journal_entries','journal_lines',
    'leave_requests','notifications','payment_requests','payroll_runs','payslips',
    'pos_activity_logs','product_batches','product_categories','products',
    'profiles','purchase_order_items','purchase_orders','sale_items','sales',
    'stock_movements','stock_transfer_items','stock_transfers','suppliers','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- skip if table doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000001''::uuid WHERE tenant_id IS NULL',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)',
      t, t
    );
  END LOOP;
END $$;

-- 6. AUTO-FILL tenant_id ON INSERT ----------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','asset_maintenance','assets','attendance','audit_logs',
    'category_field_schemas','credit_payments','credit_sales','customers',
    'employee_loans','employees','exchange_rates','goods_receipts','import_jobs',
    'import_rows','inventory_alerts','journal_entries','journal_lines',
    'leave_requests','notifications','payment_requests','payroll_runs','payslips',
    'pos_activity_logs','product_batches','product_categories','products',
    'purchase_order_items','purchase_orders','sale_items','sales',
    'stock_movements','stock_transfer_items','stock_transfers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_tenant ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_tenant BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()',
      t, t
    );
  END LOOP;
END $$;

-- 7. PAUSE PHASE 1 TRIGGERS ----------------------------------------------
DROP TRIGGER IF EXISTS trg_sale_insert        ON public.sales;
DROP TRIGGER IF EXISTS trg_sale_item_insert   ON public.sale_items;
DROP TRIGGER IF EXISTS trg_grn_insert         ON public.goods_receipts;
DROP TRIGGER IF EXISTS trg_payroll_approval   ON public.payroll_runs;
DROP TRIGGER IF EXISTS trg_credit_payment_insert ON public.credit_payments;
DROP TRIGGER IF EXISTS trg_transfer_received  ON public.stock_transfers;

-- 8. REWRITE RLS POLICIES TO ADD TENANT SCOPING --------------------------
-- Strategy: keep existing role checks, add `belongs_to_company(tenant_id)` AND tenant match.
-- We drop & recreate rather than ALTER POLICY to keep this idempotent.

-- products
DROP POLICY IF EXISTS "Manage products" ON public.products;
DROP POLICY IF EXISTS "View products"   ON public.products;
CREATE POLICY "View products" ON public.products FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage products" ON public.products FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')));

-- customers
DROP POLICY IF EXISTS "Manage customers" ON public.customers;
DROP POLICY IF EXISTS "View customers"   ON public.customers;
CREATE POLICY "View customers" ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage customers" ON public.customers FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')));

-- sales
DROP POLICY IF EXISTS "Insert sales" ON public.sales;
DROP POLICY IF EXISTS "View sales"   ON public.sales;
CREATE POLICY "View sales" ON public.sales FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
              AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')));

-- sale_items
DROP POLICY IF EXISTS "Insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "View sale items"   ON public.sale_items;
CREATE POLICY "View sale items" ON public.sale_items FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert sale items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
              AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')));

-- credit_sales
DROP POLICY IF EXISTS "Manage credit sales" ON public.credit_sales;
DROP POLICY IF EXISTS "View credit sales"   ON public.credit_sales;
CREATE POLICY "View credit sales" ON public.credit_sales FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage credit sales" ON public.credit_sales FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- credit_payments
DROP POLICY IF EXISTS "Insert credit payments" ON public.credit_payments;
DROP POLICY IF EXISTS "View credit payments"   ON public.credit_payments;
CREATE POLICY "View credit payments" ON public.credit_payments FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert credit payments" ON public.credit_payments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
              AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier')));

-- product_categories
DROP POLICY IF EXISTS "Manage categories" ON public.product_categories;
DROP POLICY IF EXISTS "View categories"   ON public.product_categories;
CREATE POLICY "View categories" ON public.product_categories FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage categories" ON public.product_categories FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- product_batches
DROP POLICY IF EXISTS "Manage batches" ON public.product_batches;
DROP POLICY IF EXISTS "View batches"   ON public.product_batches;
CREATE POLICY "View batches" ON public.product_batches FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage batches" ON public.product_batches FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- category_field_schemas
DROP POLICY IF EXISTS "Manage schemas" ON public.category_field_schemas;
DROP POLICY IF EXISTS "View schemas"   ON public.category_field_schemas;
CREATE POLICY "View schemas" ON public.category_field_schemas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage schemas" ON public.category_field_schemas FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- inventory_alerts
DROP POLICY IF EXISTS "Manage alerts" ON public.inventory_alerts;
DROP POLICY IF EXISTS "View alerts"   ON public.inventory_alerts;
CREATE POLICY "View alerts" ON public.inventory_alerts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage alerts" ON public.inventory_alerts FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- import_jobs / import_rows
DROP POLICY IF EXISTS "Manage import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "View import jobs"   ON public.import_jobs;
CREATE POLICY "View import jobs" ON public.import_jobs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage import jobs" ON public.import_jobs FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage import rows" ON public.import_rows;
DROP POLICY IF EXISTS "View import rows"   ON public.import_rows;
CREATE POLICY "View import rows" ON public.import_rows FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage import rows" ON public.import_rows FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- branches
DROP POLICY IF EXISTS "Manage branches" ON public.branches;
DROP POLICY IF EXISTS "View branches"   ON public.branches;
CREATE POLICY "View branches" ON public.branches FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage branches" ON public.branches FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- employees
DROP POLICY IF EXISTS "Manage employees" ON public.employees;
DROP POLICY IF EXISTS "View employees"   ON public.employees;
CREATE POLICY "View employees" ON public.employees FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR user_id = auth.uid() OR public.is_branch_manager(auth.uid(), branch_id)));
CREATE POLICY "Manage employees" ON public.employees FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- attendance
DROP POLICY IF EXISTS "Manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "View attendance"   ON public.attendance;
CREATE POLICY "View attendance" ON public.attendance FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid()) OR public.is_branch_manager(auth.uid(), branch_id)));
CREATE POLICY "Manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- leave_requests
DROP POLICY IF EXISTS "Insert leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Update leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "View leaves"   ON public.leave_requests;
CREATE POLICY "View leaves" ON public.leave_requests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid()) OR public.is_branch_manager(auth.uid(), branch_id)));
CREATE POLICY "Insert leaves" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Update leaves" ON public.leave_requests FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR public.is_branch_manager(auth.uid(), branch_id)));

-- payroll_runs
DROP POLICY IF EXISTS "Manage payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "View payroll runs"   ON public.payroll_runs;
CREATE POLICY "View payroll runs" ON public.payroll_runs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- payslips
DROP POLICY IF EXISTS "Manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "View payslips"   ON public.payslips;
CREATE POLICY "View payslips" ON public.payslips FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())));
CREATE POLICY "Manage payslips" ON public.payslips FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- employee_loans
DROP POLICY IF EXISTS "Manage loans" ON public.employee_loans;
DROP POLICY IF EXISTS "View loans"   ON public.employee_loans;
CREATE POLICY "View loans" ON public.employee_loans FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())));
CREATE POLICY "Manage loans" ON public.employee_loans FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- accounts / journals
DROP POLICY IF EXISTS "Manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "View accounts"   ON public.accounts;
CREATE POLICY "View accounts" ON public.accounts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage accounts" ON public.accounts FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage journals" ON public.journal_entries;
DROP POLICY IF EXISTS "View journals"   ON public.journal_entries;
CREATE POLICY "View journals" ON public.journal_entries FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage journals" ON public.journal_entries FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "View journal lines"   ON public.journal_lines;
CREATE POLICY "View journal lines" ON public.journal_lines FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage journal lines" ON public.journal_lines FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- payment_requests
DROP POLICY IF EXISTS "Approve payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Insert payment requests"  ON public.payment_requests;
DROP POLICY IF EXISTS "View payment requests"    ON public.payment_requests;
CREATE POLICY "View payment requests" ON public.payment_requests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert payment requests" ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND auth.uid() IS NOT NULL);
CREATE POLICY "Approve payment requests" ON public.payment_requests FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()));

-- purchase_orders + items
DROP POLICY IF EXISTS "Manage POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "View POs"   ON public.purchase_orders;
CREATE POLICY "View POs" ON public.purchase_orders FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage POs" ON public.purchase_orders FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "View PO items"   ON public.purchase_order_items;
CREATE POLICY "View PO items" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage PO items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- goods_receipts
DROP POLICY IF EXISTS "Manage GRNs" ON public.goods_receipts;
DROP POLICY IF EXISTS "View GRNs"   ON public.goods_receipts;
CREATE POLICY "View GRNs" ON public.goods_receipts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage GRNs" ON public.goods_receipts FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- assets / asset_maintenance
DROP POLICY IF EXISTS "Manage assets" ON public.assets;
DROP POLICY IF EXISTS "View assets"   ON public.assets;
CREATE POLICY "View assets" ON public.assets FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage assets" ON public.assets FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR public.is_finance_staff(auth.uid())))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage maintenance" ON public.asset_maintenance;
DROP POLICY IF EXISTS "View maintenance"   ON public.asset_maintenance;
CREATE POLICY "View maintenance" ON public.asset_maintenance FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage maintenance" ON public.asset_maintenance FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR public.is_finance_staff(auth.uid())))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- exchange_rates
DROP POLICY IF EXISTS "Admin insert rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "View rates"         ON public.exchange_rates;
CREATE POLICY "View rates" ON public.exchange_rates FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Admin insert rates" ON public.exchange_rates FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND has_role(auth.uid(),'admin'));

-- audit_logs
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "View audit logs"   ON public.audit_logs;
CREATE POLICY "View audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id)
         AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'auditor')));
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND auth.uid() IS NOT NULL);

-- pos_activity_logs
DROP POLICY IF EXISTS "Insert own activity" ON public.pos_activity_logs;
DROP POLICY IF EXISTS "View activity"       ON public.pos_activity_logs;
CREATE POLICY "View activity" ON public.pos_activity_logs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert own activity" ON public.pos_activity_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND auth.uid() = user_id);

-- notifications (per-user, but tenant-scoped)
DROP POLICY IF EXISTS "Insert notifs by staff" ON public.notifications;
DROP POLICY IF EXISTS "Update own notifs"      ON public.notifications;
DROP POLICY IF EXISTS "View own notifs"        ON public.notifications;
CREATE POLICY "View own notifs" ON public.notifications FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND auth.uid() = user_id);
CREATE POLICY "Update own notifs" ON public.notifications FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND auth.uid() = user_id);
CREATE POLICY "Insert notifs by staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- profiles: keep cross-tenant readable so user names render in any company they're in
DROP POLICY IF EXISTS "Insert own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authed" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile"        ON public.profiles;
CREATE POLICY "Profiles viewable by authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by_admin);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- stock_movements / stock_transfers / stock_transfer_items / suppliers / user_roles
-- only add tenant_id checks where policies already existed; keep rest unchanged.

DO $$ BEGIN
  -- stock_movements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stock_movements') THEN
    EXECUTE 'DROP POLICY IF EXISTS "View stock movements" ON public.stock_movements';
    EXECUTE 'DROP POLICY IF EXISTS "Manage stock movements" ON public.stock_movements';
    EXECUTE $p$CREATE POLICY "View stock movements" ON public.stock_movements FOR SELECT TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
    EXECUTE $p$CREATE POLICY "Manage stock movements" ON public.stock_movements FOR ALL TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
              WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stock_transfers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "View transfers" ON public.stock_transfers';
    EXECUTE 'DROP POLICY IF EXISTS "Manage transfers" ON public.stock_transfers';
    EXECUTE $p$CREATE POLICY "View transfers" ON public.stock_transfers FOR SELECT TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
    EXECUTE $p$CREATE POLICY "Manage transfers" ON public.stock_transfers FOR ALL TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
              WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stock_transfer_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "View transfer items" ON public.stock_transfer_items';
    EXECUTE 'DROP POLICY IF EXISTS "Manage transfer items" ON public.stock_transfer_items';
    EXECUTE $p$CREATE POLICY "View transfer items" ON public.stock_transfer_items FOR SELECT TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
    EXECUTE $p$CREATE POLICY "Manage transfer items" ON public.stock_transfer_items FOR ALL TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))
              WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers') THEN
    EXECUTE 'ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE';
    EXECUTE 'UPDATE public.suppliers SET tenant_id = ''00000000-0000-0000-0000-000000000001''::uuid WHERE tenant_id IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id)';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_suppliers_set_tenant ON public.suppliers';
    EXECUTE 'CREATE TRIGGER trg_suppliers_set_tenant BEFORE INSERT ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()';
    EXECUTE 'DROP POLICY IF EXISTS "View suppliers" ON public.suppliers';
    EXECUTE 'DROP POLICY IF EXISTS "Manage suppliers" ON public.suppliers';
    EXECUTE $p$CREATE POLICY "View suppliers" ON public.suppliers FOR SELECT TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
    EXECUTE $p$CREATE POLICY "Manage suppliers" ON public.suppliers FOR ALL TO authenticated
              USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_procurement_staff(auth.uid()))
              WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id))$p$;
  END IF;
END $$;

-- user_roles: scope to tenant so a user can be admin in company A but cashier in company B
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    -- Note: we backfilled tenant_id to default already; existing role checks keep working because
    -- has_role() is tenant-agnostic. Adding tenant scoping to user_roles is left for a follow-up
    -- to avoid breaking has_role() during this migration.
    NULL;
  END IF;
END $$;