"use client";

import { ArrowRight, Building2, MapPin, ShieldCheck, AlertCircle, HelpCircle, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import type { ProgramMatchEvaluation } from "@/types/matching.types";
import type { DataQualityMetrics } from "@/types/confidence.types";

interface ProgramResultCardProps {
  match: ProgramMatchEvaluation;
  dataQuality?: DataQualityMetrics;
  onViewRequirements?: (programId: string) => void;
}

const CATEGORY_STYLE: Record<string, { label: string; bg: string; border: string; text: string; icon: LucideIcon }> = {
  ELIGIBLE: { label: "ELIGIBLE", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: CheckCircle2 },
  STRONG_MATCH: { label: "STRONG MATCH", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: CheckCircle2 },
  MATCH: { label: "MATCH", bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-300", icon: CheckCircle2 },
  REACH: { label: "REACH", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", icon: AlertCircle },
  REQUIREMENT_GAP: { label: "REQUIREMENT GAP", bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", icon: XCircle },
  MISSING_INFORMATION: { label: "MISSING INFORMATION", bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-300", icon: HelpCircle },
  CONFLICTING_DATA: { label: "CONFLICTING REQUIREMENTS", bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300", icon: AlertCircle },
  DATA_UNAVAILABLE: { label: "DATA UNAVAILABLE", bg: "bg-slate-800/50", border: "border-slate-700", text: "text-slate-400", icon: HelpCircle },
  UNKNOWN: { label: "DATA UNKNOWN", bg: "bg-slate-800/50", border: "border-slate-700", text: "text-slate-400", icon: HelpCircle },
};

export function ProgramResultCard({ match, dataQuality, onViewRequirements }: ProgramResultCardProps) {
  const badgeStyle = CATEGORY_STYLE[match.category] || CATEGORY_STYLE.UNKNOWN;
  const BadgeIcon = badgeStyle.icon;

  return (
    <div className="group relative rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 backdrop-blur-xl shadow-xl hover:border-slate-700 hover:shadow-2xl transition-all duration-300">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Building2 className="size-3.5 text-slate-400" />
            <span>{match.universityName}</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
            {match.programName}
          </h3>
        </div>

        {/* Categorical Match Badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold tracking-wide uppercase shadow-sm ${badgeStyle.bg} ${badgeStyle.border} ${badgeStyle.text}`}>
          <BadgeIcon className="size-3.5" />
          <span>{badgeStyle.label}</span>
        </div>
      </div>

      {/* Structured Explanations Checks */}
      <div className="mt-5 space-y-2 border-t border-b border-slate-800/80 py-4">
        {match.explanations.map((exp, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-xs font-medium">
            <span
              className={`font-mono text-sm shrink-0 ${
                exp.kind === "SUCCESS"
                  ? "text-emerald-400"
                  : exp.kind === "WARNING"
                  ? "text-amber-400"
                  : exp.kind === "MISSING"
                  ? "text-sky-400"
                  : exp.kind === "GAP"
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {exp.symbol}
            </span>
            <span
              className={
                exp.kind === "GAP"
                  ? "text-rose-300"
                  : exp.kind === "WARNING"
                  ? "text-amber-200"
                  : exp.kind === "MISSING"
                  ? "text-sky-200"
                  : "text-slate-300"
              }
            >
              {exp.message}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Info & Verification Badge */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>
            {dataQuality ? `Verified ${dataQuality.verificationDate}` : "Verified May 2026"}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">{dataQuality?.userFacingBadge || "Official Source"}</span>
        </div>

        <button
          type="button"
          onClick={() => onViewRequirements?.(match.programId)}
          className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <span>View requirements</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
