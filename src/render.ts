import type { QueryResult, Task } from './model.js';
import { relativePathWithoutExt } from './config.js';
import { injectCompletionLog } from './sections.js';

export interface RenderOptions {
  vaultRoot?: string;
  includeBacklinks?: boolean;
}

export function renderTaskLine(task: Task, options: RenderOptions = {}): string {
  if (options.includeBacklinks !== false && options.vaultRoot) {
    const rel = relativePathWithoutExt(task.filePath, options.vaultRoot);
    return `${task.rawLine} ([[${rel}]])`;
  }
  return task.rawLine;
}

export function renderTasksToMarkdown(result: QueryResult, options: RenderOptions = {}): string {
  const lines: string[] = [];

  for (const group of result.groups) {
    if (group.heading !== null) {
      lines.push(`### ${group.heading}`);
      lines.push('');
    }
    for (const task of group.tasks) {
      lines.push(renderTaskLine(task, options));
    }
    if (group.tasks.length > 0) {
      lines.push('');
    }
  }

  if (result.totalCount === 0) {
    return '';
  }

  return lines.join('\n').trimEnd();
}

const TASKS_FENCE_RE = /```tasks\r?\n([\s\S]*?)```/g;

export function renderFile(markdown: string, renderFence: (queryText: string) => string): string {
  return markdown.replace(TASKS_FENCE_RE, (_match, queryText: string) => {
    const rendered = renderFence(queryText.trim());
    return rendered.length > 0 ? rendered + '\n' : '';
  });
}

export { injectCompletionLog, isLoggedSnapshotLine, TASKS_SECTION_HEADING } from './sections.js';
