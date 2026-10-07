# Quest Pad · Domain & Technical Glossary

This glossary defines the foundational concepts, domain models, technical schemas, and terminology used throughout the **Quest Pad (IB PYP Quest Pad · 学习打卡台)** codebase. It is designed to ensure strict semantic alignment during agentic coding and architectural maintenance.

---

## 1. Domain Context & Core Metaphor

* **Quest Pad / Learning Workbench (学习打卡台)**: A gamified inquiry workbench for children and parents, inspired by IB PYP (Primary Years Programme) learner agency. Routine chores, study habits, exercise, and reading are structured into active "Quests" with tangible progress, visual feedback, and parent-approved rewards.
* **Dual-Role Model**:
  * **Quest Mode / Kid View (学生模式 / 探索模式)**: The default touch-friendly interface for young learners. Allows checking in daily tasks, running step focus timers, tracking goal progress, viewing earned points wallet, and requesting rewards.
  * **Parent Hub / Parent Settings (家长中心 / 家长设置)**: PIN-protected administration console (`parentPin`, default: `1234`). Allows adding/editing quests, sub-steps, categories, monthly goals, custom reward items, approving/rejecting redemption requests, manually adjusting points, and importing/exporting database JSON backups.
* **Multi-Tenant Isolation**: Each user signs in via Firebase Google Authentication. Their complete workbench is stored in a private Firestore document `/workbenches/{userId}` with strict row-level security.

---

## 2. Core Entities & TypeScript Interfaces (`src/types.ts`)

### 2.1 `QuestPadDB`
The top-level JSON document representing the entire state of a user's workbench.
```typescript
interface QuestPadDB {
  version: number;             // Schema version (current: 3)
  createdAt: number;           // Unix epoch timestamp (ms)
  updatedAt?: string;          // ISO-8601 timestamp string
  ownerId?: string;            // Firebase Auth UID
  settings: WorkbenchSettings; // App-wide configuration
  categories: CategoryDef[];   // Active learning/habit categories
  goals: GoalDef[];            // Monthly high-level inquiry goals
  tasks: TaskDef[];            // Task/quest definitions
  checkins: Record<string, Record<string, TaskCheckin>>; // Date -> TaskId -> Checkin
  ledger: LedgerEntry[];       // Immutable point transaction audit log
  redeems: {                   // Catalog of available reward items
    daily: RedeemItem[];
    weekly: RedeemItem[];
    monthly: RedeemItem[];
  };
  redemptions: RedemptionRecord[]; // Child's reward requests & fulfillment history
  timer: TimerState | null;    // Active persisted focus stopwatch/timer
}
```

### 2.2 `CategoryDef`
Defines an inquiry domain (e.g. Study, Earn Money, Sport, Life Skills).
* `id` (`string`): Unique category identifier (e.g. `cat_study`, `cat_money`, `cat_sport`, `cat_life`).
* `name` (`string`): English display name (e.g. "Study").
* `nameZh` (`string?`): Simplified Chinese display name (e.g. "学习").
* `color` (`string`): Hex accent color code (e.g. `#3b82f6`).
* `icon` (`string`): Icon key matching `Icons.tsx` (e.g. `book`, `coin`, `run`, `home`).
* `points` (`number`): Default reward point value for newly created tasks in this category.
* `pointName` (`string`): English name of the currency (e.g. "IQ", "Coin", "Energy", "Care").
* `pointNameZh` (`string?`): Chinese currency name (e.g. "智力", "币", "能量", "爱心").
* `emoji` (`string`): Visual category emoji (e.g. `🌟`, `💰`, `⚡`, `❤️`).

### 2.3 `TaskDef` (Quest Definition)
Defines a daily scheduled quest.
* `id` (`string`): Unique task identifier (generated via `uid('task')`).
* `title` (`string`): Task title/headline.
* `categoryId` (`string`): Foreign key to `CategoryDef.id`.
* `points` (`number`): Total points awarded upon complete execution.
* `weekdays` (`number[]`): Active days of the week (`0` = Sunday, `1` = Monday, ..., `6` = Saturday).
* `months` (`string[]?`): Targeted months in `YYYY-MM` format (e.g. `["2026-03", "2026-04"]`).
* `goalId` (`string?`): Optional foreign key to an associated `GoalDef.id`.
* `active` (`boolean?`): Whether the task is currently active or paused.
* `steps` (`TaskStep[]`): Ordered sub-steps that make up the quest.
* `createdAt` (`number`): Unix epoch timestamp (ms).

### 2.4 `TaskStep`
A bite-sized step within a task.
* `id` (`string`): Step identifier (e.g. `step_1` or `uid('step')`).
* `title` (`string`): Step description.
* `minutes` (`number`): Suggested duration in minutes for the focus timer.

### 2.5 `TaskCheckin`
The execution record of a task on a specific calendar date (`checkins[dateKey][taskId]`).
* `steps` (`Record<string, boolean>`): Map of `stepId -> boolean` indicating completed steps.
* `used` (`Record<string, number>`): Map of `stepId -> seconds` recording time spent in focus timer.
* `note` (`string?`): Optional note or reflection for the checkin.

### 2.6 `GoalDef` (Monthly Inquiry Goal)
High-level target grouping daily quests across a calendar month.
* `id` (`string`): Unique goal identifier (`uid('goal')`).
* `title` (`string`): Goal title (e.g. "Read 10 Books this Month").
* `desc` (`string?`): Detailed description or inquiry question.
* `targetCount` (`number`): Target accomplishment count or steps threshold.
* `months` (`string[]?`): Targeted months (`YYYY-MM`).
* `createdAt` (`number`): Creation timestamp.

### 2.7 `LedgerEntry` (Points Ledger)
Append-only audit transaction recording point deltas.
* `id` (`string`): Unique entry ID (often deterministic: `${date}|${taskId}|${stepId}` for earn events, or `uid('adj')` for adjustments).
* `ts` (`number`): Unix epoch timestamp (ms).
* `date` (`string`): Calendar date string (`YYYY-MM-DD`).
* `catId` (`string`): Foreign key to `CategoryDef.id`.
* `delta` (`number`): Signed point change (`+10`, `-25`).
* `reason` (`string`): Human-readable reason shown in audit logs.
* `kind` (`'earn' | 'spend' | 'adjust'`):
  * `earn`: Points earned through task or sub-step check-in.
  * `spend`: Points deducted when a reward request is approved.
  * `adjust`: Manual balance adjustments made by parents.
* `taskId` (`string?`): Reference to task if kind is `earn`.
* `redemptionId` (`string?`): Reference to redemption record if kind is `spend`.

### 2.8 `RedeemItem` (Reward Catalog Item)
A reward configurable by parents in the Celebration Vault.
* `id` (`string`): Unique reward item ID (`uid('rd')`).
* `tier` (`'daily' | 'weekly' | 'monthly'`): Reward classification tier.
* `name` (`string`): Reward item title (e.g. "30 Min Free Play", "Lego Set").
* `cost` (`number`): Point cost required to redeem.
* `catId` (`string`): Category point currency required.
* `limit` (`number?`): Frequency limit per period.
* `desc` (`string?`): Reward details or conditions.

### 2.9 `RedemptionRecord` (Redemption History)
A child's reward request and its approval lifecycle.
* `id` (`string`): Unique record ID (`uid('redemption')`).
* `itemId` (`string`): Reference to `RedeemItem.id`.
* `tier` (`'daily' | 'weekly' | 'monthly'`): Reward tier.
* `name` (`string`): Reward item name snapshot at time of request.
* `cost` (`number`): Points deducted on approval.
* `catId` (`string`): Category currency.
* `status` (`'pending' | 'approved' | 'rejected'`): Current approval status.
* `appliedDate` (`string`): Date requested (`YYYY-MM-DD`).
* `ts` (`number`): Timestamp requested.
* `decidedAt` (`number?`): Timestamp when parent approved or rejected.

### 2.10 `WorkbenchSettings`
* `childName` (`string`): Learner's display name (default: "IB Learner").
* `parentPin` (`string`): 4-digit PIN for parent hub unlock (default: "1234").
* `stepMode` (`'perStep' | 'onComplete'`):
  * `perStep`: Points are awarded proportionally as each sub-step is completed.
  * `onComplete`: Points are only awarded once all sub-steps of the task are completed.

---

## 3. UI Concepts & Tab Nomenclature

| Navigation Key | English UI | Chinese UI (zh) | Description |
| :--- | :--- | :--- | :--- |
| `nav_tasks` | **Today's Quests** | 今日打卡 | Main daily check-in screen for children. Shows category selector, active tasks, sub-step checklists, and focus timer. |
| `nav_goals` | **Big Goals** | 月度目标 | Monthly inquiry milestone tracker showing progress bars and associated quests. |
| `nav_rewards` | **Reward Vault** | 愿望兑换 (心愿宝库) | Kid-facing reward shop organized into Daily, Weekly, and Monthly tiers with point balances and request buttons. |
| `nav_parent` | **Parent Hub** | 家长管理 | PIN-protected console divided into 4 sub-tabs: Tasks, Goals, Rewards (Celebration Vault), and Settings & Data. |

### Parent Hub Sub-tabs (`parentTab`):
* `'tasks'`: Manage quest definitions, sub-steps, target weekdays, and category filters.
* `'goals'`: Manage monthly inquiry goals and assign quests to goals.
* `'rewards'`: Manage **Celebration Vault** (pending approval actions + categorized reward catalog with tier filters).
* `'settings'`: Learner profile name, parent PIN, step scoring mode (`perStep` vs `onComplete`), points wallet adjustments, and JSON backup import/export.

---

## 4. Date & Key Conventions

* **`dateKey(d?: Date | string): string`**: Always produces formatted local calendar date string: `YYYY-MM-DD` (e.g. `2026-10-07`).
* **`monthKey(d?: Date | string): string`**: Always produces formatted local month string: `YYYY-MM` (e.g. `2026-10`).
* **`parseKey(k: string): Date`**: Parses `YYYY-MM-DD` into a local `Date` object using local year, month, and day components (preventing UTC offset boundary shifts).
* **Deterministic Ledger Keys**: For step-level check-ins, `id = `${date}|${taskId}|${stepId}`` to ensure idempotency when checking/unchecking steps.

---

## 5. Security & Isolation Invariants

* **Single Tenant Collection**: All workbench state resides at `/workbenches/{userId}` in Firestore, keyed strictly to the authenticated user's Firebase UID (`request.auth.uid == userId`).
* **Profile Collection**: `/users/{userId}` stores profile metadata (`email`, `displayName`, `photoURL`, `updatedAt`).
* **Zero Cross-User Leakage**: Security rules forbid reading or writing any document where document ID does not match the caller's auth UID.
