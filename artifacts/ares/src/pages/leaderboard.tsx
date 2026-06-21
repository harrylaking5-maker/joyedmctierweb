import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useGetLeaderboard, getGetLeaderboardQueryKey, useGetOverviewLeaderboard, getGetOverviewLeaderboardQueryKey } from "@/lib/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MODES, SUB_MODES, TIER_COLORS, TIER_BORDER_GLOW, EU_COUNTRIES, type ModeKey, type SubModeKey } from "@/lib/tiers";
import { Trophy, Crown, Swords, Star, Zap, Server, Shield, Menu, Copy, Check, Sword, FlaskConical, Gem, Axe, Sparkles, Hammer, Target, Search, X, MessageCircle, Info, FileText, BowArrow, Wind } from "lucide-react";
import logoUrl from "@assets/JTlogoNEW.png";
import heroLogoUrl from "@assets/joyedtier.png";
import CookieBanner from "@/components/CookieBanner";
 
type TabKey = ModeKey | "overview";
type SubTabKey = SubModeKey | "sub-overview";
type PageKey = "leaderboard" | "subleaderboard" | "ranks" | "server" | "contact" | "about" | "privacy";
 
function ModeIcon({ mode, className = "w-3.5 h-3.5" }: { mode: string; className?: string }) {
  switch (mode) {
    case "sword":    return <Sword className={className} />;
    case "axe":      return <Axe className={className} />;
    case "dpot":     return <FlaskConical className={className} />;
    case "nethpot":  return <FlaskConical className={className} />;
    case "smp":      return <Target className={className} />;
    case "crystal":  return <Gem className={className} />;
    case "mace":     return <Hammer className={className} />;
    case "uhc":      return <Sparkles className={className} />;
    case "cartpvp":  return <Zap className={className} />;
    case "speed":    return <Zap className={className} />;
    case "bow":      return <BowArrow className={className} />;
    case "creeper":  return <Zap className={className} />;
    case "trident":  return <Zap className={className} />;
    case "elytra":   return <Wind className={className} />;
    case "diamondsmp": return <Sword className={className} />;
    case "diamondvanilla": return <Sword className={className} />;
  }
}
 
const TIERS = [
  { key: "HT1", name: "High Tier 1", mmr: "3700+ (dethrone current HT1)", how: "Defeat the current HT1 holder in a duel. Only one player can hold this throne per mode.", special: true },
  { key: "LT1", name: "Low Tier 1",  mmr: "3300 – 3699", how: "Reach 3300+ MMR in any ranked mode." },
  { key: "HT2", name: "High Tier 2", mmr: "2900 – 3299", how: "Reach 2900+ MMR in any ranked mode." },
  { key: "LT2", name: "Low Tier 2",  mmr: "2500 – 2899", how: "Reach 2500+ MMR in any ranked mode." },
  { key: "HT3", name: "High Tier 3", mmr: "2100 – 2499", how: "Reach 2100+ MMR in any ranked mode." },
  { key: "LT3", name: "Low Tier 3",  mmr: "1700 – 2099", how: "Reach 1700+ MMR in any ranked mode." },
  { key: "HT4", name: "High Tier 4", mmr: "1300 – 1699", how: "Reach 1300+ MMR in any ranked mode." },
  { key: "LT4", name: "Low Tier 4",  mmr: "900 – 1299",  how: "Reach 900+ MMR in any ranked mode." },
  { key: "HT5", name: "High Tier 5", mmr: "500 – 899",   how: "Reach 500+ MMR in any ranked mode." },
  { key: "LT5", name: "Low Tier 5",  mmr: "0 – 499",     how: "Complete 10 placement matches in any ranked mode." },
];
 
const TIER_COLOR_STYLES: Record<string, { color: string; background: string; border: string }> = {
  HT1: { color: "#fcd34d", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)" },
  LT1: { color: "#fde047", background: "rgba(234,179,8,0.15)",  border: "1px solid rgba(234,179,8,0.35)" },
  HT2: { color: "#d8b4fe", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)" },
  LT2: { color: "#a5b4fc", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)" },
  HT3: { color: "#93c5fd", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.35)" },
  LT3: { color: "#67e8f9", background: "rgba(6,182,212,0.15)",  border: "1px solid rgba(6,182,212,0.35)" },
  HT4: { color: "#6ee7b7", background: "rgba(5,150,105,0.15)",  border: "1px solid rgba(5,150,105,0.35)" },
  LT4: { color: "#bef264", background: "rgba(101,163,13,0.15)", border: "1px solid rgba(101,163,13,0.35)" },
  HT5: { color: "#fdba74", background: "rgba(234,88,12,0.15)",  border: "1px solid rgba(234,88,12,0.35)" },
  LT5: { color: "#a1a1aa", background: "rgba(63,63,70,0.4)",    border: "1px solid rgba(82,82,91,0.4)" },
  Unranked: { color: "#71717a", background: "rgba(39,39,42,0.4)", border: "1px solid rgba(63,63,70,0.4)" },
};
 
function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] ?? TIER_COLORS["Unranked"];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono tracking-wide ${cls}`}>
      {tier === "HT1" && <Crown className="w-3 h-3 mr-1 text-amber-300" />}
      {tier}
    </span>
  );
}
 
function PlayerHead({ username, rank }: { uuid: string; username: string; rank?: number }) {
  const [errored, setErrored] = useState(false);
  const ringStyle =
    rank === 1 ? { boxShadow: "0 0 0 2px rgba(251,191,36,.75), 0 0 12px rgba(251,191,36,.35)" }
    : rank === 2 ? { boxShadow: "0 0 0 2px rgba(203,213,225,.55), 0 0 8px rgba(203,213,225,.2)" }
    : rank === 3 ? { boxShadow: "0 0 0 2px rgba(251,146,60,.6), 0 0 8px rgba(251,146,60,.25)" }
    : undefined;
  return (
    <div className="relative flex-shrink-0 rounded-lg" style={ringStyle}>
      <img
        src={errored ? `https://minotar.net/helm/MHF_Steve/40` : `https://minotar.net/helm/${username}/40`}
        alt={username}
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg shadow-lg block"
        style={{ imageRendering: "pixelated" }}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
 
function RegionBadge({ region }: { region?: string | null }) {
  if (!region) return null;
  const label = region === "EU" ? "EU" : "US";
  const isEU = label === "EU";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider flex-shrink-0 ${
      isEU ? "bg-blue-500/15 text-blue-300 border border-blue-400/28" : "bg-sky-500/15 text-sky-300 border border-sky-400/28"
    }`}>{label}</span>
  );
}
 
function WinLoss({ wins, losses }: { wins: number; losses: number }) {
  return (
    <div className="flex items-center justify-end gap-1 font-mono text-xs">
      <span className="text-emerald-400 font-bold">W{wins}</span>
      <span className="text-muted-foreground opacity-50">/</span>
      <span className="text-red-400 font-bold">L{losses}</span>
    </div>
  );
}
 
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="rank-1 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-base sm:text-lg font-black font-mono flex-shrink-0">1</span>;
  if (rank === 2) return <span className="rank-2 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-black font-mono flex-shrink-0">2</span>;
  if (rank === 3) return <span className="rank-3 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-black font-mono flex-shrink-0">3</span>;
  return <span className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-sm font-bold font-mono text-muted-foreground/60 flex-shrink-0">{rank}</span>;
}
 
function ColHeader({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 ${right ? "text-right" : ""}`}>{children}</div>;
}
 
function LeaderboardSkeleton() {
  return (
    <div className="p-3 sm:p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 flex items-center gap-2 sm:gap-3">
          <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />
          <Skeleton className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-20 h-3" />
          </div>
          <Skeleton className="hidden sm:block w-16 h-5 rounded-md" />
          <Skeleton className="hidden sm:block w-14 h-4" />
        </div>
      ))}
    </div>
  );
}
 
function PlayerSearch() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
 
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) navigate(`/player/${trimmed}`);
  };
 
  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-sm">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player..."
          className="w-full pl-9 pr-9 py-2 rounded-xl text-sm font-medium bg-white/7 border border-white/12 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-sky-400/40 focus:bg-white/10 transition-all"
          style={{ backdropFilter: "blur(8px)" }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="absolute right-2.5 p-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
 
function ModeLeaderboard({ mode }: { mode: ModeKey }) {
  const { data, isLoading, isError } = useGetLeaderboard(mode, undefined, {
    query: { queryKey: getGetLeaderboardQueryKey(mode) },
  });
  if (isLoading) return <LeaderboardSkeleton />;
  if (isError || !data) return <div className="text-center py-24 text-muted-foreground"><p className="text-sm">Failed to load leaderboard.</p></div>;
  const entries = data.entries ?? [];
  if (!entries.length) return <div className="text-center py-24 text-muted-foreground"><Zap className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No ranked players yet.</p></div>;
  return (
    <div>
      <div className="hidden sm:grid grid-cols-[40px_44px_1fr_88px_96px_80px_84px] items-center gap-3 px-7 sm:px-8 pt-3 pb-2">
        <div /><div /><ColHeader>Player</ColHeader><ColHeader right>MMR</ColHeader><ColHeader right>W / L</ColHeader><ColHeader right>Points</ColHeader><ColHeader right>Tier</ColHeader>
      </div>
      <div className="lb-scroll overflow-y-auto max-h-[370px] px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
        {entries.map((entry: any) => {
          const rankClass = entry.rank === 1 ? "row-rank-1" : entry.rank === 2 ? "row-rank-2" : entry.rank === 3 ? "row-rank-3" : "";
          const displayTier = entry.isHT1 ? "HT1" : entry.tier;
          return (
            <Link key={entry.uuid} href={`/player/${entry.username}`}>
              <div className={`glass-card rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 grid grid-cols-[36px_40px_1fr_auto] sm:grid-cols-[40px_44px_1fr_88px_96px_80px_84px] items-center gap-2 sm:gap-3 cursor-pointer ${entry.isHT1 ? "row-ht1" : ""} ${rankClass} ${TIER_BORDER_GLOW[displayTier] ?? ""}`}>
                <RankBadge rank={entry.rank} />
                <PlayerHead uuid={entry.uuid} username={entry.username} rank={entry.rank} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground truncate text-sm sm:text-[15px]">{entry.username}</span>
                    {entry.isHT1 && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    <RegionBadge region={entry.region} />
                  </div>
                  {/* Mobile: just MMR + pts, no tier pill — full details on player profile */}
                  <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                    <span className="font-mono text-[11px] text-foreground/60">{entry.mmr.toLocaleString()} MMR</span>
                    <span className="font-mono text-[11px] text-sky-400 font-bold">{entry.points}pts</span>
                  </div>
                  {/* Desktop: mode + tier pill */}
                  <div className="hidden sm:flex items-center gap-1 mt-0.5">
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                      style={TIER_COLOR_STYLES[displayTier] ?? TIER_COLOR_STYLES["Unranked"]}
                    >
                      <ModeIcon mode={mode} className="w-2.5 h-2.5" />
                      {displayTier}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block text-right"><span className="font-mono text-sm text-foreground/90 font-semibold">{entry.mmr.toLocaleString()}</span></div>
                <div className="hidden sm:block text-right"><WinLoss wins={entry.wins} losses={entry.losses} /></div>
                <div className="hidden sm:block text-right"><span className="font-mono font-black text-sky-400 text-base">{entry.points}</span><span className="text-muted-foreground text-[11px] ml-0.5">pts</span></div>
                <div className="hidden sm:flex justify-end"><TierBadge tier={displayTier} /></div>
                {/* Mobile right: W/L */}
                <div className="sm:hidden flex flex-col items-end">
                  <WinLoss wins={entry.wins} losses={entry.losses} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
 
function OverviewLeaderboard() {
  const { data, isLoading, isError } = useGetOverviewLeaderboard(undefined, {
    query: { queryKey: getGetOverviewLeaderboardQueryKey() },
  });
  if (isLoading) return <LeaderboardSkeleton />;
  if (isError || !data) return <div className="text-center py-24 text-muted-foreground"><p className="text-sm">Failed to load overview.</p></div>;
  const entries = data.entries ?? [];
  if (!entries.length) return <div className="text-center py-24 text-muted-foreground"><Zap className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No ranked players yet.</p></div>;
  return (
    <div>
      <div className="hidden sm:grid grid-cols-[40px_44px_1fr_96px_100px] items-center gap-3 px-7 sm:px-8 pt-3 pb-2">
        <div /><div /><ColHeader>Player</ColHeader><ColHeader right>W / L</ColHeader><ColHeader right>Points</ColHeader>
      </div>
      <div className="lb-scroll overflow-y-auto max-h-[370px] px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
        {entries.map((entry: any) => {
          const rankClass = entry.rank === 1 ? "row-rank-1" : entry.rank === 2 ? "row-rank-2" : entry.rank === 3 ? "row-rank-3" : "";
          const modesFixed = (entry.modes ?? []).map((m: { mode: string; tier: string; isHT1?: boolean }) => ({
            ...m,
            tier: m.isHT1 ? "HT1" : m.tier,
          }));
          return (
            <Link key={entry.uuid} href={`/player/${entry.username}`}>
              <div className={`glass-card rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 grid grid-cols-[36px_40px_1fr_auto] sm:grid-cols-[40px_44px_1fr_96px_100px] items-center gap-2 sm:gap-3 cursor-pointer ${rankClass}`}>
                <RankBadge rank={entry.rank} />
                <PlayerHead uuid={entry.uuid} username={entry.username} rank={entry.rank} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground truncate text-sm sm:text-[15px]">{entry.username}</span>
                    <RegionBadge region={entry.region} />
                  </div>
                  <div className="hidden sm:flex items-center gap-1 mt-0.5 flex-wrap">
                    {modesFixed.map((m: { mode: string; tier: string }) => (
                      <span
                        key={m.mode}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                        style={TIER_COLOR_STYLES[m.tier] ?? TIER_COLOR_STYLES["Unranked"]}
                      >
                        <ModeIcon mode={m.mode} className="w-2.5 h-2.5" />
                        {m.tier}
                      </span>
                    ))}
                    {(!entry.modes || entry.modes.length === 0) && (
                      <span className="text-[10px] text-muted-foreground/40">{entry.rankedModes} mode{entry.rankedModes !== 1 ? "s" : ""} ranked</span>
                    )}
                  </div>
                  <div className="sm:hidden mt-0.5">
                    <span className="text-[11px] text-muted-foreground/50 font-mono">
                      {entry.modes?.length ?? entry.rankedModes ?? 0} mode{(entry.modes?.length ?? entry.rankedModes) !== 1 ? "s" : ""} ranked
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block text-right"><WinLoss wins={entry.totalWins} losses={entry.totalLosses} /></div>
                <div className="text-right">
                  <span className="font-mono font-black text-sky-400 text-lg sm:text-xl">{entry.totalPoints}</span>
                  <span className="text-muted-foreground text-[11px] ml-0.5">pts</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SubModeLeaderboard({ mode }: { mode: SubModeKey }) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    fetch(`/api/sub-leaderboard/${mode}`)
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed");
        return r.json();
      })
      .then((json) => setData(json))
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [mode]);

  if (isLoading) return <LeaderboardSkeleton />;
  if (isError || !data) return <div className="text-center py-24 text-muted-foreground"><p className="text-sm">Failed to load subleaderboard.</p></div>;
  const entries = data.entries ?? [];
  if (!entries.length) return <div className="text-center py-24 text-muted-foreground"><Zap className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No ranked SubDuels players yet.</p></div>;

  return (
    <div>
      <div className="hidden sm:grid grid-cols-[40px_44px_1fr_96px_100px] items-center gap-3 px-7 sm:px-8 pt-3 pb-2">
        <div /><div /><ColHeader>Player</ColHeader><ColHeader right>MMR</ColHeader><ColHeader right>W / L</ColHeader><ColHeader right>Points</ColHeader>
      </div>
      <div className="lb-scroll overflow-y-auto max-h-[370px] px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
        {entries.map((entry: any) => (
          <Link key={entry.uuid} href={`/player/${entry.username}`}>
            <div className="glass-card rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 grid grid-cols-[36px_40px_1fr_auto] sm:grid-cols-[40px_44px_1fr_96px_100px] items-center gap-2 sm:gap-3 cursor-pointer">
              <RankBadge rank={entry.rank} />
              <PlayerHead uuid={entry.uuid} username={entry.username} rank={entry.rank} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-foreground truncate text-sm sm:text-[15px]">{entry.username}</span>
                  <RegionBadge region={entry.region} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[11px] text-muted-foreground/60">{entry.mmr.toLocaleString()} MMR</span>
                  <TierBadge tier={entry.isHT1 ? "HT1" : entry.tier} />
                </div>
              </div>
              <div className="hidden sm:block text-right"><span className="font-mono text-sm text-foreground/90 font-semibold">{entry.mmr.toLocaleString()}</span></div>
              <div className="hidden sm:block text-right"><WinLoss wins={entry.wins} losses={entry.losses} /></div>
              <div className="text-right"><span className="font-mono font-black text-sky-400 text-base">{entry.points}</span><span className="text-muted-foreground text-[11px] ml-0.5">pts</span></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SubOverviewLeaderboard() {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    fetch("/api/sub-leaderboard/overview")
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed");
        return r.json();
      })
      .then((json) => setData(json))
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LeaderboardSkeleton />;
  if (isError || !data) return <div className="text-center py-24 text-muted-foreground"><p className="text-sm">Failed to load SubDuels overview.</p></div>;
  const entries = data.entries ?? [];
  if (!entries.length) return <div className="text-center py-24 text-muted-foreground"><Zap className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No ranked SubDuels players yet.</p></div>;

  return (
    <div>
      <div className="hidden sm:grid grid-cols-[40px_44px_1fr_96px_100px] items-center gap-3 px-7 sm:px-8 pt-3 pb-2">
        <div /><div /><ColHeader>Player</ColHeader><ColHeader right>W / L</ColHeader><ColHeader right>Points</ColHeader>
      </div>
      <div className="lb-scroll overflow-y-auto max-h-[370px] px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
        {entries.map((entry: any) => (
          <Link key={entry.uuid} href={`/player/${entry.username}`}>
            <div className="glass-card rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 grid grid-cols-[36px_40px_1fr_auto] sm:grid-cols-[40px_44px_1fr_96px_100px] items-center gap-2 sm:gap-3 cursor-pointer">
              <RankBadge rank={entry.rank} />
              <PlayerHead uuid={entry.uuid} username={entry.username} rank={entry.rank} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-foreground truncate text-sm sm:text-[15px]">{entry.username}</span>
                  <RegionBadge region={entry.region} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/60 font-mono">
                  {entry.modes?.length ?? 0} mode{(entry.modes?.length ?? 0) !== 1 ? "s" : ""} ranked
                </div>
              </div>
              <div className="hidden sm:block text-right"><WinLoss wins={entry.totalWins} losses={entry.totalLosses} /></div>
              <div className="text-right"><span className="font-mono font-black text-sky-400 text-lg sm:text-xl">{entry.totalPoints}</span><span className="text-muted-foreground text-[11px] ml-0.5">pts</span></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SubLeaderboardSection() {
  const [activeTab, setActiveTab] = useState<SubTabKey>("sub-overview");
  const activeMode = SUB_MODES.find((m) => m.key === activeTab);
  return (
    <>
      <div className="glass-tabs rounded-2xl p-2 mb-5 overflow-x-auto tabs-scroll">
        <div className="flex gap-1.5 min-w-max sm:min-w-0 sm:flex-wrap">
          <button onClick={() => setActiveTab("sub-overview")} className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "sub-overview" ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/6"}`}>
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />Overview
          </button>
          {SUB_MODES.map((m) => (
            <button key={m.key} onClick={() => setActiveTab(m.key as SubModeKey)} className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === m.key ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/6"}`}>
              <ModeIcon mode={m.key} />{m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="glass-wrap">
        <div className="glass rounded-[1.1rem] overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 flex-wrap border-b border-white/6">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                {activeTab === "sub-overview" ? <><Zap className="w-4 h-4 text-purple-400" />SubDuels Overview</> : <><ModeIcon mode={activeTab} className="w-4 h-4 text-purple-400" />{activeMode?.label ?? activeTab}</>}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{activeTab === "sub-overview" ? "SubDuels total points across all sub modes" : "SubDuels · Sorted by MMR · top 50 players"}</p>
            </div>
            <div className="flex items-center gap-2"><PlayerSearch /></div>
          </div>
          <div className="glass-rainbow-line" />
          {activeTab === "sub-overview" ? <SubOverviewLeaderboard /> : <SubModeLeaderboard mode={activeTab as SubModeKey} />}
          <div className="mt-4 px-5 sm:px-8 pb-6 text-center text-sm text-muted-foreground">10 SubDuels matches per mode required to appear on the leaderboard.</div>
        </div>
      </div>
    </>
  );
}

function LeaderboardSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const activeMode = MODES.find((m) => m.key === activeTab);
  return (
    <>
      <div className="glass-tabs rounded-2xl p-2 mb-5 overflow-x-auto tabs-scroll">
        <div className="flex gap-1.5 min-w-max sm:min-w-0 sm:flex-wrap">
          <button onClick={() => setActiveTab("overview")} className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "overview" ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/6"}`}>
            <Trophy className="w-3.5 h-3.5 flex-shrink-0" />Overview
          </button>
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setActiveTab(m.key as ModeKey)} className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === m.key ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/6"}`}>
              <ModeIcon mode={m.key} />{m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="glass-wrap">
        <div className="glass rounded-[1.1rem] overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 flex-wrap border-b border-white/6">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                {activeTab === "overview" ? <><Trophy className="w-4 h-4 text-sky-400" />Overall Rankings</> : <><ModeIcon mode={activeTab} className="w-4 h-4 text-sky-400" />{activeMode?.label ?? activeTab}</>}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{activeTab === "overview" ? "Ranked by total points across all modes" : "Sorted by MMR · top 50 players"}</p>
            </div>
            <div className="flex items-center gap-2">
              <PlayerSearch />
            </div>
          </div>
          <div className="glass-rainbow-line" />
          {activeTab === "overview" ? <OverviewLeaderboard /> : <ModeLeaderboard mode={activeTab as ModeKey} />}
          <div className="mt-4 px-5 sm:px-8 pb-6 text-center text-sm text-muted-foreground">
            10 duel matches are required to be ranked and appear on the leaderboard.
          </div>
        </div>
      </div>
    </>
  );
}
 
function RanksPage() {
  return (
    <div className="glass-wrap">
      <div className="glass rounded-[1.1rem] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3 border-b border-white/6">
          <Shield className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Rank Tiers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">How rankings work on JoyedTiers</p>
          </div>
        </div>
        <div className="glass-rainbow-line" />
        <div className="px-3 sm:px-5 py-4 space-y-2.5">
          <div className="glass-card rounded-xl px-4 py-3 flex items-start gap-3">
            <Zap className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Placements Required</p>
              <p className="text-xs text-muted-foreground mt-0.5">10 duel matches per mode required before your rank shows on the leaderboard. MMR starts at 1000.</p>
            </div>
          </div>
          {TIERS.map((tier) => (
            <div key={tier.key} className={`glass-card rounded-xl px-4 py-3.5 flex items-start gap-4 ${tier.special ? "row-ht1" : ""}`}>
              <div className="flex-shrink-0 mt-0.5"><TierBadge tier={tier.key} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-sm">{tier.name}</span>
                  {tier.special && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  <span className="font-mono text-[10px] text-muted-foreground bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">{tier.mmr} MMR</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{tier.how}</p>
              </div>
            </div>
          ))}
          <div className="glass-card rounded-xl px-4 py-3.5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">How MMR Works</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">↑</span><span>Win games to gain MMR. K-factor is higher during placements (first 10 matches).</span></div>
              <div className="flex items-start gap-2"><span className="text-red-400 font-bold mt-0.5">↓</span><span>LT2+ players lose MMR if inactive for 3+ days (rank decay).</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">≈</span><span>MMR gain/loss is Elo-based — beating stronger players gives more MMR.</span></div>
              <div className="flex items-start gap-2"><span className="text-amber-400 font-bold mt-0.5">★</span><span>HT1 is unique — only one player holds the throne per mode. Dethrone them to take it.</span></div>
            </div>
          </div>
          <div className="glass-card rounded-xl px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Ranked Modes</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MODES.map((m) => (
                <div key={m.key} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2 border border-white/8">
                  <ModeIcon mode={m.key} className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground/90">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 px-5 sm:px-8 pb-6 text-center text-xs text-muted-foreground">
          Rankings are tracked separately per mode. Play multiple modes to earn more total points.
        </div>
      </div>
    </div>
  );
}
 
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex-shrink-0 p-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}
 
function ServerPage() {
  return (
    <div className="glass-wrap">
      <div className="glass rounded-[1.1rem] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3 border-b border-white/6">
          <Server className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Server Info</h2>
            <p className="text-xs text-muted-foreground mt-0.5">How to join JoyedTiers</p>
          </div>
        </div>
        <div className="glass-rainbow-line" />
        <div className="px-3 sm:px-5 py-5 space-y-4">
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-sm text-foreground">Java Edition</span>
              <span className="text-[10px] font-mono text-emerald-400/70 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">1.8 – 1.21+</span>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Server IP</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-sky-300 bg-sky-400/8 border border-sky-400/18 px-3 py-2 rounded-lg">evpk.minehut.gg</code>
                  <CopyButton text="evpk.minehut.gg" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Connect using any Java client. The server is hosted on Minehut.</p>
            </div>
          </div>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="font-bold text-sm text-foreground">Bedrock Edition</span>
              <span className="text-[10px] font-mono text-orange-400/70 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded">PE / Console / Win10 / PC</span>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Server Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-orange-300 bg-orange-400/8 border border-orange-400/18 px-3 py-2 rounded-lg">evpk.bedrock.minehut.gg</code>
                  <CopyButton text="evpk.bedrock.minehut.gg" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Port</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-orange-300 bg-orange-400/8 border border-orange-400/18 px-3 py-2 rounded-lg">19132</code>
                  <CopyButton text="19132" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 px-5 sm:px-8 pb-6 text-center text-xs text-muted-foreground">
          JoyedMC Servers.
        </div>
      </div>
    </div>
  );
}
 
function ContactPage() {
  return (
    <div className="glass-wrap">
      <div className="glass rounded-[1.1rem] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3 border-b border-white/6">
          <MessageCircle className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Contact Us</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Get in touch with the JoyedTiers team</p>
          </div>
        </div>
        <div className="glass-rainbow-line" />
        <div className="px-3 sm:px-5 py-6 space-y-4">
          <div className="glass-card rounded-xl px-5 py-5 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(88,101,242,.2)", border: "1px solid rgba(88,101,242,.35)" }}>
              <MessageCircle className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <p className="font-bold text-foreground text-base">Join our Discord</p>
              <p className="text-xs text-muted-foreground mt-1">The fastest way to reach us. Ask questions, report issues, or just hang out with the community.</p>
            </div>
            <a
              href="https://discord.gg/2mDqh8YhzZ"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, rgba(88,101,242,.5) 0%, rgba(88,101,242,.3) 100%)", border: "1px solid rgba(88,101,242,.5)", color: "#a5b4fc" }}
            >
              <MessageCircle className="w-4 h-4" />
              Join Discord Server
            </a>
          </div>
          <div className="glass-card rounded-xl px-5 py-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">What you can reach us for</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Reporting bugs or incorrect stats</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Questions about your rank or MMR</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Appeals or disputes</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>General feedback or suggestions</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
function AboutPage() {
  return (
    <div className="glass-wrap">
      <div className="glass rounded-[1.1rem] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3 border-b border-white/6">
          <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">About JoyedTiers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">What we're about</p>
          </div>
        </div>
        <div className="glass-rainbow-line" />
        <div className="px-5 sm:px-8 py-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
          <p className="text-foreground font-semibold text-base">The home of competitive Minecraft PvP ranking.</p>
          <p>JoyedTiers is a ranked leaderboard platform built for the JoyedMC Minecraft server. We track player performance across multiple combat modes — from Sword and Axe to Crystal and Mace — using a live MMR system to give every player a fair and accurate rank.</p>
          <p>Our goal is simple: give competitive Minecraft PvP players a place to prove their skill, track their progress, and compete for the top spot in their favourite mode.</p>
          <div className="glass-card rounded-xl px-4 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">What we offer</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Live leaderboards updated in real time</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Individual player profiles with per-mode stats</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>Elo-based MMR system with placement matches</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>10 ranked modes including Sword, Axe, Crystal, Mace, UHC and more</span></div>
              <div className="flex items-start gap-2"><span className="text-sky-400 font-bold mt-0.5">→</span><span>HT1 throne system — one player per mode holds the crown</span></div>
            </div>
          </div>
          <p>JoyedTiers is community-driven and constantly improving. Join our Discord to be part of it.</p>
          <a
            href="https://discord.gg/2mDqh8YhzZ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-xs transition-all hover:opacity-90"
            style={{ background: "rgba(88,101,242,.2)", border: "1px solid rgba(88,101,242,.35)", color: "#a5b4fc" }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Join the Discord
          </a>
        </div>
      </div>
    </div>
  );
}
 
function PrivacyPage() {
  return (
    <div className="glass-wrap">
      <div className="glass rounded-[1.1rem] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3 border-b border-white/6">
          <FileText className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Privacy Policy</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Last updated: May 2025</p>
          </div>
        </div>
        <div className="glass-rainbow-line" />
        <div className="px-5 sm:px-8 py-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <div className="space-y-2">
            <p className="text-foreground font-semibold">1. Information We Collect</p>
            <p>JoyedTiers displays publicly available Minecraft player data including usernames, UUIDs, and in-game statistics (MMR, wins, losses, rank). This data is collected from gameplay on the JoyedMC server. We do not collect any personal information such as email addresses, passwords, or payment details.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">2. How We Use Your Data</p>
            <p>Player data is used solely to display leaderboard rankings and individual player profiles on joyedtiers.com. We do not sell, trade, or share this data with third parties for marketing purposes.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">3. Cookies & Analytics</p>
            <p>This site may use cookies and third-party services such as Google AdSense for advertising purposes. These services may collect anonymised usage data in accordance with their own privacy policies. You can opt out of personalised ads via Google's ad settings.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">4. Third-Party Services</p>
            <p>We use Minotar to display Minecraft player avatars. Player skin images are fetched directly from their servers using publicly available Minecraft usernames. We are not responsible for third-party services' data practices.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">5. Data Removal</p>
            <p>If you would like your player data removed from JoyedTiers, please contact us via our Discord server and we will process your request.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">6. Changes to This Policy</p>
            <p>We may update this policy from time to time. Continued use of the site after changes constitutes acceptance of the updated policy.</p>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">7. Contact</p>
            <p>For any privacy-related questions, reach us via our <a href="https://discord.gg/2mDqh8YhzZ" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Discord server</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
 
const PAGE_TABS: { key: PageKey; label: string; icon: React.ReactNode }[] = [
  { key: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
  { key: "subleaderboard", label: "SubDuels", icon: <Zap className="w-4 h-4" /> },
  { key: "ranks",       label: "Ranks",       icon: <Shield className="w-4 h-4" /> },
  { key: "server",      label: "Server Info",  icon: <Server className="w-4 h-4" /> },
  { key: "about",       label: "About",        icon: <Info className="w-4 h-4" /> },
  { key: "contact",     label: "Contact",      icon: <MessageCircle className="w-4 h-4" /> },
  { key: "privacy",     label: "Privacy",      icon: <FileText className="w-4 h-4" /> },
];
 
function MobileSidebar({ open, onClose, activePage, setActivePage }: { open: boolean; onClose: () => void; activePage: PageKey; setActivePage: (p: PageKey) => void }) {
  return (
    <>
      <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl transition-transform duration-250 ease-out ${open ? "translate-y-0" : "translate-y-full"}`} style={{ background: "hsl(220 16% 8%)", border: "1px solid rgba(255,255,255,.09)", borderBottom: "none" }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Navigation</p>
          <div className="space-y-1.5">
            {PAGE_TABS.map((tab) => (
              <button key={tab.key} onClick={() => { setActivePage(tab.key); onClose(); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${activePage === tab.key ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/6"}`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pb-8" />
      </div>
    </>
  );
}
 
export default function LeaderboardPage() {
  const [activePage, setActivePage] = useState<PageKey>("leaderboard");
  const [region, setRegion] = useState<"US" | "EU" | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
 
  useEffect(() => {
    fetch("/api/geoip").then((r) => r.json()).then((d: any) => setRegion(d?.region ?? "US")).catch(() => setRegion("US"));
  }, []);
 
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
 
  return (
    <div className="relative min-h-screen bg-background">
      <CookieBanner />
      <div className="bg-orbs" aria-hidden><div className="bg-orb-3" /></div>
 
      {/* ── Header ── */}
      <header className="glass-header sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Mobile: tap this corner logo 2×, then the hero logo below 3×, then this one 2× again to unlock A.R.I.A. */}
            <img src={logoUrl} alt="JoyedTiers" className="h-7 w-auto object-contain select-none" style={{ imageRendering: "pixelated", WebkitTapHighlightColor: "transparent" }} onClick={() => (window as any).__ariaLogoTap?.("corner")} />
            <span className="font-black text-sm tracking-tight text-foreground">JoyedTiers</span>
          </div>
          <nav className="hidden sm:flex items-center gap-0.5">
            {PAGE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivePage(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap ${activePage === tab.key ? "glass-tab-active" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
 
      {/* ── Hero: clean, no float animation ── */}
      <section className="relative z-10 pt-10 pb-8 sm:pt-12 sm:pb-10 text-center overflow-hidden">
        <div className="hero-glow-ring" aria-hidden />
        <div className="relative">
          <div className="hero-logo-wrap mx-auto" onClick={() => (window as any).__ariaLogoTap?.("middle")} style={{ cursor: "default", WebkitTapHighlightColor: "transparent" }}>
            <img
              src={heroLogoUrl}
              alt="JoyedTiers"
              className="hero-logo relative mx-auto select-none"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <p className="hero-subtitle mt-4 flex items-center justify-center gap-2 px-4">
            <Swords className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            Minecraft PvP Ranked Leaderboard
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap px-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.18)", color: "#7dd3fc" }}>
              ⚔ 8 Modes
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.2)", color: "#fbbf24" }}>
              <Crown className="w-3 h-3" /> HT1 Throne
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.18)", color: "#86efac" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Live
            </span>
          </div>
        </div>
      </section>
 
      <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-5 pb-28 sm:pb-14">
        {activePage === "leaderboard" && <LeaderboardSection />}
        {activePage === "subleaderboard" && <SubLeaderboardSection />}
        {activePage === "ranks"       && <RanksPage />}
        {activePage === "server"      && <ServerPage />}
        {activePage === "contact"     && <ContactPage />}
        {activePage === "about"       && <AboutPage />}
        {activePage === "privacy"     && <PrivacyPage />}
      </main>
 
      <div className="fixed bottom-5 right-4 z-30 sm:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-card border border-white/10 text-foreground"
        >
          <Menu className="w-4 h-4" />
          <span>{PAGE_TABS.find(t => t.key === activePage)?.label}</span>
        </button>
      </div>
 
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activePage={activePage} setActivePage={setActivePage} />
    </div>
  );
}