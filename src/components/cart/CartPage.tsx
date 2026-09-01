"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Package,
  Receipt,
  BookOpen,
} from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { useCart } from "@/lib/cart/cart-context";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { useAccount } from "@/lib/auth/account-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { ButtonLink } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";

export function CartPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { accountType, isInitializing } = useAccount();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const { items, removeFromCart, clearCart } = useCart();

  const [availablePackages, setAvailablePackages] = useState<PublicPricingPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load server-authoritative packages from database for both guests and authenticated users
  useEffect(() => {
    getPublicPricingPackages()
      .then((packages) => {
        setAvailablePackages(packages.filter((p) => p.active && p.purchase_mode === "purchasable"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (isInitializing || loading || settingsLoading) {
    return <AccountWaveLoader />;
  }

  // When pricing is disabled and caller is not admin
  if (!showPricing && accountType !== "admin") {
    return (
      <section className="min-h-[70vh] bg-[#F6F8F3] pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage-soft text-primary shadow-xs">
            <ShoppingBag className="size-8 text-[#819586]" />
          </div>
          <h1 className="mt-6 font-heading text-3xl text-[#10271B] sm:text-4xl">
            {isTr ? "Paket Satışı Çevrim Dışıdır" : "Package Sales are Currently Offline"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#68756C]">
            {isTr
              ? "Paket satışı şu anda çevrim dışıdır. Eğitim ve danışmanlık hizmetlerimiz hakkında bilgi almak için ücretsiz görüşme planlayabilirsiniz."
              : "Package purchases are currently offline. You can book a complimentary consultation to learn more about our education and guidance services."}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={`${localizedPath("home", locale)}#consultation-form`} size="lg" className="h-12 px-6">
              {isTr ? "Görüşme Planla" : "Book a Consultation"}
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  // Match cart items with DB packages
  const cartPackages = items
    .map((item) => availablePackages.find((p) => p.id === item.packageId))
    .filter((p): p is PublicPricingPackage => Boolean(p));

  const totalPrice = cartPackages.reduce(
    (acc, p) => acc + Number(p.current_total ?? p.price_amount ?? 0),
    0
  );
  const totalOriginalPrice = cartPackages.reduce((acc, p) => {
    const listPrice = p.old_total && p.old_total > Number(p.current_total ?? p.price_amount ?? 0)
      ? p.old_total
      : Number(p.current_total ?? p.price_amount ?? 0);
    return acc + listPrice;
  }, 0);
  const totalDiscount = Math.max(0, totalOriginalPrice - totalPrice);
  const totalLessons = cartPackages.reduce((acc, p) => acc + (p.lesson_count || 0), 0);
  const currency = cartPackages[0]?.currency || "TRY";

  const money = (val: number, cur = "TRY") => {
    return formatCurrency(val, { currency: cur, locale });
  };

  const isAuthenticated = accountType === "student" || accountType === "admin";
  const directPaymentHref = cartPackages.length > 0
    ? `${localizedPath("payment", locale)}?source=cart`
    : localizedPath("pricing", locale);

  const checkoutHref = isAuthenticated
    ? directPaymentHref
    : `${unifiedLoginPath(locale)}?next=${encodeURIComponent(directPaymentHref)}&source=checkout`;

  return (
    <section className="min-h-screen bg-background pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="public-container">
        <div className="mx-auto max-w-5xl">
          <header className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {isTr ? "Hesabım" : "My Account"}
            </p>
            <h1 className="mt-3 font-heading text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] text-ink">
              {isTr ? "Sepetim" : "My Cart"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              {isTr
                ? "Seçtiğiniz eğitim paketlerini inceleyin ve ödemeye geçin."
                : "Review your selected lesson packages and proceed to checkout."}
            </p>
          </header>

          {cartPackages.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface p-12 text-center shadow-xs">
              <div className="flex size-16 items-center justify-center rounded-full bg-sage-soft text-[#10271B]">
                <ShoppingBag className="size-8 text-[#819586]" />
              </div>
              <h2 className="mt-5 font-heading text-2xl text-ink">
                {isTr ? "Sepetiniz boş." : "Your cart is empty."}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {isTr
                  ? "Henüz bir eğitim paketi eklemediniz. Akademik hedeflerinize uygun paketleri keşfedin."
                  : "You have not added any lesson packages yet. Discover packages tailored to your academic goals."}
              </p>
              <Link
                href={localizedPath("pricing", locale)}
                className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
              >
                <Package className="size-4" />
                {isTr ? "Paketleri İncele" : "Explore Packages"}
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              {/* CART ITEMS LIST */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isTr ? `Seçilen Paketler (${cartPackages.length})` : `Selected Packages (${cartPackages.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-medium text-muted-foreground hover:text-red-600 transition-colors"
                  >
                    {isTr ? "Sepeti Temizle" : "Clear Cart"}
                  </button>
                </div>

                {cartPackages.map((pkg) => {
                  const pkgName = isTr ? pkg.name_tr : pkg.name_en || pkg.name_tr;
                  const finalPrice = Number(pkg.current_total ?? pkg.price_amount ?? 0);
                  const hasDiscount = Boolean(pkg.old_total && pkg.old_total > finalPrice);
                  const listPrice = hasDiscount ? (pkg.old_total as number) : finalPrice;
                  const discountVal = listPrice - finalPrice;
                  const discountPct = pkg.discount_percentage || Math.round((discountVal / listPrice) * 100);

                  return (
                    <div
                      key={pkg.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-xs sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-primary">
                          <BookOpen className="size-6 text-[#819586]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-lg text-ink">{pkgName}</h3>
                            {pkg.badge_tr && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {isTr ? pkg.badge_tr : pkg.badge_en}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pkg.lesson_count} {isTr ? "Ders · Birebir Özel Destek" : "Lessons · 1-on-1 Private Tutoring"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-6 border-t border-border pt-3 sm:border-0 sm:pt-0">
                        <div className="text-right space-y-0.5">
                          {hasDiscount && (
                            <div className="flex flex-col items-end text-[11px] text-muted-foreground">
                              <span className="line-through">{money(listPrice, pkg.currency)}</span>
                              <span className="font-semibold text-emerald-800">
                                {isTr ? `Paket İndirimi (%${discountPct}): -${money(discountVal, pkg.currency)}` : `Package Discount (%${discountPct}): -${money(discountVal, pkg.currency)}`}
                              </span>
                            </div>
                          )}
                          <span className="block text-base font-bold text-ink sm:text-lg">
                            {money(finalPrice, pkg.currency)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(pkg.id)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={isTr ? "Paketi sepetten çıkar" : "Remove package from cart"}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ORDER SUMMARY */}
              <aside className="h-fit rounded-3xl border border-border bg-surface-muted p-6 sm:p-8">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <Receipt className="size-5 text-primary" />
                  <h2 className="font-heading text-xl text-ink">{isTr ? "Sipariş Özeti" : "Order Summary"}</h2>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isTr ? "Paket Sayısı" : "Package Count"}</span>
                    <span className="font-semibold text-ink">{cartPackages.length}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isTr ? "Toplam Ders" : "Total Lessons"}</span>
                    <span className="font-semibold text-ink">{totalLessons} {isTr ? "Ders" : "Lessons"}</span>
                  </div>

                  {totalDiscount > 0 ? (
                    <>
                      <div className="flex justify-between text-muted-foreground border-t border-border pt-3">
                        <span>{isTr ? "Paket Tutarı / Liste Fiyatı" : "List Price"}</span>
                        <span>{money(totalOriginalPrice, currency)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-emerald-800">
                        <span>{isTr ? "Paket İndirimi" : "Package Discount"}</span>
                        <span>-{money(totalDiscount, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-4 text-base font-heading text-ink sm:text-xl">
                        <span>{isTr ? "Toplam Tutar" : "Total Amount"}</span>
                        <span className="font-bold text-ink">{money(totalPrice, currency)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between border-t border-border pt-4 text-base font-heading text-ink sm:text-xl">
                      <span>{isTr ? "Toplam Tutar" : "Total Amount"}</span>
                      <span className="font-bold text-ink">{money(totalPrice, currency)}</span>
                    </div>
                  )}
                </div>

                <Link
                  href={checkoutHref}
                  className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-base font-bold text-white shadow-lg shadow-ink/15 transition-all hover:-translate-y-0.5 hover:bg-forest focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99]"
                >
                  <span>{isTr ? "Ödemeye Geç" : "Proceed to Checkout"}</span>
                  <ArrowRight className="size-4" />
                </Link>

                <div className="mt-6 border-t border-border pt-5 space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <ShieldCheck className="size-4 text-primary" />
                    {isTr ? "256-bit SSL Güvenli Ödeme" : "256-bit SSL Secure Payment"}
                  </p>
                  <p className="leading-relaxed">
                    {isTr
                      ? "Ödeme işlemleriniz banka güvencesiyle korunur. Kart bilgileriniz sunucularımızda saklanmaz."
                      : "Your payments are protected with bank-grade security. Card details are never stored on our servers."}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CartPage;
