
-- ============================================================================
-- 1. PRODUCT CATEGORIES (hierarchical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_am TEXT DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'Package',
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories(parent_id);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage categories" ON public.product_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'));

CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. CATEGORY FIELD SCHEMAS (DB overrides for built-in templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.category_field_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  default_unit TEXT,
  default_tax_rate NUMERIC,
  track_expiry BOOLEAN,
  track_batch BOOLEAN,
  track_serial BOOLEAN,
  track_warranty BOOLEAN,
  default_warranty_months INTEGER,
  default_reorder_point NUMERIC,
  storage_conditions TEXT,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  required_fields JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id)
);
ALTER TABLE public.category_field_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View schemas" ON public.category_field_schemas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage schemas" ON public.category_field_schemas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'));
CREATE TRIGGER trg_cat_schemas_updated BEFORE UPDATE ON public.category_field_schemas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. EXTEND PRODUCTS
-- ============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_serial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_batch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reorder_point NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_stock NUMERIC,
  ADD COLUMN IF NOT EXISTS storage_conditions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- ============================================================================
-- 4. PRODUCT BATCHES (lot tracking, FEFO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  serial_number TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  expiry_date DATE,
  manufactured_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batches_product ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.product_batches(expiry_date);
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View batches" ON public.product_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage batches" ON public.product_batches FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier'));
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. STOCK MOVEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  quantity_change NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL DEFAULT 0,
  quantity_after NUMERIC NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch ON public.stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON public.stock_movements(created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 6. STOCK TRANSFERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_code TEXT NOT NULL UNIQUE,
  source_branch_id UUID NOT NULL REFERENCES public.branches(id),
  destination_branch_id UUID NOT NULL REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  rejected_reason TEXT DEFAULT '',
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View transfers" ON public.stock_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage transfers" ON public.stock_transfers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'branch_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'branch_manager'));
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  received_quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View transfer items" ON public.stock_transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage transfer items" ON public.stock_transfer_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'branch_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'branch_manager'));

-- ============================================================================
-- 7. COMPANY ASSETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_am TEXT DEFAULT '',
  category TEXT NOT NULL,
  subcategory TEXT DEFAULT '',
  description TEXT DEFAULT '',
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  location TEXT DEFAULT '',
  serial_number TEXT,
  registration_number TEXT,
  chassis_number TEXT,
  engine_number TEXT,
  manufacturer TEXT DEFAULT '',
  model TEXT DEFAULT '',
  year_manufactured INTEGER,
  purchase_date DATE,
  purchase_cost NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  depreciation_rate NUMERIC NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'active',
  warranty_expiry DATE,
  insurance_expiry DATE,
  next_maintenance_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  image_url TEXT DEFAULT '',
  document_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  attributes JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_branch ON public.assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage assets" ON public.assets FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR is_finance_staff(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR is_finance_staff(auth.uid()));
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL DEFAULT 'routine',
  description TEXT DEFAULT '',
  cost NUMERIC NOT NULL DEFAULT 0,
  performed_by TEXT DEFAULT '',
  next_due_date DATE,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_asset ON public.asset_maintenance(asset_id);
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View maintenance" ON public.asset_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage maintenance" ON public.asset_maintenance FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR is_finance_staff(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR is_finance_staff(auth.uid()));

-- ============================================================================
-- 8. IMPORT JOBS (lenient validation with quarantine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processing',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  quarantined_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  performed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View import jobs" ON public.import_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage import jobs" ON public.import_jobs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'));

CREATE TABLE IF NOT EXISTS public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  resulting_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_rows_job ON public.import_rows(job_id);
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View import rows" ON public.import_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage import rows" ON public.import_rows FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager'));

-- ============================================================================
-- 9. INVENTORY ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.inventory_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON public.inventory_alerts(is_dismissed, created_at DESC);
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View alerts" ON public.inventory_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage alerts" ON public.inventory_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager') OR has_role(auth.uid(),'cashier'));

-- ============================================================================
-- 10. STORAGE BUCKET FOR IMPORTS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-imports', 'inventory-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inventory staff upload imports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-imports' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')));

CREATE POLICY "Inventory staff read imports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inventory-imports' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')));

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read asset images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'asset-images');

CREATE POLICY "Inventory staff upload asset images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-images' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inventory_manager')));
