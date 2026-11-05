export type LanesMode = 'none' | 'systems' | 'services';

export function isLanesMode(value: unknown): value is LanesMode {
  return value === 'none' || value === 'systems' || value === 'services';
}

export interface DiagramDisplaySettings {
  humanizeLabels?: boolean;
  /** Requested server layout. Bands in the graph describe the layout actually on screen. */
  lanes?: LanesMode;
}

function splitIdentifierWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function humanizeLabel(label: string): string {
  return label
    .split(':')
    .map((segment) => splitIdentifierWords(segment))
    .join(': ');
}

export function humanizeMultilineLabel(label: string): string {
  return label
    .split('\n')
    .map((line) => humanizeLabel(line))
    .join('\n');
}
