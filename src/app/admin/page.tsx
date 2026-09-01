"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { CountingNumber } from "@/components/ui/counting-number";
import { useAdminAuth } from "@/lib/admin/auth-context";
import type { DashboardMetrics } from "@/lib/admin/dashboard";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard";
import {
  ShieldCheck,
  CalendarCheck,
  MessageSquare,
  Users,
  WalletCards,
  CreditCard,
  Bell,
  Settings,
  AlertTriangle,
  ChevronRight,
  ListChecks,
} from "lucide-react";

export default function AdminDashboardPage() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { user, profile } = useAdminAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      getAdminDashboardMetrics().then(({ metrics: mData }) => {
        if (mounted) {
          setMetrics(mData);
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

      {/* Consolidated Actionable Operational KPIs */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-[#10271B]">
          Operasyonel Veri Özeti / Operational Overview
        </h2>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-white p-8">
            <AdminWaveStatus label="Metrikler sorgulanıyor…" className="text-xs text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Aktif Öğrenci"
              count={metrics?.activeStudents || 0}
              subtext="Kayıtlı Profiller"
              href="/admin/ogrenciler"
            />
            <MetricCard
              label="Bugünkü Ders"
              count={metrics?.todayLessons || 0}
              subtext="Bugünkü Seanslar"
              href="/admin/randevular"
            />
            <MetricCard
              label="Bu Hafta Randevu"
              count={metrics?.weekAppointments || 0}
              subtext="Planlanan Seans"
              href="/admin/randevular"
            />
            <MetricCard
              label="Açık Destek Talebi"
              count={metrics?.openSupportTickets || 0}
              subtext="Yanıt Bekleyen"
              href="/admin/iletisim-destek"
              highlight={Boolean(metrics?.openSupportTickets)}
            />
            <MetricCard
              label="Ödeme Bekliyor"
              count={metrics?.awaitingPayments || 0}
              subtext="İnceleme Gerekli"
              href="/admin/odemeler"
              highlight={Boolean(metrics?.awaitingPayments)}
            />
            <MetricCard
              label="Hatalı E-Posta"
              count={metrics?.failedDeliveries || 0}
              subtext="Teslim Edilemeyen"
              href="/admin/bildirimler"
              alert={metrics ? metrics.failedDeliveries > 0 : false}
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
            title="Öğrenci Yönetimi"
            href="/admin/ogrenciler"
            icon={Users}
            description="Öğrenci profillerini ve ders geçmişlerini yönetin."
          />
          <ModuleLinkCard
            title="Ders & Randevular"
            href="/admin/randevular"
            icon={CalendarCheck}
            description="Seans randevularını ve takvimi yönetin."
          />
          <ModuleLinkCard
            title="İletişim & Destek"
            href="/admin/iletisim-destek"
            icon={MessageSquare}
            description="Web taleplerini ve öğrenci destek konuşmalarını yönetin."
          />
          <ModuleLinkCard
            title="Fiyatlandırma & Kuponlar"
            href="/admin/fiyatlandirma"
            icon={CreditCard}
            description="Paket fiyatlarını ve indirim kuponlarını yönetin."
          />
          <ModuleLinkCard
            title="Ödemeler & Finans"
            href="/admin/odemeler"
            icon={WalletCards}
            description="Ödeme işlemlerini ve banka havalelerini inceleyin."
          />
          <ModuleLinkCard
            title="Değerlendirmeler / Evaluations"
            href="/admin/degerlendirmeler"
            icon={ListChecks}
            description="Gönderilmiş öğrenci çalışmalarını inceleyip değerlendirin."
          />
          <ModuleLinkCard
            title="E-Posta Bildirimleri"
            href="/admin/bildirimler"
            icon={Bell}
            description="Resend e-posta teslimat loglarını inceleyin."
          />
          <ModuleLinkCard
            title="Site Ayarları"
            href="/admin/ayarlar"
            icon={Settings}
            description="Bildirim yönlendirmeleri ve genel ayarları yönetin."
          />
        </div>
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
