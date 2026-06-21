import { useState, useEffect, useRef } from "react";
import { UserPlus, Trash2, Camera, CameraOff, Shield, ShieldOff, User } from "lucide-react";

interface Person {
  id: string;
  name: string;
  photoBase64?: string;
  addedAt: string;
}

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function Persons() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [webcamOn, setWebcamOn] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchPersons();
  }, []);

  const fetchPersons = async () => {
    try {
      const r = await fetch(`${API}/persons`);
      setPersons(await r.json());
    } catch {}
    setLoading(false);
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
    } catch {}
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamOn(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 320;
    c.height = v.videoHeight || 240;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setCapturedPhoto(c.toDataURL("image/jpeg", 0.8));
    stopWebcam();
  };

  const addPerson = async () => {
    if (!newName.trim()) return;
    try {
      const r = await fetch(`${API}/persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), photoBase64: capturedPhoto }),
      });
      const person = await r.json();
      setPersons((p) => [...p, person]);
      setNewName("");
      setCapturedPhoto(null);
      setAdding(false);
    } catch {}
  };

  const removePerson = async (id: string) => {
    await fetch(`${API}/persons/${id}`, { method: "DELETE" });
    setPersons((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary tracking-wider">AUTHORIZED PERSONS</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            A.R.I.A. will identify these people via webcam detection
          </p>
        </div>
        <button
          onClick={() => { setAdding((p) => !p); setCapturedPhoto(null); setNewName(""); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-primary/40 text-primary text-sm hover:bg-primary/10 transition-colors"
        >
          <UserPlus size={14} />
          ADD PERSON
        </button>
      </div>

      {adding && (
        <div className="hud-border rounded-lg p-4 space-y-4 slide-up">
          <h3 className="text-sm font-semibold text-foreground tracking-wider">NEW AUTHORIZED PERSON</h3>

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
          />

          {!capturedPhoto ? (
            <div className="space-y-3">
              {webcamOn ? (
                <div className="relative rounded border border-border overflow-hidden">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : (
                <canvas ref={canvasRef} className="hidden" />
              )}
              <div className="flex gap-2">
                {!webcamOn ? (
                  <button
                    onClick={startWebcam}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Camera size={13} /> Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Camera size={13} /> Capture Photo
                    </button>
                    <button
                      onClick={stopWebcam}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <CameraOff size={13} /> Cancel
                    </button>
                  </>
                )}
                <span className="text-xs text-muted-foreground self-center">(optional — helps with detection)</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <img src={capturedPhoto} className="w-32 h-32 object-cover rounded border border-border" />
              <button
                onClick={() => { setCapturedPhoto(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Retake photo
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border/50">
            <button
              onClick={addPerson}
              disabled={!newName.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Shield size={13} /> AUTHORIZE
            </button>
            <button
              onClick={() => { setAdding(false); stopWebcam(); setCapturedPhoto(null); }}
              className="px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div>
      ) : persons.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShieldOff size={40} className="text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">No authorized persons registered</p>
          <p className="text-xs text-muted-foreground/50">A.R.I.A. will flag any detected person as unauthorized</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {persons.map((p) => (
            <div key={p.id} className="hud-border rounded-lg p-4 flex items-center gap-4 slide-up">
              <div className="w-14 h-14 rounded-full border border-primary/30 overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                {p.photoBase64 ? (
                  <img src={p.photoBase64} className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Shield size={13} className="text-green-400" />
                  <span className="font-semibold text-foreground tracking-wide">{p.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Added {new Date(p.addedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => removePerson(p.id)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove authorization"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
