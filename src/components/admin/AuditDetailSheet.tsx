"use client";

import type { AuditLogRow } from "@/lib/admin/audit";
import {
  X,
  FileCheck,
  User,
  Calendar,
  Tag,
  ShieldAlert,
  Code2,
} from "lucide-react";

interface AuditDetailSheetProps {
  log: AuditLogRow | null;
  onClose: () => void;
}

export function AuditDetailSheet({ log, onClose }: AuditDetailSheetProps) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl z-10 border-l border-border">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-card text-foreground">
          <div className="flex items-center gap-2">
            <FileCheck className="size-5 text-[#819586]" />
            <h2 className="text-sm font-semibold tracking-wide">
              Denetim Kaydı Detayı / Audit Log Details
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
          {/* Action Header */}
          <div className="rounded-xl border border-border bg-background-soft p-4 shadow-xs space-y-2">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              İşlem Türü / Action
            </div>
            <div className="font-mono text-sm font-bold text-[#10271B]">
              {log.action}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
              <span>Log ID: #{log.id}</span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" />
                <span>{new Date(log.created_at).toLocaleString("tr-TR")}</span>
              </span>
            </div>
          </div>

          {/* Actor & Entity Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <User className="size-4 text-[#10271B]" />
              <span>İşlemi Yapan & Hedef Varlık</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">Aktör User ID</div>
                <div className="font-mono text-[11px] font-semibold text-foreground truncate mt-0.5">
                  {log.actor_user_id || "Sistem / Edge Function"}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Tag className="size-3 text-muted-foreground" />
                  <span>Entity Type</span>
                </div>
                <div className="font-semibold text-foreground mt-0.5 capitalize">
                  {log.entity_type}
                </div>
              </div>
            </div>

            {log.entity_id && (
              <div className="rounded-lg border border-border bg-white p-3 text-xs">
                <div className="text-[11px] text-muted-foreground">Entity ID</div>
                <div className="font-mono text-[11px] font-semibold text-foreground truncate mt-0.5">
                  {log.entity_id}
                </div>
              </div>
            )}
          </div>

          {/* Structured Metadata */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Code2 className="size-4 text-[#819586]" />
              <span>İşlem Meta Verileri / Audit Metadata</span>
            </h3>

            {log.metadata ? (
              <pre className="whitespace-pre-wrap rounded-xl border border-border bg-forest p-4 text-[11px] leading-relaxed text-emerald-400 font-mono overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-muted-foreground italic p-3 rounded-lg border border-border bg-background-soft">
                Bu işlem için ek meta veri kaydedilmemiş.
              </div>
            )}
          </div>

          {/* Read-Only Notice */}
          <div className="rounded-xl border border-border bg-background-soft p-4 text-xs text-muted-foreground flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-amber-600 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <strong>Salt Okunur Denetim Kaydı:</strong> Güvenlik ve mevzuat gereği denetim logları silinemez veya düzenlenemez. Tüm yönetici eylemleri değişmez bir biçimde saklanır.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
