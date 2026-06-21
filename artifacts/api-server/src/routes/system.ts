import { Router } from "express";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

router.get("/diagnostics", async (req, res) => {
  const results: Record<string, unknown> = {};

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  results.cpu = {
    model: cpus[0]?.model || "Unknown",
    cores: cpus.length,
    speed: cpus[0]?.speed || 0,
    loadAvg: os.loadavg(),
  };

  results.memory = {
    totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
    usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
    freeGB: (freeMem / 1024 / 1024 / 1024).toFixed(2),
    usedPercent: ((usedMem / totalMem) * 100).toFixed(1),
  };

  results.system = {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: formatUptime(os.uptime()),
    nodeVersion: process.version,
  };

  try {
    const { stdout: dfOut } = await execAsync("df -h / 2>/dev/null || echo 'unavailable'");
    const lines = dfOut.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      results.disk = {
        total: parts[1] || "?",
        used: parts[2] || "?",
        available: parts[3] || "?",
        usedPercent: parts[4] || "?",
      };
    }
  } catch {
    results.disk = { error: "Unavailable" };
  }

  try {
    await execAsync("ping -c 1 8.8.8.8 -W 2 2>/dev/null || ping -n 1 8.8.8.8 2>nul");
    results.network = { internet: true };
  } catch {
    results.network = { internet: false };
  }

  const issues: string[] = [];

  const memUsed = parseFloat((results.memory as { usedPercent: string }).usedPercent);
  if (memUsed > 90) issues.push(`Critical memory usage: ${memUsed}% used`);
  else if (memUsed > 75) issues.push(`High memory usage: ${memUsed}% used`);

  const [load1] = (results.cpu as { loadAvg: number[] }).loadAvg;
  const cores = (results.cpu as { cores: number }).cores;
  if (load1 > cores * 0.9) issues.push(`High CPU load: ${load1.toFixed(2)} (${cores} cores)`);

  if (!(results.network as { internet: boolean }).internet) {
    issues.push("No internet connectivity detected");
  }

  results.issues = issues;
  results.status = issues.length === 0 ? "healthy" : issues.length <= 1 ? "warning" : "critical";
  results.timestamp = new Date().toISOString();

  res.json(results);
});

const ALLOWED_COMMANDS: Record<string, { cmd: string; description: string }> = {
  "list processes": { cmd: "ps aux --no-headers | head -20 2>/dev/null || tasklist /fo csv /nh 2>nul | head -20", description: "List running processes" },
  "disk usage": { cmd: "df -h 2>/dev/null || wmic logicaldisk get size,freespace,caption 2>nul", description: "Show disk usage" },
  "network info": { cmd: "ip addr show 2>/dev/null || ifconfig 2>/dev/null || ipconfig 2>nul", description: "Show network interfaces" },
  "uptime": { cmd: "uptime 2>/dev/null || net stats workstation 2>nul", description: "Show system uptime" },
  "memory usage": { cmd: "free -h 2>/dev/null || systeminfo | findstr /C:'Available Physical Memory' 2>nul", description: "Show memory usage" },
  "top processes": { cmd: "ps aux --sort=-%cpu 2>/dev/null | head -10 || wmic process get Caption,WorkingSetSize /format:list 2>nul | head -30", description: "Top CPU processes" },
  "open browser": { cmd: "xdg-open https://google.com 2>/dev/null || open https://google.com 2>/dev/null || start https://google.com 2>nul", description: "Open browser" },
  "open files": { cmd: "xdg-open ~ 2>/dev/null || open ~ 2>/dev/null || explorer . 2>nul", description: "Open file manager" },
  "battery": { cmd: "cat /sys/class/power_supply/BAT0/capacity 2>/dev/null; cat /sys/class/power_supply/BAT0/status 2>/dev/null || pmset -g batt 2>/dev/null || powercfg /batteryreport /output /dev/stdout 2>nul", description: "Battery status" },
  "temperature": { cmd: "cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | awk '{print $1/1000}' || sudo powermetrics -n 1 --samplers smc 2>/dev/null | grep 'CPU die temperature' | head -3", description: "CPU temperature" },
};

router.get("/commands", (req, res) => {
  res.json(
    Object.entries(ALLOWED_COMMANDS).map(([name, info]) => ({
      name,
      description: info.description,
    }))
  );
});

router.post("/commands/execute", async (req, res) => {
  const { command } = req.body;

  const entry = ALLOWED_COMMANDS[command?.toLowerCase()];
  if (!entry) {
    res.status(400).json({
      error: `Unknown command. Available: ${Object.keys(ALLOWED_COMMANDS).join(", ")}`,
    });
    return;
  }

  try {
    const { stdout, stderr } = await execAsync(entry.cmd, { timeout: 10000 });
    res.json({
      command,
      output: (stdout || stderr || "No output").trim().slice(0, 4000),
      success: true,
    });
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    res.json({
      command,
      output: (error.stdout || error.stderr || error.message || "Command failed").slice(0, 4000),
      success: false,
    });
  }
});

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export default router;
