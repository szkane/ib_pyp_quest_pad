import { I18N } from './constants';

export function uid(p?: string): string {
  return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

export function dateKey(d?: Date | string): string {
  if (typeof d === 'string') return d;
  const date = d ? new Date(d) : new Date();
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

export function monthKey(d?: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 7);
  const date = d ? new Date(d) : new Date();
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
}

export function parseKey(k: string): Date {
  const p = String(k).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2] || 1);
}

export function fmtDate(k: string, lang: string): string {
  const d = parseKey(k);
  if (lang === 'zh') return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthsEn[d.getMonth()] + ' ' + d.getDate();
}

export function fmtHeaderDate(k: string, lang: string): string {
  const d = parseKey(k);
  const dw = d.getDay();
  if (lang === 'zh') {
    const dwZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dw];
    return dwZh + ' · ' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  const dwEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dw];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return dwEn + ' · ' + monthsEn[d.getMonth()] + ' ' + d.getDate();
}

export function fmtMonth(mk: string, lang: string): string {
  const p = mk.split('-').map(Number);
  if (lang === 'zh') return p[0] + '年' + p[1] + '月';
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return monthsEn[p[1] - 1] + ' ' + p[0];
}

export function fmtDur(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || isNaN(sec)) return '—';
  const cleanSec = Math.max(0, Math.round(sec));
  const m = Math.floor(cleanSec / 60);
  const s = cleanSec % 60;
  return pad2(m) + ':' + pad2(s);
}

export function fmtDateTime(ts?: number, dateStr?: string, lang?: string): string {
  if (ts && !isNaN(ts) && ts > 0) {
    const d = new Date(ts);
    const hours = pad2(d.getHours());
    const mins = pad2(d.getMinutes());
    const timePart = `${hours}:${mins}`;

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (lang === 'zh') {
      if (isToday) return `今天 ${timePart}`;
      if (isYesterday) return `昨天 ${timePart}`;
      return `${d.getMonth() + 1}月${d.getDate()}日 ${timePart}`;
    } else {
      if (isToday) return `Today, ${timePart}`;
      if (isYesterday) return `Yesterday, ${timePart}`;
      const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthsEn[d.getMonth()]} ${d.getDate()}, ${timePart}`;
    }
  }
  if (dateStr) {
    return fmtDate(dateStr, lang || 'en');
  }
  return '—';
}

export function t(key: string, lang: string, params?: Record<string, any>): string {
  const dict = I18N[lang] || I18N.en;
  let str = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
  if (typeof str !== 'string') return str;
  if (params) {
    Object.keys(params).forEach((k) => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
    });
  }
  return str;
}

// Audio Synthesis for Mario Chimes
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSoundStepDone(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(987.77, now); // B5
    g1.gain.setValueAtTime(0.24, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.1);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    g2.gain.setValueAtTime(0.3, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(now + 0.08);
    o2.stop(now + 0.42);
  } catch (e) {
    // audio fallback
  }
}

export function playSoundQuestAccomplished(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 392.00, t: 0, d: 0.10 },     // G4
      { f: 523.25, t: 0.10, d: 0.10 },  // C5
      { f: 659.25, t: 0.20, d: 0.10 },  // E5
      { f: 783.99, t: 0.30, d: 0.12 },  // G5
      { f: 1046.50, t: 0.42, d: 0.15 }, // C6
      { f: 1318.51, t: 0.57, d: 0.45 }  // E6 triumphant hold
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.25, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  } catch (e) {
    // audio fallback
  }
}

export function runConfetti(canvas: HTMLCanvasElement, durationMs = 2800): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let animId: number | null = null;
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);

  const colors = ['#f2b84b', '#4a7cdd', '#2f6f62', '#e36b5a', '#a855f7', '#ec4899', '#06b6d4', '#10b981'];
  const count = 75;
  const particles: any[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 5 + Math.random() * 9;
    particles.push({
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h / 2 - 40 + (Math.random() - 0.5) * 60,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6 - Math.random() * 4,
      size: 7 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.28 + Math.random() * 0.12,
      alpha: 1
    });
  }

  const startTs = Date.now();

  function render() {
    const elapsed = Date.now() - startTs;
    if (elapsed > durationMs) {
      ctx?.clearRect(0, 0, w, h);
      return;
    }

    ctx?.clearRect(0, 0, w, h);
    const fade = elapsed > durationMs - 700 ? (durationMs - elapsed) / 700 : 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;

      ctx?.save();
      if (ctx) ctx.globalAlpha = Math.max(0, p.alpha * fade);
      ctx?.translate(p.x, p.y);
      ctx?.rotate((p.rotation * Math.PI) / 180);
      if (ctx) ctx.fillStyle = p.color;
      ctx?.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx?.restore();
    }

    animId = requestAnimationFrame(render);
  }

  animId = requestAnimationFrame(render);

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}
