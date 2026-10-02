import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { fmtDur, t } from '../utils';
import { QuestPadDB, TaskDef } from '../types';
import { stepPoints } from '../services/workbench';

interface FocusTimerProps {
  timer: { date: string; taskId: string; stepId: string; startTs: number };
  db: QuestPadDB;
  lang: string;
  onFinish: (date: string, taskId: string, stepId: string) => void;
  onCancel: () => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  timer,
  db,
  lang,
  onFinish,
  onCancel,
}) => {
  const [seconds, setSeconds] = useState(Math.max(0, Math.round((Date.now() - timer.startTs) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.round((Date.now() - timer.startTs) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.startTs]);

  const task = db.tasks.find((t: TaskDef) => t.id === timer.taskId);
  if (!task) return null;

  const stepIdx = task.steps.findIndex((s) => s.id === timer.stepId);
  if (stepIdx === -1) return null;
  const step = task.steps[stepIdx];

  const cat = db.categories.find((c) => c.id === task.categoryId) || db.categories[0];
  const color = cat.color;
  const cName = lang === 'zh' && cat.nameZh ? cat.nameZh : cat.name;
  const cEmoji = cat.emoji || '🌟';
  const pts = stepPoints(task);
  const sPts = pts[stepIdx] || Math.round(task.points / task.steps.length);
  const targetMin = step.minutes || 5;

  const focusHint = lang === 'zh' ? '沉浸专注，向着目标全速前进！✨' : 'Deep Focus Mode · Do your best! ✨';
  const targetLabel = lang === 'zh' ? `目标建议: ${targetMin} 分钟` : `Target: ${targetMin} min`;
  const rewardLabel = `+${sPts} ${cEmoji}`;

  return (
    <div className="timer-layer">
      <div className="timer-focus-card" style={{ '--c': color } as React.CSSProperties}>
        <div className="timer-focus-header">
          <div className="timer-focus-cat-tag" style={{ background: color }}>
            {cEmoji} {cName} · {rewardLabel}
          </div>
          <div className="timer-focus-quest">{task.title}</div>
          <div className="timer-focus-step">
            {stepIdx + 1}. {step.title}
          </div>
        </div>

        <div className="timer-clock-wrap">
          <div className="timer-clock-val">{fmtDur(seconds)}</div>
          <div className="timer-clock-target">{targetLabel}</div>
        </div>

        <div className="timer-focus-hint">{focusHint}</div>

        <div className="timer-focus-actions">
          <button
            className="timer-btn-finish"
            onClick={() => onFinish(timer.date, task.id, step.id)}
          >
            <Icon name="check" size={20} color="#fff" />
            <span>{t('btn_done', lang)}</span>
          </button>
          <button className="timer-btn-cancel" onClick={onCancel}>
            {t('btn_cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
