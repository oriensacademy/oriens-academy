-- Ayarlar > İletişim bilgileri: sunucuda tek kayıt.
-- site_settings tablosu ve politikaları zaten var (herkes is_public satırları
-- okuyabilir, yalnız admin günceller). authenticated rolünün INSERT yetkisi
-- olmadığından panelin güncelleyebileceği satır burada bir kez oluşturulur.
-- Değerler bugünkü canlı iletişim bilgileridir; satır zaten varsa dokunulmaz.
-- Gizli anahtar içermez. Geri alma: delete from public.site_settings where key = 'contact.public';

insert into public.site_settings (key, value, is_public)
values (
  'contact.public',
  jsonb_build_object(
    'whatsapp', '+90 544 293 90 40',
    'landline', '+90 850 304 04 67',
    'email', 'info@oriens-academy.com',
    'address', 'Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul'
  ),
  true
)
on conflict (key) do nothing;
