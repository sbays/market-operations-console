import { ShieldAlert, ShieldCheck, ShieldHalf } from "lucide-react";
import { confidenceBand, type ConfidenceBand } from "@/domain/selectors";

const BANDS: Record<
  ConfidenceBand,
  { label: string; Icon: typeof ShieldCheck }
> = {
  high: { label: "High confidence", Icon: ShieldCheck },
  medium: { label: "Medium confidence", Icon: ShieldHalf },
  low: { label: "Low confidence", Icon: ShieldAlert },
};

/** The model's confidence as a labelled band: icon and text, never colour alone. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { label, Icon } = BANDS[confidenceBand(confidence)];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border-ai px-2 py-0.5 text-xs font-medium">
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
