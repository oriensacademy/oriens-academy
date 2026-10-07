-- C1: Hesabım > Dersler "Eğitmen" alanı.
-- instructors tablosu RLS ile yalnız admin'e açık ve öyle kalır (geniş SELECT
-- politikası AÇILMAZ). Bunun yerine dar kapsamlı bir SECURITY DEFINER okuma:
--
--   auth.uid() -> kendi aktif veli hesabı -> aktif bağlı öğrenci (ya da kendisi)
--   -> o öğrencinin arşivlenmemiş ders kayıtları -> yalnız bu derslerdeki eğitmenler.
--
-- Dönen alanlar yalnız (instructor_id, display_name). Arama / listeleme ucu
-- değildir: parametre sadece öğrenci kimliğidir; erişimi olmayan öğrenci için
-- satır dönmez (hata da vermez, varlık bilgisi sızdırmaz). Tek çağrıda o
-- öğrencinin tüm eğitmen adları gelir (N+1 yok).
-- Geri alma: drop function public.get_guardian_lesson_instructor_names(uuid);

create or replace function public.get_guardian_lesson_instructor_names(p_student_id uuid)
returns table(instructor_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.id, btrim(i.name)
  from public.student_lessons l
  join public.instructors i on i.id = l.instructor_id
  where auth.uid() is not null
    and p_student_id is not null
    and l.student_user_id = p_student_id
    and not l.is_archived
    and (
      p_student_id = auth.uid()
      or exists (
        select 1
        from public.guardian_students gs
        join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
        where gs.guardian_user_id = auth.uid()
          and gs.student_id = p_student_id
          and gs.active and ga.active
      )
    );
$$;

revoke all on function public.get_guardian_lesson_instructor_names(uuid) from public, anon;
grant execute on function public.get_guardian_lesson_instructor_names(uuid) to authenticated;
