# AGENT.md · Quest Pad Agentic Coding Guide

This guide is designed for AI coding agents and autonomous software engineers working on the **Quest Pad (IB PYP Quest Pad · 学习打卡台)** codebase. It outlines architecture patterns, state invariants, coding conventions, common recipes, and critical pitfalls.

---

## 1. High-Level Architecture

* **Frontend**: React 19 SPA bootstrapped with Vite, written in strict TypeScript.
* **Styling**: Vanilla CSS in `src/index.css` paired with a Neo-Brutalist / Tactile Notebook design system (high-contrast borders, playful pastel tokens, responsive grids, touch-friendly pill badges, and zero generic pill drift).
* **Database & Persistence**: Google Cloud Firestore with real-time multi-device synchronization via `onSnapshot`.
* **Authentication**: Firebase Authentication (Google OAuth provider popup flow).
* **Sound & Micro-Animations**: Synthesized audio fanfares using the browser's native Web Audio API (`AudioContext`) with zero external asset dependencies, plus canvas confetti.
* **Localization**: Lightweight native I18N dictionary in `src/constants.ts` supporting English (`en`) and Simplified Chinese (`zh`).

---

## 2. Directory Layout & File Responsibilities

```
/
├── Glossary.md             # Domain models, schema definitions, and vocabulary
├── AGENT.md                # This file: agentic engineering manual
├── metadata.json           # AI Studio applet capabilities and permissions
├── firebase-blueprint.json # Firestore entity schemas & security definitions
├── firestore.rules         # Tenant-isolated Firestore security rules
├── index.html              # HTML shell with meta tags and viewport settings
├── package.json            # Project dependencies and npm scripts
├── src/
│   ├── main.tsx            # React application entry point
│   ├── App.tsx             # Central state hub, main view controllers, and modals
│   ├── types.ts            # Canonical TypeScript domain interfaces
│   ├── constants.ts        # Default categories, I18N localization dictionary, storage keys
│   ├── utils.ts            # Date formatting, IDs, I18N helpers, and Web Audio synths
│   ├── firebase.ts         # Firebase SDK initialization, auth helpers, Firestore RPC
│   ├── index.css           # Global stylesheets, CSS custom properties, responsive layout
│   ├── components/
│   │   ├── AuthScreen.tsx  # Google Login screen for unauthenticated users
│   │   ├── Celebration.tsx # Canvas confetti animations and congratulatory banner
│   │   ├── FocusTimer.tsx  # Persisted step timer & audio countdown chime
│   │   ├── Icons.tsx       # Inline SVG icon library with standardized styling props
│   │   └── Modals.tsx      # Modal controllers (Tasks, Categories, Rewards, PIN, Backups)
│   └── services/
│       └── workbench.ts    # Database seeding, Firestore sync, ledger logic, point calculation
```

---

## 3. State Management & Data Flow

### 3.1 The Single Source of Truth
The application maintains a single in-memory reactive state object: `db: QuestPadDB`.

```typescript
// App.tsx
const [db, setDb] = useState<QuestPadDB>(() => seedDemo('IB Learner'));
```

### 3.2 Immutable Mutation Pattern (`updateDB`)
All database updates **must** go through the `updateDB` helper in `App.tsx`:
```typescript
const updateDB = (fn: (draft: QuestPadDB) => void) => {
  setDb((prev) => {
    // 1. Deep clone the current state
    const next: QuestPadDB = JSON.parse(JSON.stringify(prev));
    // 2. Apply mutations on the draft
    fn(next);
    next.updatedAt = new Date().toISOString();
    // 3. Debounced asynchronous persist to Firestore
    if (currentUser?.uid) {
      saveWorkbench(currentUser.uid, next).catch(console.error);
    }
    return next;
  });
};
```

### 3.3 Cloud Sync Lifecycle
1. On initial login (`onAuthStateChanged`), `App.tsx` calls `subscribeWorkbench(user.uid, (remoteDB) => { ... })`.
2. If remote document exists, `setDb(remoteDB)` initializes the local state.
3. If no remote document exists, `blankDB(childName, user.uid)` is created and persisted via `saveWorkbench`.
4. The local mutations use debounced `setDoc` to prevent Firestore write rate limits while ensuring immediate local UI responsiveness.

---

## 4. Critical Domain Invariants & Business Logic

### 4.1 Points Ledger Calculation (`calcBalance`)
* **Never compute balances by reading a static field.** Balances are computed dynamically from the append-only `db.ledger`:
  ```typescript
  const calcBalance = (catId: string): number => {
    return db.ledger
      .filter((e) => e.catId === catId)
      .reduce((sum, e) => sum + (Number(e.delta) || 0), 0);
  };
  ```
* `kind: 'earn'`: Positive delta awarded when tasks or sub-steps are checked in.
* `kind: 'spend'`: Negative delta deducted when a parent **approves** a reward redemption.
* `kind: 'adjust'`: Signed delta entered manually by parent with an explanatory reason.

### 4.2 Step Scoring Modes (`stepMode`)
Located in `db.settings.stepMode`:
* `'perStep'` (Default): Points are divided across sub-steps (`stepPoints(task)`). As each step is completed, a deterministic ledger entry `${date}|${taskId}|${stepId}` is created.
* `'onComplete'`: Points are only awarded once **all** sub-steps of the task are completed (`${date}|${taskId}|all`).
* Synchronization is executed by calling `syncPointsIn(db, date, task)`.

### 4.3 Reward Redemption Workflow
1. **Child Action**: Child clicks "Request Reward" in the **Reward Vault** tab (`activeNav === 'rewards'`).
   - Requires `calcBalance(reward.catId) >= reward.cost`.
   - Inserts record into `db.redemptions` with `status: 'pending'`.
   - **Does NOT deduct points yet.**
2. **Parent Approval**: Parent reviews in Parent Hub -> Rewards tab.
   - **Approve**: Sets `status: 'approved'`, and appends a `kind: 'spend'` entry to `db.ledger` (`delta = -cost`).
   - **Reject**: Sets `status: 'rejected'`. No points deducted.
   - **Delete Approved**: If parent deletes an approved record, points are refunded by removing the corresponding spend ledger entry or applying a refund adjustment.

### 4.4 Date & Time Operations
* **Never use `new Date().toISOString().slice(0, 10)`** because it evaluates in UTC and causes off-by-one calendar day bugs in positive or negative UTC timezones.
* **Always use helper functions in `src/utils.ts`**:
  * `dateKey()`: Returns local `YYYY-MM-DD`.
  * `monthKey()`: Returns local `YYYY-MM`.
  * `parseKey(str)`: Safely parses `YYYY-MM-DD` using local calendar parts.
  * `fmtDateTime(ts, dateStr, lang)`: Formats timestamps relative to today/yesterday.

---

## 5. Coding Conventions for Agents

### 5.1 Bilingual Localization (I18N)
Every newly added string visible to the user **must** be localized in both English (`en`) and Simplified Chinese (`zh`) in `src/constants.ts`:
```typescript
// Good
<span>{t('my_new_action', lang)}</span>

// Or inline conditional if localized helper isn't required:
{lang === 'zh' ? '操作成功' : 'Action Succeeded'}
```

### 5.2 Visual Design System
Follow the existing notebook aesthetics defined in `src/index.css`:
* Primary CSS variables:
  * `--ink`: Dark charcoal text & borders (`#1e293b`)
  * `--paper`: Clean card surface (`#ffffff`)
  * `--bg`: Warm parchment background (`#f8fafc`)
  * `--coral`, `--yellow`, `--blue`, `--green`: Playful category accents
  * `--b-fat`: Thick borders (`2.5px solid var(--ink)`)
  * `--s-card`: Neo-brutalist hard shadow (`3px 3px 0 var(--ink)`)
* Buttons should use standard classes: `btn green`, `btn sm soft`, `btn line`, `icon-btn danger`.

### 5.3 Web Audio Chimes
Do not import external MP3 or audio files. Use the native Web Audio synthesizer helpers in `src/utils.ts`:
* `playDoneChime()`: Played when a task sub-step is completed.
* `playFanfare()`: Played when all daily tasks are accomplished.
* `playNote(freq, dur)`: Custom tone generator.

---

## 6. Common Modification Recipes

### 6.1 Adding a New Field to the Database Schema
1. Update interface in `src/types.ts` (`QuestPadDB` or relevant child interface).
2. Update `blankDB()` and `seedDemo()` in `src/services/workbench.ts` to supply default values.
3. Update `firebase-blueprint.json` to keep schema definition aligned.
4. If the field is modified in UI, update `updateDB((draft) => { draft.newField = ... })`.

### 6.2 Adding a Modal Action
1. Open `src/App.tsx` and locate `modal` state:
   ```typescript
   const [modal, setModal] = useState<ModalState | null>(null);
   ```
2. For confirmation dialogs, use `type: 'confirm'` with a unique `action` identifier.
3. Handle the action inside the modal confirm callback in `src/App.tsx`:
   ```typescript
   if (m.action === 'myAction') {
     updateDB((draft) => { /* logic */ });
   }
   ```

### 6.3 Verifying Code Changes
Always execute:
1. `npm run lint` (or call `lint_applet` tool) to verify TypeScript types and syntax.
2. `compile_applet` to ensure full Vite bundle compilation without errors.
