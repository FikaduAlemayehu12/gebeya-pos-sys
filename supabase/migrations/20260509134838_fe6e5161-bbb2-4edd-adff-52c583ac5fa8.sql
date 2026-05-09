
REVOKE EXECUTE ON FUNCTION public.execute_sale_void(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_void_sale(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_void_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_void_request(uuid, text, text) TO authenticated;
-- execute_sale_void stays internal (called only from the two above)
