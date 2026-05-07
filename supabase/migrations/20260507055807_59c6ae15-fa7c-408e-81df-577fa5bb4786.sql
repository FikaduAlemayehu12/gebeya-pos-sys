
-- ───────── PROCUREMENT: Purchase Requests ─────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  pr_number text NOT NULL,
  branch_id uuid,
  department text DEFAULT '',
  requester_id uuid,
  required_date date,
  urgency text NOT NULL DEFAULT 'normal',
  justification text DEFAULT '',
  budget_code text DEFAULT '',
  preferred_supplier_id uuid,
  estimated_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ETB',
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  pr_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id uuid,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'pcs',
  estimated_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── PROCUREMENT: RFQs ─────────
CREATE TABLE IF NOT EXISTS public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  rfq_number text NOT NULL,
  pr_id uuid,
  title text NOT NULL,
  description text DEFAULT '',
  closing_date date,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'pcs',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  total_price numeric NOT NULL DEFAULT 0,
  delivery_days integer DEFAULT 0,
  payment_terms text DEFAULT '',
  warranty text DEFAULT '',
  notes text DEFAULT '',
  score numeric NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── PROCUREMENT: Supplier Invoices + 3-way match ─────────
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  invoice_number text NOT NULL,
  supplier_id uuid NOT NULL,
  po_id uuid,
  grn_id uuid,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  vat numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ETB',
  match_status text NOT NULL DEFAULT 'pending', -- matched | mismatch | pending
  match_notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | paid | rejected
  approved_by uuid,
  approved_at timestamptz,
  document_url text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── PROCUREMENT: Contracts ─────────
CREATE TABLE IF NOT EXISTS public.supplier_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contract_number text NOT NULL,
  supplier_id uuid NOT NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  contract_value numeric NOT NULL DEFAULT 0,
  used_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ETB',
  terms text DEFAULT '',
  document_url text DEFAULT '',
  status text NOT NULL DEFAULT 'active', -- active | expired | terminated
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── PROCUREMENT: Supplier compliance docs ─────────
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  supplier_id uuid NOT NULL,
  doc_type text NOT NULL, -- trade_license | vat_cert | tin | iso | other
  doc_number text DEFAULT '',
  issued_date date,
  expiry_date date,
  document_url text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add suppliers extension columns (only if missing)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tin text DEFAULT '',
  ADD COLUMN IF NOT EXISTS vat_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_time_delivery_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score numeric NOT NULL DEFAULT 0;

-- ───────── PROCUREMENT: Tender bookmarks ─────────
CREATE TABLE IF NOT EXISTS public.tender_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  title text NOT NULL,
  source text DEFAULT '2merkato', -- 2merkato | gov_portal | other
  url text NOT NULL,
  deadline date,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── BRANCHES: Targets ─────────
CREATE TABLE IF NOT EXISTS public.branch_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid NOT NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  sales_target numeric NOT NULL DEFAULT 0,
  profit_target numeric NOT NULL DEFAULT 0,
  collections_target numeric NOT NULL DEFAULT 0,
  customer_target integer NOT NULL DEFAULT 0,
  expense_cap numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, period_year, period_month)
);

-- Branch region for roll-up (optional column)
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS region text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gps_lat numeric,
  ADD COLUMN IF NOT EXISTS gps_lng numeric,
  ADD COLUMN IF NOT EXISTS opening_hours text DEFAULT '';

-- ───────── BRANCHES: Cash position snapshots ─────────
CREATE TABLE IF NOT EXISTS public.branch_cash_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  cash_balance numeric NOT NULL DEFAULT 0,
  petty_cash numeric NOT NULL DEFAULT 0,
  bank_balance numeric NOT NULL DEFAULT 0,
  expected_deposit numeric NOT NULL DEFAULT 0,
  shortage numeric NOT NULL DEFAULT 0,
  overage numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── BRANCHES: Inter-branch cash & staff transfers ─────────
CREATE TABLE IF NOT EXISTS public.branch_resource_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  transfer_code text NOT NULL,
  resource_type text NOT NULL, -- cash | asset | staff
  source_branch_id uuid NOT NULL,
  destination_branch_id uuid NOT NULL,
  amount numeric DEFAULT 0,
  asset_id uuid,
  employee_id uuid,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | received | cancelled
  approved_by uuid,
  approved_at timestamptz,
  received_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── Triggers: tenant_id + updated_at ─────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'purchase_requests','purchase_request_items','rfqs','rfq_items','quotations',
    'supplier_invoices','supplier_contracts','supplier_documents','tender_bookmarks',
    'branch_targets','branch_cash_positions','branch_resource_transfers'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_%I ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER set_tenant_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();', t, t);
  END LOOP;
END $$;

CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rfq_updated BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_si_updated BEFORE UPDATE ON public.supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.supplier_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bt_updated BEFORE UPDATE ON public.branch_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_brt_updated BEFORE UPDATE ON public.branch_resource_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────── RLS ─────────
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_cash_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_resource_transfers ENABLE ROW LEVEL SECURITY;

-- View policies (any tenant member)
CREATE POLICY "View PRs" ON public.purchase_requests FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage PRs" ON public.purchase_requests FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View PR items" ON public.purchase_request_items FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage PR items" ON public.purchase_request_items FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View RFQs" ON public.rfqs FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage RFQs" ON public.rfqs FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View RFQ items" ON public.rfq_items FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage RFQ items" ON public.rfq_items FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View quotations" ON public.quotations FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage quotations" ON public.quotations FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View invoices" ON public.supplier_invoices FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage invoices" ON public.supplier_invoices FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (is_procurement_staff(auth.uid()) OR is_finance_staff(auth.uid())))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View contracts" ON public.supplier_contracts FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage contracts" ON public.supplier_contracts FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View supplier docs" ON public.supplier_documents FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage supplier docs" ON public.supplier_documents FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_procurement_staff(auth.uid()))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View tenders" ON public.tender_bookmarks FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage tenders" ON public.tender_bookmarks FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View branch targets" ON public.branch_targets FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage branch targets" ON public.branch_targets FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND (is_hr_staff(auth.uid()) OR is_finance_staff(auth.uid())))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View cash positions" ON public.branch_cash_positions FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage cash positions" ON public.branch_cash_positions FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

CREATE POLICY "View resource transfers" ON public.branch_resource_transfers FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage resource transfers" ON public.branch_resource_transfers FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id))
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));

-- Storage bucket for procurement documents
INSERT INTO storage.buckets (id, name, public) VALUES ('procurement-docs','procurement-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Procurement docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'procurement-docs');
CREATE POLICY "Procurement docs write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procurement-docs');
CREATE POLICY "Procurement docs update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'procurement-docs');
