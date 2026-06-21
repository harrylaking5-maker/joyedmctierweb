import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Camera, CameraOff, Mic, MicOff, Trash2, AlertTriangle, Zap, Eye
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageAttached?: boolean;
  timestamp: Date;
}

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "A.R.I.A. ONLINE. Adaptive Reasoning Intelligence Assistant ready. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [webcamOn, setWebcamOn] = useState(false);
  const [captureNext, setCaptureNext] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{authorized?: boolean; name?: string; detected?: boolean} | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    checkOllama();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkOllama = async () => {
    try {
      const r = await fetch(`${API}/ollama/status`);
      const d = await r.json();
      setOllamaStatus(d.online ? "online" : "offline");
    } catch {
      setOllamaStatus("offline");
    }
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamOn(true);
    } catch (e) {
      addSystemMessage("Webcam access denied or unavailable.");
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamOn(false);
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.7);
  };

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "system", content, timestamp: new Date() },
    ]);
  };

  const detectPerson = async () => {
    if (!webcamOn) { addSystemMessage("Enable webcam to detect persons."); return; }
    setDetecting(true);
    setDetectionResult(null);
    const image = captureFrame();
    if (!image) { setDetecting(false); return; }
    try {
      const r = await fetch(`${API}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image }),
      });
      const d = await r.json();
      setDetectionResult(d);
      if (d.detected && !d.authorized) {
        addSystemMessage("⚠️ UNAUTHORIZED PERSON DETECTED. Security alert triggered.");
      } else if (d.detected && d.authorized) {
        addSystemMessage(`✓ Authorized person recognized: ${d.name || "Known user"}`);
      } else {
        addSystemMessage("No person detected in frame.");
      }
    } catch {
      addSystemMessage("Detection failed — check Ollama connection.");
    }
    setDetecting(false);
  };

  const sendMessage = async () => {
    if (streaming || (!input.trim() && !captureNext)) return;
    const userText = input.trim();
    const image = captureNext && webcamOn ? captureFrame() : null;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText || "(webcam frame)",
      imageAttached: !!image,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setCaptureNext(false);
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    const history = messages
      .filter((m) => m.role !== "system" && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const r = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, imageBase64: image, conversationHistory: history }),
      });

      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + d.content } : m
                )
              );
            }
            if (d.done || d.error) {
              if (d.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: `ERROR: ${d.error}` } : m
                  )
                );
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Connection failed. Make sure Ollama is running." }
            : m
        )
      );
    }
    setStreaming(false);
  };

  const clearHistory = async () => {
    await fetch(`${API}/history`, { method: "DELETE" });
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Memory cleared. A.R.I.A. ready.",
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
            ollamaStatus === "online" ? "border-green-500/40 text-green-400 bg-green-500/5" :
            ollamaStatus === "offline" ? "border-destructive/40 text-destructive bg-destructive/5" :
            "border-border text-muted-foreground"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              ollamaStatus === "online" ? "bg-green-400 animate-pulse" :
              ollamaStatus === "offline" ? "bg-destructive" : "bg-muted-foreground animate-pulse"
            }`} />
            OLLAMA {ollamaStatus.toUpperCase()}
          </div>
          {detectionResult?.detected && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
              detectionResult.authorized
                ? "border-green-500/40 text-green-400 bg-green-500/5"
                : "border-destructive/40 text-destructive bg-destructive/5"
            }`}>
              {detectionResult.authorized ? "✓ AUTHORIZED" : "⚠ UNAUTHORIZED"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={detectPerson}
            disabled={detecting || !webcamOn}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Eye size={12} />
            {detecting ? "SCANNING..." : "DETECT"}
          </button>
          <button
            onClick={webcamOn ? stopWebcam : startWebcam}
            className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border transition-colors ${
              webcamOn
                ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {webcamOn ? <Camera size={12} /> : <CameraOff size={12} />}
            {webcamOn ? "CAM ON" : "CAM OFF"}
          </button>
          <button
            onClick={clearHistory}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="Clear history"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden py-3">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.map((msg) => (
            <div key={msg.id} className={`slide-up ${
              msg.role === "user" ? "flex justify-end" :
              msg.role === "system" ? "flex justify-center" :
              "flex justify-start"
            }`}>
              {msg.role === "system" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/40 rounded px-3 py-1.5 bg-secondary/20 max-w-sm text-center">
                  <AlertTriangle size={11} />
                  {msg.content}
                </div>
              ) : msg.role === "user" ? (
                <div className="max-w-[80%]">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg rounded-tr-none px-4 py-2.5 text-sm text-foreground">
                    {msg.imageAttached && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary/70 mb-1">
                        <Camera size={10} /> image attached
                      </span>
                    )}
                    {msg.content && <p>{msg.content}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-1 text-right">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full border border-primary/40 flex items-center justify-center shrink-0 mt-1">
                      <Zap size={10} className="text-primary" />
                    </div>
                    <div className="hud-border rounded-lg rounded-tl-none px-4 py-2.5 text-sm flex-1">
                      {msg.content ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : (
                        <span className="text-primary typing-cursor">&nbsp;</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-1 ml-8">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {webcamOn && (
          <div className="w-48 shrink-0 flex flex-col gap-2">
            <div className="relative rounded border border-border overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video object-cover"
              />
              <div className="absolute top-1 left-1 text-xs text-primary bg-background/80 px-1 rounded font-mono">
                LIVE
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <button
              onClick={() => setCaptureNext((p) => !p)}
              className={`text-xs py-1.5 rounded border transition-colors ${
                captureNext
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {captureNext ? "📷 CAPTURE ON SEND" : "CAPTURE FRAME"}
            </button>
          </div>
        )}

        {!webcamOn && <canvas ref={canvasRef} className="hidden" />}
      </div>

      <div className="border-t border-border/50 py-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={streaming ? "A.R.I.A. is responding..." : "Send a message to A.R.I.A. (Enter to send, Shift+Enter for newline)"}
              disabled={streaming}
              rows={1}
              className="w-full bg-input border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none disabled:opacity-50 font-mono"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={streaming || (!input.trim() && !captureNext)}
            className="p-2.5 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
