import type { PastResult } from "./espn.server";

function streakFromEnd(results: PastResult[], keep: (r: PastResult) => boolean): number {
  let n = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (!keep(results[i]!)) break;
    n++;
  }
  return n;
}

/** Concrete, code-computed facts about a team's recent matches — scoring
 *  droughts, streaks, home/away splits. Never includes anything not directly
 *  derivable from real results (no injuries, no lineup news — there's no
 *  data source for that, so it's never invented here). Results are assumed
 *  chronological, oldest first. */
export function deriveTrends(team: string, results: PastResult[]): string[] {
  const facts: string[] = [];
  if (!results.length) return facts;

  const recent = results.slice(-5);
  const goalsInRecent = recent.reduce((a, r) => a + r.scored, 0);
  if (recent.length >= 3 && goalsInRecent <= recent.length) {
    facts.push(
      `${team} have managed just ${goalsInRecent} goal${goalsInRecent === 1 ? "" : "s"} in their last ${recent.length}`,
    );
  }

  const winStreak = streakFromEnd(results, (r) => r.scored > r.conceded);
  const unbeatenStreak = streakFromEnd(results, (r) => r.scored >= r.conceded);
  const winlessStreak = streakFromEnd(results, (r) => r.scored <= r.conceded);

  if (winStreak >= 3) {
    facts.push(`${team} have won their last ${winStreak} in a row`);
  } else if (unbeatenStreak >= 5) {
    facts.push(`${team} are unbeaten in their last ${unbeatenStreak}`);
  } else if (winlessStreak >= 4) {
    facts.push(`${team} are winless in their last ${winlessStreak}`);
  }

  const cleanSheets = recent.filter((r) => r.conceded === 0).length;
  if (cleanSheets >= 3) {
    facts.push(`${team} have kept ${cleanSheets} clean sheets in their last ${recent.length}`);
  }

  const home = results.filter((r) => r.isHome);
  const away = results.filter((r) => !r.isHome);
  if (home.length >= 3) {
    const wins = home.filter((r) => r.scored > r.conceded).length;
    facts.push(`${team} have won ${wins} of their last ${home.length} at home`);
  }
  if (away.length >= 3) {
    const wins = away.filter((r) => r.scored > r.conceded).length;
    facts.push(`${team} have won ${wins} of their last ${away.length} away from home`);
  }

  return facts.slice(0, 4);
}
