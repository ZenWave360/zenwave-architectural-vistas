import type { TextEdit } from './adapter.ts';

/** Same contract as dsl-kotlin's applyEdits: UTF-16 offsets into the source the edits were prepared for. */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let out = '';
  for (const edit of sorted) {
    if (![edit.start, edit.end].every((n) => Number.isInteger(n) && n >= 0) || edit.start > edit.end || edit.end > source.length) throw new Error(`Edit ${edit.start}..${edit.end} is outside the source`);
    if (edit.start < cursor) throw new Error('Overlapping edits');
    out += source.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  return out + source.slice(cursor);
}
