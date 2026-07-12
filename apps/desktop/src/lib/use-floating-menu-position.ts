import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

const VIEWPORT_PADDING = 12;

export function useFloatingMenuPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  align: "start" | "end" = "start",
) {
  const [position, setPosition] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      const content = contentRef.current;
      if (!anchor || !content) {
        return;
      }

      const triggerRect = anchor.getBoundingClientRect();
      const contentWidth = content.offsetWidth;
      const contentHeight = content.offsetHeight;
      const maxLeft = window.innerWidth - contentWidth - VIEWPORT_PADDING;

      let left =
        align === "end" ? triggerRect.right - contentWidth : triggerRect.left;

      if (left + contentWidth > window.innerWidth - VIEWPORT_PADDING) {
        left = triggerRect.right - contentWidth;
      }
      if (left < VIEWPORT_PADDING) {
        left = triggerRect.left;
      }
      left = Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft));

      let top = triggerRect.bottom + 8;
      if (top + contentHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = triggerRect.top - contentHeight - 8;
      }
      top = Math.max(VIEWPORT_PADDING, top);

      setPosition({
        position: "fixed",
        top,
        left,
        right: "auto",
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, anchorRef, contentRef]);

  return position;
}
