
-- 1. Branch logo
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. MoR retry engine columns
ALTER TABLE public.mor_sync_queue
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS worker_id text;
CREATE INDEX IF NOT EXISTS idx_mor_queue_next ON public.mor_sync_queue(next_attempt_at) WHERE status IN ('pending','failed');

-- 3. Disposals
CREATE TABLE IF NOT EXISTS public.product_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  disposal_type text NOT NULL DEFAULT 'expired' CHECK (disposal_type IN ('expired','damaged','recall','return','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed')),
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disposals_tenant ON public.product_disposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disposals_status ON public.product_disposals(status);
ALTER TABLE public.product_disposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view disposals" ON public.product_disposals;
CREATE POLICY "view disposals" ON public.product_disposals FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
DROP POLICY IF EXISTS "insert disposals" ON public.product_disposals;
CREATE POLICY "insert disposals" ON public.product_disposals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND belongs_to_company(tenant_id));
DROP POLICY IF EXISTS "manage disposals" ON public.product_disposals;
CREATE POLICY "manage disposals" ON public.product_disposals FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND (is_finance_staff(auth.uid()) OR is_procurement_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
DROP TRIGGER IF EXISTS trg_disposals_set_tenant ON public.product_disposals;
CREATE TRIGGER trg_disposals_set_tenant BEFORE INSERT ON public.product_disposals
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 4. FEFO consume on sale_items insert
CREATE OR REPLACE FUNCTION public.fefo_consume_batches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _remaining numeric := NEW.quantity;
  _batch record;
  _take numeric;
BEGIN
  IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity <= 0 THEN RETURN NEW; END IF;
  FOR _batch IN
    SELECT id, quantity, expiry_date
    FROM public.product_batches
    WHERE product_id = NEW.product_id AND status = 'active' AND quantity > 0
    ORDER BY expiry_date NULLS LAST, received_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(_batch.quantity, _remaining);
    UPDATE public.product_batches
       SET quantity = quantity - _take,
           status = CASE WHEN quantity - _take <= 0 THEN 'depleted' ELSE status END,
           updated_at = now()
     WHERE id = _batch.id;
    INSERT INTO public.stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after,
                                        reason, reference_type, reference_id, performed_by, batch_id)
    VALUES (NEW.product_id, 'fefo_consume', _batch.quantity, -_take, _batch.quantity - _take,
            'FEFO depletion', 'sale_item', NEW.id, auth.uid(), _batch.id);
    _remaining := _remaining - _take;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN
  -- batch_id column may not exist on stock_movements; fail open silently
  RETURN NEW;
END;
$$;

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_sale_item_fefo ON public.sale_items;
CREATE TRIGGER trg_sale_item_fefo AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fefo_consume_batches();

-- 5. Expiry alert generator
CREATE OR REPLACE FUNCTION public.generate_expiry_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count integer := 0;
  _b record;
  _sev text;
  _msg text;
  _days integer;
BEGIN
  FOR _b IN
    SELECT pb.id AS batch_id, pb.product_id, pb.branch_id, pb.tenant_id, pb.batch_number,
           pb.expiry_date, pb.quantity, p.name AS pname, p.unit
    FROM public.product_batches pb
    JOIN public.products p ON p.id = pb.product_id
    WHERE pb.status = 'active'
      AND pb.quantity > 0
      AND pb.expiry_date IS NOT NULL
      AND pb.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
  LOOP
    _days := (_b.expiry_date - CURRENT_DATE)::int;
    IF _days < 0 THEN _sev := 'critical'; _msg := 'Expired ' || abs(_days) || ' day(s) ago — remove from sale floor.';
    ELSIF _days <= 7 THEN _sev := 'critical'; _msg := 'Expires in ' || _days || ' day(s) — apply 50% discount (FEFO).';
    ELSIF _days <= 30 THEN _sev := 'warning'; _msg := 'Expires in ' || _days || ' days — promote 20-30%.';
    ELSE _sev := 'info'; _msg := 'Expires in ' || _days || ' days — monitor.';
    END IF;

    -- de-dupe per batch
    IF NOT EXISTS (SELECT 1 FROM public.inventory_alerts
                    WHERE batch_id = _b.batch_id AND alert_type = 'expiry' AND is_dismissed = false) THEN
      INSERT INTO public.inventory_alerts
        (tenant_id, alert_type, severity, product_id, branch_id, batch_id, title, message, recommendation, metadata)
      VALUES (_b.tenant_id, 'expiry', _sev, _b.product_id, _b.branch_id, _b.batch_id,
              CASE WHEN _days < 0 THEN 'EXPIRED: ' ELSE 'Near expiry: ' END || _b.pname,
              _msg,
              CASE WHEN _days < 0 THEN 'Move to disposal queue.' ELSE 'Sell first using FEFO; discount aggressively if <30d.' END,
              jsonb_build_object('batch', _b.batch_number, 'qty', _b.quantity, 'days_to_expiry', _days, 'expiry_date', _b.expiry_date));
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END;
$$;

-- 6. Slow-moving detector (no sales in 60 days, stock>0)
CREATE OR REPLACE FUNCTION public.detect_slow_moving(_days integer DEFAULT 60)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count integer := 0;
  _p record;
BEGIN
  FOR _p IN
    SELECT p.id, p.name, p.stock, p.tenant_id, p.branch_id
    FROM public.products p
    WHERE p.is_active = true AND p.stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE si.product_id = p.id
          AND s.created_at > now() - make_interval(days => _days)
          AND s.status <> 'void'
      )
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.inventory_alerts
                    WHERE product_id = _p.id AND alert_type = 'slow_moving' AND is_dismissed = false) THEN
      INSERT INTO public.inventory_alerts
        (tenant_id, alert_type, severity, product_id, branch_id, title, message, recommendation, metadata)
      VALUES (_p.tenant_id, 'slow_moving', 'info', _p.id, _p.branch_id,
              'Slow-moving: ' || _p.name,
              'No sales in last ' || _days || ' days (stock: ' || _p.stock || ').',
              'Bundle, discount, or transfer to a higher-traffic branch.',
              jsonb_build_object('days', _days, 'stock', _p.stock));
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END;
$$;

-- 7. MoR retry helpers
CREATE OR REPLACE FUNCTION public.mor_requeue(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_finance_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized to requeue MoR items';
  END IF;
  UPDATE public.mor_sync_queue
     SET status='pending', next_attempt_at = now(), last_error = NULL
   WHERE id = _id;
END;
$$;

-- 8. Storage policy: allow members to upload to asset-images for branch logos
DO $$ BEGIN
  CREATE POLICY "Members can upload branch logos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'asset-images' AND (storage.foldername(name))[1] = 'branch-logos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Members can update branch logos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'asset-images' AND (storage.foldername(name))[1] = 'branch-logos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
