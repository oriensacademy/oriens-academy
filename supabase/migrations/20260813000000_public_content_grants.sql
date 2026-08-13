-- Public content tables require both an RLS SELECT policy and table privileges.
-- RLS remains enabled; anonymous users can only read rows allowed by the
-- existing active/verified policies.
GRANT SELECT ON TABLE public.pricing_packages TO anon, authenticated;
GRANT SELECT ON TABLE public.testimonials TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pricing_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO service_role;
