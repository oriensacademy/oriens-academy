"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { CountingNumber } from "@/components/ui/counting-number";
import { useAdminAuth } from "@/lib/admin/auth-context";
import type { DashboardMetrics, RecentAuditRow } from "@/lib/admin/dashboard";
import {
  getAdminDashboardMetrics,
  getRecentAuditActivity,
} from "@/lib/admin/dashboard";
import {
  ShieldCheck,
  CalendarCheck,
  MessageSquare,
  Clock,
  CreditCard,
  FileText,
  Bell,
  FileCheck,
  Settings,
  AlertTriangle,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      <AdminShell>
        <DashboardContent />
      </AdminShell>
    </AdminGuard>
  );
}

function DashboardContent() {
  const { user, profile } = useAdminAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all([
        getAdminDashboardMetrics(),
        getRecentAuditActivity(6),
      ]).then(([{ metrics: mData }, { data: aData }]) => {
        if (mounted) {
          setMetrics(mData);
          setRecentActivity(aData);
          setLoading(false);
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#819586]" />
              <h1 className="text-lg font-bold tracking-tight text-[#10271B]">
                Oriens Academy Admin Control Panel
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Hoş geldiniz,{" "}
              <span className="font-semibold text-foreground">
                {profile?.display_name || "Yönetici"}
              </span>{" "}
              ({user?.email})
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-medium">Sistem Aktif / Operational</span>
          </div>
        </div>
      </div>

      {/* Failed Deliveries Alert Banner */}
      {metrics && metrics.failedDeliveries > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-red-900">
                Teslim Edilemeyen E-Posta Bildirimi Var!
              </div>
              <div className="text-[11px] text-red-700">
                Son dönemde {metrics.failedDeliveries} adet bildirim teslimatı başarısız oldu.
              </div>
            </div>
          </div>
          <Link
            href="/admin/bildirimler?status=failed"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 shrink-0"
          >
            <span>İncele</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Real Operational Metrics Overview Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-[#10271B]">
          Operasyonel Veri Özeti / Operational Overview
        </h2>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-white p-8">
            <AdminWaveStatus label="Metrikler sorgulanıyor…" className="text-xs text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <MetricCard
              label="İletişim Talebi"
              count={metrics?.unresolvedContacts || 0}
              subtext="Bekleyen / İşlemde"
              href="/admin/iletisim"
              highlight={metrics ? metrics.unresolvedContacts > 0 : false}
            />
            <MetricCard
              label="Onaylı Randevu"
              count={metrics?.confirmedBookings || 0}
              subtext="Gelecek Seanslar"
              href="/admin/randevular"
            />
            <MetricCard
              label="Bekleyen Randevu"
              count={metrics?.pendingBookings || 0}
              subtext="Onay Bekleyen"
              href="/admin/randevular"
              highlight={metrics ? metrics.pendingBookings > 0 : false}
            />
            <MetricCard
              label="Aktif Müsaitlik"
              count={metrics?.activeSlots || 0}
              subtext="Açık Seans Slotu"
              href="/admin/musaitlik"
            />
            <MetricCard
              label="Hatalı E-Posta"
              count={metrics?.failedDeliveries || 0}
              subtext="Teslim Edilemeyen"
              href="/admin/bildirimler"
              alert={metrics ? metrics.failedDeliveries > 0 : false}
            />
            <MetricCard
              label="Fiyat Paketleri"
              count={metrics?.activePricingPackages || 0}
              subtext="Aktif Seans/Paket"
              href="/admin/fiyatlandirma"
            />
            <MetricCard
              label="Öğrenci Yorumu"
              count={metrics?.activeTestimonials || 0}
              subtext="Yayınlanan Yorum"
              href="/admin/icerik"
            />
          </div>
        )}
      </div>



      {/* Module Quick Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-[#10271B]">
          Yönetim Modülleri / Active Modules
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleLinkCard
            title="Randevu Yönetimi"
            href="/admin/randevular"
            icon={CalendarCheck}
            description="Seans randevularını onaylayın ve yönetin."
          />
          <ModuleLinkCard
            title="Müsaitlik Takvimi"
            href="/admin/musaitlik"
            icon={Clock}
            description="Tekli ve toplu seans slotları oluşturun."
          />
          <ModuleLinkCard
            title="İletişim Talepleri"
            href="/admin/iletisim"
            icon={MessageSquare}
            description="Gelen öğrenci iletişim mesajlarını yanıtlayın."
          />
          <ModuleLinkCard
            title="Fiyat Paketleri"
            href="/admin/fiyatlandirma"
            icon={CreditCard}
            description="Ders ve üyelik paket fiyatlarını güncelleyin."
          />
          <ModuleLinkCard
            title="Öğrenci Yorumları"
            href="/admin/icerik"
            icon={FileText}
            description="Gerçek öğrenci alıntılarını ve yorumları düzenleyin."
          />
          <ModuleLinkCard
            title="E-Posta Bildirimleri"
            href="/admin/bildirimler"
            icon={Bell}
            description="Canlı Resend teslimat loglarını inceleyin."
          />
          <ModuleLinkCard
            title="Denetim Logları"
            href="/admin/denetim"
            icon={FileCheck}
            description="Tüm yönetici eylemlerini izleyin (Salt Okunur)."
          />
          <ModuleLinkCard
            title="Site Ayarları"
            href="/admin/ayarlar"
            icon={Settings}
            description="Bildirim e-postalarını ve konfigürasyonu yönetin."
          />
        </div>
      </div>

      {/* Recent Admin Activity Section */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-xs font-bold text-foreground flex items-center gap-2">
              <FileCheck className="size-4 text-[#819586]" />
              <span>Son Yönetici İşlemleri / Recent Audit Feed</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Veritabanına kaydedilen en son 6 işlem logu.
            </p>
          </div>
          <Link
            href="/admin/denetim"
            className="text-xs font-semibold text-[#10271B] hover:underline"
          >
            Tüm Logları Gör &rarr;
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-4 text-center">
            Henüz kaydedilmiş denetim işlemi bulunmuyor.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#10271B]">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    ({log.entity_type})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>{new Date(log.created_at).toLocaleString("tr-TR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  count,
  subtext,
  href,
  highlight = false,
  alert = false,
}: {
  label: string;
  count: number;
  subtext: string;
  href: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs transition-all hover:shadow-md ${
        alert
          ? "border-red-300 bg-red-50/60"
          : highlight
          ? "border-amber-300 bg-amber-50/60"
          : "border-border bg-white hover:border-input"
      }`}
    >
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground truncate">
          {label}
        </div>
        <div
          className={`mt-1 text-xl font-extrabold font-mono ${
            alert
              ? "text-red-700"
              : highlight
              ? "text-amber-800"
              : "text-[#10271B]"
          }`}
        >
          <CountingNumber
            target={count}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], type: "tween" }}
          />
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground truncate">{subtext}</div>
    </Link>
  );
}

function ModuleLinkCard({
  title,
  href,
  icon: Icon,
  description,
}: {
  title: string;
  href: string;
  icon: typeof CalendarCheck;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-2xs transition-colors hover:border-[#10271B] hover:bg-background-soft/50"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#10271B]">
            <Icon className="size-4" />
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
        <h3 className="text-xs font-bold text-foreground">
          {title}
        </h3>
        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
      </div>
    </Link>
  );
}
