import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { z } from "zod";
import type { Market, Sport, TeamForm } from "./types";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/** Groq's free tier (console.groq.com) — no credit card, OpenAI-compatible
 *  endpoint, ~14,400 requests/day, more than enough given predictions are
 *  cached for 20 minutes each. This is the primary path now; the Lovable
 *  gateway above is kept only as a fallback for anyone still running this
 *  inside Lovable's platform.
 *
 *  Model note: Groq deprecated its Llama chat models (llama-3.3-70b-versatile
 *  etc.) — "openai/gpt-oss-120b" is their current recommended general-purpose
 *  model as of this writing. If this ever 404s again, check
 *  https://console.groq.com/docs/deprecations or just call
 *  GET https://api.groq.com/openai/v1/models with your key for the live list. */
export function createGroqProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

const AnalysisSchema = z.object({
  headline: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
  bestBetKey: z.string(),
  adjustments: z.array(
    z.object({
      key: z.string(),
      probability: z.number(),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

interface AnalyseArgs {
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
  form: { home: TeamForm | null; away: TeamForm | null };
  trends: { home: string[]; away: string[] };
  expectedHome: number;
  expectedAway: number;
  expectedCorners: number | null;
  markets: Market[];
}

function describeForm(f: TeamForm | null) {
  if (!f || f.played === 0) return "no recent completed matches on record";
  return `last ${f.played}: ${f.formString} (${f.wins}W-${f.draws}D-${f.losses}L), ${f.scored} for / ${f.conceded} against`;
}

export async function analyseMatch(args: AnalyseArgs): Promise<Analysis | null> {
  const groqKey = process.env["GROQ_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!groqKey && !lovableKey) return null;

  const { model } = groqKey
    ? { model: createGroqProvider(groqKey)("openai/gpt-oss-120b") }
    : { model: createLovableAiGatewayProvider(lovableKey!)("google/gemini-3.6-flash") };

  const marketLines = args.markets
    .map(
      (m) =>
        `${m.name}\n` +
        m.selections
          .map((s) => `  ${s.key} | ${s.label} | model ${(s.probability * 100).toFixed(1)}%`)
          .join("\n"),
    )
    .join("\n");

  const trendLines =
    [...args.trends.home, ...args.trends.away].map((t) => `- ${t}`).join("\n") ||
    "- No notable streaks or droughts on record for either side";

  const prompt = `Fixture: ${args.homeTeam} (home) vs ${args.awayTeam} (away)
Competition: ${args.league} | Sport: ${args.sport} | Kickoff: ${args.kickoff ?? "TBC"}

Recent form
- ${args.homeTeam}: ${describeForm(args.form.home)}
- ${args.awayTeam}: ${describeForm(args.form.away)}

Verified recent-form facts (computed directly from match history — these are
the ONLY specific claims you may make about either team's recent run; do not
mention injuries, suspensions, transfers, lineups, or any other detail not
listed here, since no such data was provided):
${trendLines}

Statistical model expectation
- Expected ${args.sport === "basketball" ? "points" : "goals"}: home ${args.expectedHome}, away ${args.expectedAway}
${args.expectedCorners ? `- Expected corners: ${args.expectedCorners}` : ""}

Model probabilities by selection key:
${marketLines}

Task: act as a quantitative sports trader. Adjust the model probabilities where the form data, home advantage, competition context or scheduling suggest the pure Poisson/normal model is off. Keep adjustments disciplined: rarely move a probability by more than 12 percentage points, and keep mutually exclusive selections roughly summing to 100%. Return probabilities as decimals between 0.02 and 0.97 using the exact selection keys given. Pick one bestBetKey: the selection with the strongest edge and reasonable probability. confidence is 0-100. headline is under 70 characters. reasoning is 2-3 sentences written like a match-preview blurb, grounded specifically in the verified facts above (cite the actual numbers, e.g. "just 1 goal in 5") rather than generic hedging — but never invent a fact not given. For adjustments, list AT MOST 3 selections total — only the ones with a genuinely meaningful edge, not every market. Keep the whole response compact; do not pad it.

Respond with ONLY a single raw JSON object — no markdown code fences, no commentary before or after, no explanation. Exactly this shape, with "reasoning" written BEFORE "adjustments" so it's never the part that gets cut off if you run long:
{"headline": string, "confidence": number, "bestBetKey": string, "reasoning": string, "adjustments": [{"key": string, "probability": number}, ...] (at most 3 items)}`;

  try {
    const { text } = await generateText({
      model,
      maxOutputTokens: 1500,
      system:
        "You are the prediction engine for Max AI Tips: a disciplined quantitative football and basketball analyst. You output calibrated probabilities, never certainties. You never invent facts (injuries, transfers, lineups) beyond what's explicitly given to you. You always respond with raw JSON only — never markdown, never prose outside the JSON object.",
      prompt,
    });

    const parsed = extractJson(text);
    if (!parsed) {
      console.error("AI analysis returned no parsable JSON:", text.slice(0, 400));
      return null;
    }

    const result = AnalysisSchema.safeParse(parsed);
    if (!result.success) {
      console.error("AI analysis JSON failed schema validation:", result.error.message);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error("AI analysis failed", error);
    return null;
  }
}

/** Models sometimes wrap JSON in ```json fences or add stray text around it
 *  despite instructions not to — this pulls out the first complete JSON
 *  object it can find and parses that, rather than failing outright. */
function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
