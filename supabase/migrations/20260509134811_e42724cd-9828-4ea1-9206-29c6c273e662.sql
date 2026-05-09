
-- 1. Extend sales table for compliance metadata
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_approval_status text,
  ADD COLUMN IF NOT EXISTS void_approved_by uuid,
  ADD COLUMN IF NOT EXISTS void_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS withholding_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mor_qr_payload text,
  ADD COLUMN IF NOT EXISTS mor_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mor_synced_at timestamptz;

-- Block hard-deletes of sales (compliance: must use void)
CREATE OR REPLACE FUNCTION public.prevent_sale_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Sales invoices cannot be deleted (MoR 1099/2025). Use void workflow.';
END;
$$;
DROP TRIGGER IF EXISTS trg_sales_no_delete ON public.sales;
CREATE TRIGGER trg_sales_no_delete BEFORE DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sale_delete();

-- 2. Credit notes
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL,
  original_sale_id uuid NOT NULL REFERENCES public.sales(id),
  original_receipt_id text NOT NULL,
  reason text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  vat numeric NOT NULL DEFAULT 0,
  withholding_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  customer_id uuid,
  branch_id uuid,
  payment_method text,
  cashier_id uuid,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  qr_payload text,
  mor_sync_status text NOT NULL DEFAULT 'pending',
  mor_synced_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number ON public.credit_notes(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON public.credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_sale ON public.credit_notes(original_sale_id);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View credit notes" ON public.credit_notes FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Insert credit notes" ON public.credit_notes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage credit notes" ON public.credit_notes FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_finance_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_credit_notes_set_tenant ON public.credit_notes;
CREATE TRIGGER trg_credit_notes_set_tenant BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 3. Void requests (>7 days)
CREATE TABLE IF NOT EXISTS public.invoice_void_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  receipt_id text NOT NULL,
  reason text NOT NULL,
  days_since_invoice integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text
);
CREATE INDEX IF NOT EXISTS idx_void_req_tenant ON public.invoice_void_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_void_req_status ON public.invoice_void_requests(status);

ALTER TABLE public.invoice_void_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View void requests" ON public.invoice_void_requests FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Insert void requests" ON public.invoice_void_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Update void requests" ON public.invoice_void_requests FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_void_req_set_tenant ON public.invoice_void_requests;
CREATE TRIGGER trg_void_req_set_tenant BEFORE INSERT ON public.invoice_void_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 4. MoR sync queue
CREATE TABLE IF NOT EXISTS public.mor_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,           -- 'invoice' | 'credit_note'
  document_id uuid NOT NULL,
  reference text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mor_queue_tenant ON public.mor_sync_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mor_queue_status ON public.mor_sync_queue(status);

ALTER TABLE public.mor_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View mor queue" ON public.mor_sync_queue FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Insert mor queue" ON public.mor_sync_queue FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
CREATE POLICY "Manage mor queue" ON public.mor_sync_queue FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id) AND is_finance_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_mor_queue_set_tenant ON public.mor_sync_queue;
CREATE TRIGGER trg_mor_queue_set_tenant BEFORE INSERT ON public.mor_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 5. Core void execution function (private)
CREATE OR REPLACE FUNCTION public.execute_sale_void(_sale_id uuid, _reason text, _approver uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale public.sales%ROWTYPE;
  _item record;
  _stock_now numeric;
  _cogs numeric := 0;
  _cash_acct text;
  _cn_id uuid;
  _cn_number text;
  _qr text;
  _credit public.credit_sales%ROWTYPE;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale % not found', _sale_id; END IF;
  IF _sale.status = 'void' THEN RAISE EXCEPTION 'Sale % already voided', _sale.receipt_id; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Reason for cancellation is mandatory (min 5 chars)';
  END IF;

  -- Restore stock + COGS reversal
  FOR _item IN SELECT si.product_id, si.quantity, p.cost
                 FROM public.sale_items si
                 LEFT JOIN public.products p ON p.id = si.product_id
                 WHERE si.sale_id = _sale_id LOOP
    IF _item.product_id IS NOT NULL THEN
      SELECT stock INTO _stock_now FROM public.products WHERE id = _item.product_id FOR UPDATE;
      UPDATE public.products SET stock = COALESCE(_stock_now,0) + _item.quantity, updated_at = now()
        WHERE id = _item.product_id;
      INSERT INTO public.stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after,
                                           reason, reference_type, reference_id, performed_by)
      VALUES (_item.product_id, 'void_return', COALESCE(_stock_now,0), _item.quantity,
              COALESCE(_stock_now,0) + _item.quantity,
              'Invoice voided: ' || _sale.receipt_id, 'sale_void', _sale_id, COALESCE(_approver, auth.uid()));
      _cogs := _cogs + _item.quantity * COALESCE(_item.cost, 0);
    END IF;
  END LOOP;

  -- Reversing journal entry
  _cash_acct := CASE _sale.payment_method
    WHEN 'cash' THEN '1000' WHEN 'telebirr' THEN '1010'
    WHEN 'cbe_birr' THEN '1020' WHEN 'bank_transfer' THEN '1030'
    WHEN 'credit' THEN '1100' ELSE '1000'
  END;
  PERFORM public.post_journal_entry(
    'JE-VOID-' || substring(_sale_id::text,1,8),
    'Void of sale ' || _sale.receipt_id || ' — ' || _reason,
    _sale.receipt_id,
    jsonb_build_array(
      jsonb_build_object('account_code','4000','debit',_sale.subtotal,'credit',0,'description','Reverse revenue'),
      jsonb_build_object('account_code','2100','debit',_sale.vat,    'credit',0,'description','Reverse VAT'),
      jsonb_build_object('account_code',_cash_acct,'debit',0,'credit',_sale.total,'description','Reverse cash/AR'),
      jsonb_build_object('account_code','1200','debit',_cogs,'credit',0,'description','Restore inventory'),
      jsonb_build_object('account_code','5000','debit',0,'credit',_cogs,'description','Reverse COGS')
    )
  );

  -- Unwind credit sale + customer balance
  SELECT * INTO _credit FROM public.credit_sales WHERE sale_id = _sale_id LIMIT 1;
  IF FOUND THEN
    UPDATE public.credit_sales SET status='voided', updated_at=now() WHERE id=_credit.id;
    IF _sale.customer_id IS NOT NULL THEN
      UPDATE public.customers
        SET credit_balance = GREATEST(0, COALESCE(credit_balance,0) - (_credit.total_amount - COALESCE(_credit.paid_amount,0))),
            updated_at = now()
        WHERE id = _sale.customer_id;
    END IF;
  END IF;
  IF _sale.customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET total_purchases = GREATEST(0, COALESCE(total_purchases,0) - _sale.total),
          updated_at = now()
      WHERE id = _sale.customer_id;
  END IF;

  -- Credit note
  _cn_number := 'CN-' || to_char(now(),'YYYYMMDD') || '-' || substring(_sale_id::text,1,8);
  _qr := json_build_object(
    'type','credit_note','number',_cn_number,'origReceipt',_sale.receipt_id,
    'total',_sale.total,'vat',_sale.vat,'wht',_sale.withholding_amount,
    'tenant',_sale.tenant_id,'issuedAt', now()
  )::text;
  INSERT INTO public.credit_notes (
    tenant_id, credit_note_number, original_sale_id, original_receipt_id, reason,
    subtotal, vat, withholding_amount, total, customer_id, branch_id, payment_method,
    cashier_id, issued_by, qr_payload
  ) VALUES (
    _sale.tenant_id, _cn_number, _sale_id, _sale.receipt_id, _reason,
    _sale.subtotal, _sale.vat, _sale.withholding_amount, _sale.total,
    _sale.customer_id, _sale.branch_id, _sale.payment_method,
    _sale.cashier_id, COALESCE(_approver, auth.uid()), _qr
  ) RETURNING id INTO _cn_id;

  -- Update sale itself
  UPDATE public.sales
    SET status='void',
        void_reason=_reason,
        voided_at=now(),
        voided_by=COALESCE(_approver, auth.uid()),
        void_approval_status = CASE WHEN _approver IS NOT NULL THEN 'approved' ELSE 'auto' END,
        void_approved_by = _approver,
        void_approved_at = CASE WHEN _approver IS NOT NULL THEN now() ELSE NULL END,
        mor_sync_status='pending'
    WHERE id=_sale_id;

  -- Queue MoR sync for both sale void + credit note
  INSERT INTO public.mor_sync_queue (tenant_id, document_type, document_id, reference, payload)
  VALUES (_sale.tenant_id, 'invoice_void', _sale_id, _sale.receipt_id,
          jsonb_build_object('receipt',_sale.receipt_id,'reason',_reason,'voidedAt',now())),
         (_sale.tenant_id, 'credit_note', _cn_id, _cn_number,
          jsonb_build_object('creditNote',_cn_number,'origReceipt',_sale.receipt_id,'total',_sale.total));

  -- Audit
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, severity, after_data)
  VALUES (_sale.tenant_id, COALESCE(_approver,auth.uid()), 'invoice_voided', 'sales', _sale_id, 'warning',
          jsonb_build_object('receipt',_sale.receipt_id,'reason',_reason,'creditNote',_cn_number));

  RETURN _cn_id;
END;
$$;

-- 6. Public entry point: cashier/admin requests a void
CREATE OR REPLACE FUNCTION public.request_void_sale(_sale_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale public.sales%ROWTYPE;
  _days integer;
  _req_id uuid;
  _cn_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role) OR is_finance_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to void invoices';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Reason for cancellation is mandatory (min 5 chars)';
  END IF;
  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF _sale.tenant_id <> current_tenant_id() THEN RAISE EXCEPTION 'Cross-tenant operation blocked'; END IF;
  IF _sale.status = 'void' THEN RAISE EXCEPTION 'Already voided'; END IF;

  _days := EXTRACT(DAY FROM (now() - _sale.created_at))::int;

  IF _days <= 7 THEN
    _cn_id := public.execute_sale_void(_sale_id, _reason, NULL);
    RETURN jsonb_build_object('status','voided','credit_note_id',_cn_id,'days_since',_days);
  ELSE
    INSERT INTO public.invoice_void_requests (sale_id, receipt_id, reason, days_since_invoice, requested_by)
    VALUES (_sale_id, _sale.receipt_id, _reason, _days, auth.uid())
    RETURNING id INTO _req_id;
    UPDATE public.sales SET void_approval_status='pending_review' WHERE id=_sale_id;
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, severity, after_data)
    VALUES (_sale.tenant_id, auth.uid(), 'void_request_filed', 'sales', _sale_id, 'warning',
            jsonb_build_object('reason',_reason,'days',_days,'request_id',_req_id));
    RETURN jsonb_build_object('status','pending_admin_approval','request_id',_req_id,'days_since',_days);
  END IF;
END;
$$;

-- 7. Admin approves/rejects late void
CREATE OR REPLACE FUNCTION public.approve_void_request(_request_id uuid, _decision text, _notes text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req public.invoice_void_requests%ROWTYPE;
  _cn_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can approve void requests';
  END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO _req FROM public.invoice_void_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF _decision = 'approve' THEN
    _cn_id := public.execute_sale_void(_req.sale_id, _req.reason, auth.uid());
    UPDATE public.invoice_void_requests
      SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), review_notes=_notes
      WHERE id=_request_id;
    RETURN jsonb_build_object('status','approved','credit_note_id',_cn_id);
  ELSE
    UPDATE public.invoice_void_requests
      SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), review_notes=_notes
      WHERE id=_request_id;
    UPDATE public.sales SET void_approval_status='rejected' WHERE id=_req.sale_id;
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, severity, after_data)
    VALUES (_req.tenant_id, auth.uid(), 'void_request_rejected', 'sales', _req.sale_id, 'info',
            jsonb_build_object('notes',_notes));
    RETURN jsonb_build_object('status','rejected');
  END IF;
END;
$$;
