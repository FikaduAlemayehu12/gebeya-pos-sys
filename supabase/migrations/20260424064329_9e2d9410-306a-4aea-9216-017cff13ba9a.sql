CREATE OR REPLACE FUNCTION public.set_active_tenant(_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid() AND company_id = _company_id
  ) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;
  PERFORM set_config('app.tenant_id', _company_id::text, false);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;