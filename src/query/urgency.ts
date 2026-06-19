import type { Task } from '../model.js';

const DUE_COEFFICIENT = 12.0;
const SCHEDULED_COEFFICIENT = 5.0;
const STARTED_COEFFICIENT = -3.0;
const PRIORITY_COEFFICIENT = 6.0;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((from.getTime() - to.getTime()) / MS_PER_DAY);
}

export function calculateUrgency(task: Task, today: string): number {
  let urgency = 0.0;

  if (task.dueDate) {
    const startOfToday = startOfDay(today);
    const dueDate = startOfDay(task.dueDate);
    const daysOverdue = daysBetween(startOfToday, dueDate);

    let dueMultiplier: number;
    if (daysOverdue >= 7) {
      dueMultiplier = 1.0;
    } else if (daysOverdue >= -14) {
      dueMultiplier = ((daysOverdue + 14) * 0.8) / 21 + 0.2;
    } else {
      dueMultiplier = 0.2;
    }
    urgency += dueMultiplier * DUE_COEFFICIENT;
  }

  if (task.scheduledDate) {
    const scheduled = startOfDay(task.scheduledDate);
    const todayDate = startOfDay(today);
    if (todayDate >= scheduled) {
      urgency += SCHEDULED_COEFFICIENT;
    }
  }

  if (task.startDate) {
    const start = startOfDay(task.startDate);
    const todayDate = startOfDay(today);
    if (todayDate < start) {
      urgency += STARTED_COEFFICIENT;
    }
  }

  switch (task.priority) {
    case 'HIGHEST':
      urgency += 1.5 * PRIORITY_COEFFICIENT;
      break;
    case 'HIGH':
      urgency += 1.0 * PRIORITY_COEFFICIENT;
      break;
    case 'MEDIUM':
      urgency += 0.65 * PRIORITY_COEFFICIENT;
      break;
    case 'NONE':
      urgency += 0.325 * PRIORITY_COEFFICIENT;
      break;
    case 'LOWEST':
      urgency -= 0.3 * PRIORITY_COEFFICIENT;
      break;
  }

  return urgency;
}
