alter table public.pricing_packages
  add column if not exists price_eur numeric(12, 2);

alter table public.pricing_packages
  drop constraint if exists pricing_packages_price_eur_valid;

alter table public.pricing_packages
  add constraint pricing_packages_price_eur_valid
  check (price_eur is null or (price_eur > 0 and price_eur <= 1000000));

update public.pricing_packages
set price_eur = case id
  when 'single' then 59.99
  when 'package5' then 269.99
  when 'package10' then 499.99
  when 'package20' then 899.99
  when 'package30' then 1299.99
  else price_eur
end
where id in ('single', 'package5', 'package10', 'package20', 'package30');

comment on column public.pricing_packages.price_eur is
  'Admin-controlled customer display price for the English locale. Never used for payment, coupon, refund, or accounting calculations.';
