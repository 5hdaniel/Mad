/**
 * InfoTooltip — click-to-show tooltip with portal rendering.
 * Auto-dismisses after 3 seconds. Only one tooltip open at a time.
 */
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

let activeTooltipClose: (() => void) | null = null;

export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (show) {
      setShow(false);
      activeTooltipClose = null;
      return;
    }
    if (activeTooltipClose) activeTooltipClose();
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.top - 8,
        left: Math.min(rect.left, window.innerWidth - 220),
      });
    }
    setShow(true);
    activeTooltipClose = () => setShow(false);
  };

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setShow(false);
      activeTooltipClose = null;
    }, 3000);
    const close = () => {
      setShow(false);
      activeTooltipClose = null;
    };
    window.addEventListener("scroll", close, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", close, true);
    };
  }, [show]);

  return (
    <>
      <span ref={iconRef} className="inline-flex items-center ml-1.5 cursor-help" onClick={handleClick}>
        <svg
          className={`w-4 h-4 transition-colors ${show ? "text-purple-500" : "text-gray-400 hover:text-purple-500"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeLinecap="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
        </svg>
      </span>
      {show && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] px-3 py-2 rounded-lg bg-gray-900 text-white text-xs normal-case tracking-normal shadow-lg w-52 text-center"
          style={{ top: pos.top, left: pos.left, transform: "translateY(-100%)" }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
