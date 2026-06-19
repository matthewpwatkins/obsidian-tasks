const ON_OR_BEFORE = '__ON_OR_BEFORE__';
const ON_OR_AFTER = '__ON_OR_AFTER__';

export function maskDatePhrases(text: string): string {
  return text
    .replace(/\bon or before\b/gi, ON_OR_BEFORE)
    .replace(/\bon or after\b/gi, ON_OR_AFTER);
}

export function unmaskDatePhrases(text: string): string {
  return text
    .replace(new RegExp(ON_OR_BEFORE, 'g'), 'on or before')
    .replace(new RegExp(ON_OR_AFTER, 'g'), 'on or after');
}

type EvalFn = (task: import('../model.js').Task) => boolean;

export function parseBooleanExpression(
  expression: string,
  buildAtom: (atom: string) => EvalFn,
): EvalFn {
  const masked = maskDatePhrases(expression.trim());
  return compileOrExpression(masked, buildAtom);
}

function compileOrExpression(expr: string, buildAtom: (atom: string) => EvalFn): EvalFn {
  const parts = splitTopLevel(expr, 'OR');
  if (parts.length === 1) {
    return compileAndExpression(parts[0]!, buildAtom);
  }
  const fns = parts.map((p) => compileAndExpression(p.trim(), buildAtom));
  return (task) => fns.some((fn) => fn(task));
}

function compileAndExpression(expr: string, buildAtom: (atom: string) => EvalFn): EvalFn {
  const parts = splitTopLevel(expr, 'AND');
  if (parts.length === 1) {
    return compileNotExpression(parts[0]!.trim(), buildAtom);
  }
  const fns = parts.map((p) => compileNotExpression(p.trim(), buildAtom));
  return (task) => fns.every((fn) => fn(task));
}

function compileNotExpression(expr: string, buildAtom: (atom: string) => EvalFn): EvalFn {
  if (/^NOT\s+/i.test(expr)) {
    const inner = compileOrExpression(expr.slice(4).trim(), buildAtom);
    return (task) => !inner(task);
  }
  return compilePrimary(expr, buildAtom);
}

function compilePrimary(expr: string, buildAtom: (atom: string) => EvalFn): EvalFn {
  const trimmed = expr.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return compileOrExpression(trimmed.slice(1, -1).trim(), buildAtom);
  }
  const atom = unmaskDatePhrases(trimmed);
  return buildAtom(atom);
}

function splitTopLevel(expr: string, op: 'OR' | 'AND'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  const opUpper = op.toUpperCase();
  const opRe = op === 'OR' ? /^OR\b/i : /^AND\b/i;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) {
      const slice = expr.slice(i);
      const match = slice.match(opRe);
      if (match) {
        parts.push(expr.slice(start, i).trim());
        i += match[0].length - 1;
        start = i + 1;
      }
    }
  }

  parts.push(expr.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}
