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

    const evaluator = new EligibilityEvaluator(supabase);
    const evaluation = await evaluator.evaluateProgramEligibility(programId, profile, admissionCycle || "2026/2027");

    return NextResponse.json(evaluation);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
