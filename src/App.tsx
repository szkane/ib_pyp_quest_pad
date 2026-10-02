/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  onAuthStateChanged,
  signOut,
  User,
} from './firebase';
import { QuestPadDB, TaskDef } from './types';
import { LS_LANG_KEY, ENCOURAGING_PHRASES } from './constants';
import {
  t,
  dateKey,
  monthKey,
  fmtDate,
  fmtHeaderDate,
  fmtMonth,
  playSoundStepDone,
  playSoundQuestAccomplished,
} from './utils';
import {
  blankDB,
  seedDemo,
  isTaskComplete,
  stepPoints,
  syncPointsIn,
  saveWorkbenchToFirestore,
  subscribeToWorkbench,
} from './services/workbench';
import { Icon } from './components/Icons';
import { AuthScreen } from './components/AuthScreen';
import { Modals } from './components/Modals';
import { Celebration } from './components/Celebration';
import { FocusTimer } from './components/FocusTimer';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lang, setLang] = useState<string>(() => localStorage.getItem(LS_LANG_KEY) || 'en');

  // Application navigation
  const [activeNav, setActiveNav] = useState<'tasks' | 'goals' | 'rewards' | 'parent'>('tasks');
  const [parentTab, setParentTab] = useState<'tasks' | 'goals' | 'points' | 'rewards' | 'settings'>('tasks');
  const [parentTaskCat, setParentTaskCat] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('cat_study');
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [redeemTier, setRedeemTier] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Database state
  const [db, setDb] = useState<QuestPadDB>(() => seedDemo('IB Learner'));
  const [modal, setModal] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; kind?: 'good' | 'bad' } | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ task: any; phrase: string; emoji: string; pts: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to user workbench data from Cloud Firestore
  useEffect(() => {
    if (!currentUser) return;

    const unsub = subscribeToWorkbench(
      currentUser.uid,
      (data) => {
        setDb(data);
      },
      (err) => {
        console.error('Workbench subscription error:', err);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const showToast = (text: string, kind?: 'good' | 'bad') => {
    setToastMsg({ text, kind });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 2500);
  };

  const switchLang = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem(LS_LANG_KEY, newLang);
    document.documentElement.lang = newLang === 'zh' ? 'zh-CN' : 'en';
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setParentUnlocked(false);
      showToast(lang === 'zh' ? '已退出登录' : 'Signed out successfully');
    } catch (err: any) {
      showToast(err.message || 'Sign out failed', 'bad');
    }
  };

  // Helper mutations with automatic Firestore save
  const updateDB = async (updater: (draft: QuestPadDB) => void) => {
    if (!currentUser) return;
    const cloned: QuestPadDB = JSON.parse(JSON.stringify(db));
    updater(cloned);
    setDb(cloned);
    try {
      await saveWorkbenchToFirestore(currentUser.uid, cloned);
    } catch (err: any) {
      console.error('Failed to save to Firestore:', err);
      showToast(err.message || 'Sync error', 'bad');
    }
  };

  // Queries
  const today = dateKey();
  const currentMonth = monthKey(today);

  const catById = (id: string) => db.categories.find((c) => c.id === id) || db.categories[0];
  const catColor = (id: string) => catById(id).color;
  const catName = (id: string) => {
    const c = catById(id);
    return lang === 'zh' && c.nameZh ? c.nameZh : c.name;
  };
  const catPointEmoji = (id: string) => catById(id).emoji || '🌟';

  const catBalance = (catId: string) => {
    return db.ledger.reduce((acc, entry) => (entry.catId === catId ? acc + entry.delta : acc), 0);
  };

  const catEarnOn = (catId: string, dt: string) => {
    return db.ledger.reduce((acc, entry) => (entry.catId === catId && entry.date === dt && entry.delta > 0 ? acc + entry.delta : acc), 0);
  };

  const tasksOfCategory = (catId: string, dt: string) => {
    const mk = monthKey(dt);
    const dow = new Date(dt.replace(/-/g, '/')).getDay();
    return db.tasks.filter((t) => {
      if (t.active === false) return false;
      if (t.categoryId !== catId) return false;
      const ms = t.months && t.months.length ? t.months : (t.month ? [t.month] : []);
      if (ms.length && !ms.includes(mk)) return false;
      const wd = t.weekdays && t.weekdays.length ? t.weekdays : [0, 1, 2, 3, 4, 5, 6];
      return wd.includes(dow);
    });
  };

  const doneStepCount = (dt: string, task: TaskDef) => {
    const r = (db.checkins[dt] || {})[task.id];
    if (!r?.steps) return 0;
    return task.steps.filter((s) => r.steps[s.id]).length;
  };

  // Actions
  const handleStartTimer = (dt: string, taskId: string, stepId: string) => {
    updateDB((draft) => {
      draft.timer = { date: dt, taskId, stepId, startTs: Date.now() };
    });
    showToast(lang === 'zh' ? '专注计时开始！' : 'Timer started. Focus and do your best!', 'good');
  };

  const handleCancelTimer = () => {
    updateDB((draft) => {
      draft.timer = null;
    });
    showToast(lang === 'zh' ? '已取消计时' : 'Timer cancelled.');
  };

  const handleFinishStep = (dt: string, taskId: string, stepId: string) => {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return;

    updateDB((draft) => {
      if (!draft.checkins[dt]) draft.checkins[dt] = {};
      if (!draft.checkins[dt][taskId]) draft.checkins[dt][taskId] = { steps: {}, used: {} };
      const rec = draft.checkins[dt][taskId];
      rec.steps[stepId] = true;

      if (draft.timer && draft.timer.taskId === taskId && draft.timer.stepId === stepId) {
        rec.used[stepId] = Math.max(1, Math.round((Date.now() - draft.timer.startTs) / 1000));
        draft.timer = null;
      }
      syncPointsIn(draft, dt, task);
    });

    const isComplete = (doneStepCount(dt, task) + 1) >= task.steps.length;
    if (isComplete) {
      playSoundQuestAccomplished();
      const phrases = lang === 'zh' ? ENCOURAGING_PHRASES.zh : ENCOURAGING_PHRASES.en;
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      setCelebrationData({
        task,
        phrase,
        emoji: catPointEmoji(task.categoryId),
        pts: Number(task.points) || 10,
      });
    } else {
      playSoundStepDone();
      showToast(lang === 'zh' ? '完成一步，继续加油！' : 'Step complete! Keep going!', 'good');
    }
  };

  const handleUndoStep = (dt: string, taskId: string, stepId: string) => {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return;

    updateDB((draft) => {
      const rec = (draft.checkins[dt] || {})[taskId];
      if (rec?.steps[stepId]) {
        delete rec.steps[stepId];
        if (rec.used) delete rec.used[stepId];
      }
      syncPointsIn(draft, dt, task);
    });
    showToast(lang === 'zh' ? '已撤销这一步' : 'Step undone.');
  };

  const handleApplyRedeem = (id: string) => {
    let item: any = null;
    ['daily', 'weekly', 'monthly'].forEach((tier) => {
      const found = (db.redeems as any)[tier]?.find((r: any) => r.id === id);
      if (found) item = found;
    });
    if (!item) return;

    const bal = catBalance(item.catId);
    if (bal < item.cost) {
      showToast(t('not_enough_stars', lang), 'bad');
      return;
    }

    updateDB((draft) => {
      draft.redemptions.push({
        id: 'rp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ts: Date.now(),
        tier: item.tier,
        itemId: item.id,
        name: item.name,
        cost: item.cost,
        catId: item.catId,
        status: 'pending',
        appliedDate: today,
      });
    });
    showToast(lang === 'zh' ? '心愿申请已提交！' : 'Reward requested!', 'good');
  };

  const handleApproveRedeem = (id: string) => {
    updateDB((draft) => {
      const r = draft.redemptions.find((item) => item.id === id);
      if (!r || r.status !== 'pending') return;
      r.status = 'approved';
      r.decidedAt = Date.now();
      draft.ledger.push({
        id: 'spend|' + r.id,
        ts: Date.now(),
        date: today,
        catId: r.catId,
        delta: -r.cost,
        reason: 'Reward: ' + r.name,
        kind: 'spend',
        redemptionId: r.id,
      });
    });
    showToast(lang === 'zh' ? '已批准并扣分' : 'Approved & points deducted', 'good');
  };

  const handleRejectRedeem = (id: string) => {
    updateDB((draft) => {
      const r = draft.redemptions.find((item) => item.id === id);
      if (!r || r.status !== 'pending') return;
      r.status = 'rejected';
      r.decidedAt = Date.now();
    });
    showToast(lang === 'zh' ? '已驳回' : 'Declined');
  };

  // Export & Import JSON
  const handleExportJSON = () => {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ib-pyp-quest-pad-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    showToast('Backup exported', 'good');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj || !obj.categories || !obj.tasks) throw new Error('Invalid format');
        setModal({
          type: 'confirm',
          title: t('import_json', lang),
          text: lang === 'zh' ? '确定导入此备份文件并覆盖当前数据吗？' : 'Replace current data with imported backup?',
          confirmLabel: t('import_json', lang),
          action: 'import',
          payload: obj,
        });
      } catch (err) {
        showToast('Invalid JSON file format', 'bad');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div style={{ fontSize: 40, animation: 'celebBounce 1s infinite alternate' }}>🌟</div>
        <p style={{ marginTop: 12, fontWeight: 800, color: 'var(--muted)' }}>Loading IB PYP Quest Pad...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen lang={lang} onSwitchLang={switchLang} onToast={showToast} />;
  }

  const pendingApprovalsCount = db.redemptions.filter((r) => r.status === 'pending').length;

  return (
    <div id="app">
      {/* Hidden file input for backup restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* 1. Top Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-title">
            <span className="brand-name">
              IB PYP Quest Pad
            </span>
            <span className="badge-date">
              <Icon name="calendar" size={14} color="var(--ink)" />
              <span>{fmtHeaderDate(today, lang)}</span>
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {activeNav === 'parent' && parentUnlocked && (
            <button
              className="lock-btn"
              onClick={() => {
                setParentUnlocked(false);
                setActiveNav('tasks');
                showToast(t('locked_back', lang));
              }}
            >
              <Icon name="shield" size={14} color="#fff" />
              <span>{t('lock', lang)}</span>
            </button>
          )}

          <div className="user-badge" title={currentUser.email || ''}>
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="User avatar" />
            ) : (
              <span style={{ fontSize: 13 }}>👤</span>
            )}
            <span>{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
          </div>

          <button
            className="signout-btn"
            onClick={handleSignOut}
            title={t('sign_out', lang)}
          >
            <span>{t('sign_out', lang)}</span>
          </button>

          <div className="lang-switcher">
            <button
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => switchLang('en')}
            >
              EN
            </button>
            <button
              className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
              onClick={() => switchLang('zh')}
            >
              中文
            </button>
          </div>
        </div>
      </header>

      {/* 2. Category Bar (Shown in Tasks Mode) */}
      {activeNav === 'tasks' && (
        <nav className="category-bar">
          {db.categories.map((c) => {
            const isCur = activeCategory === c.id;
            const tasks = tasksOfCategory(c.id, today);
            const done = tasks.filter((t) => isTaskComplete(today, t, db)).length;
            return (
              <button
                key={c.id}
                className={`cat-tab ${isCur ? 'active' : ''}`}
                style={{ '--c': c.color } as React.CSSProperties}
                onClick={() => setActiveCategory(c.id)}
              >
                <Icon name={c.icon || 'book'} size={16} color={isCur ? '#fff' : 'var(--ink)'} />
                <span>{catName(c.id)}</span>
                <span className="cnt-badge">
                  {done}/{tasks.length}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* 3. Main Viewports */}
      {activeNav === 'tasks' && (
        <div className="app-viewport">
          {(() => {
            const tasks = tasksOfCategory(activeCategory, today);
            if (!tasks.length) {
              return (
                <div className="card-empty-state">
                  <div style={{ marginBottom: 10 }}>
                    <Icon name={catById(activeCategory).icon || 'book'} size={44} color="var(--muted)" />
                  </div>
                  <b style={{ fontSize: 18 }}>{t('no_tasks_in_cat', lang)}</b>
                </div>
              );
            }
            const isSingle = tasks.length === 1;
            return (
              <div className={`cards-carousel ${isSingle ? 'single-card' : ''}`}>
                {tasks.map((task) => {
                  const color = catColor(task.categoryId);
                  const total = task.steps.length;
                  const done = doneStepCount(today, task);
                  const complete = isTaskComplete(today, task, db);
                  const rec = (db.checkins[today] || {})[task.id] || { steps: {}, used: {} };
                  const pts = stepPoints(task);

                  let curIdx = -1;
                  for (let i = 0; i < task.steps.length; i++) {
                    if (!rec.steps?.[task.steps[i].id]) {
                      curIdx = i;
                      break;
                    }
                  }

                  return (
                    <article
                      key={task.id}
                      className={`task-hero-card ${complete ? 'done' : ''}`}
                      style={{ '--c': color } as React.CSSProperties}
                    >
                      <div className="th-header">
                        <div>
                          <div className="th-title">{task.title}</div>
                          <div className="hint" style={{ marginTop: 2 }}>
                            {t('completed_steps_info', lang, { done, total })}
                          </div>
                        </div>
                        <div className="th-badges">
                          <span className="tag" style={{ background: color, color: '#fff' }}>
                            {catName(task.categoryId)}
                          </span>
                          <span className="tag pts-badge">
                            +{task.points} {catPointEmoji(task.categoryId)}
                          </span>
                          {complete && (
                            <span
                              className="tag"
                              style={{
                                background: 'var(--green-soft)',
                                color: 'var(--green-dark)',
                                borderColor: 'var(--green)',
                              }}
                            >
                              {t('completed_badge', lang)}
                            </span>
                          )}
                        </div>
                      </div>

                      {complete ? (
                        <div className="card-completed-banner">
                          <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 2 }}>
                            {catPointEmoji(task.categoryId)}
                          </div>
                          <b>{t('all_done_title', lang)}</b>
                          <p style={{ margin: '4px 0 10px', fontSize: 14, color: 'var(--green-dark)', fontWeight: 800 }}>
                            {lang === 'zh'
                              ? '太棒啦！任务圆满达成，自主探究闪闪发光！✨'
                              : 'Awesome work! Great inquiry and agency! Keep shining! 🌟'}
                          </p>
                          <button
                            className="btn sm line"
                            onClick={() => handleUndoStep(today, task.id, task.steps[total - 1].id)}
                          >
                            {t('btn_undo_last', lang)}
                          </button>
                        </div>
                      ) : (
                        <div className="th-steps-list">
                          {task.steps.map((s, idx) => {
                            const ok = !!rec.steps?.[s.id];
                            const isCur = !ok && idx === curIdx;
                            return (
                              <div
                                key={s.id}
                                className={`step-item ${ok ? 'done' : isCur ? 'cur' : ''}`}
                              >
                                <div className="step-idx">
                                  {ok ? <Icon name="check" size={14} color="#fff" /> : idx + 1}
                                </div>
                                <div className="step-info">
                                  <div className="step-name">{s.title}</div>
                                  <div className="step-meta">
                                    {t('time_target', lang, { min: s.minutes || 5 })} · +
                                    {pts[idx] || 0} {catPointEmoji(task.categoryId)}
                                  </div>
                                </div>
                                <div className="step-act">
                                  {ok ? (
                                    <button
                                      className="btn sm line"
                                      onClick={() => handleUndoStep(today, task.id, s.id)}
                                    >
                                      {t('btn_undo_step', lang)}
                                    </button>
                                  ) : isCur ? (
                                    <>
                                      <button
                                        className="btn sm soft"
                                        onClick={() => handleStartTimer(today, task.id, s.id)}
                                      >
                                        <Icon name="play" size={12} color="var(--ink)" />
                                        <span>{t('btn_start', lang)}</span>
                                      </button>
                                      <button
                                        className="btn sm green"
                                        onClick={() => handleFinishStep(today, task.id, s.id)}
                                      >
                                        {t('btn_done', lang)}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="hint" style={{ opacity: 0.5 }}>
                                      {idx + 1}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="th-footer">
                        <span className="hint">
                          {lang === 'zh' ? '今日已获得: ' : 'Earned today: '}+
                          {catEarnOn(task.categoryId, today)} {catPointEmoji(task.categoryId)}
                        </span>
                        <span className="hint" style={{ color: 'var(--ink)', fontWeight: 900 }}>
                          {catName(task.categoryId)}: {catBalance(task.categoryId)}{' '}
                          {catPointEmoji(task.categoryId)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Goals Viewport */}
      {activeNav === 'goals' && (
        <div className="app-viewport">
          <div className="scrollable-view">
            <section className="card">
              <div className="card-h">
                <h2>
                  <Icon name="target" size={22} color="var(--green)" />
                  <span>{t('goals_title', lang)}</span>
                </h2>
                <span className="pill green">{fmtMonth(currentMonth, lang)}</span>
              </div>

              {!db.goals.length ? (
                <div className="empty">{t('no_goals_set', lang)}</div>
              ) : (
                db.goals.map((g) => {
                  const tasks = db.tasks.filter((t) => t.goalId === g.id);
                  let doneCount = 0;
                  let stepCount = 0;
                  Object.keys(db.checkins).forEach((dt) => {
                    tasks.forEach((t) => {
                      const r = db.checkins[dt]?.[t.id];
                      if (!r?.steps) return;
                      const sd = t.steps.filter((s) => r.steps[s.id]).length;
                      stepCount += sd;
                      if (t.steps.length && sd >= t.steps.length) doneCount++;
                    });
                  });
                  const target = Math.max(0, Number(g.targetCount) || 0);
                  const pct = target ? Math.min(100, Math.round((doneCount / target) * 100)) : 0;

                  return (
                    <div key={g.id} style={{ marginBottom: 14 }}>
                      <div className="row-title" style={{ fontSize: 16.5 }}>
                        {g.title}
                      </div>
                      {g.desc && <div className="row-sub">{g.desc}</div>}
                      <div className="bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <div className="row-sub">
                        {t('goals_progress', lang, { done: doneCount, target, steps: stepCount })}
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="card">
              <div className="card-h">
                <h2>
                  <Icon name="coin" size={22} color="var(--yellow)" />
                  <span>{t('pts_balance_title', lang)}</span>
                </h2>
              </div>
              <div className="stat-grid">
                {db.categories.map((c) => {
                  const bal = catBalance(c.id);
                  return (
                    <div key={c.id} className="stat" style={{ borderLeft: `5px solid ${c.color}` }}>
                      <b>
                        {bal}{' '}
                        <span style={{ fontSize: 18, verticalAlign: 'middle', marginLeft: 2 }}>
                          {c.emoji}
                        </span>
                      </b>
                      <span>{catName(c.id)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Rewards Viewport */}
      {activeNav === 'rewards' && (
        <div className="app-viewport">
          <div className="scrollable-view">
            <section className="card">
              <div className="card-h">
                <h2>
                  <Icon name="gift" size={22} color="var(--coral)" />
                  <span>{t('celebration_vault', lang)}</span>
                </h2>
                <span className="hint">{t('choose_wish_hint', lang)}</span>
              </div>

              <div className="seg">
                {(['daily', 'weekly', 'monthly'] as const).map((tier) => (
                  <button
                    key={tier}
                    className={redeemTier === tier ? 'active on' : ''}
                    onClick={() => setRedeemTier(tier)}
                  >
                    {t(`${tier}_tier`, lang)}
                  </button>
                ))}
              </div>

              {!(db.redeems[redeemTier] || []).length ? (
                <div className="empty">{t('no_rewards_tier', lang)}</div>
              ) : (
                <div className="redeem-grid">
                  {(db.redeems[redeemTier] || []).map((it) => {
                    const col = catColor(it.catId);
                    const bal = catBalance(it.catId);
                    const can = bal >= it.cost;
                    const diff = it.cost - bal;
                    const cEmoji = catPointEmoji(it.catId);

                    return (
                      <div key={it.id} className="ri" style={{ borderTop: `5px solid ${col}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            className="tag"
                            style={{ background: `${col}22`, color: col, fontWeight: 900 }}
                          >
                            {catName(it.catId)}
                          </span>
                          <span className="tag pts-badge">
                            {it.cost} {cEmoji}
                          </span>
                        </div>
                        <div className="ri-name">{it.name}</div>
                        <div
                          className="ri-cost"
                          style={{ color: can ? 'var(--green-dark)' : 'var(--coral)' }}
                        >
                          {lang === 'zh'
                            ? `消耗 ${it.cost} · 结余 ${bal}${!can ? ` (还差 ${diff})` : ''}`
                            : `Cost: ${it.cost} · Balance: ${bal}${!can ? ` (Need ${diff})` : ''}`}
                        </div>
                        {it.desc && <div className="hint">{it.desc}</div>}
                        <div className="ri-foot">
                          {can ? (
                            <button
                              className="btn block yellow sm"
                              onClick={() => handleApplyRedeem(it.id)}
                            >
                              {t('request_reward', lang)}
                            </button>
                          ) : (
                            <button className="btn block line sm" disabled>
                              {t('not_enough_stars', lang)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-h">
                <h2>{t('my_requests', lang)}</h2>
              </div>
              {!db.redemptions.length ? (
                <div className="empty">{t('no_requests', lang)}</div>
              ) : (
                <div className="rows">
                  {db.redemptions.slice().reverse().slice(0, 10).map((r) => (
                    <div key={r.id} className="row">
                      <div className="row-main">
                        <div className="row-title">{r.name}</div>
                        <div className="row-sub">
                          {fmtDate(r.appliedDate, lang)} · {catName(r.catId)} {r.cost}{' '}
                          {catPointEmoji(r.catId)}
                        </div>
                      </div>
                      <div className="row-acts">
                        <span
                          className="tag"
                          style={{
                            background:
                              r.status === 'approved'
                                ? 'var(--mint)'
                                : r.status === 'rejected'
                                ? 'var(--coral-soft)'
                                : 'var(--yellow-soft)',
                          }}
                        >
                          {t(`status_${r.status}`, lang)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Parent Hub Viewport */}
      {activeNav === 'parent' && (
        <div className="app-viewport">
          <div className="scrollable-view">
            <nav className="parent-subnav">
              <button
                className={`subnav-btn ${parentTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setParentTab('tasks')}
              >
                <Icon name="book" size={18} />
                <span>{t('parent_tab_tasks', lang)}</span>
              </button>
              <button
                className={`subnav-btn ${parentTab === 'goals' ? 'active' : ''}`}
                onClick={() => setParentTab('goals')}
              >
                <Icon name="target" size={18} />
                <span>{t('parent_tab_goals', lang)}</span>
              </button>
              <button
                className={`subnav-btn ${parentTab === 'points' ? 'active' : ''}`}
                onClick={() => setParentTab('points')}
              >
                <Icon name="star" size={18} />
                <span>{t('parent_tab_points', lang)}</span>
              </button>
              <button
                className={`subnav-btn ${parentTab === 'rewards' ? 'active' : ''}`}
                onClick={() => setParentTab('rewards')}
              >
                <Icon name="gift" size={18} />
                <span>{t('parent_tab_rewards', lang)}</span>
                {pendingApprovalsCount > 0 && <span className="badge">{pendingApprovalsCount}</span>}
              </button>
              <button
                className={`subnav-btn ${parentTab === 'settings' ? 'active' : ''}`}
                onClick={() => setParentTab('settings')}
              >
                <Icon name="settings" size={18} />
                <span>{t('parent_tab_settings', lang)}</span>
              </button>
            </nav>

            {/* Parent Tab: Tasks */}
            {parentTab === 'tasks' && (
              <section className="card">
                <div className="card-h">
                  <h2>
                    <Icon name="book" size={22} color="var(--green)" />
                    <span>
                      {t('parent_tab_tasks', lang)} ({db.tasks.length})
                    </span>
                  </h2>
                  <button
                    className="btn sm green"
                    onClick={() => {
                      setModal({
                        type: 'task',
                        draft: {
                          id: '',
                          title: '',
                          categoryId: parentTaskCat === 'all' ? 'cat_study' : parentTaskCat,
                          points: 10,
                          weekdays: [0, 1, 2, 3, 4, 5, 6],
                          steps: [
                            { id: 'st_1', title: lang === 'zh' ? '自主学习与摘录' : 'Study & Inquiry', minutes: 10 },
                            { id: 'st_2', title: lang === 'zh' ? '反思总结' : 'Review & Summary', minutes: 5 },
                          ],
                        },
                      });
                    }}
                  >
                    <Icon name="plus" size={16} color="#fff" />
                    <span>{t('add_new_task', lang)}</span>
                  </button>
                </div>

                <div className="parent-task-tabs">
                  <button
                    className={`parent-cat-tab ${parentTaskCat === 'all' ? 'active' : ''}`}
                    onClick={() => setParentTaskCat('all')}
                  >
                    <Icon name="grid" size={15} color={parentTaskCat === 'all' ? '#fff' : 'var(--ink)'} />
                    <span>{lang === 'zh' ? '全部' : 'All'}</span>
                    <span className="cnt-badge">{db.tasks.length}</span>
                  </button>
                  {db.categories.map((c) => {
                    const isCur = parentTaskCat === c.id;
                    const cCount = db.tasks.filter((t) => t.categoryId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        className={`parent-cat-tab ${isCur ? 'active' : ''}`}
                        style={{ '--tab-c': c.color } as React.CSSProperties}
                        onClick={() => setParentTaskCat(c.id)}
                      >
                        <Icon name={c.icon || 'book'} size={15} color={isCur ? '#fff' : c.color} />
                        <span>{catName(c.id)}</span>
                        <span className="cnt-badge">{cCount}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rows">
                  {db.tasks
                    .filter((t) => parentTaskCat === 'all' || t.categoryId === parentTaskCat)
                    .map((tItem) => {
                      const col = catColor(tItem.categoryId);
                      const totalMin = tItem.steps.reduce((acc, s) => acc + (Number(s.minutes) || 0), 0);
                      const pts = stepPoints(tItem);

                      return (
                        <div key={tItem.id} className="row" style={{ alignItems: 'flex-start' }}>
                          <div className="row-main">
                            <div className="row-title">
                              <span>{tItem.title}</span>
                              <span className="tag" style={{ background: `${col}22`, color: col }}>
                                {catName(tItem.categoryId)}
                              </span>
                              <span className="tag pts-badge">
                                +{tItem.points} {catPointEmoji(tItem.categoryId)}
                              </span>
                            </div>
                            <div className="row-sub">
                              {tItem.steps.length} {lang === 'zh' ? '步骤' : 'steps'} · {totalMin}{' '}
                              {t('step_minutes_hint', lang)}
                            </div>
                            <div className="step-pills-wrap">
                              {tItem.steps.map((s, idx) => (
                                <span key={s.id} className="step-pill-preview">
                                  <span className="s-num">{idx + 1}</span> {s.title}{' '}
                                  <span className="hint">
                                    ({s.minutes}' / +{pts[idx] || 0} {catPointEmoji(tItem.categoryId)})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="row-acts" style={{ alignSelf: 'center' }}>
                            <button
                              className="btn sm soft"
                              onClick={() => {
                                setModal({
                                  type: 'task',
                                  draft: JSON.parse(JSON.stringify(tItem)),
                                });
                              }}
                            >
                              <Icon name="edit" size={16} />
                              <span>{lang === 'zh' ? '编辑' : 'Edit'}</span>
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={() => {
                                setModal({
                                  type: 'confirm',
                                  title: t('del_task_confirm', lang),
                                  text: t('del_task_confirm', lang),
                                  danger: true,
                                  action: 'taskDel',
                                  targetId: tItem.id,
                                });
                              }}
                            >
                              <Icon name="trash" size={16} color="var(--coral)" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Parent Tab: Goals */}
            {parentTab === 'goals' && (
              <section className="card">
                <div className="card-h">
                  <h2>
                    <Icon name="target" size={22} color="var(--green)" />
                    <span>
                      {t('parent_tab_goals', lang)} ({db.goals.length})
                    </span>
                  </h2>
                  <button
                    className="btn sm green"
                    onClick={() => {
                      setModal({
                        type: 'goal',
                        draft: { id: '', title: '', desc: '', targetCount: 30 },
                      });
                    }}
                  >
                    <Icon name="plus" size={16} color="#fff" />
                    <span>{t('add_new_goal', lang)}</span>
                  </button>
                </div>
                <div className="rows">
                  {db.goals.map((g) => (
                    <div key={g.id} className="row">
                      <div className="row-main">
                        <div className="row-title">{g.title}</div>
                        {g.desc && <div className="row-sub">{g.desc}</div>}
                        <div className="row-sub">
                          {lang === 'zh' ? '目标达成: ' : 'Target: '}
                          {g.targetCount} {lang === 'zh' ? '次' : 'times'}
                        </div>
                      </div>
                      <div className="row-acts">
                        <button
                          className="btn sm soft"
                          onClick={() => {
                            setModal({
                              type: 'goal',
                              draft: JSON.parse(JSON.stringify(g)),
                            });
                          }}
                        >
                          <Icon name="edit" size={16} />
                          <span>{lang === 'zh' ? '编辑' : 'Edit'}</span>
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => {
                            setModal({
                              type: 'confirm',
                              title: t('del_goal_confirm', lang),
                              text: t('del_goal_confirm', lang),
                              danger: true,
                              action: 'goalDel',
                              targetId: g.id,
                            });
                          }}
                        >
                          <Icon name="trash" size={16} color="var(--coral)" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Parent Tab: Points */}
            {parentTab === 'points' && (
              <>
                <section className="card">
                  <div className="card-h">
                    <h2>
                      <Icon name="star" size={22} color="var(--yellow)" />
                      <span>{t('scoring_mode', lang)}</span>
                    </h2>
                  </div>
                  <div className="seg">
                    <button
                      className={db.settings.stepMode === 'perStep' ? 'active on' : ''}
                      onClick={() => {
                        updateDB((draft) => {
                          draft.settings.stepMode = 'perStep';
                          draft.tasks.forEach((t) => {
                            Object.keys(draft.checkins).forEach((dt) => syncPointsIn(draft, dt, t));
                          });
                        });
                        showToast(lang === 'zh' ? '计分规则已更新' : 'Scoring updated', 'good');
                      }}
                    >
                      {t('mode_per_step', lang)}
                    </button>
                    <button
                      className={db.settings.stepMode === 'onComplete' ? 'active on' : ''}
                      onClick={() => {
                        updateDB((draft) => {
                          draft.settings.stepMode = 'onComplete';
                          draft.tasks.forEach((t) => {
                            Object.keys(draft.checkins).forEach((dt) => syncPointsIn(draft, dt, t));
                          });
                        });
                        showToast(lang === 'zh' ? '计分规则已更新' : 'Scoring updated', 'good');
                      }}
                    >
                      {t('mode_on_complete', lang)}
                    </button>
                  </div>
                  <div className="hint" style={{ marginTop: 8 }}>
                    {t('mode_hint', lang)}
                  </div>
                </section>

                <section className="card">
                  <div className="card-h">
                    <h2>{t('category_default_points', lang)}</h2>
                    <button
                      className="btn sm yellow"
                      onClick={() => setModal({ type: 'adjustPoints' })}
                    >
                      {t('adjust_points', lang)}
                    </button>
                  </div>
                  <div className="rows">
                    {db.categories.map((c) => {
                      const bal = catBalance(c.id);
                      return (
                        <div key={c.id} className="row">
                          <div className="row-main">
                            <div className="row-title">
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: c.color,
                                  border: '1px solid var(--ink)',
                                  marginRight: 6,
                                }}
                              />
                              {catName(c.id)}
                            </div>
                            <div className="row-sub">
                              {lang === 'zh' ? '默认每任务: ' : 'Default: '}
                              {c.points} {c.emoji}
                            </div>
                          </div>
                          <div className="row-acts">
                            <span className="tag pts-badge">
                              {bal} {c.emoji}
                            </span>
                            <button
                              className="btn sm soft"
                              onClick={() => setModal({ type: 'cat', draft: { id: c.id } })}
                            >
                              <Icon name="edit" size={16} />
                              <span>{lang === 'zh' ? '修改' : 'Edit'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {/* Parent Tab: Rewards */}
            {parentTab === 'rewards' && (
              <>
                <section className="card">
                  <div className="card-h">
                    <h2>
                      <Icon name="shield" size={22} color="var(--green)" />
                      <span>{t('pending_approvals', lang)}</span>
                    </h2>
                    <span className={`pill ${pendingApprovalsCount ? 'coral' : 'green'}`}>
                      {pendingApprovalsCount}
                    </span>
                  </div>
                  {!pendingApprovalsCount ? (
                    <div className="empty" style={{ color: 'var(--green)', fontWeight: 800 }}>
                      {t('no_pending', lang)}
                    </div>
                  ) : (
                    <div className="rows">
                      {db.redemptions
                        .filter((r) => r.status === 'pending')
                        .map((r) => {
                          const bal = catBalance(r.catId);
                          return (
                            <div key={r.id} className="row">
                              <div className="row-main">
                                <div className="row-title">{r.name}</div>
                                <div className="row-sub">
                                  {fmtDate(r.appliedDate, lang)} · {catName(r.catId)} {r.cost}{' '}
                                  {catPointEmoji(r.catId)} · Balance: {bal}
                                </div>
                              </div>
                              <div className="row-acts">
                                <button
                                  className="btn sm green"
                                  onClick={() => handleApproveRedeem(r.id)}
                                >
                                  {t('approve', lang)}
                                </button>
                                <button
                                  className="btn sm line"
                                  onClick={() => handleRejectRedeem(r.id)}
                                >
                                  {t('reject', lang)}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>

                <section className="card">
                  <div className="card-h">
                    <h2>
                      <Icon name="gift" size={22} color="var(--coral)" />
                      <span>{t('celebration_vault', lang)}</span>
                    </h2>
                    <button
                      className="btn sm green"
                      onClick={() => {
                        setModal({
                          type: 'redeem',
                          draft: {
                            id: '',
                            tier: redeemTier,
                            name: '',
                            cost: 25,
                            catId: 'cat_study',
                            limit: 1,
                            desc: '',
                          },
                        });
                      }}
                    >
                      <Icon name="plus" size={16} color="#fff" />
                      <span>{t('add_new_reward', lang)}</span>
                    </button>
                  </div>
                  <div className="rows">
                    {(db.redeems[redeemTier] || []).map((it) => (
                      <div key={it.id} className="row">
                        <div className="row-main">
                          <div className="row-title">
                            <span>{it.name}</span>
                            <span className="tag pts-badge">
                              {it.cost} {catPointEmoji(it.catId)}
                            </span>
                          </div>
                          <div className="row-sub">{catName(it.catId)}</div>
                        </div>
                        <div className="row-acts">
                          <button
                            className="btn sm soft"
                            onClick={() => {
                              setModal({
                                type: 'redeem',
                                draft: JSON.parse(JSON.stringify(it)),
                              });
                            }}
                          >
                            <Icon name="edit" size={16} />
                            <span>{lang === 'zh' ? '编辑' : 'Edit'}</span>
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => {
                              setModal({
                                type: 'confirm',
                                title: t('del_reward_confirm', lang),
                                text: t('del_reward_confirm', lang),
                                danger: true,
                                action: 'rdDel',
                                targetId: it.id,
                                targetTier: redeemTier,
                              });
                            }}
                          >
                            <Icon name="trash" size={16} color="var(--coral)" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Parent Tab: Settings & Backup */}
            {parentTab === 'settings' && (
              <>
                <section className="card">
                  <div className="card-h">
                    <h2>
                      <Icon name="settings" size={22} color="var(--green)" />
                      <span>{lang === 'zh' ? '基础信息与密码' : 'Child Info & PIN'}</span>
                    </h2>
                  </div>
                  <div className="grid2" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>{t('child_name', lang)}</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          id="childNameInput"
                          defaultValue={db.settings.childName}
                        />
                        <button
                          className="btn sm green"
                          onClick={() => {
                            const val = (document.getElementById('childNameInput') as HTMLInputElement)?.value?.trim();
                            if (val) {
                              updateDB((draft) => {
                                draft.settings.childName = val;
                              });
                              showToast(t('saved_toast', lang), 'good');
                            }
                          }}
                        >
                          {t('modal_save', lang)}
                        </button>
                      </div>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>{t('change_pin', lang)}</label>
                      <button
                        className="btn sm soft block"
                        onClick={() => setModal({ type: 'pinChange', draft: {} })}
                      >
                        <Icon name="shield" size={16} />
                        <span>{t('change_pin_btn', lang)}</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section className="card">
                  <div className="card-h">
                    <h2>{t('backup_data', lang)}</h2>
                  </div>
                  <div className="btn-row" style={{ marginBottom: 14 }}>
                    <button className="btn sm green" onClick={handleExportJSON}>
                      {t('export_json', lang)}
                    </button>
                    <button
                      className="btn sm soft"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('import_json', lang)}
                    </button>
                    <button
                      className="btn sm yellow"
                      onClick={() => {
                        setModal({
                          type: 'confirm',
                          title: t('reset_demo', lang),
                          danger: false,
                          text:
                            lang === 'zh'
                              ? '确定重置为示例任务吗？现有数据将被覆盖并同步至云端。'
                              : 'Reset all quests to demo version and sync to cloud?',
                          confirmLabel: t('reset_demo', lang),
                          action: 'resetDemo',
                        });
                      }}
                    >
                      {t('reset_demo', lang)}
                    </button>
                    <button
                      className="btn sm coral"
                      onClick={() => {
                        setModal({
                          type: 'confirm',
                          title: t('clear_all', lang),
                          danger: true,
                          text:
                            lang === 'zh'
                              ? '确定清空所有数据吗？此操作不可逆。'
                              : 'Clear all data permanently?',
                          confirmLabel: t('clear_all', lang),
                          action: 'clearAll',
                        });
                      }}
                    >
                      {t('clear_all', lang)}
                    </button>
                  </div>
                  <div className="stat-grid">
                    <div className="stat">
                      <b>{db.tasks.length}</b>
                      <span>{lang === 'zh' ? '任务总数' : 'Total Quests'}</span>
                    </div>
                    <div className="stat">
                      <b>{db.goals.length}</b>
                      <span>{lang === 'zh' ? '目标总数' : 'Total Goals'}</span>
                    </div>
                    <div className="stat">
                      <b>{Object.keys(db.checkins).length}</b>
                      <span>{lang === 'zh' ? '打卡天数' : 'Check-in Days'}</span>
                    </div>
                    <div className="stat">
                      <b>{db.ledger.length}</b>
                      <span>{lang === 'zh' ? '积分流水' : 'Ledger Records'}</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. Bottom Dock Bar */}
      <nav className="bottom-bar">
        <button
          className={`bottom-tab-btn ${activeNav === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveNav('tasks')}
        >
          <Icon name="book" size={22} />
          <span>{t('nav_tasks', lang)}</span>
        </button>
        <button
          className={`bottom-tab-btn ${activeNav === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveNav('goals')}
        >
          <Icon name="target" size={22} />
          <span>{t('nav_goals', lang)}</span>
        </button>
        <button
          className={`bottom-tab-btn ${activeNav === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveNav('rewards')}
        >
          <Icon name="gift" size={22} />
          <span>{t('nav_rewards', lang)}</span>
        </button>
        <button
          className={`bottom-tab-btn ${activeNav === 'parent' ? 'active' : ''}`}
          onClick={() => {
            if (!parentUnlocked) {
              setModal({ type: 'pin', draft: { pin: '' } });
            } else {
              setActiveNav('parent');
            }
          }}
        >
          <Icon name="settings" size={22} />
          <span>{t('nav_parent', lang)}</span>
          {pendingApprovalsCount > 0 && <span className="badge">{pendingApprovalsCount}</span>}
        </button>
      </nav>

      {/* Focus Timer Overlay */}
      {db.timer && (
        <FocusTimer
          timer={db.timer}
          db={db}
          lang={lang}
          onFinish={handleFinishStep}
          onCancel={handleCancelTimer}
        />
      )}

      {/* Celebration Popup */}
      {celebrationData && (
        <Celebration
          task={celebrationData.task}
          phrase={celebrationData.phrase}
          emoji={celebrationData.emoji}
          pts={celebrationData.pts}
          lang={lang}
          onClose={() => setCelebrationData(null)}
        />
      )}

      {/* Modals */}
      <Modals
        modal={modal}
        db={db}
        lang={lang}
        onClose={() => setModal(null)}
        onUnlockPin={() => {
          setParentUnlocked(true);
          setActiveNav('parent');
        }}
        onConfirm={(m) => {
          setModal(null);
          if (m.action === 'taskDel') {
            updateDB((draft) => {
              draft.tasks = draft.tasks.filter((t) => t.id !== m.targetId);
            });
            showToast(t('deleted_toast', lang));
          } else if (m.action === 'goalDel') {
            updateDB((draft) => {
              draft.goals = draft.goals.filter((g) => g.id !== m.targetId);
            });
            showToast(t('deleted_toast', lang));
          } else if (m.action === 'rdDel') {
            updateDB((draft) => {
              if (draft.redeems[m.targetTier as 'daily' | 'weekly' | 'monthly']) {
                draft.redeems[m.targetTier as 'daily' | 'weekly' | 'monthly'] = draft.redeems[
                  m.targetTier as 'daily' | 'weekly' | 'monthly'
                ].filter((r) => r.id !== m.targetId);
              }
            });
            showToast(t('deleted_toast', lang));
          } else if (m.action === 'resetDemo') {
            const currentName = db.settings.childName && db.settings.childName !== 'Hilson' ? db.settings.childName : 'IB Learner';
            const fresh = seedDemo(currentName, currentUser.uid);
            setDb(fresh);
            saveWorkbenchToFirestore(currentUser.uid, fresh);
            showToast('Reset to demo', 'good');
          } else if (m.action === 'clearAll') {
            const currentName = db.settings.childName && db.settings.childName !== 'Hilson' ? db.settings.childName : 'IB Learner';
            const blank = blankDB(currentName, currentUser.uid);
            setDb(blank);
            saveWorkbenchToFirestore(currentUser.uid, blank);
            showToast('All data cleared');
          } else if (m.action === 'import') {
            const imported = { ...m.payload, ownerId: currentUser.uid };
            setDb(imported);
            saveWorkbenchToFirestore(currentUser.uid, imported);
            showToast('Data restored', 'good');
          }
        }}
        onSaveTask={(draft) => {
          if (!draft.title) {
            showToast(lang === 'zh' ? '请输入任务名称' : 'Please enter quest title', 'bad');
            return;
          }
          updateDB((d) => {
            const existingIdx = d.tasks.findIndex((t) => t.id === draft.id);
            if (existingIdx >= 0) {
              d.tasks[existingIdx] = draft;
            } else {
              draft.id = 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              draft.createdAt = Date.now();
              draft.active = true;
              d.tasks.push(draft);
            }
          });
          setModal(null);
          showToast(t('saved_toast', lang), 'good');
        }}
        onSaveGoal={(draft) => {
          if (!draft.title) {
            showToast(lang === 'zh' ? '请输入目标名称' : 'Please enter goal title', 'bad');
            return;
          }
          updateDB((d) => {
            const existingIdx = d.goals.findIndex((g) => g.id === draft.id);
            if (existingIdx >= 0) {
              d.goals[existingIdx] = draft;
            } else {
              draft.id = 'goal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              draft.createdAt = Date.now();
              d.goals.push(draft);
            }
          });
          setModal(null);
          showToast(t('saved_toast', lang), 'good');
        }}
        onSaveReward={(draft) => {
          if (!draft.name) {
            showToast(lang === 'zh' ? '请输入心愿名称' : 'Please enter reward name', 'bad');
            return;
          }
          updateDB((d) => {
            const tierList = d.redeems[draft.tier as 'daily' | 'weekly' | 'monthly'];
            const existingIdx = tierList.findIndex((r) => r.id === draft.id);
            if (existingIdx >= 0) {
              tierList[existingIdx] = draft;
            } else {
              draft.id = 'rd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              tierList.push(draft);
            }
          });
          setModal(null);
          showToast(t('saved_toast', lang), 'good');
        }}
        onSaveCat={(catId, pts) => {
          updateDB((d) => {
            const cat = d.categories.find((c) => c.id === catId);
            if (cat) cat.points = pts;
          });
          setModal(null);
          showToast(t('saved_toast', lang), 'good');
        }}
        onSaveAdjust={(catId, delta, reason) => {
          if (!delta) {
            showToast('Enter non-zero value', 'bad');
            return;
          }
          updateDB((d) => {
            d.ledger.push({
              id: 'adj_' + Date.now().toString(36),
              ts: Date.now(),
              date: today,
              catId,
              delta,
              reason: reason || (delta > 0 ? 'Parent Reward' : 'Parent Deduction'),
              kind: 'adjust',
            });
          });
          setModal(null);
          showToast('Points adjusted', 'good');
        }}
        onSavePinChange={(p1, p2) => {
          if (p1.length !== 4 || !/^\d{4}$/.test(p1)) {
            showToast(lang === 'zh' ? '请输入 4 位数字密码' : 'PIN must be 4 digits', 'bad');
            return;
          }
          if (p1 !== p2) {
            showToast(t('pin_mismatch', lang), 'bad');
            return;
          }
          updateDB((d) => {
            d.settings.parentPin = p1;
          });
          setModal(null);
          showToast(t('pin_changed', lang), 'good');
        }}
        onToast={showToast}
      />

      {/* Toast Notification */}
      <div className={`toast-layer ${toastMsg ? 'on' : ''}`}>
        {toastMsg && (
          <div className={`toast ${toastMsg.kind || ''}`}>
            <span>{toastMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
