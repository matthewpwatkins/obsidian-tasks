import type { QueryContext, QueryResult, Task } from '../model.js';
import { buildTasksById } from '../parse.js';
import { buildFilterFromLines } from './filters.js';
import { groupTasks } from './group.js';
import { extractFilterLines, parseQueryInstructions, type ParsedInstruction } from './grammar.js';
import { sortTasks, type SortSpec } from './sort.js';

export interface QueryOptions {
  today?: string;
  vaultRoot?: string;
}

export function queryTasks(tasks: Task[], queryText: string, options: QueryOptions = {}): QueryResult {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const tasksById = buildTasksById(tasks);
  const ctx: QueryContext = { today, allTasks: tasks, tasksById };

  const instructions = parseQueryInstructions(queryText);
  const filterLines = extractFilterLines(instructions);
  const filterFn = buildFilterFromLines(filterLines, ctx);

  let filtered = tasks.filter(filterFn);

  const sortSpecs: SortSpec[] = instructions
    .filter((i) => i.kind === 'sort')
    .map((i) => ({
      field: i.sortField ?? 'urgency',
      direction: i.sortDirection ?? 'desc',
    }));

  filtered = sortTasks(filtered, sortSpecs, today);

  const groupInstruction = instructions.find((i) => i.kind === 'group');
  let groups = groupInstruction
    ? groupTasks(filtered, groupInstruction.groupField ?? 'tags')
    : [{ heading: null, tasks: filtered }];

  const limitInstruction = instructions.find((i) => i.kind === 'limit');
  if (limitInstruction?.limit !== undefined) {
    let remaining = limitInstruction.limit;
    const limited: typeof groups = [];
    for (const group of groups) {
      if (remaining <= 0) break;
      const slice = group.tasks.slice(0, remaining);
      remaining -= slice.length;
      limited.push({ heading: group.heading, tasks: slice });
    }
    groups = limited;
  }

  const totalCount = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  return { groups, totalCount };
}

export { parseQueryInstructions, type ParsedInstruction };
