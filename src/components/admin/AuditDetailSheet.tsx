"use client";

import { useEffect, useState } from "react";
import type { AuditLogRow } from "@/lib/admin/audit";
import { listAdminAuditLogs } from "@/lib/admin/audit";
import {
  asAuditMetadata,
  auditActionLabel,
  auditEntityLabel,
  correlatePaymentTimeline,
  formatPaymentAmount,
  isPaymentAuditLog,
  paymentCorrelationReference,
  paymentTransactionId,
  safeAuditJson,
  toAuditText,
} from "@/lib/admin/audit-presentation";
import {
  X,
  FileCheck,
  User,
  Calendar,
  Tag,
  ShieldAlert,
  Code2,
  CreditCard,
  AlertTriangle,
  Clock,
  Copy,
  Check,
} from "lucide-react";

interface AuditDetailSheetProps {
  log: AuditLogRow | null;
  onClose: () => void;
}

export function AuditDetailSheet({ log, onClose }: AuditDetailSheetProps) {
  const logId = log?.id ?? null;
  const [selectedTimelineLog, setSelectedTimelineLog] = useState<AuditLogRow | null>(null);
  const [prevLogId, setPrevLogId] = useState<number | null>(logId);
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRow[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Synchronize selection with prop changes during render (per React guidelines)
  if (logId !== prevLogId) {
    setPrevLogId(logId);
    setSelectedTimelineLog(null);
    setShowRawJson(false);
  }

  const currentLog = selectedTimelineLog || log;

  // Check if current log is payment related
  const isPayment = isPaymentAuditLog(currentLog);
  const meta = asAuditMetadata(currentLog?.metadata);
  const publicRef = paymentCorrelationReference(currentLog);
  const transactionId = paymentTransactionId(currentLog);

  // Load timeline for correlated payment events
  useEffect(() => {
    if (!publicRef || !isPayment) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setLoadingTimeline(true);
      listAdminAuditLogs({
        search: publicRef,
        limit: 50,
      }).then((res) => {
        if (!active) return;
        // Sort oldest to newest
        const sorted = correlatePaymentTimeline(res.data, publicRef);
        setTimelineLogs(sorted);
        setLoadingTimeline(false);
      }).catch(() => {
        if (!active) return;
        setTimelineLogs([]);
        setLoadingTimeline(false);
      });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [publicRef, isPayment]);

  if (!currentLog) return null;

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Amount calculation
  const formattedAmount = formatPaymentAmount(meta);
  const failedReasonCode = toAuditText(meta.failed_reason_code);
  const failedReasonMsg = toAuditText(meta.failed_reason_msg);
  const safeErrorMsg = toAuditText(meta.safe_message) || toAuditText(meta.safe_error_message);
  const failureType = toAuditText(meta.failure_type);
  const severity = currentLog.severity.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl z-10 border-l border-border">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-card text-foreground">
          <div className="flex items-center gap-2">
            {isPayment ? (
              <CreditCard className="size-5 text-emerald-600" />
            ) : (
              <FileCheck className="size-5 text-[#819586]" />
            )}
            <h2 className="text-sm font-semibold tracking-wide">
              {isPayment ? "Ödeme Denetim Kaydı" : "Denetim Kaydı Detayı"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sage-soft hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Header Card */}
          <div className="rounded-xl border border-border bg-background-soft p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                İşlem Adımı
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  severity === "CRITICAL"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : severity === "ERROR"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : severity === "WARNING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {severity}
              </span>
            </div>

            <div className="text-base font-bold text-[#10271B]">
              {auditActionLabel(currentLog.action)}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {currentLog.action}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded border border-border bg-white px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{currentLog.category}</span>
              {currentLog.correlation_id && <span className="max-w-full truncate rounded border border-border bg-white px-2 py-0.5 font-mono text-[10px] text-muted-foreground">İlişki: {currentLog.correlation_id}</span>}
            </div>
            {safeErrorMsg && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{safeErrorMsg}</div>}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border">
              <span>Kayıt ID: #{currentLog.id}</span>
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="size-3 text-muted-foreground" />
                <span>{new Date(currentLog.created_at).toLocaleString("tr-TR")}</span>
              </span>
            </div>
          </div>

          {/* Structured Payment Info Card (if payment event) */}
          {isPayment && (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CreditCard className="size-4 text-emerald-700" />
                  <span>Ödeme Bilgileri</span>
                </span>
                {formattedAmount && (
                  <span className="font-heading text-sm font-bold text-emerald-900">
                    {formattedAmount}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Reference */}
                <div className="rounded-lg border border-emerald-200/60 bg-white p-2.5">
                  <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>PayTR Referansı</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(publicRef)}
                      className="inline-flex items-center gap-0.5 text-emerald-700 hover:text-emerald-900"
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      <span className="text-[10px]">{copied ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-[#10271B] truncate mt-0.5 select-all">
                    {publicRef || "—"}
                  </div>
                </div>

                {/* Transaction ID */}
                <div className="rounded-lg border border-emerald-200/60 bg-white p-2.5">
                  <div className="text-[10px] text-muted-foreground">İşlem ID (UUID)</div>
                  <div className="font-mono text-[11px] font-semibold text-foreground truncate mt-0.5">
                    {transactionId || "—"}
                  </div>
                </div>
              </div>

              {/* PayTR Error Code & Message Alert Box */}
              {(failedReasonCode || failedReasonMsg || safeErrorMsg) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-red-950">
                    <AlertTriangle className="size-4 text-red-600 shrink-0" />
                    <span>PayTR Hata Bildirimi</span>
                    {failedReasonCode && (
                      <span className="ml-auto rounded bg-red-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        Kod: {failedReasonCode}
                      </span>
                    )}
                  </div>
                  {failedReasonMsg && (
                    <div className="text-[11px] leading-relaxed">
                      <strong>Açıklama:</strong> {failedReasonMsg}
                    </div>
                  )}
                  {safeErrorMsg && safeErrorMsg !== failedReasonMsg && (
                    <div className="text-[11px] leading-relaxed">
                      <strong>Detay:</strong> {safeErrorMsg}
                    </div>
                  )}
                  {failureType && (
                    <div className="text-[10px] text-red-700 font-mono">
                      Hata Tipi: {failureType}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payment Lifecycle Timeline */}
          {isPayment && publicRef && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Clock className="size-4 text-[#10271B]" />
                  <span>Ödeme Akış Zaman Çizelgesi (Timeline)</span>
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {timelineLogs.length} Adım
                </span>
              </div>

              {loadingTimeline ? (
                <div className="text-xs text-muted-foreground p-3 rounded-lg border border-border bg-background-soft text-center animate-pulse">
                  Zaman çizelgesi yükleniyor…
                </div>
              ) : timelineLogs.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {timelineLogs.map((item) => {
                    const isSelected = item.id === currentLog.id;
                    const itemDate = new Date(item.created_at);
                    const timeStr = itemDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const isSuccess = item.action.includes("success") || item.action.includes("completed");
                    const isFailure = item.action.includes("failed") || item.action.includes("error") || item.action.includes("invalid") || item.action.includes("mismatch");

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedTimelineLog(item)}
                        className={`relative cursor-pointer rounded-lg border p-2.5 transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600/30 shadow-xs"
                            : "border-border bg-white hover:border-[#819586] hover:bg-background-soft"
                        }`}
                      >
                        {/* Timeline Node Bullet */}
                        <div
                          className={`absolute -left-[27px] top-3.5 size-3 rounded-full border-2 border-white shadow-xs ${
                            isSelected
                              ? "bg-emerald-600 ring-2 ring-emerald-300"
                              : isFailure
                                ? "bg-red-500"
                                : isSuccess
                                  ? "bg-emerald-500"
                                  : "bg-[#819586]"
                          }`}
                        />

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-foreground">
                            {auditActionLabel(item.action)}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                          {item.action}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 rounded-lg border border-border bg-background-soft">
                  Bu işlem için ilişkili başka log bulunamadı.
                </div>
              )}
            </div>
          )}

          {/* Actor & Target Entity */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <User className="size-4 text-[#10271B]" />
              <span>İşlemi Yapan & Hedef Varlık</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Aktör User ID</div>
                <div className="font-mono text-[11px] font-semibold text-foreground truncate mt-0.5">
                  {currentLog.actor_user_id || "Sistem İşlevi / Webhook"}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Tag className="size-3 text-muted-foreground" />
                  <span>Varlık Türü</span>
                </div>
                <div className="font-semibold text-foreground mt-0.5">
                  {auditEntityLabel(currentLog.entity_type)}
                </div>
              </div>
            </div>
          </div>

          {/* Raw Structured JSON (Collapsible) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Code2 className="size-4 text-[#819586]" />
                <span>Teknik Meta Veriler</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-xs text-emerald-800 font-semibold hover:underline"
              >
                {showRawJson ? "Gizle" : "JSON Göster"}
              </button>
            </div>

            {showRawJson && (
              currentLog.metadata ? (
                <pre className="whitespace-pre-wrap rounded-xl border border-border bg-forest p-4 text-[11px] leading-relaxed text-emerald-400 font-mono overflow-x-auto max-h-64">
                  {safeAuditJson(currentLog.metadata)}
                </pre>
              ) : (
                <div className="text-xs text-muted-foreground italic p-3 rounded-lg border border-border bg-background-soft">
                  Bu işlem için ek meta veri kaydedilmemiş.
                </div>
              )
            )}
          </div>

          {/* Read-Only Notice */}
          <div className="rounded-xl border border-border bg-background-soft p-4 text-xs text-muted-foreground flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-amber-600 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <strong>Denetim Kaydı:</strong> Bu kayıt, işlem ayrıntılarını incelemeniz için tutulur. Gereksiz kayıtları log listesindeki çöp kutusu simgesinden silebilirsiniz.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
