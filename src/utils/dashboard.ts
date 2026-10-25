import { QuestPadDB, TaskDef } from '../types';
import { dateKey, parseKey, pad2, monthKey, fmtDate } from '../utils';
import { isTaskComplete } from '../services/workbench';

export interface CategoryMetric {
  categoryId: string;
  categoryName: string;
  categoryNameZh?: string;
  color: string;
  icon?: string;
  emoji: string;
  scheduledCount: number;
  completedCount: number;
  rate: number; // 0 - 100%
}

export interface PeriodMetrics {
  title: string;
  dateLabel: string;
  totalScheduled: number;
  totalCompleted: number;
  overallRate: number;
  byCategory: CategoryMetric[];
}

export type DayStatus = 'completed' | 'missed' | 'pending' | 'upcoming' | 'not_scheduled';

export function getYesterday(refDate?: string): string {
  const d = refDate ? parseKey(refDate) : new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export function getShiftedDate(refDate: string, deltaDays: number): string {
  const d = parseKey(refDate);
  d.setDate(d.getDate() + deltaDays);
  return dateKey(d);
}

export function getWeekDays(refDate: string): { date: string; dow: number; labelEn: string; labelZh: string }[] {
  const d = parseKey(refDate);
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);

  const labelsEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const labelsZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dows = [1, 2, 3, 4, 5, 6, 0];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push({
      date: dateKey(cur),
      dow: dows[i],
      labelEn: labelsEn[i],
      labelZh: labelsZh[i],
    });
  }
  return days;
}

export function getWeekRangeLabel(days: { date: string }[], lang: string): string {
  if (!days.length) return '';
  const first = days[0].date;
  const last = days[days.length - 1].date;
  return `${fmtDate(first, lang)} – ${fmtDate(last, lang)}`;
}

export function getMonthDays(monthStr: string): string[] {
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const list: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    list.push(`${y}-${pad2(m)}-${pad2(d)}`);
  }
  return list;
}

export function isTaskScheduledOnDate(task: TaskDef, dt: string): boolean {
  if (task.active === false) return false;
  const mk = monthKey(dt);
  const ms = task.months && task.months.length ? task.months : (task.month ? [task.month] : []);
  if (ms.length && !ms.includes(mk)) return false;
  const d = parseKey(dt);
  const dow = d.getDay();
  const wd = task.weekdays && task.weekdays.length ? task.weekdays : [0, 1, 2, 3, 4, 5, 6];
  return wd.includes(dow);
}

export function getTaskDayStatus(task: TaskDef, dt: string, db: QuestPadDB, todayStr = dateKey()): DayStatus {
  if (!isTaskScheduledOnDate(task, dt)) {
    return 'not_scheduled';
  }
  if (isTaskComplete(dt, task, db)) {
    return 'completed';
  }
  if (dt < todayStr) {
    return 'missed';
  }
  if (dt === todayStr) {
    return 'pending';
  }
  return 'upcoming';
}

export function computePeriodMetrics(
  db: QuestPadDB,
  dates: string[],
  title: string,
  dateLabel: string
): PeriodMetrics {
  const categoryStats: Record<string, { scheduled: number; completed: number }> = {};
  
  db.categories.forEach((cat) => {
    categoryStats[cat.id] = { scheduled: 0, completed: 0 };
  });

  let totalScheduled = 0;
  let totalCompleted = 0;

  dates.forEach((dt) => {
    db.tasks.forEach((task) => {
      if (isTaskScheduledOnDate(task, dt)) {
        if (!categoryStats[task.categoryId]) {
          categoryStats[task.categoryId] = { scheduled: 0, completed: 0 };
        }
        categoryStats[task.categoryId].scheduled += 1;
        totalScheduled += 1;

        if (isTaskComplete(dt, task, db)) {
          categoryStats[task.categoryId].completed += 1;
          totalCompleted += 1;
        }
      }
    });
  });

  const byCategory: CategoryMetric[] = db.categories.map((cat) => {
    const stat = categoryStats[cat.id] || { scheduled: 0, completed: 0 };
    const rate = stat.scheduled > 0 ? Math.round((stat.completed / stat.scheduled) * 100) : 0;
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      categoryNameZh: cat.nameZh,
      color: cat.color,
      icon: cat.icon,
      emoji: cat.emoji || '🌟',
      scheduledCount: stat.scheduled,
      completedCount: stat.completed,
      rate,
    };
  });

  const overallRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return {
    title,
    dateLabel,
    totalScheduled,
    totalCompleted,
    overallRate,
    byCategory,
  };
}
