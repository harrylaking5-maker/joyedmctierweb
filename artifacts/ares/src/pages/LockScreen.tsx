import { useState, useEffect, useRef, useCallback } from "react";
import { Code2, Unlock, CheckSquare } from "lucide-react";

interface Props {
  onUnlock: () => void;
}

type Step = "idle" | "awaiting_secret" | "awaiting_shake" | "awaiting_center" | "awaiting_corners" | "success";

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type Corner = (typeof CORNERS)[number];

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function LockScreen({ onUnlock }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [centerTaps, setCenterTaps] = useState(0);
  const [tappedCorners, setTappedCorners] = useState<Set<Corner>>(new Set());
  const [flashCorner, setFlashCorner] = useState<Corner | null>(null);
  const [flashCenter, setFlashCenter] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [keyBuffer, setKeyBuffer] = useState("");
  const shakeDetected = useRef(false);
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobile = isMobile();

  const reset = useCallback(() => {
    setStep("idle");
    setCenterTaps(0);
    setTappedCorners(new Set());
    setFlashCorner(null);
    setKeyBuffer("");
    shakeDetected.current = false;
    setStatusMsg("");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (step === "idle" || step === "awaiting_secret") {
        const key = e.key.toLowerCase();
        if (key.length === 1 && /[a-z]/.test(key)) {
          setKeyBuffer((prev) => {
            const next = (prev + key).slice(-4);
            if (next === "aria") {
              setStep("awaiting_corners");
              setTappedCorners(new Set());
              setStatusMsg("Click all 4 corners");
              timeoutRef.current = setTimeout(reset, 60000);
            } else if (step === "idle" && next.endsWith("a")) {
              setStep("awaiting_secret");
            }
            return next;
          });
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, reset]);

  const startMobileSequence = () => {
    if (step !== "idle") { reset(); return; }
    setStep("awaiting_shake");
    setStatusMsg("Shake your device");
    shakeDetected.current = false;
    timeoutRef.current = setTimeout(reset, 60000);
  };

  useEffect(() => {
    if (step !== "awaiting_shake") return;
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const { x = 0, y = 0, z = 0 } = acc;
      const dx = Math.abs((x ?? 0) - lastAccel.current.x);
      const dy = Math.abs((y ?? 0) - lastAccel.current.y);
      const dz = Math.abs((z ?? 0) - lastAccel.current.z);
      lastAccel.current = { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
      if ((dx + dy + dz) > 30 && !shakeDetected.current) {
        shakeDetected.current = true;
        setStep("awaiting_center");
        setCenterTaps(0);
        setStatusMsg("Tap center 3 times");
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [step]);

  const handleCenterTap = () => {
    if (step !== "awaiting_center") return;
    setFlashCenter(true);
    setTimeout(() => setFlashCenter(false), 200);
    const next = centerTaps + 1;
    setCenterTaps(next);
    setStatusMsg(`${next}/3`);
    if (next >= 3) {
      setStep("awaiting_corners");
      setTappedCorners(new Set());
      setStatusMsg("Tap all 4 corners");
    }
  };

  const handleCornerTap = (corner: Corner) => {
    if (step !== "awaiting_corners") return;
    setFlashCorner(corner);
    setTimeout(() => setFlashCorner(null), 300);
    const next = new Set(tappedCorners);
    next.add(corner);
    setTappedCorners(next);
    setStatusMsg(`${next.size}/4`);
    if (next.size >= 4) {
      setStep("success");
      setStatusMsg("ACCESS GRANTED");
      setTimeout(onUnlock, 1000);
    }
  };

  const cornerStyle = (corner: Corner) => {
    const positions: Record<Corner, string> = {
      "top-left": "top-0 left-0",
      "top-right": "top-0 right-0",
      "bottom-left": "bottom-0 left-0",
      "bottom-right": "bottom-0 right-0",
    };
    const active = tappedCorners.has(corner);
    const flashing = flashCorner === corner;
    return `absolute w-20 h-20 flex items-center justify-center cursor-pointer z-10 transition-all ${positions[corner]} ${flashing ? "bg-primary/20" : active ? "bg-primary/10" : "hover:bg-white/5"}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none bg-background">
      {CORNERS.map((corner) => (
        <div key={corner} className={cornerStyle(corner)} onClick={() => handleCornerTap(corner)}>
          <div className={`w-10 h-10 border-2 rounded-sm transition-colors ${
            tappedCorners.has(corner) ? "border-primary" : "border-border/40"
          } ${
            corner === "top-left" ? "border-r-0 border-b-0" :
            corner === "top-right" ? "border-l-0 border-b-0" :
            corner === "bottom-left" ? "border-r-0 border-t-0" : "border-l-0 border-t-0"
          }`} />
        </div>
      ))}

      <div className="flex flex-col items-center gap-8 z-20 px-8 text-center max-w-sm">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 text-muted-foreground/50 text-xs tracking-widest">
            <Code2 size={12} />
            <span>DEVELOPER MODE</span>
          </div>
          <p className="text-xs text-muted-foreground/30 tracking-wider">v2.4.1-build</p>
        </div>

        {mobile ? (
          <div
            className="relative w-28 h-28 cursor-pointer"
            onClick={step === "idle" ? startMobileSequence : undefined}
          >
            <div className={`absolute inset-0 rounded-full border-2 transition-colors ${
              step === "success" ? "border-green-400" :
              step === "idle" ? "border-border/40" : "border-primary/60 animate-pulse"
            }`} />
            <div className="absolute inset-0 flex items-center justify-center">
              {step === "success" ? (
                <CheckSquare size={32} className="text-green-400" />
              ) : (
                <Unlock size={28} className={step !== "idle" ? "text-primary" : "text-muted-foreground/40"} />
              )}
            </div>
            {step !== "idle" && step !== "success" && (
              <div className="absolute inset-0 rounded-full pulse-ring" />
            )}
          </div>
        ) : (
          <div className="relative w-28 h-28">
            <div className={`absolute inset-0 rounded-full border-2 transition-colors ${
              step === "success" ? "border-green-400" :
              step === "awaiting_corners" ? "border-primary/60 animate-pulse" :
              step === "awaiting_secret" ? "border-border/60 animate-pulse" :
              "border-border/40"
            }`} />
            <div className="absolute inset-0 flex items-center justify-center">
              {step === "success" ? (
                <CheckSquare size={32} className="text-green-400" />
              ) : (
                <Code2 size={28} className={step !== "idle" ? "text-primary/60" : "text-muted-foreground/30"} />
              )}
            </div>
          </div>
        )}

        {step === "awaiting_center" && (
          <button
            onClick={handleCenterTap}
            className={`w-20 h-20 rounded-full border-2 border-primary/60 flex items-center justify-center text-primary font-bold text-xl transition-all active:scale-95 ${
              flashCenter ? "bg-primary/30 scale-110" : "bg-primary/5 hover:bg-primary/10"
            }`}
          >
            {centerTaps > 0 ? centerTaps : "•"}
          </button>
        )}

        {statusMsg && (
          <div className={`px-4 py-1.5 rounded border text-xs tracking-wider ${
            step === "success"
              ? "border-green-500/40 text-green-400 bg-green-500/5"
              : "border-primary/30 text-primary/70 bg-primary/5"
          }`}>
            {statusMsg}
          </div>
        )}

        {step === "idle" && !mobile && (
          <p className="text-xs text-muted-foreground/20 tracking-widest">
            Authentication required
          </p>
        )}
        {step === "idle" && mobile && (
          <p className="text-xs text-muted-foreground/30 tracking-wider">
            Tap to authenticate
          </p>
        )}
      </div>
    </div>
  );
}
