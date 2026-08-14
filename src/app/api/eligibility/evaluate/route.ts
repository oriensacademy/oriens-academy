import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { EligibilityEvaluator } from "@/lib/eligibility-engine/eligibility-evaluator";
import { StudentAcademicProfile } from "@/lib/qualification-normalization/student-academic-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { programId, profile, admissionCycle } = body as {
      programId: string;
      profile: StudentAcademicProfile;
      admissionCycle?: string;
    };

    if (!programId || !profile) {
      return NextResponse.json({ error: "Missing programId or profile in request body" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Quarantined/non-program pages must never be evaluated as academic programs,
    // even though their historical requirements remain available for audit.
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, active, data_quality_status")
      .eq("id", programId)
      .maybeSingle();

    if (programError) throw programError;
    if (!program || !program.active || !["VALID_PROGRAM", "LIKELY_VALID_PROGRAM"].includes(program.data_quality_status)) {
      return NextResponse.json({
        programId,
        status: "DATA_UNAVAILABLE",
        matchScore: 0,
        totalChecks: 0,
        passedChecksCount: 0,
        failedChecksCount: 0,
        missingChecksCount: 0,
        checks: [],
        disclaimer: "Meeting published requirements does not guarantee admission.",
        evaluatedAt: new Date().toISOString(),
      });
    }

    const evaluator = new EligibilityEvaluator(supabase);
    const evaluation = await evaluator.evaluateProgramEligibility(programId, profile, admissionCycle || "2026/2027");

    return NextResponse.json(evaluation);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
