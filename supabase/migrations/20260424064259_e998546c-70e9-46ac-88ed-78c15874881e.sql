CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  _t text;
BEGIN
  BEGIN
    _t := current_setting('app.tenant_id', true);
  EXCEPTION WHEN OTHERS THEN
    _t := NULL;
  END;
  IF _t IS NULL OR _t = '' THEN
    SELECT company_id::text INTO _t
    FROM public.company_members
    WHERE user_id = auth.uid() AND is_default = true
    LIMIT 1;
  END IF;
  IF _t IS NULL OR _t = '' THEN
    SELECT company_id::text INTO _t
    FROM public.company_members
    WHERE user_id = auth.uid()
    ORDER BY created_at LIMIT 1;
  END IF;
  RETURN _t::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;