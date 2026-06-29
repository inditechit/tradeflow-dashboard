export type AdminCallSoundId = "classic" | "digital" | "nokia" | "marimba" | "pulse";

export type AdminCallAlertType =
  | "withdrawal"
  | "support"
  | "payment"
  | "new_user"
  | "alert";

export type AdminCallNotificationPrefs = {
  enabled: boolean;
  soundId: AdminCallSoundId;
  volume: number;
  types: Record<AdminCallAlertType, boolean>;
};

const PREFS_KEY = "admin_call_notification_prefs_v1";
const WATERMARK_KEY = "admin_call_alert_watermarks_v1";

export const ADMIN_CALL_SOUNDS: Array<{
  id: AdminCallSoundId;
  label: string;
  description: string;
}> = [
  { id: "classic", label: "Classic phone", description: "Dual-tone landline ring" },
  { id: "digital", label: "Digital ring", description: "Fast repeating beeps" },
  { id: "nokia", label: "Retro mobile", description: "Old-school ascending melody" },
  { id: "marimba", label: "Smartphone", description: "Bright marimba-style call" },
  { id: "pulse", label: "Urgent pulse", description: "Triple pulse — hard to miss" },
];

export const ADMIN_CALL_ALERT_LABELS: Record<AdminCallAlertType, string> = {
  withdrawal: "Withdrawal requests",
  support: "Support needs reply",
  payment: "Pending payments / recharges",
  new_user: "New users",
  alert: "Admin alerts",
};

const DEFAULT_PREFS: AdminCallNotificationPrefs = {
  enabled: true,
  soundId: "classic",
  volume: 0.85,
  types: {
    withdrawal: true,
    support: true,
    payment: true,
    new_user: true,
    alert: true,
  },
};

export type AdminCallWatermarks = {
  lastWithdrawalId: number;
  lastAlertId: number;
  support_needs_reply: number;
  pending_recharges: number;
  pending_withdrawals: number;
  new_users: number;
  open_support_tickets: number;
  unmatched_payments: number;
  unread_alerts: number;
};

export function getDefaultWatermarks(): AdminCallWatermarks {
  return {
    lastWithdrawalId: 0,
    lastAlertId: 0,
    support_needs_reply: 0,
    pending_recharges: 0,
    pending_withdrawals: 0,
    new_users: 0,
    open_support_tickets: 0,
    unmatched_payments: 0,
    unread_alerts: 0,
  };
}

export function getAdminCallPrefs(): AdminCallNotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } };
    const parsed = JSON.parse(raw) as Partial<AdminCallNotificationPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      types: { ...DEFAULT_PREFS.types, ...(parsed.types ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } };
  }
}

export function saveAdminCallPrefs(prefs: AdminCallNotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("admin-call-prefs-changed"));
}

export function getAdminCallWatermarks(): AdminCallWatermarks {
  try {
    const raw = localStorage.getItem(WATERMARK_KEY);
    if (!raw) return getDefaultWatermarks();
    return { ...getDefaultWatermarks(), ...JSON.parse(raw) };
  } catch {
    return getDefaultWatermarks();
  }
}

export function saveAdminCallWatermarks(w: AdminCallWatermarks) {
  localStorage.setItem(WATERMARK_KEY, JSON.stringify(w));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

async function playClassic(ctx: AudioContext, vol: number) {
  const t0 = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    tone(ctx, i % 2 === 0 ? 440 : 480, t0 + i * 0.55, 0.45, vol * 0.35);
  }
  await sleep(3300);
}

async function playDigital(ctx: AudioContext, vol: number) {
  const t0 = ctx.currentTime;
  for (let i = 0; i < 8; i++) {
    tone(ctx, 880, t0 + i * 0.22, 0.12, vol * 0.4, "square");
  }
  await sleep(2000);
}

async function playNokia(ctx: AudioContext, vol: number) {
  const notes = [659, 587, 370, 415, 554, 494, 277, 330, 440, 392];
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => tone(ctx, f, t0 + i * 0.18, 0.16, vol * 0.32));
  await sleep(2200);
}

async function playMarimba(ctx: AudioContext, vol: number) {
  const notes = [523, 659, 784, 988, 784, 659];
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => tone(ctx, f, t0 + i * 0.14, 0.13, vol * 0.34, "triangle"));
  await sleep(1800);
}

async function playPulse(ctx: AudioContext, vol: number) {
  const t0 = ctx.currentTime;
  for (let g = 0; g < 3; g++) {
    for (let i = 0; i < 3; i++) {
      tone(ctx, 740, t0 + g * 0.9 + i * 0.15, 0.1, vol * 0.45, "sawtooth");
    }
  }
  await sleep(2800);
}

const PLAYERS: Record<AdminCallSoundId, (ctx: AudioContext, vol: number) => Promise<void>> = {
  classic: playClassic,
  digital: playDigital,
  nokia: playNokia,
  marimba: playMarimba,
  pulse: playPulse,
};

export class CallRingPlayer {
  private ctx: AudioContext | null = null;
  private stopRequested = false;

  private getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async unlock() {
    const ctx = this.getContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  async preview(soundId: AdminCallSoundId, volume: number) {
    await this.unlock();
    this.stopRequested = true;
    await sleep(50);
    this.stopRequested = false;
    const ctx = this.getContext();
    await PLAYERS[soundId](ctx, volume);
  }

  async startLoop(soundId: AdminCallSoundId, volume: number) {
    await this.unlock();
    this.stopRequested = false;
    const ctx = this.getContext();
    while (!this.stopRequested) {
      await PLAYERS[soundId](ctx, volume);
      if (this.stopRequested) break;
      await sleep(900);
    }
  }

  stop() {
    this.stopRequested = true;
    if (this.ctx && this.ctx.state === "running") {
      void this.ctx.suspend();
      void this.ctx.resume();
    }
  }
}
