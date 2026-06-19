import type { QueryGroup, Task } from '../model.js';

export function groupTasks(tasks: Task[], field: string): QueryGroup[] {
  if (field !== 'tags') {
    return [{ heading: null, tasks }];
  }

  const groups = new Map<string, Task[]>();
  const untagged: Task[] = [];

  for (const task of tasks) {
    if (task.tags.length === 0) {
      untagged.push(task);
      continue;
    }
    for (const tag of task.tags) {
      const list = groups.get(tag) ?? [];
      list.push(task);
      groups.set(tag, list);
    }
  }

  const result: QueryGroup[] = [];
  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    result.push({ heading: key, tasks: groups.get(key)! });
  }
  if (untagged.length > 0) {
    result.push({ heading: '(no tags)', tasks: untagged });
  }
  return result;
}
