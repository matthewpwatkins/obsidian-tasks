import fs from 'fs';
import fg from 'fast-glob';
import {
  type Priority,
  type Task,
  normalizeTag,
  statusTypeFromChar,
} from './model.js';

const TASK_LINE_RE = /^(\s*)([-*+]|\d+[.)])\s+\[(.)\]\s*(.*)$/u;
const DATE_RE = /^(\d{4}-\d{2}-\d{2})$/;
const TAG_RE = /(^|\s)#([a-zA-ZáéíóúÁÉÍÓÚñÑ][\w\-/]*)/gu;

const PRIORITY_EMOJI: Record<string, Priority> = {
  '🔺': 'HIGHEST',
  '⏫': 'HIGH',
  '🔼': 'MEDIUM',
  '🔽': 'LOW',
  '⏬': 'LOWEST',
};

const DATE_FIELDS: Array<{ emoji: string; field: keyof Pick<Task, 'createdDate' | 'scheduledDate' | 'startDate' | 'dueDate' | 'doneDate' | 'cancelledDate'> }> = [
  { emoji: '➕', field: 'createdDate' },
  { emoji: '⏳', field: 'scheduledDate' },
  { emoji: '🛫', field: 'startDate' },
  { emoji: '📅', field: 'dueDate' },
  { emoji: '✅', field: 'doneDate' },
  { emoji: '❌', field: 'cancelledDate' },
];

export interface VaultScanOptions {
  vaultRoot: string;
  includeArchive?: boolean;
  includeTemplates?: boolean;
}

export function parseTaskLine(
  line: string,
  filePath: string,
  lineNumber: number,
): Task | null {
  const match = line.match(TASK_LINE_RE);
  if (!match) return null;

  const statusChar = match[3] ?? ' ';
  const statusType = statusTypeFromChar(statusChar);
  if (statusType === 'NON_TASK') return null;

  let remaining = (match[4] ?? '').trimEnd();
  let blockId: string | undefined;
  let id: string | undefined;
  let recurrence: string | undefined;
  const dependsOn: string[] = [];
  const dates: Partial<Record<string, string>> = {};
  let priority: Priority = 'NONE';

  while (remaining.length > 0) {
    const blockMatch = remaining.match(/ \^([a-zA-Z0-9-]+)$/u);
    if (blockMatch) {
      blockId = blockMatch[1];
      remaining = remaining.slice(0, blockMatch.index).trimEnd();
      continue;
    }

    let matched = false;
    for (const { emoji, field } of DATE_FIELDS) {
      const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^| )${escaped} (\\d{4}-\\d{2}-\\d{2})$`);
      const dateMatch = remaining.match(re);
      if (dateMatch?.[1] && DATE_RE.test(dateMatch[1])) {
        dates[field] = dateMatch[1];
        remaining = remaining.slice(0, dateMatch.index).trimEnd();
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const idMatch = remaining.match(/ 🆔 ([a-zA-Z0-9]+)$/);
    if (idMatch) {
      id = idMatch[1];
      remaining = remaining.slice(0, idMatch.index).trimEnd();
      continue;
    }

    const depMatch = remaining.match(/ ⛔ ([a-zA-Z0-9,]+)$/);
    if (depMatch) {
      dependsOn.push(...depMatch[1]!.split(',').map((d) => d.trim()).filter(Boolean));
      remaining = remaining.slice(0, depMatch.index).trimEnd();
      continue;
    }

    const recurMatch = remaining.match(/ 🔁 (.+)$/);
    if (recurMatch) {
      recurrence = recurMatch[1]!.trim();
      remaining = remaining.slice(0, recurMatch.index).trimEnd();
      continue;
    }

    for (const [emoji, pri] of Object.entries(PRIORITY_EMOJI)) {
      if (remaining.endsWith(` ${emoji}`) || remaining.endsWith(emoji)) {
        priority = pri;
        const idx = remaining.lastIndexOf(emoji);
        remaining = remaining.slice(0, idx).trimEnd();
        matched = true;
        break;
      }
    }
    if (matched) continue;

    break;
  }

  const description = remaining.trim();
  if (description.length === 0) {
    return null;
  }
  const tags = extractTags(description);

  return {
    description,
    rawLine: line,
    filePath,
    lineNumber,
    statusChar,
    statusType,
    priority,
    tags,
    createdDate: dates.createdDate,
    startDate: dates.startDate,
    scheduledDate: dates.scheduledDate,
    dueDate: dates.dueDate,
    doneDate: dates.doneDate,
    cancelledDate: dates.cancelledDate,
    recurrence,
    blockId,
    dependsOn,
    id,
  };
}

/** Checklist line with no meaningful description (e.g. `- [ ]` or metadata-only). */
export function isBlankTaskLine(line: string): boolean {
  if (!TASK_LINE_RE.test(line)) return false;
  return parseTaskLine(line, 'blank-check.md', 1) === null;
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(TAG_RE)) {
    if (match[2]) tags.add(normalizeTag(match[2]));
  }
  return [...tags];
}

export function parseTasksFromFile(filePath: string): Task[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const tasks: Task[] = [];
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i]!, filePath, i + 1);
    if (task) tasks.push(task);
  }
  return tasks;
}

export async function scanVault(options: VaultScanOptions): Promise<Task[]> {
  const ignore = ['*.md', '**/.*/**'];
  if (!options.includeArchive) ignore.push('Archive/**');
  if (!options.includeTemplates) ignore.push('Templates/**');

  const files = await fg(['**/*.md'], {
    cwd: options.vaultRoot,
    ignore,
    absolute: true,
  });

  const tasks: Task[] = [];
  for (const filePath of files) {
    tasks.push(...parseTasksFromFile(filePath));
  }
  return tasks;
}

export function buildTasksById(tasks: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();
  for (const task of tasks) {
    if (task.id) map.set(task.id, task);
  }
  return map;
}

export function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
