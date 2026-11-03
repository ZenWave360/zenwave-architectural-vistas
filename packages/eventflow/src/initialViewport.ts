/**
 * Opening viewport for a diagram, independent of React Flow so it can be checked without a browser.
 *
 * Zoom is the scale that fits every node, with the same padding as React Flow's fitView, clamped to
 * the renderer's [minZoom, maxZoom]. It never goes below minZoom: a diagram that is still too wide
 * (or too tall) opens at that zoom.
 *
 * The anchor is the first node in `nodes` with `start: true`. Callers pass nodes in view-model order,
 * so that is the first start the view model lists that is actually drawn. The anchor is placed on the
 * left inset and its vertical centre on the viewport's vertical centre. Fit is decided against the
 * pane, not the padded rectangle. When the whole diagram fits in both dimensions, the translation is
 * pulled back so every node stays inside: the full inset where the pane has that much slack, and only
 * the slack that remains when this zoom leaves less. When it does not fit the pane in at least one
 * dimension, neither axis is clamped and the first start stays on the left inset and vertically
 * centred.
 *
 * With no start node the bounds are centred. That is React Flow's fitView, which Systems keeps.
 */

export interface ViewportNode {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The first drawn node in the list with this set is the anchor. */
  start?: boolean;
}

export interface InitialViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface InitialViewportInput {
  nodes: readonly ViewportNode[];
  viewportWidth: number;
  viewportHeight: number;
  minZoom: number;
  maxZoom: number;
  /** Fraction React Flow's fitView uses to grow the bounds. Defaults to {@link FLOW_FIT_PADDING}. */
  padding?: number;
}

/** React Flow 11's default zoom limits. The flow renderer sets these, so the opening zoom cannot go below the minimum. */
export const FLOW_MIN_ZOOM = 0.5;
export const FLOW_MAX_ZOOM = 2;

/** React Flow fitView's default padding. */
export const FLOW_FIT_PADDING = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isDrawn(node: ViewportNode): boolean {
  return Number.isFinite(node.x)
    && Number.isFinite(node.y)
    && Number.isFinite(node.width)
    && Number.isFinite(node.height)
    && node.width > 0
    && node.height > 0;
}

function boundsOf(nodes: readonly ViewportNode[]): ViewportNode | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function computeInitialViewport(input: InitialViewportInput): InitialViewport | null {
  const { viewportWidth, viewportHeight, minZoom, maxZoom } = input;

  if (!(viewportWidth > 0) || !(viewportHeight > 0) || !(maxZoom > 0)) {
    return null;
  }

  const padding = input.padding ?? FLOW_FIT_PADDING;
  const drawn = input.nodes.filter(isDrawn);
  const bounds = boundsOf(drawn);

  if (!bounds) {
    return null;
  }

  const zoom = clamp(
    Math.min(
      viewportWidth / (bounds.width * (1 + padding)),
      viewportHeight / (bounds.height * (1 + padding)),
    ),
    minZoom,
    maxZoom,
  );
  const anchor = drawn.find((node) => node.start);

  if (!anchor) {
    return {
      x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: viewportHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
      zoom,
    };
  }

  // Half of the slack a centred fit leaves when the diagram exactly fills the limiting axis.
  const insetX = viewportWidth * (padding / (1 + padding)) / 2;
  const insetY = viewportHeight * (padding / (1 + padding)) / 2;
  let x = insetX - anchor.x * zoom;
  let y = viewportHeight / 2 - (anchor.y + anchor.height / 2) * zoom;
  const fitsWidth = bounds.width * zoom <= viewportWidth + 1e-6;
  const fitsHeight = bounds.height * zoom <= viewportHeight + 1e-6;

  // Containment on one axis would pull the start off its anchor to save nodes the other axis cannot show.
  if (fitsWidth && fitsHeight) {
    // Minimum zoom can make the diagram larger than the padded rectangle while it still fits the pane.
    const padX = Math.min(insetX, Math.max(0, viewportWidth - bounds.width * zoom) / 2);
    const padY = Math.min(insetY, Math.max(0, viewportHeight - bounds.height * zoom) / 2);
    const minX = padX - bounds.x * zoom;
    const maxX = viewportWidth - padX - (bounds.x + bounds.width) * zoom;
    x = clamp(x, Math.min(minX, maxX), Math.max(minX, maxX));

    const minY = padY - bounds.y * zoom;
    const maxY = viewportHeight - padY - (bounds.y + bounds.height) * zoom;
    y = clamp(y, Math.min(minY, maxY), Math.max(minY, maxY));
  }

  return { x, y, zoom };
}
