
-- ============================================
-- Unified ERP: Bizflow + Abyssinia ERP Ecosystem
-- ============================================

-- 1. Roles enum (combined from both projects)
CREATE TYPE public.app_role AS ENUM (
  'admin', 'cashier', 'inventory_manager', 'hr_admin', 'payroll_officer',
  'manager', 'employee', 'finance_manager', 'auditor', 'branch_manager',
  'procurement', 'user'
);

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  father_name TEXT DEFAULT '',
  grandfather_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_by_admin UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by_admin);

-- 3. User roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'full',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles viewable by authed" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Auto profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, name_am TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'pcs',
  barcode TEXT, expiry_date DATE, variants JSONB, description TEXT,
  image_url TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inventory_manager') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inventory_manager'));

-- 7. Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, name_am TEXT DEFAULT '',
  phone TEXT DEFAULT '', alt_phone TEXT DEFAULT '', email TEXT DEFAULT '',
  city TEXT DEFAULT '', sub_city TEXT DEFAULT '', woreda TEXT DEFAULT '', kebele TEXT DEFAULT '',
  trust INTEGER NOT NULL DEFAULT 3, total_purchases NUMERIC DEFAULT 0, credit_balance NUMERIC DEFAULT 0,
  guarantor_name TEXT DEFAULT '', guarantor_phone TEXT DEFAULT '',
  gov_id TEXT DEFAULT '', notes TEXT DEFAULT '',
  photo_url TEXT DEFAULT '', id_document_url TEXT DEFAULT '', id_document_back_url TEXT DEFAULT '',
  telegram_chat_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

-- 8. Sales + sale items
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  cashier_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL, product_name_am TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert sale items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

-- 9. Credit sales + payments
CREATE TABLE public.credit_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB',
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View credit sales" ON public.credit_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage credit sales" ON public.credit_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

CREATE TABLE public.credit_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_sale_id UUID NOT NULL REFERENCES public.credit_sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT, collected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View credit payments" ON public.credit_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert credit payments" ON public.credit_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

-- 10. Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info', related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own notifs" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own notifs" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert notifs by staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'hr_admin'));

-- 11. Exchange rates
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL DEFAULT 'ETB',
  rate NUMERIC NOT NULL, source TEXT DEFAULT 'manual',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert rates" ON public.exchange_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 12. POS activity logs + Z reports
CREATE TABLE public.pos_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  details JSONB, sale_id UUID, product_id UUID, customer_id UUID, amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View activity" ON public.pos_activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own activity" ON public.pos_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.z_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL, shift TEXT DEFAULT 'day',
  opened_by UUID, closed_by UUID,
  opening_balance NUMERIC NOT NULL DEFAULT 0, closing_balance NUMERIC NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0, total_vat NUMERIC NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  cash_sales NUMERIC NOT NULL DEFAULT 0, telebirr_sales NUMERIC NOT NULL DEFAULT 0,
  cbe_birr_sales NUMERIC NOT NULL DEFAULT 0, bank_transfer_sales NUMERIC NOT NULL DEFAULT 0,
  credit_sales_total NUMERIC NOT NULL DEFAULT 0,
  cash_in NUMERIC NOT NULL DEFAULT 0, cash_out NUMERIC NOT NULL DEFAULT 0,
  refunds NUMERIC NOT NULL DEFAULT 0, discounts NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), closed_at TIMESTAMPTZ
);
ALTER TABLE public.z_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View z reports" ON public.z_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage z reports" ON public.z_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));

-- 13. Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, code TEXT UNIQUE NOT NULL,
  address TEXT DEFAULT '', city TEXT DEFAULT '', phone TEXT DEFAULT '',
  manager_user_id UUID, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL, full_name_am TEXT DEFAULT '',
  email TEXT DEFAULT '', phone TEXT DEFAULT '', gender TEXT DEFAULT '',
  date_of_birth DATE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  position TEXT DEFAULT '', department TEXT DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  status TEXT NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date DATE,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  transport_allowance NUMERIC NOT NULL DEFAULT 0,
  housing_allowance NUMERIC NOT NULL DEFAULT 0,
  position_allowance NUMERIC NOT NULL DEFAULT 0,
  other_allowance NUMERIC NOT NULL DEFAULT 0,
  bank_name TEXT DEFAULT '', bank_account TEXT DEFAULT '',
  tin_number TEXT DEFAULT '', pension_number TEXT DEFAULT '',
  emergency_contact_name TEXT DEFAULT '', emergency_contact_phone TEXT DEFAULT '',
  address TEXT DEFAULT '', photo_url TEXT DEFAULT '', notes TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_branch ON public.employees(branch_id);
CREATE INDEX idx_employees_user ON public.employees(user_id);
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_hr_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','hr_admin','payroll_officer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_branch_manager(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.branches WHERE id = _branch_id AND manager_user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_finance_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','finance_manager','auditor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_procurement_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','procurement','inventory_manager')
  );
$$;

-- BRANCHES rls
CREATE POLICY "View branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));

-- EMPLOYEES rls
CREATE POLICY "View employees" ON public.employees FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR user_id = auth.uid() OR public.is_branch_manager(auth.uid(), branch_id)
);
CREATE POLICY "Manage employees" ON public.employees FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));

-- 15. Attendance, leaves, loans, payroll
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ, clock_out TIMESTAMPTZ,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT DEFAULT '', recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View attendance" ON public.attendance FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
  OR public.is_branch_manager(auth.uid(), branch_id)
);
CREATE POLICY "Manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
    OR public.is_branch_manager(auth.uid(), branch_id))
  WITH CHECK (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
    OR public.is_branch_manager(auth.uid(), branch_id));

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  leave_type TEXT NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  days_count NUMERIC NOT NULL DEFAULT 1,
  reason TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID, approved_at TIMESTAMPTZ,
  rejection_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leave_updated BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View leaves" ON public.leave_requests FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
  OR public.is_branch_manager(auth.uid(), branch_id)
);
CREATE POLICY "Insert leaves" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid()));
CREATE POLICY "Update leaves" ON public.leave_requests FOR UPDATE TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR public.is_branch_manager(auth.uid(), branch_id)
);

CREATE TABLE public.employee_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_deduction NUMERIC NOT NULL DEFAULT 0,
  remaining_balance NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date DATE,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '', approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View loans" ON public.employee_loans FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
);
CREATE POLICY "Manage loans" ON public.employee_loans FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));

CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code TEXT UNIQUE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  period_month INTEGER NOT NULL, period_year INTEGER NOT NULL,
  pay_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_gross NUMERIC NOT NULL DEFAULT 0,
  total_paye NUMERIC NOT NULL DEFAULT 0,
  total_employee_pension NUMERIC NOT NULL DEFAULT 0,
  total_employer_pension NUMERIC NOT NULL DEFAULT 0,
  total_loan_deductions NUMERIC NOT NULL DEFAULT 0,
  total_other_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID, approved_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR public.is_branch_manager(auth.uid(), branch_id)
);
CREATE POLICY "Manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));

CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  period_month INTEGER NOT NULL, period_year INTEGER NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  transport_allowance NUMERIC NOT NULL DEFAULT 0,
  housing_allowance NUMERIC NOT NULL DEFAULT 0,
  position_allowance NUMERIC NOT NULL DEFAULT 0,
  other_allowance NUMERIC NOT NULL DEFAULT 0,
  overtime_amount NUMERIC NOT NULL DEFAULT 0, bonus NUMERIC NOT NULL DEFAULT 0,
  gross_pay NUMERIC NOT NULL DEFAULT 0, taxable_income NUMERIC NOT NULL DEFAULT 0,
  paye_tax NUMERIC NOT NULL DEFAULT 0,
  employee_pension NUMERIC NOT NULL DEFAULT 0, employer_pension NUMERIC NOT NULL DEFAULT 0,
  loan_deduction NUMERIC NOT NULL DEFAULT 0, other_deductions NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0, net_pay NUMERIC NOT NULL DEFAULT 0,
  days_worked NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payslips_updated BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View payslips" ON public.payslips FOR SELECT TO authenticated USING (
  public.is_hr_staff(auth.uid()) OR employee_id = public.get_employee_id_for_user(auth.uid())
);
CREATE POLICY "Manage payslips" ON public.payslips FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));

-- 16. FINANCE: chart of accounts, journal entries, accounts payable
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- asset, liability, equity, revenue, expense
  parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage accounts" ON public.accounts FOR ALL TO authenticated
  USING (public.is_finance_staff(auth.uid())) WITH CHECK (public.is_finance_staff(auth.uid()));

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_code TEXT UNIQUE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT DEFAULT '',
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'posted',
  reference TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View journals" ON public.journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage journals" ON public.journal_entries FOR ALL TO authenticated
  USING (public.is_finance_staff(auth.uid())) WITH CHECK (public.is_finance_staff(auth.uid()));

CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  description TEXT DEFAULT ''
);
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View journal lines" ON public.journal_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage journal lines" ON public.journal_lines FOR ALL TO authenticated
  USING (public.is_finance_staff(auth.uid())) WITH CHECK (public.is_finance_staff(auth.uid()));

CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT UNIQUE NOT NULL,
  requester_id UUID,
  payee TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB',
  reason TEXT DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID, approved_at TIMESTAMPTZ,
  payment_method TEXT DEFAULT 'bank_transfer',
  paid_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payreq_updated BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View payment requests" ON public.payment_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert payment requests" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Approve payment requests" ON public.payment_requests FOR UPDATE TO authenticated
  USING (public.is_finance_staff(auth.uid()));

-- 17. PROCUREMENT: suppliers, purchase orders, GRN
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'general',
  contact_person TEXT DEFAULT '',
  phone TEXT DEFAULT '', email TEXT DEFAULT '',
  address TEXT DEFAULT '', city TEXT DEFAULT '',
  tin_number TEXT DEFAULT '',
  license_expiry DATE,
  payment_terms TEXT DEFAULT 'net_30',
  rating NUMERIC NOT NULL DEFAULT 3,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_procurement_staff(auth.uid())) WITH CHECK (public.is_procurement_staff(auth.uid()));

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, pending_approval, approved, sent, partial, delivered, closed, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB',
  notes TEXT DEFAULT '',
  created_by UUID, approved_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View POs" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage POs" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.is_procurement_staff(auth.uid())) WITH CHECK (public.is_procurement_staff(auth.uid()));

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  received_qty NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View PO items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage PO items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.is_procurement_staff(auth.uid())) WITH CHECK (public.is_procurement_staff(auth.uid()));

CREATE TABLE public.goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'received',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  received_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View GRNs" ON public.goods_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage GRNs" ON public.goods_receipts FOR ALL TO authenticated
  USING (public.is_procurement_staff(auth.uid())) WITH CHECK (public.is_procurement_staff(auth.uid()));

-- 18. AUDIT logs (system-wide)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE POLICY "View audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor')
);
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 19. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('customer-docs','customer-docs', true),
  ('product-images','product-images', true),
  ('employee-docs','employee-docs', false),
  ('finance-docs','finance-docs', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Upload customer docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer-docs');
CREATE POLICY "View customer docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'customer-docs');
CREATE POLICY "Update customer docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'customer-docs');

CREATE POLICY "Upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "View product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "Upload employee docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-docs');
CREATE POLICY "View employee docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'employee-docs' AND public.is_hr_staff(auth.uid()));

CREATE POLICY "Upload finance docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'finance-docs' AND public.is_finance_staff(auth.uid()));
CREATE POLICY "View finance docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'finance-docs' AND public.is_finance_staff(auth.uid()));

-- 20. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_payments;
