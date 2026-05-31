import React from "react";
import { Bookmark, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseUserLabels, tagColorClass, type UserLabelEntry } from "@/utils/adminUserLabels";

type UserLabelsDisplayProps = {
  user: { admin_label?: unknown; admin_tags?: unknown };
  compact?: boolean;
  onClick?: () => void;
  className?: string;
};

export function getLabelsFromUser(user: UserLabelsDisplayProps["user"]): UserLabelEntry {
  return parseUserLabels(user);
}

const UserLabelsDisplay: React.FC<UserLabelsDisplayProps> = ({
  user,
  compact = false,
  onClick,
  className,
}) => {
  const { label, tags } = parseUserLabels(user);
  const hasContent = Boolean(label) || tags.length > 0;

  const Wrapper = onClick ? "button" : "div";
  const wrapperProps = onClick
    ? {
        type: "button" as const,
        onClick,
        title: "Manage label & tags",
      }
    : {};

  if (!hasContent) {
    return (
      <Wrapper
        {...wrapperProps}
        className={cn(
          "inline-flex min-w-[120px] items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-left",
          onClick && "cursor-pointer transition hover:border-indigo-200 hover:bg-indigo-50/40",
          className,
        )}
      >
        <span className="text-[11px] font-medium text-slate-400">No label yet</span>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "inline-flex min-w-[140px] max-w-[220px] flex-col gap-2 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-2 text-left shadow-sm",
        onClick && "cursor-pointer transition hover:border-indigo-300 hover:shadow-md",
        compact && "max-w-[200px]",
        className,
      )}
    >
      {label && (
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-indigo-200/80 bg-gradient-to-r from-indigo-500 to-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
          <Bookmark className="h-3 w-3 shrink-0 fill-white/30" />
          <span className="truncate">{label}</span>
        </span>
      )}

      {tags.length > 0 && (
        <div className="rounded-lg border border-slate-200/80 bg-white/90 p-1">
          <div className="mb-1 flex items-center gap-1 px-1">
            <Hash className="h-3 w-3 text-slate-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
                  tagColorClass(tag),
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </Wrapper>
  );
};

export default UserLabelsDisplay;
