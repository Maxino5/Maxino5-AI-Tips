import { queryOptions } from "@tanstack/react-query";
import { getDailyMatches } from "./predictions.functions";
import type { Sport } from "./types";

export const matchesQuery = (date: string, sport: Sport) =>
  queryOptions({
    queryKey: ["matches", date, sport],
    queryFn: () => getDailyMatches({ data: { date, sport } }),
    staleTime: 3 * 60 * 1000,
  });

export const today = () => new Date().toISOString().slice(0, 10);
