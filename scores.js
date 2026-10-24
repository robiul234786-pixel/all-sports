const SPORTS = [
  { key: "football", label: "Football", symbol: "⚽", color: "green" },
  { key: "basketball", label: "Basketball", symbol: "🏀", color: "orange" },
  { key: "cricket", label: "Cricket", symbol: "🏏", color: "blue" },
  { key: "tennis", label: "Tennis", symbol: "🎾", color: "purple" },
];

// SportScore documents live/recent matches at /api/widget/matches/.
// Its response schema can evolve, so the mapper accepts common field names.
const first = (...values) => values.find(v => v !== undefined && v !== null && v !== "");
const str = (v, fallback = "–") => {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(x => typeof x === "object" ? first(x?.score, x?.runs, x?.points, "") : x).filter(Boolean).join(" / ") || fallback;
  if (typeof v === "object") return String(first(v.display, v.value, v.total, v.runs, v.points, v.score, "–"));
  return fallback;
};
const nestedName = v => typeof v === "object" && v ? first(v.name, v.title, v.shortName, v.fullName) : v;
const abbreviation = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";

function normalizeMatch(m, sport) {
  const competitors = Array.isArray(m?.competitors) ? m.competitors : [];
  const homeObj = first(m?.homeTeam, m?.home_team, m?.home, m?.player1, m?.playerOne, competitors[0], {});
  const awayObj = first(m?.awayTeam, m?.away_team, m?.away, m?.player2, m?.playerTwo, competitors[1], {});
  const home = str(nestedName(homeObj), "Competitor 1");
  const away = str(nestedName(awayObj), "Competitor 2");

  const scoreObj = m?.score || m?.scores || {};
  const homeScore = first(
    homeObj?.score, homeObj?.runs, homeObj?.points,
    m?.homeScore, m?.home_score, m?.scoreHome,
    scoreObj?.home, scoreObj?.homeScore, scoreObj?.home_score,
    m?.player1Score, m?.player1_score, m?.team1Score
  );
  const awayScore = first(
    awayObj?.score, awayObj?.runs, awayObj?.points,
    m?.awayScore, m?.away_score, m?.scoreAway,
    scoreObj?.away, scoreObj?.awayScore, scoreObj?.away_score,
    m?.player2Score, m?.player2_score, m?.team2Score
  );
  const rawStatus = String(first(m?.status, m?.state, m?.matchStatus, m?.statusText, m?.phase, "scheduled"));
  const s = rawStatus.toLowerCase();
  const status = /live|in.progress|in_play|playing|started|period|quarter|innings/.test(s)
    ? "live"
    : /finished|full.time|complete|ended|final|result|retired|walkover/.test(s)
      ? "finished"
      : "upcoming";
  const statusText = str(first(m?.statusText, m?.status_detail, m?.clock, m?.time, m?.dateLabel, rawStatus), "Scheduled");
  const competition = str(first(m?.competition?.name, m?.league?.name, m?.tournament?.name, m?.competitionName, m?.leagueName, m?.tournamentName, m?.eventName), sport.label);
  const id = str(first(m?.id, m?.matchId, m?.match_id, m?.slug, m?.urlSlug), `${sport.key}-${home}-${away}`);
  return {
    competition,
    row: [home, away, str(homeScore), str(awayScore), statusText, status,
      str(first(homeObj?.shortName, homeObj?.short_name, homeObj?.abbreviation), abbreviation(home)),
      str(first(awayObj?.shortName, awayObj?.short_name, awayObj?.abbreviation), abbreviation(away)),
      `${sport.key}:${id}`],
  };
}

let cachedAt = 0;
let cachedGroups = null;
let cachedUnavailable = [];
const CACHE_MS = 55_000;

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  // The upstream endpoint returns live/recent matches, not a date-specific archive.
  // Keep a short in-memory cache so the four sports don't exceed the free request allowance.
  if (!cachedGroups || Date.now() - cachedAt > CACHE_MS) {
    const results = await Promise.all(SPORTS.map(async sport => {
      try {
        const apiUrl = new URL("https://sportscore.com/api/widget/matches/");
        apiUrl.searchParams.set("sport", sport.key);
        apiUrl.searchParams.set("limit", "50");
        apiUrl.searchParams.set("src", "allsport");
        const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`SportScore returned ${response.status}`);
        const json = await response.json();
        const matches = Array.isArray(json) ? json : (Array.isArray(json?.matches) ? json.matches : []);
        const normalized = matches.map(m => normalizeMatch(m, sport));
        return {
          group: {
            name: sport.label,
            sport: sport.label,
            symbol: sport.symbol,
            color: sport.color,
            region: "SportScore",
            path: sport.key,
            matches: normalized.map(x => x.row),
          },
          unavailable: null,
        };
      } catch (error) {
        return { group: null, unavailable: `${sport.label}: ${error instanceof Error ? error.message : "unavailable"}` };
      }
    }));
    cachedGroups = results.map(r => r.group).filter(Boolean);
    cachedUnavailable = results.map(r => r.unavailable).filter(Boolean);
    cachedAt = Date.now();
  }

  return Response.json({
    date: requestedDate,
    updatedAt: new Date(cachedAt).toISOString(),
    unavailable: cachedUnavailable,
    groups: cachedGroups,
    source: "SportScore",
  }, { headers: { "Cache-Control": "public, max-age=30" } });
}
