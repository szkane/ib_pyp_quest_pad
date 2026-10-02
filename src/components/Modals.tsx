import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { t, monthKey, pad2 } from '../utils';
import { QuestPadDB, TaskStep } from '../types';

interface ModalsProps {
  modal: any;
  db: QuestPadDB;
  lang: string;
  onClose: () => void;
  onConfirm: (modal: any) => void;
  onSaveTask: (draft: any) => void;
  onSaveGoal: (draft: any) => void;
  onSaveReward: (draft: any) => void;
  onSaveCat: (catId: string, pts: number) => void;
  onSaveAdjust: (catId: string, delta: number, reason: string) => void;
  onSavePinChange: (p1: string, p2: string) => void;
  onUnlockPin: () => void;
  onToast: (msg: string, kind?: 'good' | 'bad') => void;
}

const PinModal: React.FC<{
  db: QuestPadDB;
  lang: string;
  onClose: () => void;
  onUnlockPin: () => void;
  onToast: (msg: string, kind?: 'good' | 'bad') => void;
}> = ({ db, lang, onClose, onUnlockPin, onToast }) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const handleKey = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setTimeout(() => {
        if (nextPin === String(db.settings.parentPin)) {
          onUnlockPin();
          onClose();
          onToast(t('pin_unlocked', lang), 'good');
        } else {
          setShake(true);
          onToast(t('pin_wrong', lang), 'bad');
          setTimeout(() => {
            setPin('');
            setShake(false);
          }, 450);
        }
      }, 100);
    }
  };

  const handleBack = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  // Keyboard support for desktop and iPad hardware keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBack();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && pin.length === 4) {
        if (pin === String(db.settings.parentPin)) {
          onUnlockPin();
          onClose();
          onToast(t('pin_unlocked', lang), 'good');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, db.settings.parentPin, lang]);

  return (
    <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${shake ? 'shake' : ''}`} role="dialog">
        <div className="modal-h">
          <h3>{t('pin_enter', lang)}</h3>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-b" style={{ textAlign: 'center' }}>
          <div className="hint" style={{ marginBottom: 14 }}>
            {t('pin_hint', lang)}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  border: '2px solid var(--ink)',
                  borderRadius: '50%',
                  background: i < pin.length ? 'var(--green)' : 'var(--paper)',
                  transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.12s ease',
                }}
              />
            ))}
          </div>
          <div className="pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="pin-key"
                onClick={() => handleKey(String(num))}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="pin-key action"
              onClick={handleBack}
            >
              ⌫
            </button>
            <button
              type="button"
              className="pin-key"
              onClick={() => handleKey('0')}
            >
              0
            </button>
            <button
              type="button"
              className="pin-key action"
              style={{ background: 'var(--green)', color: '#fff' }}
              onClick={() => {
                if (pin === String(db.settings.parentPin)) {
                  onUnlockPin();
                  onClose();
                  onToast(t('pin_unlocked', lang), 'good');
                } else {
                  setShake(true);
                  onToast(t('pin_wrong', lang), 'bad');
                  setTimeout(() => {
                    setPin('');
                    setShake(false);
                  }, 450);
                }
              }}
            >
              <Icon name="check" size={18} color="#fff" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskModal: React.FC<{
  modal: any;
  db: QuestPadDB;
  lang: string;
  onClose: () => void;
  onSaveTask: (draft: any) => void;
  onToast: (msg: string, kind?: 'good' | 'bad') => void;
}> = ({ modal, db, lang, onClose, onSaveTask, onToast }) => {
  const dt = modal.draft || {};
  const currentMonth = monthKey();
  const currentYear = new Date().getFullYear();

  const [title, setTitle] = useState(dt.title || '');
  const [categoryId, setCategoryId] = useState(dt.categoryId || db.categories[0]?.id || 'cat_study');
  const [points, setPoints] = useState<number>(dt.points !== undefined ? dt.points : 10);
  const [goalId, setGoalId] = useState(dt.goalId || '');

  // Target months handling
  const initialMonths: string[] = (() => {
    if (dt.months && Array.isArray(dt.months) && dt.months.length > 0) {
      return [...dt.months];
    }
    if (dt.month) {
      return [dt.month];
    }
    return [currentMonth];
  })();

  const [months, setMonths] = useState<string[]>(initialMonths);
  const [targetYear, setTargetYear] = useState<number>(() => {
    if (initialMonths.length > 0) {
      const y = parseInt(initialMonths[0].split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return currentYear;
  });

  // Weekdays (Mon to Sun: 1, 2, 3, 4, 5, 6, 0)
  const [weekdays, setWeekdays] = useState<number[]>(
    dt.weekdays && dt.weekdays.length > 0 ? dt.weekdays : [1, 2, 3, 4, 5, 6, 0]
  );

  // Sub-steps
  const [steps, setSteps] = useState<any[]>(() => {
    if (dt.steps && Array.isArray(dt.steps) && dt.steps.length > 0) {
      return dt.steps.map((s: any, idx: number) => ({
        id: s.id || ('s_' + Date.now().toString(36) + '_' + idx),
        title: s.title || '',
        minutes: s.minutes !== undefined ? s.minutes : 5,
      }));
    }
    return [
      { id: 's_init_1', title: '', minutes: 5 }
    ];
  });

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsZh = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const daysList = [
    { dow: 1, en: 'Mon', zh: '一' },
    { dow: 2, en: 'Tue', zh: '二' },
    { dow: 3, en: 'Wed', zh: '三' },
    { dow: 4, en: 'Thu', zh: '四' },
    { dow: 5, en: 'Fri', zh: '五' },
    { dow: 6, en: 'Sat', zh: '六' },
    { dow: 0, en: 'Sun', zh: '日' },
  ];

  const toggleMonth = (mk: string) => {
    setMonths((prev) => {
      if (prev.includes(mk)) {
        if (prev.length === 1) {
          onToast(t('at_least_one_month', lang), 'bad');
          return prev;
        }
        return prev.filter((m) => m !== mk);
      }
      return [...prev, mk].sort();
    });
  };

  const selectAllYear = () => {
    const allForYear = Array.from({ length: 12 }, (_, i) => `${targetYear}-${pad2(i + 1)}`);
    const otherYears = months.filter((m) => !m.startsWith(`${targetYear}-`));
    setMonths([...otherYears, ...allForYear].sort());
  };

  const selectThisMonth = () => {
    setTargetYear(currentYear);
    setMonths([currentMonth]);
  };

  const toggleDay = (dw: number) => {
    setWeekdays((prev) => {
      if (prev.includes(dw)) {
        if (prev.length === 1) {
          onToast(lang === 'zh' ? '请至少保留一天' : 'Please keep at least one day', 'bad');
          return prev;
        }
        return prev.filter((d) => d !== dw);
      }
      return [...prev, dw];
    });
  };

  const updateStepTitle = (idx: number, val: string) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], title: val };
      return copy;
    });
  };

  const updateStepMinutes = (idx: number, val: number) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], minutes: val };
      return copy;
    });
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: 's_' + Date.now().toString(36) + '_' + prev.length,
        title: '',
        minutes: 5,
      },
    ]);
  };

  const removeStep = (idx: number) => {
    if (steps.length === 1) {
      onToast(lang === 'zh' ? '请至少保留一个步骤' : 'Please keep at least one step', 'bad');
      return;
    }
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleSave = () => {
    if (!title.trim()) {
      onToast(lang === 'zh' ? '请输入任务名称' : 'Please enter quest title', 'bad');
      return;
    }
    if (months.length === 0) {
      onToast(t('at_least_one_month', lang), 'bad');
      return;
    }
    if (weekdays.length === 0) {
      onToast(lang === 'zh' ? '请至少选择一天' : 'Please select at least one day', 'bad');
      return;
    }

    const cleanedSteps = steps.map((s, idx) => ({
      id: s.id,
      title: s.title.trim() || (lang === 'zh' ? `步骤 ${idx + 1}` : `Step ${idx + 1}`),
      minutes: Math.max(1, Math.min(180, Number(s.minutes) || 5)),
    }));

    onSaveTask({
      ...dt,
      title: title.trim(),
      categoryId,
      points: Number(points) || 10,
      goalId: goalId || '',
      months: months.slice().sort(),
      month: months[0] || currentMonth,
      weekdays,
      steps: cleanedSteps,
    });
  };

  return (
    <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" style={{ maxWidth: 640 }}>
        <div className="modal-h">
          <h3>{dt.id ? (lang === 'zh' ? '编辑任务' : 'Edit Quest') : (lang === 'zh' ? '+ 添加任务' : '+ Add Quest')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>{t('task_title', lang)}</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'zh' ? '例如：自主阅读与反思' : 'e.g. Reading & Inquiry'}
              autoFocus
            />
          </div>

          <div className="grid2">
            <div className="field">
              <label>{t('task_cat', lang)}</label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {db.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(lang === 'zh' && c.nameZh ? c.nameZh : c.name) + ' ' + c.emoji}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{lang === 'zh' ? '单次完成奖励' : 'Reward Amount'}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1000"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="field">
            <div className="month-pick-wrap">
              <div className="month-pick-header">
                <label style={{ margin: 0, fontWeight: 900 }}>
                  {t('task_months', lang)}{' '}
                  <span className="hint" style={{ fontWeight: 'normal' }}>
                    ({t('task_months_multi', lang)})
                  </span>
                </label>
                <div className="month-year-nav">
                  <button
                    type="button"
                    className="btn xs soft"
                    style={{ padding: '0 8px', minHeight: 28 }}
                    onClick={() => setTargetYear((y) => y - 1)}
                    title={lang === 'zh' ? '上一年' : 'Previous Year'}
                  >
                    ◀
                  </button>
                  <span className="month-year-badge">{targetYear}</span>
                  <button
                    type="button"
                    className="btn xs soft"
                    style={{ padding: '0 8px', minHeight: 28 }}
                    onClick={() => setTargetYear((y) => y + 1)}
                    title={lang === 'zh' ? '下一年' : 'Next Year'}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className="btn xs soft"
                    style={{ minHeight: 28, padding: '0 10px' }}
                    onClick={selectAllYear}
                  >
                    {t('month_select_all', lang)}
                  </button>
                  <button
                    type="button"
                    className="btn xs soft"
                    style={{ minHeight: 28, padding: '0 10px' }}
                    onClick={selectThisMonth}
                  >
                    {t('month_cur_only', lang)}
                  </button>
                </div>
              </div>

              <div className="month-pick-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                  const mk = `${targetYear}-${pad2(m)}`;
                  const isSelected = months.includes(mk);
                  const label = lang === 'zh' ? monthsZh[m - 1] : monthsEn[m - 1];
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`month-btn ${isSelected ? 'on' : ''}`}
                      onClick={() => toggleMonth(mk)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="month-summary-bar">
                <div className="month-summary-tag">
                  <span>📅</span>
                  <span>
                    {months.length} {t('months_selected_count', lang)}: {months.length ? months.map((m) => m.replace('-', '.')).join(', ') : (lang === 'zh' ? '未选择月份' : 'None')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <label>{t('task_goal', lang)}</label>
            <select
              className="input"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              <option value="">
                {lang === 'zh' ? '无关联目标（独立任务）' : 'None (Standalone Quest)'}
              </option>
              {db.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t('task_days', lang)}</label>
            <div className="day-pick">
              {daysList.map(({ dow, en, zh }) => {
                const on = weekdays.includes(dow);
                const lbl = lang === 'zh' ? zh : en;
                return (
                  <button
                    key={dow}
                    type="button"
                    className={`day-btn ${on ? 'on' : ''}`}
                    onClick={() => toggleDay(dow)}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label>{t('task_steps', lang)}</label>
            <div className="step-edit-list">
              {steps.map((s, idx) => (
                <div key={s.id || idx} className="step-edit-row">
                  <div className="idx">{idx + 1}</div>
                  <input
                    className="input t"
                    value={s.title}
                    onChange={(e) => updateStepTitle(idx, e.target.value)}
                    placeholder={t('step_name_placeholder', lang)}
                  />
                  <input
                    className="input m"
                    type="number"
                    min="1"
                    max="180"
                    value={s.minutes}
                    onChange={(e) => updateStepMinutes(idx, Number(e.target.value))}
                  />
                  <span className="hint" style={{ flex: 'none', fontWeight: 800 }}>
                    min
                  </span>
                  <button
                    type="button"
                    className="icon-btn xs"
                    disabled={idx === 0}
                    onClick={() => moveStep(idx, -1)}
                    title={lang === 'zh' ? '上移' : 'Move up'}
                  >
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn xs"
                    disabled={idx === steps.length - 1}
                    onClick={() => moveStep(idx, 1)}
                    title={lang === 'zh' ? '下移' : 'Move down'}
                  >
                    <Icon name="arrowDown" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn xs danger"
                    disabled={steps.length === 1}
                    onClick={() => removeStep(idx)}
                    title={lang === 'zh' ? '删除步骤' : 'Delete step'}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn xs soft"
              style={{ alignSelf: 'flex-start', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={addStep}
            >
              <Icon name="plus" size={14} />
              <span>{lang === 'zh' ? '添加步骤' : 'Add Step'}</span>
            </button>
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn soft sm" onClick={onClose}>
            {t('modal_cancel', lang)}
          </button>
          <button type="button" className="btn sm green" onClick={handleSave}>
            {t('modal_save', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Modals: React.FC<ModalsProps> = ({
  modal,
  db,
  lang,
  onClose,
  onConfirm,
  onSaveTask,
  onSaveGoal,
  onSaveReward,
  onSaveCat,
  onSaveAdjust,
  onSavePinChange,
  onUnlockPin,
  onToast,
}) => {
  if (!modal) return null;

  const fCancel = (
    <button className="btn soft sm" onClick={onClose}>
      {t('modal_cancel', lang)}
    </button>
  );

  // 1. PIN Keypad Modal
  if (modal.type === 'pin') {
    return (
      <PinModal
        db={db}
        lang={lang}
        onClose={onClose}
        onUnlockPin={onUnlockPin}
        onToast={onToast}
      />
    );
  }

  // 2. Change PIN Modal
  if (modal.type === 'pinChange') {
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog">
          <div className="modal-h">
            <h3>{t('change_pin', lang)}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <div className="field">
              <label>{t('pin_new', lang)}</label>
              <input
                className="input"
                type="password"
                maxLength={4}
                inputMode="numeric"
                id="modalPin1"
                placeholder="4 digits"
              />
            </div>
            <div className="field">
              <label>{t('pin_confirm', lang)}</label>
              <input
                className="input"
                type="password"
                maxLength={4}
                inputMode="numeric"
                id="modalPin2"
                placeholder="4 digits"
              />
            </div>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className="btn sm green"
              onClick={() => {
                const p1 = (document.getElementById('modalPin1') as HTMLInputElement)?.value || '';
                const p2 = (document.getElementById('modalPin2') as HTMLInputElement)?.value || '';
                onSavePinChange(p1, p2);
              }}
            >
              {t('modal_save', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Confirm Modal
  if (modal.type === 'confirm') {
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog">
          <div className="modal-h">
            <h3>{modal.title || t('modal_confirm', lang)}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <p style={{ fontSize: 16, fontWeight: 700 }}>{modal.text}</p>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className={`btn sm ${modal.danger ? 'coral' : 'green'}`}
              onClick={() => onConfirm(modal)}
            >
              {modal.confirmLabel || t('modal_confirm', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Task Modal
  if (modal.type === 'task') {
    return (
      <TaskModal
        modal={modal}
        db={db}
        lang={lang}
        onClose={onClose}
        onSaveTask={onSaveTask}
        onToast={onToast}
      />
    );
  }

  // 5. Goal Modal
  if (modal.type === 'goal') {
    const dg = modal.draft;
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog">
          <div className="modal-h">
            <h3>{dg.id ? (lang === 'zh' ? '编辑目标' : 'Edit Goal') : t('add_new_goal', lang)}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <div className="field">
              <label>{t('goal_title', lang)}</label>
              <input className="input" id="goalTitleInput" defaultValue={dg.title} placeholder="Goal title" />
            </div>
            <div className="field">
              <label>{t('goal_desc', lang)}</label>
              <textarea className="input" id="goalDescInput" defaultValue={dg.desc || ''} placeholder="Notes" />
            </div>
            <div className="field">
              <label>{t('goal_target', lang)}</label>
              <input className="input" type="number" min="1" max="999" id="goalTargetInput" defaultValue={dg.targetCount || 30} />
            </div>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className="btn sm green"
              onClick={() => {
                const titleEl = document.getElementById('goalTitleInput') as HTMLInputElement;
                const descEl = document.getElementById('goalDescInput') as HTMLTextAreaElement;
                const targetEl = document.getElementById('goalTargetInput') as HTMLInputElement;

                dg.title = titleEl?.value?.trim() || '';
                dg.desc = descEl?.value?.trim() || '';
                dg.targetCount = Number(targetEl?.value) || 30;
                onSaveGoal(dg);
              }}
            >
              {t('modal_save', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Reward Modal
  if (modal.type === 'redeem') {
    const dr = modal.draft;
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" style={{ maxWidth: 560 }}>
          <div className="modal-h">
            <h3>{dr.id ? (lang === 'zh' ? '编辑心愿奖励' : 'Edit Reward') : t('add_new_reward', lang)}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <div className="cat-iso-notice">
              <Icon name="star" size={16} color="var(--ink)" />
              <span>{t('cat_iso_hint', lang)}</span>
            </div>
            <div className="field">
              <label>{t('reward_name', lang)}</label>
              <input className="input" id="rdNameInput" defaultValue={dr.name} placeholder="Reward name" />
            </div>
            <div className="field">
              <label>{t('reward_cat', lang)}</label>
              <select className="input" id="rdCatInput" defaultValue={dr.catId}>
                {db.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(lang === 'zh' && c.nameZh ? c.nameZh : c.name) + ' (' + c.emoji + ')'}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid2">
              <div className="field">
                <label>{t('reward_cost', lang)}</label>
                <input className="input" type="number" min="1" max="9999" id="rdCostInput" defaultValue={dr.cost || 25} />
              </div>
              <div className="field">
                <label>{t('reward_tier', lang)}</label>
                <select className="input" id="rdTierInput" defaultValue={dr.tier}>
                  <option value="daily">{t('daily_tier', lang)}</option>
                  <option value="weekly">{t('weekly_tier', lang)}</option>
                  <option value="monthly">{t('monthly_tier', lang)}</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>{t('reward_desc', lang)}</label>
              <textarea className="input" id="rdDescInput" defaultValue={dr.desc || ''} placeholder="Notes" />
            </div>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className="btn sm green"
              onClick={() => {
                const nameEl = document.getElementById('rdNameInput') as HTMLInputElement;
                const catEl = document.getElementById('rdCatInput') as HTMLSelectElement;
                const costEl = document.getElementById('rdCostInput') as HTMLInputElement;
                const tierEl = document.getElementById('rdTierInput') as HTMLSelectElement;
                const descEl = document.getElementById('rdDescInput') as HTMLTextAreaElement;

                dr.name = nameEl?.value?.trim() || '';
                dr.catId = catEl?.value || 'cat_study';
                dr.cost = Number(costEl?.value) || 25;
                dr.tier = (tierEl?.value as any) || 'daily';
                dr.desc = descEl?.value?.trim() || '';
                onSaveReward(dr);
              }}
            >
              {t('modal_save', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 7. Adjust Points Modal
  if (modal.type === 'adjustPoints') {
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog">
          <div className="modal-h">
            <h3>{t('manual_adjust_title', lang)}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <div className="field">
              <label>{t('adjust_cat', lang)}</label>
              <select className="input" id="adjCatInput">
                {db.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(lang === 'zh' && c.nameZh ? c.nameZh : c.name) + ' (' + c.emoji + ')'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('adjust_delta', lang)}</label>
              <input className="input" type="number" id="adjDeltaInput" defaultValue={10} placeholder="+15 or -10" />
            </div>
            <div className="field">
              <label>{t('adjust_reason', lang)}</label>
              <input className="input" id="adjReasonInput" placeholder="Reason" />
            </div>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className="btn sm green"
              onClick={() => {
                const catEl = document.getElementById('adjCatInput') as HTMLSelectElement;
                const deltaEl = document.getElementById('adjDeltaInput') as HTMLInputElement;
                const reasonEl = document.getElementById('adjReasonInput') as HTMLInputElement;
                onSaveAdjust(catEl?.value || 'cat_study', Number(deltaEl?.value) || 0, reasonEl?.value?.trim() || '');
              }}
            >
              {t('modal_save', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 8. Category Default Points Modal
  if (modal.type === 'cat') {
    const cat = db.categories.find((c) => c.id === modal.draft?.id) || db.categories[0];
    const catName = lang === 'zh' && cat.nameZh ? cat.nameZh : cat.name;
    return (
      <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog">
          <div className="modal-h">
            <h3>{lang === 'zh' ? `修改「${catName}」默认分值` : `Edit ${catName} default points`}</h3>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="modal-b">
            <div className="field">
              <label>{lang === 'zh' ? '默认每任务分值' : 'Default points per quest'}</label>
              <input className="input" type="number" min="1" max="1000" id="catPtsInput" defaultValue={cat.points || 10} />
            </div>
          </div>
          <div className="modal-f">
            {fCancel}
            <button
              className="btn sm green"
              onClick={() => {
                const ptsEl = document.getElementById('catPtsInput') as HTMLInputElement;
                onSaveCat(cat.id, Number(ptsEl?.value) || 10);
              }}
            >
              {t('modal_save', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
