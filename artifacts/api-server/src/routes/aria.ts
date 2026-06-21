import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const router = Router();

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), ".aria-data");
const PERSONS_FILE = join(DATA_DIR, "persons.json");
const SETTINGS_FILE = join(DATA_DIR, "settings.json");
const HISTORY_FILE = join(DATA_DIR, "history.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

interface Person {
  id: string;
  name: string;
  photoBase64?: string;
  addedAt: string;
}

interface Settings {
  ollamaUrl: string;
  model: string;
  systemPrompt: string;
  ariaName: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || "https://api.groq.com/v1";
const useGroq = Boolean(GROQ_API_KEY);

const defaultSettings: Settings = {
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  model: process.env.GROQ_MODEL || process.env.OLLAMA_MODEL || "llama3.2-vision:11b",
  systemPrompt:
    "You are A.R.I.A. (Adaptive Reasoning Intelligence Assistant), an advanced AI integrated as a hidden overlay into a private computer system. You communicate entirely through voice — keep ALL responses SHORT (1-3 sentences max), natural, and conversational. No markdown, no bullet points, no numbered lists, no asterisks. Speak directly and confidently.\n\nWhen the user asks about their system status — memory, RAM, CPU, disk, storage, processes, network, battery, temperature, or uptime — end your spoken response with [CMD:command] on a new line where command is exactly one of: memory usage, top processes, network info, uptime, battery, temperature, list processes. Only include one [CMD:...] per response.\n\nWhen you see webcam images, briefly describe what you observe in 1 sentence. You have face recognition security capabilities.\n\nAlways stay fully in character as A.R.I.A. Be direct, confident, and efficient.",
  ariaName: "A.R.I.A.",
};

function buildLLMHeaders(): Record<string, string> {
  if (useGroq) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    };
  }

  return { "Content-Type": "application/json" };
}

async function llmFetch(settings: Settings, payload: Record<string, unknown>) {
  const url = useGroq ? `${GROQ_API_URL}/chat/completions` : `${settings.ollamaUrl}/api/chat`;
  return fetch(url, {
    method: "POST",
    headers: buildLLMHeaders(),
    body: JSON.stringify(payload),
  });
}

function extractLLMContent(data: any): string {
  if (useGroq) {
    return (
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.delta?.content ||
      ""
    );
  }

  return data?.message?.content || "";
}

async function pipeStream(
  response: Response,
  writeChunk: (chunk: string) => void,
  onDone: () => void,
) {
  const body = response.body;
  if (!body) {
    writeChunk("[Stream unavailable]");
    onDone();
    return;
  }

  if (typeof (body as any).getReader === "function") {
    const reader = (body as any).getReader();
    const decoder = new TextDecoder();
    let raw = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      const lines = raw.split("\n");
      raw = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === "data: [DONE]") {
          onDone();
          return;
        }

        if (trimmed.startsWith("data:")) {
          const payload = trimmed.replace(/^data:\s*/, "");
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload);
            if (useGroq) {
              const delta = parsed?.choices?.[0]?.delta;
              if (delta?.content) {
                writeChunk(delta.content);
              }
            } else {
              const content = parsed?.message?.content;
              if (content) {
                writeChunk(content);
              }
            }
          } catch {
            continue;
          }
        }
      }
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/^data:\s*/, ""));
        if (useGroq) {
          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) writeChunk(delta.content);
        } else {
          const content = parsed?.message?.content;
          if (content) writeChunk(content);
        }
      } catch {
        // ignore incomplete final chunk
      }
    }

    onDone();
    return;
  }

  const nodeBody = body as unknown as NodeJS.ReadableStream;
  nodeBody.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          message?: { content?: string };
          choices?: Array<{ delta?: { content?: string } }>;
          done?: boolean;
        };
        if (parsed.done) {
          onDone();
          return;
        }
        if (useGroq) {
          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) writeChunk(delta.content);
        } else {
          const content = parsed?.message?.content;
          if (content) writeChunk(content);
        }
      } catch {
        // ignore invalid JSON
      }
    }
  });

  nodeBody.on("end", () => {
    onDone();
  });
  nodeBody.on("error", () => {
    onDone();
  });
}

router.get("/settings", (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  res.json(settings);
});

router.put("/settings", (req, res) => {
  const current = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  const updated = { ...current, ...req.body };
  writeJSON(SETTINGS_FILE, updated);
  res.json(updated);
});

router.get("/persons", (req, res) => {
  const persons = readJSON<Person[]>(PERSONS_FILE, []);
  res.json(persons);
});

router.post("/persons", (req, res) => {
  const persons = readJSON<Person[]>(PERSONS_FILE, []);
  const person: Person = {
    id: Date.now().toString(),
    name: req.body.name,
    photoBase64: req.body.photoBase64,
    addedAt: new Date().toISOString(),
  };
  persons.push(person);
  writeJSON(PERSONS_FILE, persons);
  res.status(201).json(person);
});

router.delete("/persons/:id", (req, res) => {
  const persons = readJSON<Person[]>(PERSONS_FILE, []);
  const filtered = persons.filter((p) => p.id !== req.params.id);
  writeJSON(PERSONS_FILE, filtered);
  res.json({ success: true });
});

router.get("/history", (req, res) => {
  const history = readJSON<ChatMessage[]>(HISTORY_FILE, []);
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(history.slice(-limit));
});

router.delete("/history", (req, res) => {
  writeJSON(HISTORY_FILE, []);
  res.json({ success: true });
});

router.post("/chat", async (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  const { message, imageBase64, conversationHistory = [] } = req.body;

  const messages = [
    { role: "system", content: settings.systemPrompt },
    ...conversationHistory,
  ];

  if (imageBase64) {
    messages.push({
      role: "user",
      content: message || "What do you see in this image?",
      images: [imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")],
    });
  } else {
    messages.push({ role: "user", content: message });
  }

  try {
    if (useGroq && imageBase64) {
      res.status(400).json({ error: "Image prompts are not supported with Groq in this backend." });
      return;
    }

    const response = await llmFetch(settings, {
      model: settings.model,
      messages,
      stream: false,
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `LLM error: ${text}` });
      return;
    }

    const data = await response.json();
    const content = extractLLMContent(data);

    const history = readJSON<ChatMessage[]>(HISTORY_FILE, []);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message || "(image)",
      imageBase64: imageBase64 ? "[image attached]" : undefined,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };
    history.push(userMsg, assistantMsg);
    if (history.length > 200) history.splice(0, history.length - 200);
    writeJSON(HISTORY_FILE, history);

    res.json({ content, role: "assistant" });
  } catch (err) {
    const error = err as Error;
    res.status(502).json({ error: `Cannot reach Ollama: ${error.message}` });
  }
});

router.post("/chat/stream", async (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  const { message, imageBase64, conversationHistory = [] } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const messages = [
    { role: "system", content: settings.systemPrompt },
    ...conversationHistory,
  ];

  if (imageBase64) {
    messages.push({
      role: "user",
      content: message || "What do you see in this image?",
      images: [imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")],
    });
  } else {
    messages.push({ role: "user", content: message });
  }

  try {
    if (useGroq && imageBase64) {
      res.write(`data: ${JSON.stringify({ error: "Image prompts are not supported with Groq in this backend." })}\n\n`);
      res.end();
      return;
    }

    const response = await llmFetch(settings, {
      model: settings.model,
      messages,
      stream: true,
    });

    if (!response.ok || !response.body) {
      res.write(`data: ${JSON.stringify({ error: "LLM unavailable" })}\n\n`);
      res.end();
      return;
    }

    let fullContent = "";
    await pipeStream(
      response,
      (content) => {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
      },
      () => {
        const history = readJSON<ChatMessage[]>(HISTORY_FILE, []);
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "user",
          content: message || "(image)",
          timestamp: new Date().toISOString(),
        };
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toISOString(),
        };
        history.push(userMsg, assistantMsg);
        if (history.length > 200) history.splice(0, history.length - 200);
        writeJSON(HISTORY_FILE, history);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      },
    );
  } catch (err) {
    const error = err as Error;
    res.write(
      `data: ${JSON.stringify({ error: `Cannot reach Ollama: ${error.message}` })}\n\n`
    );
    res.end();
  }
});

router.post("/detect", async (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  const { imageBase64 } = req.body;
  const persons = readJSON<Person[]>(PERSONS_FILE, []);

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const authorizedNames = persons.map((p) => p.name).join(", ");
    const prompt =
      persons.length > 0
        ? `Look at this image. Is the person visible one of these authorized people: ${authorizedNames}? Reply with ONLY a JSON object like: {"detected": true, "authorized": true, "name": "PersonName", "confidence": "high"} or {"detected": false} or {"detected": true, "authorized": false, "confidence": "low"}. No other text.`
        : `Is there a person visible in this image? Reply with ONLY: {"detected": true} or {"detected": false}`;

    const response = await fetch(
      `${settings.ollamaUrl}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            {
              role: "user",
              content: prompt,
              images: [imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")],
            },
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      res.status(502).json({ error: "Ollama unavailable" });
      return;
    }

    const data = (await response.json()) as {
      message?: { content: string };
    };
    const content = data?.message?.content || "{}";

    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
    } else {
      res.json({ detected: false });
    }
  } catch {
    res.json({ detected: false, error: "Detection unavailable" });
  }
});

// Enroll the authorized user — capture their appearance description via Ollama vision
router.post("/guard/enroll", async (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }
  try {
    const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "user",
            content:
              "Describe the person in this image in 1-2 sentences focusing on key physical features: hair color, skin tone, face shape, eye color, and any distinctive features. Be specific and objective. Do not mention clothing.",
            images: [imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")],
          },
        ],
        stream: false,
      }),
    });
    if (!response.ok) {
      res.status(502).json({ error: "Ollama unavailable" });
      return;
    }
    const data = (await response.json()) as { message?: { content: string } };
    const description = data?.message?.content?.trim() || "";
    // Persist enrolled description to settings file
    const current = readJSON<Settings & { enrolledDescription?: string }>(SETTINGS_FILE, defaultSettings);
    writeJSON(SETTINGS_FILE, { ...current, enrolledDescription: description });
    res.json({ description });
  } catch (err) {
    const error = err as Error;
    res.status(502).json({ error: `Cannot reach Ollama: ${error.message}` });
  }
});

// Check if current webcam frame matches the enrolled authorized user
router.post("/guard", async (req, res) => {
  const settings = readJSON<Settings & { enrolledDescription?: string }>(SETTINGS_FILE, defaultSettings);
  const { imageBase64, authorizedDescription } = req.body;
  const desc = authorizedDescription || settings.enrolledDescription;

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }
  if (!desc) {
    // No enrollment yet — default to authorized so we don't falsely lock
    res.json({ authorized: true, reason: "No enrollment data" });
    return;
  }

  try {
    const prompt = `You are a biometric security system. The authorized user was previously described as: "${desc}". Look at this image. Is the person currently visible the same individual? Note: lighting, angle, and expression may differ. Answer ONLY with valid JSON and no other text: {"authorized": true} or {"authorized": false, "reason": "brief explanation"}`;

    const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")],
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      // On Ollama error, default to authorized to avoid false lockouts
      res.json({ authorized: true, reason: "Vision check unavailable" });
      return;
    }

    const data = (await response.json()) as { message?: { content: string } };
    const content = data?.message?.content || "{}";
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
    } else {
      res.json({ authorized: true, reason: "Parse error — defaulting safe" });
    }
  } catch {
    res.json({ authorized: true, reason: "Check failed — defaulting safe" });
  }
});

router.get("/ollama/status", async (req, res) => {
  const settings = readJSON<Settings>(SETTINGS_FILE, defaultSettings);
  if (useGroq) {
    res.json({ online: true, models: [{ name: settings.model }] });
    return;
  }

  try {
    const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        models?: { name: string }[];
      };
      res.json({ online: true, models: data.models || [] });
    } else {
      res.json({ online: false });
    }
  } catch {
    res.json({ online: false });
  }
});

export default router;
