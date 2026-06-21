import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LeaderboardPage from "@/pages/leaderboard";
import PlayerPage from "@/pages/player";
import NotFound from "@/pages/not-found";
import ARIAOverlay from "@/components/ARIAOverlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000, refetchInterval: 5_000 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LeaderboardPage} />
      <Route path="/player/:username" component={PlayerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [ariaOpen, setAriaOpen] = useState(false);

  // ── background wake-word rec ──
  const wakeRecRef = useRef<any>(null);
  const wakeActive = useRef(false);

  // ── open helper ──
  const open = () => {
    if (!ariaOpen) setAriaOpen(true);
  };

  /* ── VOICE WAKE WORD: say "hey ares unlock protocol" to open the overlay ──
     Runs as a background listener while the panel is closed.
     iOS Safari does not allow real background SpeechRecognition, so this only
     works reliably on Chrome/Edge desktop and Android Chrome. */
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (ariaOpen) {
      wakeActive.current = false;
      try { wakeRecRef.current?.stop(); } catch { }
      wakeRecRef.current = null;
      return;
    }

    wakeActive.current = true;
    let rec: any = null;

    const phraseMatches = (txt: string) => {
      const normalized = txt.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
      return (
        normalized.includes("hey ares unlock protocol") ||
        normalized.includes("ares unlock protocol")
      );
    };

    const start = () => {
      if (!wakeActive.current) return;
      try {
        rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";
        rec.onresult = (e: any) => {
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            if (!e.results[i].isFinal) continue;
            const txt = e.results[i][0].transcript.toLowerCase().trim();
            if (phraseMatches(txt)) {
              wakeActive.current = false;
              setAriaOpen(true);
              return;
            }
          }
        };
        rec.onend = () => { if (wakeActive.current) setTimeout(start, 600); };
        rec.onerror = (e: any) => {
          if (e.error === "no-speech" || e.error === "aborted") {
            if (wakeActive.current) setTimeout(start, 600);
          }
        };
        rec.start();
        wakeRecRef.current = rec;
      } catch { }
    };

    const timer = setTimeout(start, 1500);
    return () => {
      wakeActive.current = false;
      clearTimeout(timer);
      try { rec?.stop(); } catch { }
      wakeRecRef.current = null;
    };
  }, [ariaOpen]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <ARIAOverlay open={ariaOpen} onClose={() => setAriaOpen(false)} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
