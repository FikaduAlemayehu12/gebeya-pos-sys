
-- ============ Storage policies for plan-attachments ============
DROP POLICY IF EXISTS "Plan attachments read" ON storage.objects;
DROP POLICY IF EXISTS "Plan attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "Plan attachments update" ON storage.objects;
DROP POLICY IF EXISTS "Plan attachments delete" ON storage.objects;

CREATE POLICY "Plan attachments read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'plan-attachments'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "Plan attachments insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'plan-attachments'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Plan attachments update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'plan-attachments'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "Plan attachments delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'plan-attachments'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

-- ============ Payment approval rules ============
CREATE TABLE IF NOT EXISTS public.payment_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid,
  step_order integer NOT NULL DEFAULT 1,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  required_role text NOT NULL DEFAULT 'finance_manager',
  approver_user_id uuid,
  notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_approval_rules ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS payment_approval_rules_set_tenant ON public.payment_approval_rules;
CREATE TRIGGER payment_approval_rules_set_tenant BEFORE INSERT ON public.payment_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS payment_approval_rules_updated_at ON public.payment_approval_rules;
CREATE TRIGGER payment_approval_rules_updated_at BEFORE UPDATE ON public.payment_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View approval rules" ON public.payment_approval_rules FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage approval rules" ON public.payment_approval_rules FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- ============ Payment approvals (audit trail) ============
CREATE TABLE IF NOT EXISTS public.payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  payment_request_id uuid NOT NULL,
  step_order integer NOT NULL DEFAULT 1,
  approver_id uuid,
  decision text NOT NULL DEFAULT 'pending',
  comment text DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS payment_approvals_set_tenant ON public.payment_approvals;
CREATE TRIGGER payment_approvals_set_tenant BEFORE INSERT ON public.payment_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE INDEX IF NOT EXISTS idx_payment_approvals_req ON public.payment_approvals(payment_request_id);

CREATE POLICY "View payment approvals" ON public.payment_approvals FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Insert payment approvals" ON public.payment_approvals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND auth.uid() IS NOT NULL);
CREATE POLICY "Update payment approvals" ON public.payment_approvals FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()));

-- ============ Bank accounts ============
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid,
  name text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'bank', -- bank|telebirr|cbe_birr|cash
  currency text NOT NULL DEFAULT 'ETB',
  gl_account_code text,
  current_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS bank_accounts_set_tenant ON public.bank_accounts;
CREATE TRIGGER bank_accounts_set_tenant BEFORE INSERT ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View bank accounts" ON public.bank_accounts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage bank accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- ============ Bank statement lines (for reconciliation) ============
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  bank_account_id uuid NOT NULL,
  txn_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  reference text DEFAULT '',
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  balance numeric,
  matched_journal_id uuid,
  matched_payment_id uuid,
  reconciled boolean NOT NULL DEFAULT false,
  reconciled_by uuid,
  reconciled_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS bank_statement_lines_set_tenant ON public.bank_statement_lines;
CREATE TRIGGER bank_statement_lines_set_tenant BEFORE INSERT ON public.bank_statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
CREATE INDEX IF NOT EXISTS idx_bank_lines_acct ON public.bank_statement_lines(bank_account_id, txn_date);

CREATE POLICY "View bank lines" ON public.bank_statement_lines FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage bank lines" ON public.bank_statement_lines FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- ============ Budgets ============
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid,
  account_id uuid,
  account_code text,
  fiscal_year integer NOT NULL,
  monthly_amounts numeric[] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::numeric[],
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS budgets_set_tenant ON public.budgets;
CREATE TRIGGER budgets_set_tenant BEFORE INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS budgets_updated_at ON public.budgets;
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View budgets" ON public.budgets FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage budgets" ON public.budgets FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- ============ Finance settings ============
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE,
  vat_rate numeric NOT NULL DEFAULT 0.15,
  withholding_rate numeric NOT NULL DEFAULT 0.02,
  withholding_threshold numeric NOT NULL DEFAULT 3000,
  fiscal_year_start_month integer NOT NULL DEFAULT 7,
  base_currency text NOT NULL DEFAULT 'ETB',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS finance_settings_set_tenant ON public.finance_settings;
CREATE TRIGGER finance_settings_set_tenant BEFORE INSERT ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS finance_settings_updated_at ON public.finance_settings;
CREATE TRIGGER finance_settings_updated_at BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View finance settings" ON public.finance_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
CREATE POLICY "Manage finance settings" ON public.finance_settings FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_finance_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));
