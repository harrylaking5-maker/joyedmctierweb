import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}
interface SR extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event & { error: string }) => void) | null;
}
interface SREvent extends Event {
  resultIndex: number;
  results: { [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } & { length: number } } & { length: number };
}

const API = "/api";
const ENROLLED_KEY = "aria_enrolled_description";

/* ─── speech ─────────────────────────────────────────────────────────────── */
let voicesLoaded = false;
function loadVoices() {
  if (voicesLoaded) return;
  window.speechSynthesis?.getVoices();
  voicesLoaded = true;
}
function buildUtterance(text: string): SpeechSynthesisUtterance {
  const clean = text.replace(/\[CMD:[^\]]+\]/gi, "").replace(/[*_#`]/g, "").trim();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1.05; utt.pitch = 1.1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) ||
    voices.find(v => v.lang.startsWith("en")) || voices[0];
  if (preferred) utt.voice = preferred;
  return utt;
}
function extractCmd(text: string): string | null {
  const m = text.match(/\[CMD:([\w ]+)\]/i);
  return m ? m[1].trim() : null;
}

/* ─── Atomic Orb Canvas ──────────────────────────────────────────────────── */
interface OrbState { speaking: boolean; listening: boolean; streaming: boolean; }

function AtomicOrb({ stateRef }: { stateRef: React.RefObject<OrbState> }) {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    /* particles */
    interface P { a: number; speed: number; orbitA: number; orbitB: number; tilt: number; sz: number; col: [number,number,number]; }
    const pts: P[] = Array.from({ length: 180 }, () => ({
      a: Math.random() * Math.PI * 2,
      speed: (0.008 + Math.random() * 0.02) * (Math.random() > 0.5 ? 1 : -1),
      orbitA: 60 + Math.random() * 140,
      orbitB: 14 + Math.random() * 70,
      tilt: Math.random() * Math.PI,
      sz: 1 + Math.random() * 3.4,
      col: [
        Math.floor(Math.random() * 40),
        Math.floor(200 + Math.random() * 55),
        Math.floor(60 + Math.random() * 80),
      ] as [number,number,number],
    }));

    let t = 0;
    let frame = 0;

    const getW = () => canvas.offsetWidth || 300;
    const getH = () => canvas.offsetHeight || 300;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = getW() * dpr;
      canvas.height = getH() * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const s = stateRef.current ?? { speaking: false, listening: false, streaming: false };
      const W = getW(), H = getH(), cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);

      const tgt = s.speaking ? 1.45 : s.streaming ? 1.22 : s.listening ? 1.0 : 0.6;
      const pulse = 1 + 0.07 * Math.sin(t * (s.speaking ? 5 : 2));
      const intensity = tgt * pulse;

      const baseR = Math.min(W, H) * 0.19;
      const coreR = baseR * (0.88 + 0.12 * Math.sin(t * 1.8));

      /* ambient room glow */
      const ambG = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 4);
      ambG.addColorStop(0, `rgba(0,255,100,${0.045 * intensity})`);
      ambG.addColorStop(0.6, `rgba(0,180,70,${0.018 * intensity})`);
      ambG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ambG; ctx.fillRect(0, 0, W, H);

      /* halo layers */
      for (let i = 4; i >= 1; i--) {
        const hr = coreR * (1 + i * 0.55);
        const hG = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, hr);
        hG.addColorStop(0, `rgba(0,255,100,${(0.09 / i) * intensity})`);
        hG.addColorStop(1, "rgba(0,255,100,0)");
        ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2);
        ctx.fillStyle = hG; ctx.fill();
      }

      /* core sphere */
      const sG = ctx.createRadialGradient(
        cx - coreR * 0.32, cy - coreR * 0.32, coreR * 0.04,
        cx, cy, coreR
      );
      sG.addColorStop(0,   `rgba(230,255,240,${Math.min(intensity, 1)})`);
      sG.addColorStop(0.22,`rgba(70,255,140,${0.95 * intensity})`);
      sG.addColorStop(0.55,`rgba(0,210,85,${0.9 * intensity})`);
      sG.addColorStop(0.82,`rgba(0,150,58,${0.78 * intensity})`);
      sG.addColorStop(1,   `rgba(0,80,30,${0.6 * intensity})`);
      ctx.save();
      ctx.shadowBlur = 40 * intensity;
      ctx.shadowColor = `rgba(0,255,100,${0.55 * intensity})`;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = sG; ctx.fill();
      ctx.restore();

      /* specular highlight */
      const specG = ctx.createRadialGradient(
        cx - coreR * 0.3, cy - coreR * 0.35, 0,
        cx - coreR * 0.1, cy - coreR * 0.1, coreR * 0.6
      );
      specG.addColorStop(0, `rgba(255,255,255,${0.25 * intensity})`);
      specG.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = specG; ctx.fill();

      /* electron orbit rings */
      const orbits = [
        { rx: baseR * 1.45, ry: baseR * 0.38, rot: t * 0.28 },
        { rx: baseR * 1.25, ry: baseR * 0.55, rot: -t * 0.21 + 1.2 },
        { rx: baseR * 1.65, ry: baseR * 0.28, rot: t * 0.14 + 2.4 },
        { rx: baseR * 1.1,  ry: baseR * 0.72, rot: -t * 0.32 + 0.7 },
      ];
      orbits.forEach(o => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,100,${0.13 * intensity})`;
        ctx.lineWidth = 0.7; ctx.stroke(); ctx.restore();
      });

      /* particles / atoms */
      const spd = s.speaking ? 2.8 : s.streaming ? 2.0 : s.listening ? 1.4 : 0.75;
      pts.forEach(p => {
        p.a += p.speed * spd;
        const cosT = Math.cos(p.tilt), sinT = Math.sin(p.tilt);
        const lx = Math.cos(p.a) * p.orbitA;
        const ly = Math.sin(p.a) * p.orbitB;
        const sx = cx + lx * cosT - ly * sinT * 0.28;
        const sy = cy + lx * sinT * 0.38 + ly * cosT * 0.58;
        const z = (Math.sin(p.a) * cosT + Math.cos(p.a) * sinT) * 0.5 + 0.5;
        const alpha = (0.18 + 0.82 * z) * Math.min(intensity, 1.3);
        const [r, g, b] = p.col;
        const ps = p.sz * (0.35 + 0.75 * z);

        /* glow */
        const pG = ctx.createRadialGradient(sx, sy, 0, sx, sy, ps * 3);
        pG.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
        pG.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath(); ctx.arc(sx, sy, ps * 3, 0, Math.PI * 2);
        ctx.fillStyle = pG; ctx.fill();

        /* dot */
        ctx.beginPath(); ctx.arc(sx, sy, ps, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`; ctx.fill();
      });

      t += 0.016;
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional: reads via ref

  return <canvas ref={cvs} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* ─── helpers (diagnostics UI) ─────────────────────────────────────────── */
function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-green-700 font-mono tracking-widest mb-1">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Row({ k, v, warn }: { k: string; v: unknown; warn?: boolean }) {
  return (
    <div className="flex gap-2 text-[11px] font-mono">
      <span className="text-green-800 w-28 shrink-0">{k}</span>
      <span className={warn ? "text-yellow-400" : "text-green-400"}>{String(v ?? "—")}</span>
    </div>
  );
}

/* ─── component ──────────────────────────────────────────────────────────── */
export default function ARIAOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "boot", role: "assistant", content: "A.R.E.S. online. Voice lock active.", timestamp: new Date() },
  ]);
  const [streaming, setStreaming]     = useState(false);
  const [webcamOn, setWebcamOn]       = useState(false);
  const [speakOn, setSpeakOn]         = useState(true);
  const [listening, setListening]     = useState(false);
  const [ariaSpeak, setAriaSpeak]     = useState(false);
  const [interimText, setInterimText] = useState("");
  const [ollamaOk, setOllamaOk]       = useState<boolean | null>(null);
  const [micBlocked, setMicBlocked]   = useState(false);

  /* subtitles */
  const [ariaSub, setAriaSub] = useState("A.R.I.A. online. I'm listening.");
  const [userSub, setUserSub] = useState("");
  const ariaSubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* face guard */
  const [faceGuard, setFaceGuard]     = useState(false);
  const [enrolling, setEnrolling]     = useState(false);
  const [enrolledDesc, setEnrolledDesc] = useState<string | null>(() => localStorage.getItem(ENROLLED_KEY));
  const [diagData, setDiagData]       = useState<Record<string, unknown> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const guardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* refs */
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recRef      = useRef<SR | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const convHistory = useRef<{ role: string; content: string }[]>([]);
  const streamingRef = useRef(false);
  const speakingRef  = useRef(false);
  const voiceActiveRef = useRef(false);
  const speakOnRef   = useRef(true);

  /* orb state ref — mutated in sync; canvas reads it without re-creating */
  const orbStateRef = useRef<OrbState>({ speaking: false, listening: false, streaming: false });
  useEffect(() => { orbStateRef.current.speaking  = ariaSpeak;  }, [ariaSpeak]);
  useEffect(() => { orbStateRef.current.listening  = listening;  }, [listening]);
  useEffect(() => { orbStateRef.current.streaming  = streaming;  }, [streaming]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => { speakOnRef.current   = speakOn;   }, [speakOn]);

  /* voices */
  useEffect(() => {
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  /* webcam → video */
  useEffect(() => {
    if (webcamOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [webcamOn]);

  /* auto-scroll history */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ollama status */
  useEffect(() => {
    if (!open) return;
    fetch(`${API}/ollama/status`)
      .then(r => r.json()).then((d: { online: boolean }) => setOllamaOk(d.online))
      .catch(() => setOllamaOk(false));
  }, [open]);

  /* ── mic permission ── */
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      setMicBlocked(false); return true;
    } catch { setMicBlocked(true); return false; }
  };

  /* ── open / close ── */
  useEffect(() => {
    if (open) {
      setMicBlocked(false);
      startWebcam();
      requestMicPermission().then(ok => {
        if (ok) { voiceActiveRef.current = true; startContinuousListening(); }
      });
    } else {
      voiceActiveRef.current = false;
      window.speechSynthesis?.cancel();
      stopWebcam();
      recRef.current?.stop(); recRef.current = null;
      setListening(false); setAriaSpeak(false); setInterimText("");
      stopFaceGuard();
    }
  }, [open]); // eslint-disable-line

  /* ── face guard polling ── */
  useEffect(() => {
    if (faceGuard && webcamOn && enrolledDesc && open) {
      guardIntervalRef.current = setInterval(async () => {
        const frame = captureFrame(); if (!frame) return;
        try {
          const r = await fetch(`${API}/guard`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: frame, authorizedDescription: enrolledDesc }),
          });
          const d = await r.json() as { authorized: boolean };
          if (!d.authorized) {
            speakImmediate("Security alert. Unauthorized access detected. Closing interface.");
            stopFaceGuard(); setTimeout(onClose, 2000);
          }
        } catch { }
      }, 18_000);
      return () => { if (guardIntervalRef.current) clearInterval(guardIntervalRef.current); };
    }
  }, [faceGuard, webcamOn, enrolledDesc, open]);

  /* ── helpers ── */
  const startWebcam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = s; setWebcamOn(true);
    } catch { }
  };
  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamOn(false); stopFaceGuard();
  };
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.7);
  };
  const stopFaceGuard = () => {
    if (guardIntervalRef.current) clearInterval(guardIntervalRef.current);
    setFaceGuard(false);
  };

  /* ── subtitle helper ── */
  const setAriaSpeech = (text: string) => {
    const clean = text.replace(/\[CMD:[^\]]+\]/gi, "").trim();
    setAriaSub(clean);
    if (ariaSubTimer.current) clearTimeout(ariaSubTimer.current);
    ariaSubTimer.current = setTimeout(() => setAriaSub(""), 12_000);
  };

  /* ── continuous listening ── */
  const startContinuousListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceActiveRef.current) return;
    try { recRef.current?.stop(); } catch { }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = async (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          setInterimText("");
          if (text && !streamingRef.current && !speakingRef.current) {
            const normalized = text.toLowerCase();
            if (/\b(lock protocol|close ares|shutdown ares|seal ares)\b/i.test(normalized)) {
              voiceActiveRef.current = false;
              try { rec.stop(); } catch { }
              speakImmediate("Locking A.R.E.S. now.");
              onClose();
              return;
            }
            if (/\b(enroll face|activate face guard|enable face guard|start face guard)\b/i.test(normalized)) {
              await enrollFace();
              speakImmediate("Face Guard enrolling now.");
              continue;
            }
            if (/\b(disable face guard|deactivate face guard|stop face guard|pause face guard)\b/i.test(normalized)) {
              stopFaceGuard();
              addMsg("system", "Face Guard disabled via voice command.");
              speakImmediate("Face Guard disabled.");
              continue;
            }
            sendMessage(text, true);
          }
        } else { interim += r[0].transcript; }
      }
      if (interim) setInterimText(interim);
    };
    rec.onend = () => {
      setListening(false);
      if (voiceActiveRef.current && !speakingRef.current) setTimeout(() => startContinuousListening(), 300);
    };
    rec.onerror = (e) => {
      if ((e as any).error !== "aborted" && (e as any).error !== "no-speech") setListening(false);
    };
    try { rec.start(); recRef.current = rec; setListening(true); } catch { }
  }, [onClose]); // eslint-disable-line

  /* ── speak ── */
  const speakResponse = useCallback((text: string) => {
    if (!speakOnRef.current || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    speakingRef.current = true; setAriaSpeak(true);
    try { recRef.current?.stop(); } catch { }
    const utt = buildUtterance(text);
    utt.onend = () => { speakingRef.current = false; setAriaSpeak(false); if (voiceActiveRef.current) startContinuousListening(); };
    utt.onerror = () => { speakingRef.current = false; setAriaSpeak(false); if (voiceActiveRef.current) startContinuousListening(); };
    window.speechSynthesis.speak(utt);
  }, [startContinuousListening]);

  const speakImmediate = (text: string) => {
    window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(buildUtterance(text));
  };

  const addMsg = (role: Message["role"], content: string) =>
    setMessages(p => [...p, { id: Date.now().toString(), role, content, timestamp: new Date() }]);

  /* ── face enroll ── */
  const enrollFace = async () => {
    if (!webcamOn) { speakImmediate("Please wait — webcam is starting."); return; }
    setEnrolling(true); speakImmediate("Capturing your face. Hold still.");
    await new Promise(r => setTimeout(r, 1200));
    const frame = captureFrame();
    if (!frame) { setEnrolling(false); return; }
    try {
      const r = await fetch(`${API}/guard/enroll`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame }),
      });
      const d = await r.json() as { description?: string; error?: string };
      if (d.description) {
        setEnrolledDesc(d.description); localStorage.setItem(ENROLLED_KEY, d.description);
        addMsg("assistant", "Face enrolled. Face Guard is now active.");
        speakImmediate("Face enrolled. I will lock if I detect an unauthorized person."); setFaceGuard(true);
      } else addMsg("system", d.error || "Enrollment failed.");
    } catch { addMsg("system", "Enrollment failed — cannot reach backend."); }
    setEnrolling(false);
  };
  const toggleFaceGuard = () => {
    if (!enrolledDesc) { enrollFace(); return; }
    if (faceGuard) { stopFaceGuard(); addMsg("system", "Face Guard disabled."); }
    else { setFaceGuard(true); addMsg("system", "Face Guard active."); speakImmediate("Face Guard enabled."); }
  };

  /* ── send ── */
  const sendMessage = useCallback(async (text: string, fromVoice = false) => {
    if (streamingRef.current) return;
    const userText = text.trim(); if (!userText) return;
    const image = webcamOn ? captureFrame() : null;
    setMessages(p => [...p, { id: Date.now().toString(), role: "user", content: userText, timestamp: new Date() }]);
    setStreaming(true); streamingRef.current = true;
    const assistantId = (Date.now() + 1).toString();
    setMessages(p => [...p, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);
    try { recRef.current?.stop(); } catch { }
    setListening(false);

    let fullContent = "";
    try {
      const r = await fetch(`${API}/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, imageBase64: image, conversationHistory: convHistory.current }),
      });
      const reader = r.body?.getReader(); const decoder = new TextDecoder(); let buf = "";
      while (reader) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6)) as { content?: string; error?: string };
            if (d.content) {
              fullContent += d.content;
              setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: fullContent.replace(/\[CMD:[^\]]+\]/gi, "").trim() } : m));
            }
            if (d.error) setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: `⚠ ${d.error}` } : m));
          } catch { }
        }
      }
      if (fullContent) {
        convHistory.current = [...convHistory.current, { role: "user", content: userText }, { role: "assistant", content: fullContent }].slice(-20);
        setAriaSpeech(fullContent);
        speakResponse(fullContent);
        const cmd = extractCmd(fullContent);
        if (cmd) {
          addMsg("system", `Auto-executing voice command: ${cmd}`);
          executeCommand(cmd);
        }
      }
    } catch {
      const errMsg = "Connection failed. Is the API server running?";
      setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: errMsg } : m));
      if (fromVoice) speakImmediate(errMsg);
      if (voiceActiveRef.current) setTimeout(() => startContinuousListening(), 300);
    }
    setStreaming(false); streamingRef.current = false;
  }, [webcamOn, speakResponse, startContinuousListening]);

  /* ── diagnostics ── */
  const runDiagnostics = async () => {
    setDiagLoading(true); setDiagData(null);
    try { setDiagData(await (await fetch(`${API}/diagnostics`)).json()); }
    catch { setDiagData({ error: "Cannot reach API server" }); }
    setDiagLoading(false);
  };

  /* ── execute command ── */
  const executeCommand = async (cmd: string) => {
    addMsg("system", `Executing ${cmd}...`);
    try {
      const r = await fetch(`${API}/commands/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: cmd }) });
      const d = await r.json() as { output?: string };
      const out = d.output || "No output";
      addMsg("system", `Command result:\n${out.slice(0, 400)}`);
    } catch {
      addMsg("system", "Command failed — API server unreachable");
    }
  };

  const guardStatus = faceGuard && enrolledDesc ? "active" : enrolledDesc ? "enrolled" : "none";

  const statusLabel =
    ariaSpeak ? "SPEAKING" :
    streaming  ? "PROCESSING" :
    listening  ? "LISTENING" :
    micBlocked ? "MIC BLOCKED" :
    "STANDBY";

  const statusColor =
    ariaSpeak  ? "text-blue-400" :
    streaming  ? "text-green-300" :
    listening  ? "text-green-400" :
    micBlocked ? "text-yellow-400" :
    "text-green-900";

  /* ─── hidden when closed ─────────────────────────────────────── */
  if (!open) return (
    <>
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );

  /* ─── render ─────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden select-none" style={{ background: "#030a06" }}>
      {/* hidden media elements */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── top bar ── */}
      <div className="flex items-center justify-center px-5 pt-5 pb-1 z-10 shrink-0">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono tracking-[0.35em] text-green-700">A.R.E.S.</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ollamaOk === true ? "bg-green-400" : ollamaOk === false ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
            <span className={`text-[9px] font-mono tracking-widest ${statusColor}`}>{statusLabel}</span>
            {guardStatus === "active" && <span className="text-[8px] font-mono text-green-500 border border-green-800 rounded px-1">GUARD</span>}
          </div>
        </div>
      </div>

      {/* ── orb ── */}
      <div className="flex-1 relative">
        <AtomicOrb stateRef={orbStateRef} />
        {/* small webcam pip when enabled */}
        {webcamOn && (
          <div className="absolute top-3 right-3 w-20 h-14 rounded-lg overflow-hidden opacity-40"
            style={{ border: "1px solid rgba(0,255,100,0.2)" }}>
            <video autoPlay muted playsInline className="w-full h-full object-cover"
              ref={(el) => { if (el && streamRef.current) { el.srcObject = streamRef.current; el.play().catch(() => {}); } }} />
            <div className="absolute bottom-0.5 left-0.5 text-[7px] font-mono text-green-500">{faceGuard ? "🛡" : "●"}</div>
          </div>
        )}
      </div>

      {/* ── subtitles ── */}
      <div className="px-6 py-4 z-10 shrink-0 min-h-[90px] flex flex-col justify-end gap-2">
        {(interimText || userSub) && (
          <p className="text-gray-500 text-sm text-center italic leading-snug">
            {interimText || userSub}
          </p>
        )}
        {ariaSub && (
          <p className="text-blue-400 text-base text-center font-medium leading-snug">
            {ariaSub.length > 160 ? ariaSub.slice(0, 160) + "…" : ariaSub}
          </p>
        )}
      </div>

      {/* ── bottom toolbar ── */}
      <div className="px-6 pb-7 z-10 shrink-0">
        <div className="flex flex-col items-center gap-2">
          {micBlocked ? (
            <p className="text-[10px] font-mono text-yellow-400">Microphone blocked. Grant browser audio permission to continue.</p>
          ) : (
            <p className="text-[10px] font-mono text-green-400">Voice mode active. Say commands or say "lock protocol" to close.</p>
          )}
        </div>
      </div>

      {/* ── text input (floats above toolbar) ── */}

      {/* ── drawer ── */}

      {/* ── consent modal ── */}
    </div>
  );
}
