// ZVE-R17: a value is committed on Enter or on leaving the field, never per keystroke; Escape cancels. Blur after Escape
// (the field blurs itself) or after Enter must not commit again. Pure, so it is tested without a DOM.
export interface CommitField {
  readonly value: string;
  change(value: string): void;
  enter(): void;
  blur(): void;
  escape(): void;
}

export function createCommitField(initial: string, onCommit: (value: string) => void): CommitField {
  let value = initial;
  let committed = initial;
  let cancelled = false;
  const commit = () => {
    const next = value.trim();
    if (next === committed) return;
    committed = next;
    onCommit(next);
  };
  return {
    get value() { return value; },
    change(next) { cancelled = false; value = next; },
    enter() { commit(); },
    blur() {
      if (cancelled) { cancelled = false; return; }
      commit();
    },
    escape() { value = committed; cancelled = true; },
  };
}
