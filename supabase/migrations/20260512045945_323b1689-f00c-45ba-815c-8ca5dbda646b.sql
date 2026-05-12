-- 1. Branches: auto-set tenant_id so RLS WITH CHECK passes
DROP TRIGGER IF EXISTS trg_branches_set_tenant ON public.branches;
CREATE TRIGGER trg_branches_set_tenant
BEFORE INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 2. POS: deduct stock when sale_items are inserted
DROP TRIGGER IF EXISTS trg_sale_item_stock ON public.sale_items;
CREATE TRIGGER trg_sale_item_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_insert();

-- 3. Sales: auto-post journal entry (revenue/VAT/COGS)
DROP TRIGGER IF EXISTS trg_sales_journal ON public.sales;
CREATE TRIGGER trg_sales_journal
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_insert();

-- 4. Credit payments: auto journal
DROP TRIGGER IF EXISTS trg_credit_payment_journal ON public.credit_payments;
CREATE TRIGGER trg_credit_payment_journal
AFTER INSERT ON public.credit_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_credit_payment_insert();

-- 5. Payroll approval -> JE
DROP TRIGGER IF EXISTS trg_payroll_journal ON public.payroll_runs;
CREATE TRIGGER trg_payroll_journal
AFTER UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.handle_payroll_approval();

-- 6. GRN -> JE
DROP TRIGGER IF EXISTS trg_grn_journal ON public.goods_receipts;
CREATE TRIGGER trg_grn_journal
AFTER INSERT ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.handle_grn_insert();

-- 7. Stock transfers received -> stock movement
DROP TRIGGER IF EXISTS trg_transfer_received ON public.stock_transfers;
CREATE TRIGGER trg_transfer_received
AFTER UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_received();

-- 8. Employee documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- id, cv, certificate, contract, other
  title text NOT NULL,
  file_url text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON public.employee_documents(employee_id);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_employee_documents_set_tenant ON public.employee_documents;
CREATE TRIGGER trg_employee_documents_set_tenant
BEFORE INSERT ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_employee_documents_updated ON public.employee_documents;
CREATE TRIGGER trg_employee_documents_updated
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "HR view employee docs"
ON public.employee_documents FOR SELECT TO authenticated
USING (
  tenant_id = current_tenant_id() AND belongs_to_company(tenant_id)
  AND (
    is_hr_staff(auth.uid())
    OR employee_id = get_employee_id_for_user(auth.uid())
  )
);

CREATE POLICY "HR manage employee docs"
ON public.employee_documents FOR ALL TO authenticated
USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_hr_staff(auth.uid()))
WITH CHECK (belongs_to_company(tenant_id) AND is_hr_staff(auth.uid()));