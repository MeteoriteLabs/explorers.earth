import { useState, useEffect } from "react";
import tmdbService, { TMDBError } from "../../../services/tmdbService";
import type { TMDBSearchResult } from "../types";

export function useTMDBSearch(query: string) {
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await tmdbService.searchMulti(query);
        setResults(data);
      } catch (err) {
        if (err instanceof TMDBError) {
          setError(err.message);
        } else {
          setError("Search failed. Please try again.");
        }
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
