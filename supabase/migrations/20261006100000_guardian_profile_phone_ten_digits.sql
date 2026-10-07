-- Hesabım telefonu: kanonik saklama biçimi yalnız 10 hane (örn. 5333591962) ya da NULL.
--
-- * p_phone NULL  -> kayıtlı telefon olduğu gibi kalır (eski çağıranlar telefonu göndermez).
-- * p_phone ''    -> telefon silinir (NULL). Önceki sürümde coalesce yüzünden silinemiyordu.
-- * p_phone dolu  -> rakamlar alınır; "+90" / "90" (12 hane) ve baştaki "0" (11 hane) atılır,
--                    sonuç ^[1-9][0-9]{9}$ olmalıdır; aksi halde INVALID_PHONE.
-- * p_contact_address NULL -> kayıtlı adres korunur (Hesabım formunda adres alanı yok);
--                    gönderilirse önceki 10–300 karakter kuralı aynen geçerlidir.
--
-- Tabloya kısıt eklenmez ve toplu dönüştürme yapılmaz: eski E.164 kayıtlar okunurken
-- istemcide 10 haneye indirilir ve kullanıcı bir sonraki kaydında 10 hane yazılır.
-- Geri alma: 20260903150000 dosyasındaki tanım yeniden uygulanabilir (imza aynı).

create or replace function public.update_guardian_profile(
  p_full_name text,
  p_contact_address text,
  p_preferred_language text default 'tr',
  p_phone text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone_given boolean := p_phone is not null;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_address text := case when p_contact_address is null then null
                         else regexp_replace(btrim(p_contact_address), '\s+', ' ', 'g') end;
  v_old_phone text;
  v_fields jsonb := jsonb_build_array('full_name', 'preferred_language');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 100 then raise exception 'INVALID_FULL_NAME'; end if;

  if v_phone is not null then
    if char_length(v_phone) = 12 and left(v_phone, 2) = '90' then v_phone := substr(v_phone, 3);
    elsif char_length(v_phone) = 11 and left(v_phone, 1) = '0' then v_phone := substr(v_phone, 2);
    end if;
    if v_phone !~ '^[1-9][0-9]{9}$' then raise exception 'INVALID_PHONE'; end if;
  end if;

  if v_address is not null and char_length(v_address) not between 10 and 300 then
    raise exception 'INVALID_CONTACT_ADDRESS';
  end if;
  if p_preferred_language not in ('tr','en') then raise exception 'INVALID_LANGUAGE'; end if;
  if (select count(*) from public.audit_logs
      where actor_user_id = auth.uid() and action = 'guardian.profile_updated'
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'PROFILE_UPDATE_RATE_LIMIT';
  end if;

  select phone into v_old_phone from public.guardian_accounts where user_id = auth.uid() and active;
  if not found then raise exception 'GUARDIAN_ACCOUNT_NOT_FOUND'; end if;

  update public.guardian_accounts
  set full_name = v_name,
      phone = case when v_phone_given then v_phone else phone end,
      contact_address = coalesce(v_address, contact_address),
      preferred_language = p_preferred_language,
      updated_at = now()
  where user_id = auth.uid() and active;

  if v_phone_given and v_old_phone is distinct from v_phone then v_fields := v_fields || '"phone"'::jsonb; end if;
  if v_address is not null then v_fields := v_fields || '"contact_address"'::jsonb; end if;

  -- Telefon değeri denetim kaydına yazılmaz; yalnız alan adı.
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'guardian.profile_updated', 'guardian_account', auth.uid()::text,
    jsonb_build_object('fields', v_fields));
  return jsonb_build_object('success', true);
end;
$$;
revoke all on function public.update_guardian_profile(text,text,text,text) from public, anon;
grant execute on function public.update_guardian_profile(text,text,text,text) to authenticated;
