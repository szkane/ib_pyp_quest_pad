import { QuestPadDB, TaskDef } from '../types';
import { CAT_DEFS } from '../constants';
import { uid, dateKey, monthKey } from '../utils';
import {
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  Unsubscribe,
} from '../firebase';

export function blankDB(childName = 'IB Learner', ownerId?: string): QuestPadDB {
  return {
    version: 3,
    createdAt: Date.now(),
    ownerId,
    settings: {
      childName: childName && childName !== 'Hilson' ? childName : 'IB Learner',
      parentPin: '1234',
      stepMode: 'perStep'
    },
    categories: CAT_DEFS.map((c) => ({ ...c })),
    goals: [],
    tasks: [],
    checkins: {},
    ledger: [],
    redeems: { daily: [], weekly: [], monthly: [] },
    redemptions: [],
    timer: null
  };
}

export function isTaskComplete(date: string, task: TaskDef, database: QuestPadDB): boolean {
  if (!task.steps || !task.steps.length) return false;
  const r = (database.checkins[date] || {})[task.id];
  if (!r || !r.steps) return false;
  let n = 0;
  task.steps.forEach((s) => {
    if (r.steps[s.id]) n++;
  });
  return n >= task.steps.length;
}

export function stepPoints(task: TaskDef): number[] {
  const arr: number[] = [];
  const n = task.steps ? task.steps.length : 0;
  if (!n) return arr;
  const pts = Math.max(0, Math.round(Number(task.points) || 0));
  const base = Math.floor(pts / n);
  const rest = pts - base * n;
  for (let i = 0; i < n; i++) {
    arr.push(i === n - 1 ? base + rest : base);
  }
  return arr;
}

export function syncPointsIn(d: QuestPadDB, date: string, task: TaskDef): void {
  const rec = (d.checkins[date] || {})[task.id] || null;
  const pts = stepPoints(task);
  const mode = d.settings?.stepMode || 'perStep';
  const wanted: Record<string, { delta: number; reason: string }> = {};
  const isDone = isTaskComplete(date, task, d);

  if (mode === 'onComplete') {
    if (isDone) {
      wanted[`${date}|${task.id}|all`] = {
        delta: Number(task.points) || 0,
        reason: `${task.title} (Completed ✓)`
      };
    }
  } else {
    task.steps.forEach((s, i) => {
      if (rec?.steps && rec.steps[s.id]) {
        wanted[`${date}|${task.id}|${s.id}`] = {
          delta: pts[i] || 0,
          reason: `${task.title} · ${s.title}`
        };
      }
    });
  }

  d.ledger = d.ledger.filter((e) => {
    if (e.kind !== 'earn') return true;
    if (e.taskId !== task.id || e.date !== date) return true;
    return !!wanted[e.id];
  });

  Object.keys(wanted).forEach((id) => {
    const w = wanted[id];
    const ex = d.ledger.find((item) => item.id === id);
    if (ex) {
      ex.delta = w.delta;
      ex.reason = w.reason;
      ex.catId = task.categoryId;
      if (!ex.ts || (ex.date && dateKey(new Date(ex.ts)) !== ex.date)) {
        const [y, m, day] = date.split('-').map(Number);
        ex.ts = new Date(y, m - 1, day, 9, 30, 0).getTime();
      }
    } else {
      let ts = Date.now();
      const todayStr = dateKey();
      const stepId = id.split('|')[2];
      const explicitTime = (rec as any)?.stepTimes?.[stepId];
      if (explicitTime && typeof explicitTime === 'number') {
        ts = explicitTime;
      } else if (date !== todayStr) {
        const [y, m, day] = date.split('-').map(Number);
        const pseudoMin = (id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 50) + 5;
        const pseudoHour = 9 + (id.charCodeAt(0) % 8);
        ts = new Date(y, m - 1, day, pseudoHour, pseudoMin, 0).getTime();
      }
      d.ledger.push({
        id,
        ts,
        date,
        catId: task.categoryId,
        delta: w.delta,
        reason: w.reason,
        taskId: task.id,
        kind: 'earn'
      });
    }
  });
}

export function seedDemo(childName = 'IB Learner', ownerId?: string): QuestPadDB {
  const cleanName = childName && childName !== 'Hilson' ? childName : 'IB Learner';
  const d = blankDB(cleanName, ownerId);
  const today = dateKey();
  const mk = monthKey(today);
  const gid = uid('goal');

  d.goals.push({
    id: gid,
    month: mk,
    months: [mk],
    title: 'Monthly Self-Management & Growth',
    desc: 'Take small steps daily, build strong agency, and celebrate achievements!',
    targetCount: 30,
    createdAt: Date.now() - 86400000 * 3
  });

  const ALL = [0, 1, 2, 3, 4, 5, 6];
  const WEEKEND = [0, 6];

  function mkTask(title: string, catId: string, points: number, steps: [string, number][], days: number[]): TaskDef {
    return {
      id: uid('task'),
      month: mk,
      months: [mk],
      goalId: gid,
      title,
      categoryId: catId,
      points,
      weekdays: days.slice(),
      active: true,
      steps: steps.map((s) => ({ id: uid('st'), title: s[0], minutes: s[1] })),
      createdAt: Date.now()
    };
  }

  // 1. Study
  d.tasks.push(mkTask('Reading & Vocabulary Quest', 'cat_study', 10, [
    ['Read 10 pages in storybook', 10],
    ['Mark & write down 3 words', 5],
    ['Share a 1-sentence reflection', 3]
  ], ALL));

  d.tasks.push(mkTask('Math Thinking Sprint', 'cat_study', 10, [
    ['Mental math warm-up', 3],
    ['Solve 15 challenge problems', 8],
    ['Review mistakes & explain', 4]
  ], ALL));

  // 2. Earn Money
  d.tasks.push(mkTask('Clean Bedroom & Organize Desk', 'cat_money', 15, [
    ['Make the bed neat', 3],
    ['Clear & wipe study desk', 5],
    ['Put away toys & books', 7]
  ], ALL));

  d.tasks.push(mkTask('Help with Family Dinner', 'cat_money', 15, [
    ['Set table & utensils', 4],
    ['Clear dishes after dinner', 5],
    ['Wipe clean dining table', 4]
  ], WEEKEND));

  // 3. Sport
  d.tasks.push(mkTask('Daily Jump Rope Challenge', 'cat_sport', 12, [
    ['Dynamic joint warm-up', 2],
    ['Jump rope 500 times', 8],
    ['Cool down & stretch legs', 3]
  ], ALL));

  d.tasks.push(mkTask('Outdoor Movement & Run', 'cat_sport', 12, [
    ['15-min jog or scooter ride', 15],
    ['Ball play / park exercise', 10]
  ], ALL));

  // 4. Life
  d.tasks.push(mkTask('Morning Routine & Water Plants', 'cat_life', 8, [
    ['Wash face & drink warm water', 3],
    ['Water the balcony plants', 4],
    ['Pack school backpack', 4]
  ], ALL));

  d.tasks.push(mkTask('Evening Self-Care & Lights Out', 'cat_life', 8, [
    ['Prepare tomorrow clothes', 4],
    ['20-min quiet bedtime reading', 20],
    ['Brush teeth & lights out', 5]
  ], ALL));

  // Preset progress for first task
  const t1 = d.tasks[0];
  d.checkins[today] = {};
  d.checkins[today][t1.id] = { steps: {}, used: {}, note: '' };
  d.checkins[today][t1.id].steps[t1.steps[0].id] = true;
  d.checkins[today][t1.id].used[t1.steps[0].id] = 120;

  // Default Rewards
  d.redeems.daily = [
    { id: uid('rd'), tier: 'daily', name: '20 min Free Choice Play / Cartoon', cost: 30, catId: 'cat_study', limit: 1, desc: 'Redeem after daily tasks' },
    { id: uid('rd'), tier: 'daily', name: "Pick Today's Favorite Snack", cost: 15, catId: 'cat_life', limit: 1, desc: '' },
    { id: uid('rd'), tier: 'daily', name: '20 min Cozy Bedtime Story', cost: 25, catId: 'cat_study', limit: 1, desc: '' }
  ];
  d.redeems.weekly = [
    { id: uid('rd'), tier: 'weekly', name: 'Weekend Park Bike Adventure', cost: 120, catId: 'cat_sport', limit: 1, desc: 'Plan time with parents' },
    { id: uid('rd'), tier: 'weekly', name: 'Pick a New Book or Comic', cost: 150, catId: 'cat_study', limit: 1, desc: '' },
    { id: uid('rd'), tier: 'weekly', name: 'Earn $5 Pocket Money / Allowance', cost: 150, catId: 'cat_money', limit: 1, desc: 'Savings or spending' }
  ];
  d.redeems.monthly = [
    { id: uid('rd'), tier: 'monthly', name: 'Family Theme Park or Nature Trip', cost: 500, catId: 'cat_sport', limit: 1, desc: 'Discuss destination together' },
    { id: uid('rd'), tier: 'monthly', name: 'Wishlist Lego / Craft Kit', cost: 750, catId: 'cat_money', limit: 1, desc: 'Within agreed budget' }
  ];

  d.tasks.forEach((t) => {
    Object.keys(d.checkins).forEach((dt) => {
      syncPointsIn(d, dt, t);
    });
  });

  return d;
}

export function reconcileWorkbenchData(d: QuestPadDB): QuestPadDB {
  if (!d) return d;
  if (!d.ledger) d.ledger = [];
  if (!d.checkins) d.checkins = {};
  if (!d.tasks) d.tasks = [];
  if (!d.redemptions) d.redemptions = [];
  if (!d.categories) d.categories = CAT_DEFS.map((c) => ({ ...c }));
  if (!d.redeems) {
    d.redeems = { daily: [], weekly: [], monthly: [] };
  } else {
    if (!Array.isArray(d.redeems.daily)) d.redeems.daily = [];
    if (!Array.isArray(d.redeems.weekly)) d.redeems.weekly = [];
    if (!Array.isArray(d.redeems.monthly)) d.redeems.monthly = [];
  }

  // 1. Re-sync all task check-ins into ledger
  const checkinDates = Object.keys(d.checkins);
  d.tasks.forEach((task) => {
    checkinDates.forEach((date) => {
      syncPointsIn(d, date, task);
    });
  });

  // 2. Ensure every approved redemption has exactly one corresponding spend entry in the ledger
  const approvedRedemptions = d.redemptions.filter((r) => r.status === 'approved');
  const existingSpendIds = new Set<string>();
  const approvedIds = new Set(approvedRedemptions.map((r) => r.id));

  // Clean up any spend ledger entries for redemptions that are no longer approved or deleted
  d.ledger = d.ledger.filter((entry) => {
    if (entry.kind === 'spend' && entry.redemptionId) {
      if (!approvedIds.has(entry.redemptionId)) return false;
      if (existingSpendIds.has(entry.redemptionId)) return false;
      existingSpendIds.add(entry.redemptionId);
    }
    return true;
  });

  // For any approved redemption that lacks a spend entry in ledger, add it!
  approvedRedemptions.forEach((r) => {
    const hasSpend = d.ledger.some(
      (e) => e.kind === 'spend' && (e.redemptionId === r.id || e.id === 'spend|' + r.id)
    );
    if (!hasSpend) {
      d.ledger.push({
        id: 'spend|' + r.id,
        ts: r.decidedAt || r.ts || Date.now(),
        date: r.appliedDate || dateKey(),
        catId: r.catId,
        delta: -Math.abs(r.cost),
        reason: 'Reward: ' + r.name,
        kind: 'spend',
        redemptionId: r.id,
      });
    }
  });

  // 3. Remove duplicate earn/adjust entries with the exact same id
  const seenIds = new Set<string>();
  d.ledger = d.ledger.filter((entry) => {
    if (entry.id) {
      if (seenIds.has(entry.id)) return false;
      seenIds.add(entry.id);
    }
    return true;
  });

  // 4. Ensure realistic, distinct timestamps matching each entry's calendar date
  const dateCounts: Record<string, number> = {};
  d.ledger.forEach((e) => {
    if (!e.date) return;
    dateCounts[e.date] = (dateCounts[e.date] || 0) + 1;
    const order = dateCounts[e.date];

    // If e.ts is missing or dateKey(new Date(e.ts)) doesn't match e.date:
    if (!e.ts || dateKey(new Date(e.ts)) !== e.date) {
      const [y, m, day] = e.date.split('-').map(Number);
      // Create a natural time distribution: e.g. 8:30 + order * 25 minutes
      const totalMinutes = 8 * 60 + 30 + order * 25;
      const h = Math.min(21, Math.floor(totalMinutes / 60));
      const min = totalMinutes % 60;
      const targetDate = new Date(y, m - 1, day, h, min, (order * 13) % 60);
      e.ts = targetDate.getTime();
    }
  });

  return d;
}

export async function saveWorkbenchToFirestore(userId: string, data: QuestPadDB): Promise<void> {
  const path = `workbenches/${userId}`;
  try {
    const rawPayload = {
      ...data,
      ownerId: userId,
      updatedAt: new Date().toISOString()
    };
    // Strip any undefined values to avoid Firestore serialization errors
    const payload = JSON.parse(
      JSON.stringify(rawPayload, (_key, value) => (value === undefined ? null : value))
    );
    await setDoc(doc(db, 'workbenches', userId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToWorkbench(
  userId: string,
  onData: (data: QuestPadDB) => void,
  onError: (err: any) => void
): Unsubscribe {
  const path = `workbenches/${userId}`;
  return onSnapshot(
    doc(db, 'workbenches', userId),
    async (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data() as QuestPadDB;
        if (raw.settings && raw.settings.childName === 'Hilson') {
          raw.settings.childName = 'IB Learner';
        }
        const reconciled = reconcileWorkbenchData(raw);
        onData(reconciled);
      } else {
        // First time initialization for new user
        const initial = seedDemo('IB Learner', userId);
        try {
          await setDoc(doc(db, 'workbenches', userId), {
            ...initial,
            ownerId: userId,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, path);
        }
        onData(initial);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      onError(error);
    }
  );
}
