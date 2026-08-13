/**
 * Non-invasive Search Analytics & Performance Hook for Oriens Academy.
 * Stores anonymous query metrics for optimization, zero-result analysis, and click attribution.
 */

export interface SearchEvent {
  query: string;
  normalizedQuery: string;
  intent: string;
  totalResults: number;
  latencyMs: number;
  timestamp: string;
  filtersUsed?: Record<string, string | number | boolean>;
}

export interface SearchClickEvent {
  query: string;
  clickedId: string;
  clickedType: "UNIVERSITY" | "PROGRAM" | "COUNTRY" | "QUALIFICATION";
  clickedTitle: string;
  position: number;
  timestamp: string;
}

class SearchAnalyticsService {
  private events: SearchEvent[] = [];
  private clickEvents: SearchClickEvent[] = [];

  /**
   * Log search execution metrics anonymously.
   */
  public logSearch(event: Omit<SearchEvent, "timestamp">): void {
    const fullEvent: SearchEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);
    if (this.events.length > 500) {
      this.events.shift(); // Keep buffer bounded
    }

    if (process.env.NODE_ENV === "development" && event.totalResults === 0) {
      console.warn(`[Search Analytics] Zero-result search detected: "${event.query}" (Intent: ${event.intent})`);
    }
  }

  /**
   * Log search result clicks for ranking refinement.
   */
  public logClick(event: Omit<SearchClickEvent, "timestamp">): void {
    const fullEvent: SearchClickEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.clickEvents.push(fullEvent);
    if (this.clickEvents.length > 500) {
      this.clickEvents.shift();
    }
  }

  /**
   * Returns recent logged search events (for admin analytics dashboards).
   */
  public getRecentSearches(limit = 50): SearchEvent[] {
    return this.events.slice(-limit);
  }
}

export const searchAnalytics = new SearchAnalyticsService();
