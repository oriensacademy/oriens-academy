"use client";

import { Globe, MapPin, Sparkles } from "lucide-react";
import type { Country } from "@/types/admission.types";

interface CountryDetailCardProps {
  country: Country;
  popularQualifications?: string[];
}

export function CountryDetailCard({ country, popularQualifications = ["IB", "SAT", "IMAT", "A-Level"] }: CountryDetailCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/10 via-slate-900/80 to-slate-900 border border-sky-500/20 p-6 backdrop-blur-xl shadow-xl">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-400 uppercase">
        <Globe className="size-4" />
        Country Admission Pathways
      </div>
      <h2 className="mt-2 text-2xl font-bold text-slate-100">{country.name}</h2>
      <p className="mt-1 text-sm text-slate-300">
        Region: <span className="text-sky-300 font-medium">{country.region || "Global"}</span> ({country.iso2} / {country.iso3})
      </p>

      <div className="mt-5 border-t border-slate-800/80 pt-4">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Recognized Admission Qualifications in {country.name}:
        </span>
        <div className="flex flex-wrap gap-2">
          {popularQualifications.map((code) => (
            <span key={code} className="px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs font-semibold">
              {code}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
