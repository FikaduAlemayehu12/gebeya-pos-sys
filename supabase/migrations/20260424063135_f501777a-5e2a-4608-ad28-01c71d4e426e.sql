
-- =====================================================
-- PHASE 1: CROSS-MODULE INTEGRATION (Triggers + Seed)
-- =====================================================

-- 1) Seed default Chart of Accounts (Ethiopian standard)
INSERT INTO public.accounts (code, name, type, balance, is_active) VALUES
  ('1000', 'Cash on Hand',          'asset',     0, true),
  ('1010', 'Bank - Telebirr',       'asset',     0, true),
  ('1020', 'Bank - CBE',            'asset',     0, true),
  ('1030', 'Bank - Other',          'asset',     0, true),
  ('1100', 'Accounts Receivable',   'asset',     0, true),
  ('1200', 'Inventory',             'asset',     0, true),
  ('1500', 'Fixed Assets',          'asset',     0, true),
  ('2000', 'Accounts Payable',      'liability', 0, true),
  ('2100', 'VAT Payable',           'liability', 0, true),
  ('2200', 'PAYE Tax Payable',      'liability', 0, true),
  ('2300', 'Pension Payable',       'liability', 0, true),
  ('2400', 'Net Salary Payable',    'liability', 0, true),
  ('3000', 'Owner Equity',          'equity',    0, true),
  ('4000', 'Sales Revenue',         'revenue',   0, true),
  ('5000', 'Cost of Goods Sold',    'expense',   0, true),
  ('5100', 'Salary Expense',        'expense',   0, true),
  ('5110', 'Allowance Expense',     'expense',   0, true),
  ('5120', 'Pension Expense (Employer)', 'expense', 0, true)
ON CONFLICT (code) DO NOTHING;

-- 2) Helper: get account id by code
CREATE OR REPLACE FUNCTION public.account_id_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts WHERE code = _code LIMIT 1;
$$;

-- 3) Helper: post a balanced journal entry from a JSON array of {account_code, debit, credit, description}
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  _entry_code text,
  _description text,
  _reference text,
  _lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _journal_id uuid;
  _line jsonb;
  _acct uuid;
  _debit numeric;
  _credit numeric;
  _total_d numeric := 0;
  _total_c numeric := 0;
BEGIN
  -- compute totals
  FOR _line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    _total_d := _total_d + COALESCE((_line->>'debit')::numeric, 0);
    _total_c := _total_c + COALESCE((_line->>'credit')::numeric, 0);
  END LOOP;

  -- skip if zero (avoid noise journals)
  IF _total_d = 0 AND _total_c = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.journal_entries (entry_code, entry_date, description, reference, total_debit, total_credit, status)
  VALUES (_entry_code, CURRENT_DATE, _description, _reference, _total_d, _total_c, 'posted')
  RETURNING id INTO _journal_id;

  FOR _line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    _acct := public.account_id_by_code(_line->>'account_code');
    IF _acct IS NULL THEN CONTINUE; END IF;
    _debit  := COALESCE((_line->>'debit')::numeric, 0);
    _credit := COALESCE((_line->>'credit')::numeric, 0);
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (_journal_id, _acct, _debit, _credit, _line->>'description');

    -- update account balance (assets+expenses normal debit; liabilities+equity+revenue normal credit)
    UPDATE public.accounts a
       SET balance = a.balance + CASE
             WHEN a.type IN ('asset','expense') THEN (_debit - _credit)
             ELSE (_credit - _debit)
           END,
           updated_at = now()
     WHERE a.id = _acct;
  END LOOP;

  RETURN _journal_id;
END;
$$;

-- 4) TRIGGER: POS sale completion
--    sale_items inserted -> deduct stock + log movement + post journal
CREATE OR REPLACE FUNCTION public.handle_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stock_before numeric;
  _stock_after  numeric;
  _cost numeric;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT stock, cost INTO _stock_before, _cost
  FROM public.products WHERE id = NEW.product_id FOR UPDATE;

  IF _stock_before IS NULL THEN RETURN NEW; END IF;

  _stock_after := GREATEST(0, _stock_before - NEW.quantity);

  UPDATE public.products SET stock = _stock_after, updated_at = now() WHERE id = NEW.product_id;

  INSERT INTO public.stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, reason, reference_type, reference_id, performed_by)
  VALUES (NEW.product_id, 'sale', _stock_before, -NEW.quantity, _stock_after, 'POS sale', 'sale', NEW.sale_id, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_item_insert ON public.sale_items;
CREATE TRIGGER trg_sale_item_insert
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_insert();

-- After sale row is committed, post the journal entry (one journal per sale)
CREATE OR REPLACE FUNCTION public.handle_sale_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cogs numeric := 0;
  _cash_acct text;
BEGIN
  -- compute COGS from sale_items joined to products
  SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost,0)), 0) INTO _cogs
  FROM public.sale_items si LEFT JOIN public.products p ON p.id = si.product_id
  WHERE si.sale_id = NEW.id;

  -- pick cash/bank account by payment method
  _cash_acct := CASE NEW.payment_method
    WHEN 'cash'          THEN '1000'
    WHEN 'telebirr'      THEN '1010'
    WHEN 'cbe_birr'      THEN '1020'
    WHEN 'bank_transfer' THEN '1030'
    WHEN 'credit'        THEN '1100'  -- AR
    ELSE '1000'
  END;

  PERFORM public.post_journal_entry(
    'JE-SALE-' || substring(NEW.id::text, 1, 8),
    'POS Sale ' || NEW.receipt_id,
    NEW.receipt_id,
    jsonb_build_array(
      jsonb_build_object('account_code', _cash_acct, 'debit', NEW.total,  'credit', 0,        'description', 'Sale receipt'),
      jsonb_build_object('account_code', '4000',     'debit', 0,          'credit', NEW.subtotal, 'description', 'Revenue'),
      jsonb_build_object('account_code', '2100',     'debit', 0,          'credit', NEW.vat,   'description', 'VAT collected'),
      jsonb_build_object('account_code', '5000',     'debit', _cogs,      'credit', 0,        'description', 'COGS'),
      jsonb_build_object('account_code', '1200',     'debit', 0,          'credit', _cogs,    'description', 'Inventory consumed')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_insert ON public.sales;
CREATE TRIGGER trg_sale_insert
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_insert();

-- 5) TRIGGER: Goods Receipt -> increase stock, post AP journal
CREATE OR REPLACE FUNCTION public.handle_grn_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total IS NULL OR NEW.total = 0 THEN RETURN NEW; END IF;

  PERFORM public.post_journal_entry(
    'JE-GRN-' || substring(NEW.id::text, 1, 8),
    'Goods Received: ' || NEW.grn_number,
    NEW.grn_number,
    jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit', NEW.total, 'credit', 0, 'description', 'Inventory received'),
      jsonb_build_object('account_code', '2000', 'debit', 0, 'credit', NEW.total, 'description', 'Payable to supplier')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grn_insert ON public.goods_receipts;
CREATE TRIGGER trg_grn_insert
AFTER INSERT ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.handle_grn_insert();

-- 6) TRIGGER: Payroll run approved -> post salary journal
CREATE OR REPLACE FUNCTION public.handle_payroll_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM public.post_journal_entry(
      'JE-PAY-' || substring(NEW.id::text, 1, 8),
      'Payroll ' || NEW.run_code || ' (' || NEW.period_month || '/' || NEW.period_year || ')',
      NEW.run_code,
      jsonb_build_array(
        jsonb_build_object('account_code', '5100', 'debit', NEW.total_gross,            'credit', 0, 'description', 'Gross salary expense'),
        jsonb_build_object('account_code', '5120', 'debit', NEW.total_employer_pension, 'credit', 0, 'description', 'Employer pension'),
        jsonb_build_object('account_code', '2200', 'debit', 0, 'credit', NEW.total_paye,             'description', 'PAYE withheld'),
        jsonb_build_object('account_code', '2300', 'debit', 0, 'credit', NEW.total_employee_pension + NEW.total_employer_pension, 'description', 'Pension payable'),
        jsonb_build_object('account_code', '2400', 'debit', 0, 'credit', NEW.total_net,              'description', 'Net pay payable'),
        jsonb_build_object('account_code', '2000', 'debit', 0, 'credit', NEW.total_loan_deductions,  'description', 'Loan recovery')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_approval ON public.payroll_runs;
CREATE TRIGGER trg_payroll_approval
AFTER UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.handle_payroll_approval();

-- 7) TRIGGER: Credit payment -> post Cash Dr / AR Cr
CREATE OR REPLACE FUNCTION public.handle_credit_payment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cash_acct text;
BEGIN
  _cash_acct := CASE NEW.payment_method
    WHEN 'cash'          THEN '1000'
    WHEN 'telebirr'      THEN '1010'
    WHEN 'cbe_birr'      THEN '1020'
    WHEN 'bank_transfer' THEN '1030'
    ELSE '1000'
  END;

  PERFORM public.post_journal_entry(
    'JE-CR-' || substring(NEW.id::text, 1, 8),
    'Credit collection',
    NEW.id::text,
    jsonb_build_array(
      jsonb_build_object('account_code', _cash_acct, 'debit', NEW.amount, 'credit', 0,           'description', 'Customer payment received'),
      jsonb_build_object('account_code', '1100',     'debit', 0,          'credit', NEW.amount,  'description', 'AR settled')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_payment_insert ON public.credit_payments;
CREATE TRIGGER trg_credit_payment_insert
AFTER INSERT ON public.credit_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_credit_payment_insert();

-- 8) TRIGGER: Stock transfer received -> move stock between branches & log movements
CREATE OR REPLACE FUNCTION public.handle_transfer_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item record;
  _stock_src numeric;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR _item IN SELECT product_id, quantity FROM public.stock_transfer_items WHERE transfer_id = NEW.id LOOP
      SELECT stock INTO _stock_src FROM public.products WHERE id = _item.product_id FOR UPDATE;
      IF _stock_src IS NOT NULL THEN
        UPDATE public.products SET stock = GREATEST(0, _stock_src - _item.quantity), updated_at = now()
         WHERE id = _item.product_id;
        INSERT INTO public.stock_movements (product_id, branch_id, movement_type, quantity_before, quantity_change, quantity_after, reason, reference_type, reference_id, performed_by)
        VALUES (_item.product_id, NEW.source_branch_id, 'transfer_out', _stock_src, -_item.quantity, GREATEST(0,_stock_src - _item.quantity), 'Transfer ' || NEW.transfer_code, 'transfer', NEW.id, auth.uid());
        INSERT INTO public.stock_movements (product_id, branch_id, movement_type, quantity_before, quantity_change, quantity_after, reason, reference_type, reference_id, performed_by)
        VALUES (_item.product_id, NEW.destination_branch_id, 'transfer_in', 0, _item.quantity, _item.quantity, 'Transfer ' || NEW.transfer_code, 'transfer', NEW.id, auth.uid());
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_received ON public.stock_transfers;
CREATE TRIGGER trg_transfer_received
AFTER UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_received();
