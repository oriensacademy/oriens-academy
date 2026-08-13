"use client";

import { Award, ExternalLink, Globe2, Layers, ShieldCheck } from "lucide-react";
import type { Qualification } from "@/types/admission.types";

interface QualificationDetailCardProps {
  qualification: Qualification;
}

export function QualificationDetailCard({ qualification }: QualificationDetailCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-900 border border-amber-500/20 p-6 backdrop-blur-xl shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-400 uppercase">
            <Award className="size-4" />
            Qualification Discovery
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-100">{qualification.name} ({qualification.shortName})</h2>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl">{qualification.description}</p>
        </div>

        {qualification.officialUrl && (
          <a
            href={qualification.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-all"
          >
            <span>Official Portal</span>
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 pt-5 text-xs">
        <div>
          <span className="text-slate-400 block">Category</span>
          <span className="font-semibold text-slate-200">{qualification.category.replace("_", " ")}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Country Scope</span>
          <span className="font-semibold text-slate-200">{qualification.countryScope || "Global"}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Score Range</span>
          <span className="font-semibold text-amber-300">
            {qualification.minimumPossibleScore} - {qualification.maximumPossibleScore}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Score Type</span>
          <span className="font-semibold text-slate-200">{qualification.scoreType || "Numeric"}</span>
        </div>
      </div>
    </div>
  );
}
