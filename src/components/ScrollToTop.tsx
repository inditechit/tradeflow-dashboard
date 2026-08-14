import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll window + layout main panels to top on every route change. */
function scrollPageToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document
    .querySelectorAll("main.overflow-y-auto, .admin-main-panel, .app-shell main")
    .forEach((el) => {
      if (el instanceof HTMLElement) el.scrollTop = 0;
    });
}

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  return null;
}
