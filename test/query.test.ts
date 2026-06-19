import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { parseTaskLine } from '../src/parse.js';
import { queryTasks } from '../src/query/execute.js';
import { calculateUrgency } from '../src/query/urgency.js';
import { scanVault } from '../src/parse.js';
import { renderFile, renderTasksToMarkdown } from '../src/render.js';
import { findDoneTasksForDate, logCompletionsForFile } from '../src/completions.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureVault = path.join(__dirname, 'fixtures', 'vault');

describe('parseTaskLine', () => {
  it('parses emoji dates and priority', () => {
    const task = parseTaskLine('- [ ] Work item ⏫ 📅 2026-06-20', 'test.md', 1);
    expect(task?.priority).toBe('HIGH');
    expect(task?.dueDate).toBe('2026-06-20');
  });

  it('parses dependencies and ids', () => {
    const blocker = parseTaskLine('- [ ] First 🆔 abc123', 'test.md', 1);
    const blocked = parseTaskLine('- [ ] Second ⛔ abc123', 'test.md', 2);
    expect(blocker?.id).toBe('abc123');
    expect(blocked?.dependsOn).toEqual(['abc123']);
  });

  it('parses in-progress status', () => {
    const task = parseTaskLine('- [/] Active task', 'test.md', 1);
    expect(task?.statusType).toBe('IN_PROGRESS');
  });

  it('parses done date', () => {
    const task = parseTaskLine('- [x] Done ✅ 2026-06-18', 'test.md', 1);
    expect(task?.statusType).toBe('DONE');
    expect(task?.doneDate).toBe('2026-06-18');
  });

  it('skips blank checkbox placeholders', () => {
    expect(parseTaskLine('- [ ]', 'Timeline/2026/06/2026-06-18 Thu.md', 1)).toBeNull();
    expect(parseTaskLine('- [ ] ⏳ 2026-06-18', 'daily.md', 1)).toBeNull();
  });
});

describe('query engine', () => {
  const today = '2026-06-18';

  it('filters not done', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(tasks, 'not done', { today });
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.groups[0]!.tasks.every((t) => t.statusType !== 'DONE')).toBe(true);
  });

  it('filters tag includes with OR', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(
      tasks,
      '(tag includes te-1-secs OR tag includes te-2-mins)\nnot done',
      { today },
    );
    expect(result.totalCount).toBe(2);
  });

  it('masks on or before in OR expressions', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(
      tasks,
      '(due on or before today) OR (no due date)\nnot done',
      { today },
    );
    expect(result.totalCount).toBeGreaterThan(0);
  });

  it('filters is not blocked', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(tasks, 'is not blocked\nnot done', { today });
    const descriptions = result.groups.flatMap((g) => g.tasks.map((t) => t.description));
    expect(descriptions.some((d) => d.includes('Blocked by dependency'))).toBe(false);
  });

  it('sorts by urgency desc', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(tasks, 'not done\nsort by urgency desc', { today });
    const urgencies = result.groups[0]!.tasks.map((t) => calculateUrgency(t, today));
    for (let i = 1; i < urgencies.length; i++) {
      expect(urgencies[i - 1]!).toBeGreaterThanOrEqual(urgencies[i]!);
    }
  });

  it('applies limit', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(tasks, 'not done\nlimit 2', { today });
    expect(result.totalCount).toBe(2);
  });

  it('filters done on date', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const result = queryTasks(tasks, 'done on 2026-06-18', { today });
    expect(result.totalCount).toBe(2);
  });
});

describe('renderFile', () => {
  it('replaces tasks fences', async () => {
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const md = fs.readFileSync(path.join(fixtureVault, 'TASKS.md'), 'utf8');
    const output = renderFile(md, (queryText) => {
      const result = queryTasks(tasks, queryText, { today: '2026-06-18' });
      return renderTasksToMarkdown(result, { vaultRoot: fixtureVault });
    });
    expect(output).not.toContain('```tasks');
    expect(output).toContain('- [/] In progress task');
  });
});

describe('log-completions idempotency', () => {
  it('rewrites marker block without duplicating', async () => {
    const dailyPath = path.join(fixtureVault, 'Timeline', '2026', '06', '2026-06-18 Wed.md');
    const tasks = await scanVault({ vaultRoot: fixtureVault });
    const done = findDoneTasksForDate(tasks, '2026-06-18', dailyPath);
    expect(done.some((t) => t.description.includes('Completed today'))).toBe(true);
    expect(done.some((t) => t.description.includes('Done in daily note'))).toBe(false);

    const first = logCompletionsForFile({
      vaultRoot: fixtureVault,
      date: '2026-06-18',
      filePath: dailyPath,
      dryRun: true,
    });
    const second = logCompletionsForFile({
      vaultRoot: fixtureVault,
      date: '2026-06-18',
      filePath: dailyPath,
      dryRun: true,
    });
    expect(first.content).toBe(second.content);
  });
});

describe('urgency formula', () => {
  it('matches documented due-today medium score components', () => {
    const task = parseTaskLine('- [ ] #task 🔼 📅 2026-06-18', 't.md', 1)!;
    const urgency = calculateUrgency(task, '2026-06-18');
    expect(urgency).toBeCloseTo(8.8 + 3.9, 1);
  });
});
