import { NextRequest, NextResponse } from "next/server";
import { retrieveSearchResultsFromDatabase } from "@/lib/search/db-retrieval-service";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 120;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQ = searchParams.get("q") || "";
    const cleanQuery = rawQ.trim();

    if (cleanQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: "INVALID_SEARCH_QUERY" },
        { status: 400 },
      );
    }

    if (!cleanQuery) {
      return NextResponse.json({
        query: "",
        intent: "MIXED",
        confidence: 1.0,
        parsedQuery: {
          raw: "",
          normalized: "",
          universitiesCount: 0,
          countriesCount: 0,
          qualificationsCount: 0,
        },
        groups: {
          universities: [],
          programs: [],
          countries: [],
          qualifications: [],
        },
        totalCount: 0,
      });
    }

    const results = await retrieveSearchResultsFromDatabase(cleanQuery);

    return NextResponse.json({
      query: results.query,
      intent: results.intent,
      confidence: results.confidence,
      parsedQuery: {
        raw: results.parsedQuery.raw,
        normalized: results.parsedQuery.normalized,
        universitiesCount: results.parsedQuery.universities.length,
        countriesCount: results.parsedQuery.countries.length,
        qualificationsCount: results.parsedQuery.qualifications.length,
      },
      groups: results.groups,
      totalCount: results.totalCount,
    });
  } catch (error) {
    console.error("[Search Autocomplete API Error]:", error);
    return NextResponse.json(
      { error: "SEARCH_BACKEND_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
