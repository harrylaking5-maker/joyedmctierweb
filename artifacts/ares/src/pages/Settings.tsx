import { useState, useEffect } from "react";
import { Save, RefreshCw, Terminal, Cpu, MessageSquare } from "lucide-react";

interface Settings {
  ollamaUrl: string;
  model: string;
  systemPrompt: string;
  ariaName: string;
}

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    ollamaUrl: "http://localhost:11434",
    model: "llama3.2-vision:11b",
    systemPrompt: "",
    ariaName: "A.R.I.A.",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const r = await fetch(`${API}/settings`);
      setSettings(await r.json());
    } catch {}
    setLoading(false);
    checkOllama();
  };

  const checkOllama = async () => {
    setOllamaStatus("checking");
    try {
      const r = await fetch(`${API}/ollama/status`);
      const d = await r.json();
      setOllamaStatus(d.online ? "online" : "offline");
      if (d.models) setModels(d.models.map((m: { name: string }) => m.name));
    } catch {
      setOllamaStatus("offline");
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="text-center text-muted-foreground py-12">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary tracking-wider">SYSTEM SETTINGS</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Configure A.R.I.A.'s core systems</p>
      </div>

      <div className="hud-border rounded-lg p-5 space-y-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground tracking-wider border-b border-border/50 pb-3">
          <Terminal size={14} className="text-primary" />
          OLLAMA CONNECTION
        </h3>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground tracking-wider">OLLAMA URL</label>
          <input
            type="text"
            value={settings.ollamaUrl}
            onChange={(e) => setSettings((s) => ({ ...s, ollamaUrl: e.target.value }))}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
            placeholder="http://localhost:11434"
          />
          <div className="flex items-center gap-3 pt-1">
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
              ollamaStatus === "online" ? "border-green-500/40 text-green-400 bg-green-500/5" :
              ollamaStatus === "offline" ? "border-destructive/40 text-destructive bg-destructive/5" :
              "border-border text-muted-foreground"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                ollamaStatus === "online" ? "bg-green-400 animate-pulse" :
                ollamaStatus === "offline" ? "bg-destructive" : "bg-muted-foreground animate-pulse"
              }`} />
              {ollamaStatus.toUpperCase()}
            </div>
            <button
              onClick={checkOllama}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground tracking-wider">MODEL</label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
            placeholder="llama3.2-vision:11b"
          />
          {models.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => setSettings((s) => ({ ...s, model: m }))}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    settings.model === m
                      ? "border-primary/50 text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground/50">
            Must be a vision-capable model to use webcam features
          </p>
        </div>
      </div>

      <div className="hud-border rounded-lg p-5 space-y-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground tracking-wider border-b border-border/50 pb-3">
          <MessageSquare size={14} className="text-primary" />
          PERSONALITY
        </h3>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground tracking-wider">ASSISTANT NAME</label>
          <input
            type="text"
            value={settings.ariaName}
            onChange={(e) => setSettings((s) => ({ ...s, ariaName: e.target.value }))}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground tracking-wider">SYSTEM PROMPT</label>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
            rows={6}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono resize-none"
            placeholder="You are A.R.I.A., an Adaptive Reasoning Intelligence Assistant..."
          />
        </div>
      </div>

      <div className="hud-border rounded-lg p-5 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground tracking-wider border-b border-border/50 pb-3">
          <Cpu size={14} className="text-primary" />
          OLLAMA SETUP GUIDE
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground font-mono">
          <p className="text-foreground font-semibold">1. Install Ollama on your machine:</p>
          <code className="block bg-secondary/50 px-3 py-2 rounded border border-border text-green-400">
            curl -fsSL https://ollama.com/install.sh | sh
          </code>
          <p className="text-foreground font-semibold mt-3">2. Pull the vision model:</p>
          <code className="block bg-secondary/50 px-3 py-2 rounded border border-border text-green-400">
            ollama pull llama3.2-vision:11b
          </code>
          <p className="text-foreground font-semibold mt-3">3. Allow cross-origin access (for remote hosting):</p>
          <code className="block bg-secondary/50 px-3 py-2 rounded border border-border text-green-400">
            OLLAMA_ORIGINS=* ollama serve
          </code>
          <p className="mt-3 text-muted-foreground/60">
            If running Ollama on a different machine, set the OLLAMA_URL environment variable on the server to point to your Ollama instance.
          </p>
        </div>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        className={`flex items-center gap-2 px-5 py-2.5 rounded border text-sm font-semibold tracking-wider transition-all ${
          saved
            ? "border-green-500/50 text-green-400 bg-green-500/10"
            : "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
        } disabled:opacity-50`}
      >
        <Save size={14} />
        {saved ? "SAVED ✓" : saving ? "SAVING..." : "SAVE SETTINGS"}
      </button>
    </div>
  );
}
