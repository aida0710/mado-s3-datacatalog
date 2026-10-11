// Room kept between a dropdown and the window edges, so it never touches or crosses them.
export const DROPDOWN_VIEWPORT_MARGIN = 8;
// Gap between the button that opens a dropdown and the dropdown.
const DROPDOWN_ANCHOR_GAP = 4;
// Below this much room under the button, a dropdown opens upward when there is more room above.
const DROPDOWN_MIN_HEIGHT_BELOW = 200;

export interface DropdownAnchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/** Where a dropdown with position: fixed goes. Exactly one of top and bottom is set. */
export interface DropdownPlacement {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/**
 * Places a dropdown under its button (`anchor`, in viewport coordinates) and keeps it inside the
 * window: at least as wide as the button and `minWidth` unless the window is narrower, moved left
 * when it would cross the right edge, and opened upward when there is little room below.
 */
export function placeDropdown({
  anchor,
  viewport,
  minWidth,
  maxHeight,
}: {
  anchor: DropdownAnchor;
  viewport: { width: number; height: number };
  minWidth: number;
  maxHeight: number;
}): DropdownPlacement {
  const widestFit = Math.max(0, viewport.width - 2 * DROPDOWN_VIEWPORT_MARGIN);
  const width = Math.min(Math.max(anchor.width, minWidth), widestFit);
  const rightmostLeft = viewport.width - DROPDOWN_VIEWPORT_MARGIN - width;
  const left = Math.max(DROPDOWN_VIEWPORT_MARGIN, Math.min(anchor.left, rightmostLeft));
  const roomBelow =
    viewport.height - anchor.bottom - DROPDOWN_ANCHOR_GAP - DROPDOWN_VIEWPORT_MARGIN;
  const roomAbove = anchor.top - DROPDOWN_ANCHOR_GAP - DROPDOWN_VIEWPORT_MARGIN;
  const opensUpward = roomBelow < DROPDOWN_MIN_HEIGHT_BELOW && roomAbove > roomBelow;
  if (opensUpward)
    return {
      left,
      width,
      maxHeight: Math.min(maxHeight, roomAbove),
      bottom: viewport.height - anchor.top + DROPDOWN_ANCHOR_GAP,
    };
  return {
    left,
    width,
    maxHeight: Math.max(0, Math.min(maxHeight, roomBelow)),
    top: anchor.bottom + DROPDOWN_ANCHOR_GAP,
  };
}
