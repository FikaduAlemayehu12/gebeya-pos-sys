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

  -- Persist active company by flipping is_default for this user
  UPDATE public.company_members SET is_default = false WHERE user_id = auth.uid();
  UPDATE public.company_members SET is_default = true  WHERE user_id = auth.uid() AND company_id = _company_id;

  -- Also set request GUC for the (rare) case the same connection serves the next call
  PERFORM set_config('app.tenant_id', _company_id::text, false);
  RETURN true;
END;
$$;