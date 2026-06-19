export type StatusType = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'NON_TASK';

export type Priority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'NONE' | 'LOW' | 'LOWEST';

export interface Task {
  description: string;
  rawLine: string;
  filePath: string;
  lineNumber: number;
  statusChar: string;
  statusType: StatusType;
  priority: Priority;
  tags: string[];
  createdDate?: string;
  startDate?: string;
  scheduledDate?: string;
  dueDate?: string;
  doneDate?: string;
  cancelledDate?: string;
  recurrence?: string;
  blockId?: string;
  dependsOn: string[];
  id?: string;
}

export interface QueryContext {
  today: string;
  allTasks: Task[];
  tasksById: Map<string, Task>;
}

export interface QueryGroup {
  heading: string | null;
  tasks: Task[];
}

export interface QueryResult {
  groups: QueryGroup[];
  totalCount: number;
}

const STATUS_MAP: Record<string, StatusType> = {
  ' ': 'TODO',
  '/': 'IN_PROGRESS',
  x: 'DONE',
  X: 'DONE',
  '-': 'CANCELLED',
};

export function statusTypeFromChar(char: string | undefined): StatusType {
  if (char === undefined) return 'NON_TASK';
  return STATUS_MAP[char] ?? 'NON_TASK';
}

export function isDoneOrCancelled(task: Task): boolean {
  return task.statusType === 'DONE' || task.statusType === 'CANCELLED';
}

export function isBlocked(task: Task, tasksById: Map<string, Task>): boolean {
  for (const depId of task.dependsOn) {
    const dep = tasksById.get(depId);
    if (dep && !isDoneOrCancelled(dep)) {
      return true;
    }
  }
  return false;
}

export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').toLowerCase();
}

export function priorityFromName(name: string): Priority | null {
  const map: Record<string, Priority> = {
    highest: 'HIGHEST',
    high: 'HIGH',
    medium: 'MEDIUM',
    none: 'NONE',
    low: 'LOW',
    lowest: 'LOWEST',
  };
  return map[name.toLowerCase()] ?? null;
}

export function statusTypeFromName(name: string): StatusType | null {
  const upper = name.toUpperCase().replace(/\s+/g, '_');
  const valid: StatusType[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NON_TASK'];
  return valid.includes(upper as StatusType) ? (upper as StatusType) : null;
}
