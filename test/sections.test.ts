import path from 'path';
import { describe, expect, it } from 'vitest';
import { injectCompletionLog, isLoggedSnapshotLine } from '../src/sections.js';

describe('injectCompletionLog', () => {
  it('keeps user tasks and appends snapshot lines without subheadings', () => {
    const content = `## Tasks

- [ ] Call dentist
- [x] Finished here ✅ 2026-06-18

## Journal
`;
    const snapshots = [
      '- [x] Laundry ✅ 2026-06-18 ([[Areas/Chores/Chores - Tasks]])',
    ];
    const updated = injectCompletionLog(content, snapshots);
    expect(updated).toContain('- [ ] Call dentist');
    expect(updated).toContain('- [x] Finished here ✅ 2026-06-18');
    expect(updated).toContain('- [x] Laundry ✅ 2026-06-18 ([[Areas/Chores/Chores - Tasks]])');
    expect(updated).not.toContain('Logged completions');
    expect(updated).not.toContain('completions:begin');
  });

  it('replaces old snapshot lines on re-sync', () => {
    const first = injectCompletionLog(
      `## Tasks

- [ ] One thing

## Journal
`,
      ['- [x] Old ✅ 2026-06-18 ([[Areas/A]])'],
    );
    const second = injectCompletionLog(first, [
      '- [x] New ✅ 2026-06-18 ([[Areas/B]])',
    ]);
    expect(second).toContain('- [ ] One thing');
    expect(second).not.toContain('([[Areas/A]])');
    expect(second).toContain('([[Areas/B]])');
    expect((second.match(/\(\[\[Areas\/B\]\]\)/g) ?? []).length).toBe(1);
  });

  it('merges legacy To Do Today and Done Today sections', () => {
    const legacy = `## To Do Today

- [ ] Plan day

## Done Today

- [x] External ✅ 2026-06-18 ([[Areas/X]])

## Journal
`;
    const updated = injectCompletionLog(legacy, []);
    expect(updated).toContain('## Tasks');
    expect(updated).not.toContain('## To Do Today');
    expect(updated).not.toContain('## Done Today');
    expect(updated).toContain('- [ ] Plan day');
    expect(updated).toContain('([[Areas/X]])');
  });

  it('identifies snapshot lines by origin backlink suffix', () => {
    expect(isLoggedSnapshotLine('- [x] Laundry ([[Areas/Chores]])')).toBe(true);
    expect(isLoggedSnapshotLine('- [x] Done here ✅ 2026-06-18')).toBe(false);
  });
});
