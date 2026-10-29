import {
  CircleCheck,
  CircleX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { formatStatus } from "@/domain/format";
import type { Status } from "@/domain/schema";
import { cn } from "@/ui/cn";

// Each status has its own icon and label; colour only reinforces them.
const STATUS_STYLES: Record<Status, { Icon: LucideIcon; className: string }> = {
  "on-track": { Icon: CircleCheck, className: "text-status-on-track" },
  "at-risk": { Icon: TriangleAlert, className: "text-status-at-risk" },
  "off-track": { Icon: CircleX, className: "text-status-off-track" },
};

/** A status's icon in its colour, for places too small for the label (which must sit nearby). */
export function StatusIcon({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { Icon, className: colour } = STATUS_STYLES[status];
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", colour, className)}
    />
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        STATUS_STYLES[status].className,
        className,
      )}
    >
      <StatusIcon status={status} />
      {formatStatus(status)}
    </span>
  );
}
