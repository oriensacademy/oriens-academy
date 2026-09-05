"use client";

import React from "react";
import { EligibilityEvaluationResult } from "@/lib/eligibility-engine/eligibility-evaluator";
import { ShieldCheck, AlertCircle, HelpCircle, ExternalLink, X, FileText, CheckCircle2 } from "lucide-react";

interface EligibilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  programName: string;
  universityName: string;
  eligibility: EligibilityEvaluationResult;
}

export const EligibilityDrawer: React.FC<EligibilityDrawerProps> = ({
  isOpen,
  onClose,
  programName,
  universityName,
  eligibility,
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "STRONG_MATCH":
        return <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30">STRONG MATCH</span>;
      case "MATCH":
        return <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-500/30">MATCH</span>;
      case "REACH":
        return <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold border border-amber-500/30">REACH</span>;
      case "REQUIREMENT_GAP":
        return <span className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs font-semibold border border-rose-500/30">REQUIREMENT GAP</span>;
      case "MISSING_INFORMATION":
        return <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-semibold border border-purple-500/30">MISSING INFORMATION</span>;
      case "CONFLICTING_DATA":
        return <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-semibold border border-orange-500/30">CONFLICTING REQUIREMENTS</span>;
      default:
        return <span className="px-3 py-1 bg-slate-500/20 text-slate-300 rounded-full text-xs font-semibold border border-slate-500/30">DATA UNAVAILABLE</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white">{programName}</h2>
              <p className="text-sm text-slate-400">{universityName}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/50">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Header */}
          <div className="my-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-6 h-6 text-sky-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Evaluation Status</p>
                <div className="mt-1">{getStatusBadge(eligibility.status)}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">{eligibility.matchScore}%</span>
              <p className="text-xs text-slate-400">Match Index</p>
            </div>
          </div>

          {/* Checks List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Source-Backed Requirements</h3>

            {eligibility.checks.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/20 border border-slate-800 text-slate-400 text-sm">
                No structured requirement data currently available in database for this program.
              </div>
            ) : (
              eligibility.checks.map((check) => (
                <div key={check.requirementId} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {check.status === "PASSED" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : check.status === "FAILED" ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <HelpCircle className="w-4 h-4 text-purple-400" />
                      )}
                      <span className="text-sm font-medium text-white">{check.category}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">{check.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400">Required:</span>{" "}
                      <span className="text-slate-200 font-semibold">{check.requiredValueText}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Your Profile:</span>{" "}
                      <span className="text-slate-200 font-semibold">{check.studentValueText}</span>
                    </div>
                  </div>

                  {check.provenance.rawSourceText && (
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400 flex items-start space-x-2">
                      <FileText className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <span className="italic line-clamp-2">{check.provenance.rawSourceText}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Cycle: {check.provenance.admissionCycle || "2026/2027"}</span>
                    {check.provenance.officialUrl && (
                      <a
                        href={check.provenance.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:underline flex items-center space-x-1"
                      >
                        <span>Official Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="pt-6 mt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400 italic">{eligibility.disclaimer}</p>
        </div>
      </div>
    </div>
  );
};
