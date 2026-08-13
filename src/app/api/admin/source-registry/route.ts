import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const universityId = searchParams.get("university_id");
  const domain = searchParams.get("domain");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let query = supabase
      .from("university_source_registry")
      .select(`
        id,
        university_id,
        source_type,
        url,
        canonical_url,
        domain,
        page_title,
        is_official,
        provenance_type,
        verification_status,
        priority,
        http_status,
        content_type,
        last_checked_at,
        universities (
          name,
          slug
        )
      `)
      .order("priority", { ascending: true })
      .limit(limit);

    if (universityId) {
      query = query.eq("university_id", universityId);
    }
    if (domain) {
      query = query.eq("domain", domain);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      total: data?.length || 0,
      registry: data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
