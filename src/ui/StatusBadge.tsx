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

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { Icon, className: colour } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        colour,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {formatStatus(status)}
    </span>
  );
}
