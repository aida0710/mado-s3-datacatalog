import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { placeDropdown, type DropdownAlignment } from './dropdownPlacement';

// Browsers without the Popover API still show the element in place with position: fixed; it may
// then be clipped by a scrolling ancestor such as the sidebar.
function supportsPopover(element: HTMLElement): boolean {
  return typeof element.showPopover === 'function';
}

/**
 * Shows the element in `popoverRef` (with popover="manual") in the top layer while `isOpen`, so
 * neither the sidebar's overflow nor the content's stacking hides it, and keeps it next to the
 * element in `anchorRef` inside the window as the window resizes or scrolls. Returns its style.
 */
export function useAnchoredPopover({
  isOpen,
  anchorRef,
  popoverRef,
  minWidth,
  maxHeight,
  alignment = 'start',
}: {
  isOpen: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  minWidth: number;
  maxHeight: number;
  alignment?: DropdownAlignment;
}): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!isOpen || !anchor || !popover) return;
    if (supportsPopover(popover) && !popover.matches(':popover-open')) popover.showPopover();
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setStyle(
        placeDropdown({
          anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          minWidth,
          maxHeight,
          alignment,
        }),
      );
    };
    place();
    window.addEventListener('resize', place);
    // Capture also hears scrolling inside the sidebar, which moves the anchor too.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (supportsPopover(popover) && popover.matches(':popover-open')) popover.hidePopover();
    };
  }, [isOpen, anchorRef, popoverRef, minWidth, maxHeight, alignment]);
  return isOpen ? style : undefined;
}
