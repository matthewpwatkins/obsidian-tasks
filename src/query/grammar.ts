export type InstructionKind = 'filter' | 'sort' | 'group' | 'limit' | 'ignore';

export interface ParsedInstruction {
  kind: InstructionKind;
  raw: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  groupField?: string;
  limit?: number;
}

export function parseQueryInstructions(queryText: string): ParsedInstruction[] {
  const lines = queryText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const instructions: ParsedInstruction[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith('sort by ')) {
      const rest = line.slice('sort by '.length).trim();
      const parts = rest.split(/\s+/);
      const field = parts[0]?.toLowerCase() ?? 'urgency';
      let direction: 'asc' | 'desc' = field === 'urgency' ? 'desc' : 'asc';
      const dirWord = parts[parts.length - 1]?.toLowerCase();
      if (dirWord === 'asc' || dirWord === 'desc') {
        direction = dirWord;
      }
      instructions.push({ kind: 'sort', raw: line, sortField: field, sortDirection: direction });
      continue;
    }

    if (lower.startsWith('group by ')) {
      const field = line.slice('group by '.length).trim().toLowerCase();
      instructions.push({ kind: 'group', raw: line, groupField: field });
      continue;
    }

    if (lower.startsWith('limit ')) {
      const n = parseInt(line.slice('limit '.length).trim(), 10);
      instructions.push({ kind: 'limit', raw: line, limit: Number.isFinite(n) ? n : undefined });
      continue;
    }

    if (
      lower.startsWith('show ') ||
      lower.startsWith('hide ') ||
      lower.startsWith('explain') ||
      lower.startsWith('preset ')
    ) {
      instructions.push({ kind: 'ignore', raw: line });
      continue;
    }

    instructions.push({ kind: 'filter', raw: line });
  }

  return instructions;
}

export function extractFilterLines(instructions: ParsedInstruction[]): string[] {
  return instructions.filter((i) => i.kind === 'filter').map((i) => i.raw);
}
