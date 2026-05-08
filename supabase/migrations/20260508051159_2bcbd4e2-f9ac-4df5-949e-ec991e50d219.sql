
-- 1) Extend branches with enterprise fields
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS tin_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS vat_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_license text DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS gl_cost_center text DEFAULT '',
  ADD COLUMN IF NOT EXISTS profit_center text DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_warehouse text DEFAULT '',
  ADD COLUMN IF NOT EXISTS stock_location text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Addis_Ababa',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS doc_prefix_invoice text DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS doc_prefix_po text DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS doc_prefix_receipt text DEFAULT 'RCT';

-- 2) Auto low-stock alert trigger
CREATE OR REPLACE FUNCTION public.handle_product_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
  _user record;
BEGIN
  -- Resolve dismissals when stock recovers above reorder point
  IF NEW.stock > COALESCE(NEW.reorder_point, NEW.min_stock) THEN
    UPDATE public.inventory_alerts
       SET is_dismissed = true, dismissed_at = now()
     WHERE product_id = NEW.id
       AND alert_type = 'low_stock'
       AND is_dismissed = false;
    RETURN NEW;
  END IF;

  -- Trigger condition: stock <= min_stock and either insert or stock just crossed
  IF NEW.stock <= COALESCE(NEW.min_stock, 0) AND (TG_OP = 'INSERT' OR OLD.stock > COALESCE(NEW.min_stock, 0)) THEN
    -- de-dupe: skip if open alert exists
    SELECT id INTO _existing_id FROM public.inventory_alerts
      WHERE product_id = NEW.id AND alert_type = 'low_stock' AND is_dismissed = false LIMIT 1;

    IF _existing_id IS NULL THEN
      INSERT INTO public.inventory_alerts (
        tenant_id, alert_type, severity, product_id, branch_id, title, message, recommendation, metadata
      ) VALUES (
        NEW.tenant_id,
        'low_stock',
        CASE WHEN NEW.stock <= 0 THEN 'critical' ELSE 'warning' END,
        NEW.id,
        NEW.branch_id,
        'Low stock: ' || NEW.name,
        CASE WHEN NEW.stock <= 0
             THEN 'Out of stock (0 ' || COALESCE(NEW.unit,'units') || ')'
             ELSE 'Stock at ' || NEW.stock || '/' || NEW.min_stock || ' ' || COALESCE(NEW.unit,'units')
        END,
        'Reorder from primary supplier as soon as possible.',
        jsonb_build_object('stock', NEW.stock, 'min_stock', NEW.min_stock, 'reorder_point', NEW.reorder_point)
      );

      -- Notify finance/inventory staff and branch manager of the same tenant
      FOR _user IN
        SELECT DISTINCT cm.user_id
        FROM public.company_members cm
        WHERE cm.company_id = NEW.tenant_id
          AND (
            EXISTS (SELECT 1 FROM public.user_roles ur
                    WHERE ur.user_id = cm.user_id
                      AND ur.role IN ('admin','inventory_manager','procurement','finance_manager'))
            OR EXISTS (SELECT 1 FROM public.branches b
                       WHERE b.id = NEW.branch_id AND b.manager_user_id = cm.user_id)
          )
      LOOP
        INSERT INTO public.notifications (tenant_id, user_id, title, message, type, related_id)
        VALUES (
          NEW.tenant_id,
          _user.user_id,
          'Low stock: ' || NEW.name,
          'Stock is ' || NEW.stock || '/' || NEW.min_stock || ' ' || COALESCE(NEW.unit,''),
          'low_stock',
          NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_stock_alert ON public.products;
CREATE TRIGGER trg_product_stock_alert
AFTER INSERT OR UPDATE OF stock, min_stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_product_stock_alert();
