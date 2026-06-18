import { useState, useRef, useCallback, useEffect } from 'react';

export function useHoverPreview(delay = 300) {
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef(null);
  const hideTimer = useRef(null);

  const showPreview = useCallback((e) => {
    clearTimeout(hideTimer.current);
    clearTimeout(hoverTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimer.current = setTimeout(() => {
      let x = rect.right + 8;
      let y = rect.top;
      if (x + 340 > window.innerWidth) {
        x = rect.left - 348;
        if (x < 8) x = 8;
      }
      if (y + 260 > window.innerHeight) {
        y = window.innerHeight - 270;
      }
      if (y < 8) y = 8;
      setPosition({ x, y });
      setVisible(true);
    }, delay);
  }, [delay]);

  const hidePreview = useCallback(() => {
    clearTimeout(hoverTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!pinned) setVisible(false);
    }, 200);
  }, [pinned]);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  const togglePin = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setPinned((p) => !p);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setPinned(false);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  return {
    visible,
    position,
    pinned,
    triggerProps: {
      onMouseEnter: showPreview,
      onMouseLeave: hidePreview,
      onClick: togglePin,
    },
    previewProps: {
      onMouseEnter: cancelHide,
      onMouseLeave: hidePreview,
      onClose: close,
    },
  };
}
