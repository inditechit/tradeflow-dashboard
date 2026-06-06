import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  link_url?: string | null;
  read_at?: string | null;
  created_at?: string;
};

type Props = {
  open: boolean;
  notification: NotificationItem | null;
  onClose: () => void;
  onOpenLink?: (url: string) => void;
};

export function NotificationDetailDialog({ open, notification, onClose, onOpenLink }: Props) {
  if (!notification) return null;
  const hasLink = Boolean(notification.link_url?.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{notification.title}</DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {notification.message}
        </p>
        {notification.created_at ? (
          <p className="text-xs text-slate-400">
            {new Date(notification.created_at).toLocaleString()}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {hasLink && onOpenLink ? (
            <Button
              type="button"
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
              onClick={() => onOpenLink(notification.link_url!.trim())}
            >
              Open link
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function handleNotificationClick(
  n: NotificationItem,
  navigate: (path: string) => void,
  onShowPopup: (n: NotificationItem) => void,
) {
  const link = n.link_url?.trim();
  if (link) {
    if (/^https?:\/\//i.test(link)) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      navigate(link.startsWith("/") ? link : `/${link}`);
    }
    return;
  }
  onShowPopup(n);
}
