import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import type { Task } from './model.js';
import { resolveDailyNotePath } from './config.js';
import { parseTasksFromFile, scanVault } from './parse.js';
import { queryTasks } from './query/execute.js';
import { injectCompletionLog, renderTaskLine } from './render.js';

export function findDoneTasksForDate(tasks: Task[], date: string, excludeFilePath?: string): Task[] {
  const query = `done on ${date}`;
  const result = queryTasks(tasks, query, { today: date });
  const done = result.groups.flatMap((g) => g.tasks);

  if (!excludeFilePath) return done;
  const normalizedExclude = path.resolve(excludeFilePath);
  return done.filter((t) => path.resolve(t.filePath) !== normalizedExclude);
}

export function buildCompletionLogLines(
  tasks: Task[],
  vaultRoot: string,
  includeBacklinks = true,
): string[] {
  return tasks.map((t) =>
    renderTaskLine(t, { vaultRoot, includeBacklinks }),
  );
}

export interface LogCompletionsOptions {
  vaultRoot: string;
  date: string;
  dryRun?: boolean;
}

export function logCompletionsForDate(options: LogCompletionsOptions): { filePath: string; content: string; changed: boolean } | null {
  const dailyPath = resolveDailyNotePath(options.vaultRoot, options.date);
  if (!dailyPath || !fs.existsSync(dailyPath)) {
    return null;
  }

  return logCompletionsForFile({
    ...options,
    filePath: dailyPath,
  });
}

export interface LogCompletionsForFileOptions extends LogCompletionsOptions {
  filePath: string;
}

export async function loadVaultTasks(vaultRoot: string): Promise<Task[]> {
  return scanVault({ vaultRoot, includeArchive: true });
}

export async function logCompletionsForFileAsync(
  options: LogCompletionsForFileOptions,
): Promise<{ filePath: string; content: string; changed: boolean }> {
  const tasks = await scanVault({ vaultRoot: options.vaultRoot, includeArchive: true });
  return applyCompletionLog(tasks, options);
}

export function logCompletionsForFile(
  options: LogCompletionsForFileOptions,
): { filePath: string; content: string; changed: boolean } {
  const tasks = scanVaultSync(options.vaultRoot);
  return applyCompletionLog(tasks, options);
}

export function syncCompletionsForChangedFile(
  vaultRoot: string,
  changedFilePath: string,
  dryRun = false,
): { updated: string[] } {
  const resolved = path.resolve(changedFilePath);
  const rel = path.relative(vaultRoot, resolved).replace(/\\/g, '/');

  if (/^Timeline\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2} .+\.md$/i.test(rel)) {
    return { updated: [] };
  }

  const tasks = parseTasksFromFile(resolved);
  const dates = new Set<string>();
  for (const task of tasks) {
    if (task.doneDate && (task.statusType === 'DONE' || task.statusType === 'CANCELLED')) {
      dates.add(task.doneDate);
    }
  }

  const updated: string[] = [];
  for (const date of [...dates].sort()) {
    const result = logCompletionsForDate({ vaultRoot, date, dryRun });
    if (result?.changed) {
      updated.push(path.relative(vaultRoot, result.filePath));
    }
  }

  return { updated };
}

function applyCompletionLog(
  tasks: Task[],
  options: LogCompletionsForFileOptions,
): { filePath: string; content: string; changed: boolean } {
  const doneTasks = findDoneTasksForDate(tasks, options.date, options.filePath);
  const lines = buildCompletionLogLines(doneTasks, options.vaultRoot);

  const original = fs.readFileSync(options.filePath, 'utf8');
  const updated = injectCompletionLog(original, lines);
  const changed = updated !== original;

  if (!options.dryRun && changed) {
    fs.writeFileSync(options.filePath, updated, 'utf8');
  }

  return { filePath: options.filePath, content: updated, changed };
}

function scanVaultSync(vaultRoot: string): Task[] {
  const ignore = ['*.md', '**/.*/**'];
  const files = fg.sync(['**/*.md'], {
    cwd: vaultRoot,
    ignore,
    absolute: true,
  }) as string[];

  const tasks: Task[] = [];
  for (const filePath of files) {
    tasks.push(...parseTasksFromFile(filePath));
  }
  return tasks;
}

export function getCatchUpDates(lastRunDate: string | null, throughDate: string): string[] {
  const dates: string[] = [];
  if (!lastRunDate) {
    return [throughDate];
  }
  let current = addDays(lastRunDate, 1);
  while (current <= throughDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  return formatDate(dt);
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function yesterday(today: string): string {
  return addDays(today, -1);
}
