import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

type Direction = "up" | "down" | "left" | "right" | "none";

const hidden: Record<Direction, string> = {
  up: "translate-y-10 opacity-0",
  down: "-translate-y-10 opacity-0",
  left: "translate-x-10 opacity-0",
  right: "-translate-x-10 opacity-0",
  none: "opacity-0",
};

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  as?: keyof JSX.IntrinsicElements;
};

export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  as: Tag = "div",
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        inView ? "translate-x-0 translate-y-0 opacity-100" : hidden[direction],
        className,
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
