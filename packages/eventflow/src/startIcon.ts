// Which icon a START node draws (EF-R17). Free of React so a test can load it.

export type StartKind = 'actor' | 'timer' | 'system';

export function getStartIconKind(startKind: string | null | undefined): StartKind | null {
  if (startKind === 'actor' || startKind === 'timer' || startKind === 'system') return startKind;
  return null;
}
