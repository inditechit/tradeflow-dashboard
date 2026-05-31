import { useEffect, useRef, useState } from "react";

type Options = IntersectionObserverInit & { once?: boolean };

export function useInView<T extends HTMLElement = HTMLDivElement>(options?: Options) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const once = options?.once ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -6% 0px",
        ...options,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, options?.root, options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
