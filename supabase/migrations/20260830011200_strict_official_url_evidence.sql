-- Empty JSON arrays are not URL evidence. Require an HTTPS candidate and either
-- a reviewed override or at least one imported official-domain evidence item.
update public.universities set
  url_verification_status=case
    when website ~ '^https://' and (
      featured_override_verified or
      (jsonb_typeof(source_metadata->'official_domain_evidence')='array'
        and jsonb_array_length(source_metadata->'official_domain_evidence')>0)
    ) then 'verified'
    when website is not null then 'source_provided' else 'unverified' end,
  verified_url=coalesce(website ~ '^https://' and (
    featured_override_verified or
    (jsonb_typeof(source_metadata->'official_domain_evidence')='array'
      and jsonb_array_length(source_metadata->'official_domain_evidence')>0)
  ),false),
  url_verification_source=case
    when website ~ '^https://' and featured_override_verified then 'reviewed Oriens override'
    when website ~ '^https://' and jsonb_typeof(source_metadata->'official_domain_evidence')='array'
      and jsonb_array_length(source_metadata->'official_domain_evidence')>0
      then 'imported official-domain evidence'
    else null end,
  url_checked_at=case
    when website ~ '^https://' and (
      featured_override_verified or
      (jsonb_typeof(source_metadata->'official_domain_evidence')='array'
        and jsonb_array_length(source_metadata->'official_domain_evidence')>0)
    ) then coalesce(verified_at,now()) else null end;
