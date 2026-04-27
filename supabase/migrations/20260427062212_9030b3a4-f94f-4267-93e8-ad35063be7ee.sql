
-- ============ Phase A: Attendance enhancements ============

-- 1. Add new columns to existing attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS geo_lat numeric,
  ADD COLUMN IF NOT EXISTS geo_lng numeric,
  ADD COLUMN IF NOT EXISTS geo_accuracy numeric,
  ADD COLUMN IF NOT EXISTS clock_out_lat numeric,
  ADD COLUMN IF NOT EXISTS clock_out_lng numeric,
  ADD COLUMN IF NOT EXISTS selfie_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS check_in_method text NOT NULL DEFAULT 'manual';

-- Drop the implicit (employee_id, date) unique constraint if it exists, so multiple sessions per day are allowed
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.attendance'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(employee_id, date)%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', c);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON public.attendance(tenant_id, date);

-- 2. Per-tenant attendance settings
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE,
  office_lat numeric,
  office_lng numeric,
  allowed_radius_m integer NOT NULL DEFAULT 200,
  expected_clock_in time NOT NULL DEFAULT '08:30',
  late_grace_minutes integer NOT NULL DEFAULT 10,
  require_geo boolean NOT NULL DEFAULT false,
  require_selfie boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View attendance settings" ON public.attendance_settings;
CREATE POLICY "View attendance settings" ON public.attendance_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

DROP POLICY IF EXISTS "Manage attendance settings" ON public.attendance_settings;
CREATE POLICY "Manage attendance settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id) AND public.is_hr_staff(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.belongs_to_company(tenant_id));

-- Auto-set tenant_id on insert
DROP TRIGGER IF EXISTS set_tenant_attendance_settings ON public.attendance_settings;
CREATE TRIGGER set_tenant_attendance_settings
  BEFORE INSERT ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS update_attendance_settings_updated_at ON public.attendance_settings;
CREATE TRIGGER update_attendance_settings_updated_at
  BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage bucket for attendance selfies (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: employee folder convention {tenant_id}/{user_id}/{file}
DROP POLICY IF EXISTS "Upload own attendance selfie" ON storage.objects;
CREATE POLICY "Upload own attendance selfie" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS "View own or HR attendance selfie" ON storage.objects;
CREATE POLICY "View own or HR attendance selfie" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.is_hr_staff(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Delete own attendance selfie" ON storage.objects;
CREATE POLICY "Delete own attendance selfie" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.is_hr_staff(auth.uid())
    )
  );
