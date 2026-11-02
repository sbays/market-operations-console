import { ShieldAlert, ShieldCheck, ShieldHalf } from "lucide-react";
import type { Confidence } from "@/domain/schema";

const BANDS: Record<Confidence, { label: string; Icon: typeof ShieldCheck }> = {
  high: { label: "High confidence", Icon: ShieldCheck },
  medium: { label: "Medium confidence", Icon: ShieldHalf },
  low: { label: "Low confidence", Icon: ShieldAlert },
};

/** The model's confidence as a labelled band: icon and text, never colour alone. */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { label, Icon } = BANDS[confidence];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border-ai px-2 py-0.5 text-xs font-medium">
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
