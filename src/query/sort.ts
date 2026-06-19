import type { Task } from '../model.js';
import { calculateUrgency } from './urgency.js';

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

function compareNullableDate(a: string | undefined, b: string | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function sortTasks(tasks: Task[], specs: SortSpec[], today: string): Task[] {
  if (specs.length === 0) {
    specs = [{ field: 'urgency', direction: 'desc' }];
  }

  return [...tasks].sort((a, b) => {
    for (const spec of specs) {
      let cmp = 0;
      switch (spec.field) {
        case 'urgency':
          cmp = calculateUrgency(a, today) - calculateUrgency(b, today);
          break;
        case 'due':
          cmp = compareNullableDate(a.dueDate, b.dueDate);
          break;
        case 'done':
          cmp = compareNullableDate(a.doneDate, b.doneDate);
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) {
        return spec.direction === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}
