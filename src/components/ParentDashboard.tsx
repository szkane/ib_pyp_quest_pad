import React, { useState, useMemo } from 'react';
import { QuestPadDB, TaskDef } from '../types';
import { Icon } from './Icons';
import { t, dateKey, monthKey, fmtDate } from '../utils';
import {
  getYesterday,
  getShiftedDate,
  getWeekDays,
  getWeekRangeLabel,
  getMonthDays,
  getTaskDayStatus,
  computePeriodMetrics,
  isTaskScheduledOnDate,
  DayStatus,
} from '../utils/dashboard';

interface ParentDashboardProps {
  db: QuestPadDB;
  lang: string;
  catName: (id: string) => string;
  catColor: (id: string) => string;
  catPointEmoji: (id: string) => string;
  onEditTask?: (task: TaskDef) => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  db,
  lang,
  catName,
  catColor,
  catPointEmoji,
  onEditTask,
}) => {
  const today = dateKey();
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>(today);
  const [filterCat, setFilterCat] = useState<string>('all');

  // 1. Period Metrics
  const yesterdayDate = getYesterday(today);
  const currentWeekDays = useMemo(() => getWeekDays(today), [today]);
  const currentMonthDays = useMemo(() => getMonthDays(monthKey(today)), [today]);

  const yesterdayMetrics = useMemo(
    () =>
      computePeriodMetrics(
        db,
        [yesterdayDate],
        t('dashboard_yesterday', lang),
        fmtDate(yesterdayDate, lang)
      ),
    [db, yesterdayDate, lang]
  );

  const weekMetrics = useMemo(
    () =>
      computePeriodMetrics(
        db,
        currentWeekDays.map((d) => d.date),
        t('dashboard_week', lang),
        getWeekRangeLabel(currentWeekDays, lang)
      ),
    [db, currentWeekDays, lang]
  );

  const monthMetrics = useMemo(
    () =>
      computePeriodMetrics(
        db,
        currentMonthDays,
        t('dashboard_month', lang),
        lang === 'zh'
          ? `${monthKey(today).split('-')[0]}年${monthKey(today).split('-')[1]}月`
          : monthKey(today)
      ),
    [db, currentMonthDays, today, lang]
  );

  // 2. Matrix Week Days for navigation
  const matrixWeekDays = useMemo(() => getWeekDays(selectedWeekDate), [selectedWeekDate]);
  const isCurrentWeekSelected = useMemo(() => {
    const curMonday = getWeekDays(today)[0].date;
    return matrixWeekDays[0].date === curMonday;
  }, [matrixWeekDays, today]);

  // Tasks filtered by category for matrix
  const categoriesToShow = useMemo(() => {
    if (filterCat === 'all') return db.categories;
    return db.categories.filter((c) => c.id === filterCat);
  }, [db.categories, filterCat]);

  const getStatusBadge = (status: DayStatus, task: TaskDef, dt: string) => {
    switch (status) {
      case 'completed':
        return (
          <div
            className="matrix-cell-badge completed"
            title={`${task.title} - ${lang === 'zh' ? '已完成' : 'Completed'}`}
          >
            <span className="matrix-icon">✓</span>
            <span className="matrix-pts">+{task.points}</span>
          </div>
        );
      case 'missed':
        return (
          <div
            className="matrix-cell-badge missed"
            title={`${task.title} - ${lang === 'zh' ? '未完成' : 'Missed'}`}
          >
            <span className="matrix-icon">✕</span>
            <span className="matrix-label">{t('status_missed', lang)}</span>
          </div>
        );
      case 'pending':
        return (
          <div
            className="matrix-cell-badge pending"
            title={`${task.title} - ${lang === 'zh' ? '今日待完成' : 'Pending Today'}`}
          >
            <span className="matrix-icon">⏳</span>
            <span className="matrix-label">{t('status_task_pending', lang)}</span>
          </div>
        );
      case 'upcoming':
        return (
          <div
            className="matrix-cell-badge upcoming"
            title={`${task.title} - ${lang === 'zh' ? '排班中' : 'Scheduled'}`}
          >
            <span className="matrix-icon">📅</span>
          </div>
        );
      case 'not_scheduled':
      default:
        return (
          <div className="matrix-cell-badge not-scheduled" title={lang === 'zh' ? '无排班' : 'Not scheduled'}>
            <span className="matrix-dash">—</span>
          </div>
        );
    }
  };

  return (
    <div className="parent-dashboard-view">
      {/* Header Info */}
      <div className="dashboard-hero-banner">
        <div>
          <h2 className="dashboard-title">
            <Icon name="grid" size={24} color="var(--blue)" />
            <span>{t('dashboard_overview_title', lang)}</span>
          </h2>
          <p className="dashboard-subtitle">{t('dashboard_overview_sub', lang)}</p>
        </div>
        <div className="dashboard-child-badge">
          <span className="child-avatar">🎓</span>
          <span className="child-name">{db.settings.childName || 'Child'}</span>
        </div>
      </div>

      {/* 1. Three Period Summary Cards */}
      <section className="dashboard-period-grid">
        {[yesterdayMetrics, weekMetrics, monthMetrics].map((metric, idx) => {
          const accentColors = ['#f59e0b', '#3b82f6', '#10b981'];
          const accentColor = accentColors[idx % accentColors.length];

          return (
            <div key={metric.title} className="period-card" style={{ '--accent': accentColor } as any}>
              <div className="period-card-header">
                <div>
                  <div className="period-card-title">{metric.title}</div>
                  <div className="period-card-date">{metric.dateLabel}</div>
                </div>
                <div
                  className="period-rate-badge"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    color: accentColor,
                    borderColor: accentColor,
                  }}
                >
                  <span className="rate-num">{metric.overallRate}%</span>
                  <span className="rate-lbl">{t('dashboard_comp_rate', lang)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="period-progress-container">
                <div
                  className="period-progress-bar"
                  style={{ width: `${metric.overallRate}%`, backgroundColor: accentColor }}
                />
              </div>

              <div className="period-stats-row">
                <span className="stat-item">
                  <strong>{metric.totalCompleted}</strong> / {metric.totalScheduled}{' '}
                  {t('dashboard_completed_items', lang)}
                </span>
                <span className="stat-divider">·</span>
                <span className="stat-item">
                  {metric.totalScheduled - metric.totalCompleted}{' '}
                  {lang === 'zh' ? '项待完成/未打卡' : 'incomplete'}
                </span>
              </div>

              {/* Category Breakdown Breakdown */}
              <div className="period-cat-breakdown">
                {metric.byCategory.map((cat) => {
                  return (
                    <div key={cat.categoryId} className="cat-mini-stat" style={{ '--cc': cat.color } as any}>
                      <div className="cat-mini-header">
                        <span className="cat-mini-name">
                          <span className="cat-dot" style={{ backgroundColor: cat.color }} />
                          {lang === 'zh' && cat.categoryNameZh ? cat.categoryNameZh : cat.categoryName}
                        </span>
                        <span className="cat-mini-ratio">
                          <strong>{cat.completedCount}</strong>/{cat.scheduledCount}
                          <span className="cat-mini-rate">({cat.rate}%)</span>
                        </span>
                      </div>
                      <div className="cat-mini-progress">
                        <div
                          className="cat-mini-bar"
                          style={{
                            width: `${cat.rate}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* 2. Weekly Quest Completion Matrix */}
      <section className="card dashboard-matrix-section">
        <div className="card-h matrix-section-header">
          <div>
            <h2>
              <Icon name="calendar" size={22} color="var(--blue)" />
              <span>{t('dashboard_weekly_matrix', lang)}</span>
            </h2>
            <div className="hint" style={{ marginTop: 2 }}>
              {lang === 'zh'
                ? '查看每个分类下具体任务在本周周一至周日每一天的完成情况'
                : 'Review daily completion status for each quest under every category across Monday–Sunday'}
            </div>
          </div>

          {/* Week Navigation Controls */}
          <div className="matrix-week-stepper">
            <button
              className="btn xs soft"
              onClick={() => setSelectedWeekDate((prev) => getShiftedDate(prev, -7))}
              title={t('dashboard_prev_week', lang)}
            >
              ◀ {t('dashboard_prev_week', lang)}
            </button>
            <div className="matrix-week-range-pill">
              <Icon name="calendar" size={14} color="var(--blue)" />
              <span>{getWeekRangeLabel(matrixWeekDays, lang)}</span>
            </div>
            <button
              className="btn xs soft"
              onClick={() => setSelectedWeekDate((prev) => getShiftedDate(prev, 7))}
              title={t('dashboard_next_week', lang)}
            >
              {t('dashboard_next_week', lang)} ▶
            </button>
            {!isCurrentWeekSelected && (
              <button
                className="btn xs line"
                onClick={() => setSelectedWeekDate(today)}
                title={t('dashboard_cur_week', lang)}
              >
                {t('dashboard_cur_week', lang)}
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="matrix-cat-filters">
          <button
            className={`matrix-filter-pill ${filterCat === 'all' ? 'active' : ''}`}
            onClick={() => setFilterCat('all')}
          >
            <Icon name="grid" size={14} />
            <span>{t('dashboard_all_categories', lang)}</span>
            <span className="pill-cnt">{db.tasks.length}</span>
          </button>
          {db.categories.map((c) => {
            const isCur = filterCat === c.id;
            const cCount = db.tasks.filter((t) => t.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                className={`matrix-filter-pill ${isCur ? 'active' : ''}`}
                style={{ '--p-c': c.color } as any}
                onClick={() => setFilterCat(c.id)}
              >
                <Icon name={c.icon || 'book'} size={14} color={isCur ? '#fff' : c.color} />
                <span>{catName(c.id)}</span>
                <span className="pill-cnt">{cCount}</span>
              </button>
            );
          })}
        </div>

        {/* Matrix Table */}
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="col-quest-name">
                  {lang === 'zh' ? '分类与任务名称' : 'Category & Quest Title'}
                </th>
                <th className="col-pts">{lang === 'zh' ? '单次分值' : 'Points'}</th>
                {matrixWeekDays.map((d) => {
                  const isTodayCol = d.date === today;
                  return (
                    <th key={d.date} className={`col-day ${isTodayCol ? 'is-today-col' : ''}`}>
                      <div className="day-name">{lang === 'zh' ? d.labelZh : d.labelEn}</div>
                      <div className="day-date">{fmtDate(d.date, lang)}</div>
                      {isTodayCol && (
                        <div className="day-today-tag">{lang === 'zh' ? '今日' : 'Today'}</div>
                      )}
                    </th>
                  );
                })}
                <th className="col-week-summary">{lang === 'zh' ? '本周完成' : 'Week Total'}</th>
              </tr>
            </thead>
            <tbody>
              {categoriesToShow.map((cat) => {
                const catTasks = db.tasks.filter((t) => t.categoryId === cat.id);
                if (!catTasks.length) {
                  return (
                    <React.Fragment key={cat.id}>
                      <tr className="matrix-cat-row" style={{ borderLeftColor: cat.color }}>
                        <td colSpan={10} className="cat-row-cell">
                          <div className="cat-row-content">
                            <span className="cat-color-chip" style={{ backgroundColor: cat.color }} />
                            <Icon name={cat.icon || 'book'} size={16} color={cat.color} />
                            <strong>{catName(cat.id)}</strong>
                            <span className="cat-empty-hint">
                              ({lang === 'zh' ? '该分类暂未配置任务' : 'No quests in this category'})
                            </span>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                }

                // Compute weekly completion for this category
                let catWeekScheduled = 0;
                let catWeekCompleted = 0;
                catTasks.forEach((task) => {
                  matrixWeekDays.forEach((d) => {
                    if (isTaskScheduledOnDate(task, d.date)) {
                      catWeekScheduled++;
                      if (getTaskDayStatus(task, d.date, db, today) === 'completed') {
                        catWeekCompleted++;
                      }
                    }
                  });
                });
                const catWeekRate =
                  catWeekScheduled > 0 ? Math.round((catWeekCompleted / catWeekScheduled) * 100) : 0;

                return (
                  <React.Fragment key={cat.id}>
                    {/* Category Header Row */}
                    <tr className="matrix-cat-row" style={{ borderLeftColor: cat.color }}>
                      <td colSpan={2} className="cat-row-cell">
                        <div className="cat-row-content">
                          <span className="cat-color-chip" style={{ backgroundColor: cat.color }} />
                          <Icon name={cat.icon || 'book'} size={16} color={cat.color} />
                          <strong>{catName(cat.id)}</strong>
                          <span className="cat-task-count">
                            ({catTasks.length} {lang === 'zh' ? '个任务' : 'quests'})
                          </span>
                        </div>
                      </td>
                      <td colSpan={7} className="cat-row-spacer" />
                      <td className="cat-row-summary">
                        <span className="cat-summary-pill" style={{ borderColor: cat.color, color: cat.color }}>
                          {catWeekCompleted}/{catWeekScheduled} ({catWeekRate}%)
                        </span>
                      </td>
                    </tr>

                    {/* Task Rows */}
                    {catTasks.map((task) => {
                      let taskWeekScheduled = 0;
                      let taskWeekCompleted = 0;

                      return (
                        <tr key={task.id} className="matrix-task-row">
                          <td className="cell-task-info">
                            <div className="matrix-task-title-wrap">
                              <span
                                className="task-title-text"
                                onClick={() => onEditTask?.(task)}
                                title={lang === 'zh' ? '点击查看/编辑任务' : 'Click to edit quest'}
                              >
                                {task.title}
                              </span>
                              <div className="task-meta-hint">
                                {task.steps.length} {lang === 'zh' ? '步骤' : 'steps'}
                                {task.active === false && (
                                  <span className="task-paused-tag">
                                    {lang === 'zh' ? '已暂停' : 'Paused'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="cell-task-pts">
                            <span className="tag pts-badge">
                              +{task.points} {catPointEmoji(task.categoryId)}
                            </span>
                          </td>

                          {matrixWeekDays.map((d) => {
                            const isToday = d.date === today;
                            const status = getTaskDayStatus(task, d.date, db, today);
                            if (status !== 'not_scheduled') {
                              taskWeekScheduled++;
                              if (status === 'completed') taskWeekCompleted++;
                            }

                            return (
                              <td
                                key={d.date}
                                className={`cell-status-day ${isToday ? 'is-today-cell' : ''}`}
                              >
                                {getStatusBadge(status, task, d.date)}
                              </td>
                            );
                          })}

                          <td className="cell-task-summary">
                            <div className="task-week-progress">
                              <span className="summary-ratio">
                                <strong>{taskWeekCompleted}</strong>/{taskWeekScheduled}
                              </span>
                              <div className="summary-bar-bg">
                                <div
                                  className="summary-bar-fill"
                                  style={{
                                    width: `${
                                      taskWeekScheduled > 0
                                        ? Math.round((taskWeekCompleted / taskWeekScheduled) * 100)
                                        : 0
                                    }%`,
                                    backgroundColor: cat.color,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="matrix-legend">
          <div className="legend-item">
            <span className="legend-chip completed">✓</span>
            <span>{t('status_done', lang)}</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip missed">✕</span>
            <span>{t('status_missed', lang)}</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip pending">⏳</span>
            <span>{t('status_task_pending', lang)}</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip not-scheduled">—</span>
            <span>{t('status_not_scheduled', lang)}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
