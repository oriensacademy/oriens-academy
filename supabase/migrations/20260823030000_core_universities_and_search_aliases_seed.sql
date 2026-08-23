-- Migration: 20260823030000_core_universities_and_search_aliases_seed.sql
-- Description: Seeds core canonical universities and establishes official search aliases for instant discovery.

-- 1. Seed Core Canonical Universities
insert into public.universities (
  name,
  normalized_name,
  slug,
  country_id,
  city,
  state_or_region,
  website,
  admissions_url,
  institution_type,
  popularity_score,
  active
)
select
  seed.name,
  seed.normalized_name,
  seed.slug,
  country.id as country_id,
  seed.city,
  seed.state_or_region,
  seed.website,
  seed.admissions_url,
  seed.institution_type,
  seed.popularity_score,
  true
from (values
  ('University of Oxford', 'university of oxford', 'university-of-oxford', 'GB', 'Oxford', 'Oxfordshire', 'https://www.ox.ac.uk', 'https://www.ox.ac.uk/admissions', 'PUBLIC', 99),
  ('University of Cambridge', 'university of cambridge', 'university-of-cambridge', 'GB', 'Cambridge', 'Cambridgeshire', 'https://www.cam.ac.uk', 'https://www.undergraduate.study.cam.ac.uk', 'PUBLIC', 98),
  ('Imperial College London', 'imperial college london', 'imperial-college-london', 'GB', 'London', 'Greater London', 'https://www.imperial.ac.uk', 'https://www.imperial.ac.uk/study', 'PUBLIC', 94),
  ('University College London', 'university college london', 'university-college-london', 'GB', 'London', 'Greater London', 'https://www.ucl.ac.uk', 'https://www.ucl.ac.uk/prospective-students', 'PUBLIC', 95),
  ('London School of Economics and Political Science', 'london school of economics and political science', 'london-school-of-economics-and-political-science', 'GB', 'London', 'Greater London', 'https://www.lse.ac.uk', 'https://www.lse.ac.uk/study-at-lse', 'PUBLIC', 93),
  ('London Business School', 'london business school', 'london-business-school', 'GB', 'London', 'Greater London', 'https://www.london.edu', 'https://www.london.edu/masters-degrees', 'PUBLIC', 91),
  ('Massachusetts Institute of Technology', 'massachusetts institute of technology', 'massachusetts-institute-of-technology', 'US', 'Cambridge', 'MA', 'https://www.mit.edu', 'https://mitadmissions.org', 'PRIVATE', 100),
  ('Harvard University', 'harvard university', 'harvard-university', 'US', 'Cambridge', 'MA', 'https://www.harvard.edu', 'https://college.harvard.edu/admissions', 'PRIVATE', 99),
  ('Bocconi University', 'bocconi university', 'bocconi-university', 'IT', 'Milan', 'Lombardy', 'https://www.unibocconi.it', 'https://www.unibocconi.it/admissions', 'PRIVATE', 90),
  ('University of Bologna', 'university of bologna', 'university-of-bologna', 'IT', 'Bologna', 'Emilia-Romagna', 'https://www.unibo.it', 'https://www.unibo.it/en/admissions', 'PUBLIC', 85),
  ('University of Milan', 'university of milan', 'university-of-milan', 'IT', 'Milan', 'Lombardy', 'https://www.unimi.it', 'https://www.unimi.it/en/study', 'PUBLIC', 82),
  ('Sapienza University of Rome', 'sapienza university of rome', 'sapienza-university-of-rome', 'IT', 'Rome', 'Lazio', 'https://www.uniroma1.it', 'https://www.uniroma1.it/en/admissions', 'PUBLIC', 80),
  ('ETH Zurich', 'eth zurich', 'eth-zurich', 'CH', 'Zurich', 'Zurich', 'https://ethz.ch', 'https://ethz.ch/en/studies.html', 'PUBLIC', 93),
  ('Delft University of Technology', 'delft university of technology', 'tu-delft', 'NL', 'Delft', 'South Holland', 'https://www.tudelft.nl', 'https://www.tudelft.nl/en/education/admission-and-application', 'PUBLIC', 88),
  ('INSEAD', 'insead', 'insead', 'FR', 'Fontainebleau', 'Île-de-France', 'https://www.insead.edu', 'https://www.insead.edu/master-programmes', 'PRIVATE', 89)
) as seed(name, normalized_name, slug, country_iso2, city, state_or_region, website, admissions_url, institution_type, popularity_score)
join public.countries as country on country.iso2 = seed.country_iso2
on conflict (slug) do update
set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  country_id = excluded.country_id,
  city = excluded.city,
  state_or_region = excluded.state_or_region,
  website = excluded.website,
  admissions_url = excluded.admissions_url,
  institution_type = excluded.institution_type,
  popularity_score = excluded.popularity_score,
  active = true,
  updated_at = now();

-- 2. Link Any Pre-Existing Unlinked University Aliases
update public.search_aliases as alias
set
  entity_id = university.id,
  updated_at = now()
from public.universities as university
where alias.entity_type = 'UNIVERSITY'
  and alias.entity_id is null
  and lower(alias.alias) in ('mit', 'ucl', 'cambridge', 'harvard', 'oxford')
  and (
    (lower(alias.alias) = 'mit' and university.slug = 'massachusetts-institute-of-technology')
    or (lower(alias.alias) = 'ucl' and university.slug = 'university-college-london')
    or (lower(alias.alias) = 'cambridge' and university.slug = 'university-of-cambridge')
    or (lower(alias.alias) = 'harvard' and university.slug = 'harvard-university')
    or (lower(alias.alias) = 'oxford' and university.slug = 'university-of-oxford')
  );

-- 3. Seed Curated & Canonical Search Aliases for Universities
insert into public.search_aliases (
  entity_type,
  entity_id,
  alias,
  normalized_alias,
  language,
  priority,
  source
)
select
  'UNIVERSITY',
  university.id,
  curated.alias,
  curated.normalized_alias,
  'en',
  curated.priority,
  'EXPLICIT_OFFICIAL_ALIAS'
from (values
  ('University of Oxford', 'Oxford', 'oxford', 200),
  ('University of Oxford', 'University of Oxford', 'university of oxford', 180),
  ('University of Oxford', 'Oxford University', 'oxford university', 180),
  ('University of Cambridge', 'Cambridge', 'cambridge', 200),
  ('University of Cambridge', 'University of Cambridge', 'university of cambridge', 180),
  ('University of Cambridge', 'Cambridge University', 'cambridge university', 180),
  ('University of Cambridge', 'Cam', 'cam', 100),
  ('University College London', 'UCL', 'ucl', 200),
  ('University College London', 'University College London', 'university college london', 180),
  ('Imperial College London', 'Imperial', 'imperial', 190),
  ('Imperial College London', 'Imperial College', 'imperial college', 190),
  ('Imperial College London', 'Imperial College London', 'imperial college london', 180),
  ('London School of Economics and Political Science', 'LSE', 'lse', 200),
  ('London School of Economics and Political Science', 'London School of Economics', 'london school of economics', 180),
  ('London Business School', 'LBS', 'lbs', 200),
  ('London Business School', 'London Business School', 'london business school', 180),
  ('Massachusetts Institute of Technology', 'MIT', 'mit', 200),
  ('Massachusetts Institute of Technology', 'Massachusetts Institute of Technology', 'massachusetts institute of technology', 180),
  ('Harvard University', 'Harvard', 'harvard', 200),
  ('Harvard University', 'Harvard University', 'harvard university', 180),
  ('Bocconi University', 'Bocconi', 'bocconi', 200),
  ('Bocconi University', 'Bocconi University', 'bocconi university', 180),
  ('Bocconi University', 'UniBocconi', 'unibocconi', 150),
  ('University of Bologna', 'Bologna', 'bologna', 190),
  ('University of Bologna', 'University of Bologna', 'university of bologna', 180),
  ('University of Bologna', 'UniBo', 'unibo', 150),
  ('University of Milan', 'University of Milan', 'university of milan', 180),
  ('University of Milan', 'UniMi', 'unimi', 180),
  ('Sapienza University of Rome', 'Sapienza', 'sapienza', 190),
  ('Sapienza University of Rome', 'Sapienza University of Rome', 'sapienza university of rome', 180),
  ('ETH Zurich', 'ETH', 'eth', 200),
  ('ETH Zurich', 'ETH Zurich', 'eth zurich', 180),
  ('ETH Zurich', 'Swiss Federal Institute of Technology', 'swiss federal institute of technology', 150),
  ('Delft University of Technology', 'TU Delft', 'tu delft', 200),
  ('Delft University of Technology', 'Delft', 'delft', 190),
  ('Delft University of Technology', 'Delft University of Technology', 'delft university of technology', 180),
  ('INSEAD', 'INSEAD', 'insead', 200)
) as curated(canonical_name, alias, normalized_alias, priority)
join public.universities as university
  on university.name = curated.canonical_name and university.active
where not exists (
  select 1 from public.search_aliases existing
  where existing.entity_type = 'UNIVERSITY'
    and existing.entity_id = university.id
    and existing.normalized_alias = curated.normalized_alias
);
