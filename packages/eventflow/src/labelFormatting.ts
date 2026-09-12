export interface DiagramDisplaySettings {
  humanizeLabels?: boolean;
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
