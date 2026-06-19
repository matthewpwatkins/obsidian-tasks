import path from 'path';
import {
  type QueryContext,
  type Task,
  isBlocked,
  isDoneOrCancelled,
  normalizeTag,
  priorityFromName,
  statusTypeFromName,
} from '../model.js';
import { parseBooleanExpression } from './boolean.js';

function resolveDate(value: string, today: string): string {
  if (value.toLowerCase() === 'today') return today;
  return value;
}

function compareDates(a: string, b: string): number {
  return a.localeCompare(b);
}

function hasDate(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function buildAtomFilter(atom: string, ctx: QueryContext): (task: Task) => boolean {
  const lower = atom.toLowerCase().trim();

  if (lower === 'not done') return (t) => !isDoneOrCancelled(t);
  if (lower === 'done') return (t) => isDoneOrCancelled(t);
  if (lower === 'is not blocked') return (t) => !isBlocked(t, ctx.tasksById);

  const doneOn = atom.match(/^done on (\S+)$/i);
  if (doneOn) {
    const date = resolveDate(doneOn[1]!, ctx.today);
    return (t) => t.doneDate === date;
  }

  const doneAfter = atom.match(/^done after (\S+)$/i);
  if (doneAfter) {
    const date = resolveDate(doneAfter[1]!, ctx.today);
    return (t) => hasDate(t.doneDate) && compareDates(t.doneDate, date) > 0;
  }

  const doneBefore = atom.match(/^done before (\S+)$/i);
  if (doneBefore) {
    const date = resolveDate(doneBefore[1]!, ctx.today);
    return (t) => hasDate(t.doneDate) && compareDates(t.doneDate, date) < 0;
  }

  const statusIs = atom.match(/^status\.type is (not )?(\S+)$/i);
  if (statusIs) {
    const negated = !!statusIs[1];
    const type = statusTypeFromName(statusIs[2]!);
    if (!type) throw new Error(`Unknown status type: ${statusIs[2]}`);
    return (t) => (t.statusType === type) !== negated;
  }

  const dueOnOrBefore = atom.match(/^due on or before (\S+)$/i);
  if (dueOnOrBefore) {
    const date = resolveDate(dueOnOrBefore[1]!, ctx.today);
    return (t) => hasDate(t.dueDate) && compareDates(t.dueDate, date) <= 0;
  }

  const dueAfter = atom.match(/^due after (\S+)$/i);
  if (dueAfter) {
    const date = resolveDate(dueAfter[1]!, ctx.today);
    return (t) => hasDate(t.dueDate) && compareDates(t.dueDate, date) > 0;
  }

  const dueBefore = atom.match(/^due before (\S+)$/i);
  if (dueBefore) {
    const date = resolveDate(dueBefore[1]!, ctx.today);
    return (t) => hasDate(t.dueDate) && compareDates(t.dueDate, date) < 0;
  }

  if (lower === 'no due date') return (t) => !hasDate(t.dueDate);

  const scheduledOnOrBefore = atom.match(/^scheduled on or before (\S+)$/i);
  if (scheduledOnOrBefore) {
    const date = resolveDate(scheduledOnOrBefore[1]!, ctx.today);
    return (t) => hasDate(t.scheduledDate) && compareDates(t.scheduledDate, date) <= 0;
  }

  const scheduledAfter = atom.match(/^scheduled after (\S+)$/i);
  if (scheduledAfter) {
    const date = resolveDate(scheduledAfter[1]!, ctx.today);
    return (t) => hasDate(t.scheduledDate) && compareDates(t.scheduledDate, date) > 0;
  }

  if (lower === 'no scheduled date') return (t) => !hasDate(t.scheduledDate);

  const createdOnOrBefore = atom.match(/^created on or before (\S+)$/i);
  if (createdOnOrBefore) {
    const date = resolveDate(createdOnOrBefore[1]!, ctx.today);
    return (t) => hasDate(t.createdDate) && compareDates(t.createdDate, date) <= 0;
  }

  if (lower === 'no created date') return (t) => !hasDate(t.createdDate);

  const startsOnOrBefore = atom.match(/^starts on or before (\S+)$/i);
  if (startsOnOrBefore) {
    const date = resolveDate(startsOnOrBefore[1]!, ctx.today);
    return (t) => hasDate(t.startDate) && compareDates(t.startDate, date) <= 0;
  }

  const startsBeforeToday = atom.match(/^starts before today$/i);
  if (startsBeforeToday) {
    return (t) => hasDate(t.startDate) && compareDates(t.startDate, ctx.today) < 0;
  }

  const startsToday = atom.match(/^starts today$/i);
  if (startsToday) {
    return (t) => t.startDate === ctx.today;
  }

  if (lower === 'no start date') return (t) => !hasDate(t.startDate);

  const pathIncludes = atom.match(/^path (does not )?includes? (.+)$/i);
  if (pathIncludes) {
    const negated = !!pathIncludes[1];
    const needle = pathIncludes[2]!.trim();
    return (t) => {
      const relFromVault = t.filePath.replace(/\\/g, '/');
      const found = relFromVault.includes(needle);
      return found !== negated;
    };
  }

  const folderIncludes = atom.match(/^folder (does not )?includes? (.+)$/i);
  if (folderIncludes) {
    const negated = !!folderIncludes[1];
    const needle = folderIncludes[2]!.trim();
    return (t) => {
      const dir = path.dirname(t.filePath).replace(/\\/g, '/');
      const found = dir.includes(needle);
      return found !== negated;
    };
  }

  const tagIncludes = atom.match(/^tag (does not )?includes? (.+)$/i);
  if (tagIncludes) {
    const negated = !!tagIncludes[1];
    const tag = normalizeTag(tagIncludes[2]!.trim());
    return (t) => {
      const found = t.tags.some((tg) => tg === tag || tg.includes(tag));
      return found !== negated;
    };
  }

  const tagsDoNotInclude = atom.match(/^tags do not include (.+)$/i);
  if (tagsDoNotInclude) {
    const tag = normalizeTag(tagsDoNotInclude[1]!.trim());
    return (t) => !t.tags.some((tg) => tg === tag);
  }

  const priorityIs = atom.match(/^priority is (\S+)$/i);
  if (priorityIs) {
    const p = priorityFromName(priorityIs[1]!);
    if (!p) throw new Error(`Unknown priority: ${priorityIs[1]}`);
    return (t) => t.priority === p;
  }

  throw new Error(`Unsupported filter: ${atom}`);
}

export function buildFilterFromLines(filterLines: string[], ctx: QueryContext): (task: Task) => boolean {
  const lineFilters = filterLines.map((line) =>
    parseBooleanExpression(line, (atom) => buildAtomFilter(atom, ctx)),
  );
  return (task) => lineFilters.every((fn) => fn(task));
}
