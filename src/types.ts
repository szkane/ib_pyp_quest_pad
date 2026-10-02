export interface CategoryDef {
  id: string;
  name: string;
  nameZh?: string;
  color: string;
  icon?: string;
  points: number;
  pointName: string;
  pointNameZh?: string;
  emoji: string;
}

export interface TaskStep {
  id: string;
  title: string;
  minutes: number;
}

export interface TaskDef {
  id: string;
  month?: string;
  months?: string[];
  goalId?: string;
  title: string;
  categoryId: string;
  points: number;
  weekdays: number[];
  active?: boolean;
  steps: TaskStep[];
  createdAt: number;
}

export interface GoalDef {
  id: string;
  month?: string;
  months?: string[];
  title: string;
  desc?: string;
  targetCount: number;
  createdAt: number;
}

export interface TaskCheckin {
  steps: Record<string, boolean>;
  used: Record<string, number>;
  note?: string;
}

export interface LedgerEntry {
  id: string;
  ts: number;
  date: string;
  catId: string;
  delta: number;
  reason: string;
  taskId?: string;
  kind?: 'earn' | 'spend' | 'adjust';
  redemptionId?: string;
}

export interface RedeemItem {
  id: string;
  tier: 'daily' | 'weekly' | 'monthly';
  name: string;
  cost: number;
  catId: string;
  limit?: number;
  desc?: string;
}

export interface RedemptionRecord {
  id: string;
  ts: number;
  tier: 'daily' | 'weekly' | 'monthly';
  itemId: string;
  name: string;
  cost: number;
  catId: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedDate: string;
  decidedAt?: number;
}

export interface TimerState {
  date: string;
  taskId: string;
  stepId: string;
  startTs: number;
}

export interface WorkbenchSettings {
  childName: string;
  parentPin: string;
  stepMode: 'perStep' | 'onComplete';
}

export interface QuestPadDB {
  version: number;
  createdAt: number;
  updatedAt?: string;
  ownerId?: string;
  settings: WorkbenchSettings;
  categories: CategoryDef[];
  goals: GoalDef[];
  tasks: TaskDef[];
  checkins: Record<string, Record<string, TaskCheckin>>;
  ledger: LedgerEntry[];
  redeems: {
    daily: RedeemItem[];
    weekly: RedeemItem[];
    monthly: RedeemItem[];
  };
  redemptions: RedemptionRecord[];
  timer: TimerState | null;
}
