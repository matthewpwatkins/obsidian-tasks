export const TASKS_SECTION_HEADING = '## Tasks';

/** Snapshot copies appended by log-completions end with an origin wikilink. */
export const SNAPSHOT_BACKLINK_RE = / \(\[\[[^\]]+\]\]\)\s*$/;

const LEGACY_COMPLETIONS_BEGIN = '<!-- completions:begin -->';
const LEGACY_COMPLETIONS_END = '<!-- completions:end -->';
const LEGACY_LOGGED_HEADING = '### Logged completions';

export interface H2Section {
  header: string | null;
  lines: string[];
}

export function isLoggedSnapshotLine(line: string): boolean {
  const trimmed = line.trim();
  return /^[-*+] \[[xX]\]/i.test(trimmed) && SNAPSHOT_BACKLINK_RE.test(trimmed);
}

export function isTaskLine(line: string): boolean {
  return /^[-*+] \[[ xX/-]\]/i.test(line.trim());
}

export function splitH2Sections(content: string): H2Section[] {
  const lines = content.split(/\r?\n/);
  const sections: H2Section[] = [];
  let current: H2Section = { header: null, lines: [] };

  for (const line of lines) {
    if (/^## /.test(line)) {
      sections.push(current);
      current = { header: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

export function reassembleH2Sections(sections: H2Section[]): string {
  const parts: string[] = [];
  for (const section of sections) {
    if (section.header !== null) {
      parts.push(section.header);
    }
    parts.push(...section.lines);
  }
  return parts.join('\n');
}

function collapseBlankLines(lines: string[]): string[] {
  const result: string[] = [];
  let prevBlank = false;
  for (const line of lines) {
    const isBlank = line.trim() === '';
    if (isBlank && prevBlank) continue;
    result.push(line);
    prevBlank = isBlank;
  }
  let end = result.length;
  while (end > 0 && result[end - 1]?.trim() === '') end--;
  return result.slice(0, end);
}

function stripLegacyArtifacts(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed !== LEGACY_COMPLETIONS_BEGIN &&
      trimmed !== LEGACY_COMPLETIONS_END &&
      trimmed.toLowerCase() !== LEGACY_LOGGED_HEADING.toLowerCase()
    );
  });
}

function extractUserTaskLines(lines: string[]): string[] {
  return collapseBlankLines(
    stripLegacyArtifacts(lines).filter((line) => isTaskLine(line) && !isLoggedSnapshotLine(line)),
  );
}

function extractExistingSnapshotLines(lines: string[]): string[] {
  return stripLegacyArtifacts(lines).filter((line) => isLoggedSnapshotLine(line));
}

function buildTasksSectionLines(userLines: string[], snapshotLines: string[]): string[] {
  const parts: string[] = [];
  if (userLines.length > 0 || snapshotLines.length > 0) parts.push('');
  parts.push(...userLines);
  if (snapshotLines.length > 0) {
    if (userLines.length > 0) parts.push('');
    parts.push(...snapshotLines);
  }
  if (parts.length > 0) parts.push('');
  return parts;
}

function isTasksSection(header: string | null): boolean {
  return header?.trim().toLowerCase() === TASKS_SECTION_HEADING.toLowerCase();
}

function isLegacyTodoSection(header: string | null): boolean {
  return header?.trim().toLowerCase() === '## to do today';
}

function isLegacyDoneSection(header: string | null): boolean {
  return header?.trim().toLowerCase() === '## done today';
}

/**
 * Sync ## Tasks for a day: preserve user task lines (no origin backlink), replace
 * script-managed snapshot lines (with ` ([[origin]])` suffix) from loggedTaskLines.
 */
export function injectCompletionLog(content: string, loggedTaskLines: string[]): string {
  const sections = splitH2Sections(content);
  const tasksIdx = sections.findIndex((s) => isTasksSection(s.header));

  if (tasksIdx >= 0) {
    const section = sections[tasksIdx]!;
    const userLines = extractUserTaskLines(section.lines);
    sections[tasksIdx] = {
      header: section.header,
      lines: buildTasksSectionLines(userLines, loggedTaskLines),
    };
    return reassembleH2Sections(sections);
  }

  const todoIdx = sections.findIndex((s) => isLegacyTodoSection(s.header));
  const doneIdx = sections.findIndex((s) => isLegacyDoneSection(s.header));
  const userLines =
    todoIdx >= 0
      ? extractUserTaskLines(sections[todoIdx]!.lines)
      : ['- [ ]'];
  const legacySnapshots =
    doneIdx >= 0 ? extractExistingSnapshotLines(sections[doneIdx]!.lines) : [];
  const snapshotLines =
    loggedTaskLines.length > 0 ? loggedTaskLines : legacySnapshots;

  const newSections: H2Section[] = [];
  let inserted = false;

  for (const section of sections) {
    if (isLegacyTodoSection(section.header) || isLegacyDoneSection(section.header)) {
      if (!inserted) {
        newSections.push({
          header: TASKS_SECTION_HEADING,
          lines: buildTasksSectionLines(userLines, snapshotLines),
        });
        inserted = true;
      }
      continue;
    }
    newSections.push(section);
  }

  if (!inserted) {
    newSections.push({
      header: TASKS_SECTION_HEADING,
      lines: buildTasksSectionLines(['- [ ]'], loggedTaskLines),
    });
  }

  return reassembleH2Sections(newSections);
}

export function consolidateLegacyDailySections(content: string): string {
  const sections = splitH2Sections(content);
  if (sections.some((s) => isTasksSection(s.header))) {
    const tasksIdx = sections.findIndex((s) => isTasksSection(s.header));
    const section = sections[tasksIdx]!;
    const userLines = extractUserTaskLines(section.lines);
    const snapshots = extractExistingSnapshotLines(section.lines);
    sections[tasksIdx] = {
      header: section.header,
      lines: buildTasksSectionLines(userLines, snapshots),
    };
    return reassembleH2Sections(sections);
  }

  return injectCompletionLog(content, []);
}
