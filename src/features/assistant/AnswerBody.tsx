import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import { splitBlocks } from "./blocks";
import { CitationChip } from "./CitationChip";
import { EvidenceContext, type Evidence } from "./citations";
import { rehypeCitations } from "./rehypeCitations";

const rehypePlugins = [rehypeCitations];

const components: Components = {
  // The link allow-list is empty: model output never links out, so links render as text.
  a: ({ children }) => <>{children}</>,
  cite: ({ node, children }) => {
    const id = node?.properties.dataCitation;
    return typeof id === "number" ? (
      <CitationChip id={id} />
    ) : (
      <cite>{children}</cite>
    );
  },
};

type Props = {
  text: string;
  evidence: Evidence;
};

/**
 * The answer's Markdown, one block at a time: only the block still streaming is parsed again
 * each frame. Evidence arrives through context, so resolving citations re-renders the chips
 * without re-parsing the text.
 */
export function AnswerBody({ text, evidence }: Props) {
  return (
    <EvidenceContext value={evidence}>
      <div className="space-y-2 text-sm leading-relaxed">
        {splitBlocks(text).map((block, index) => (
          // Blocks only ever append, so the index is a stable key.
          <MarkdownBlock key={index} text={block} />
        ))}
      </div>
    </EvidenceContext>
  );
}

/**
 * Explicit memo, unlike the rest of the app: parsing is the cost this split exists to avoid,
 * so a settled block must stay unparsed wherever it runs, and a test can hold that here.
 * Vitest doesn't run the React Compiler.
 */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <Markdown skipHtml rehypePlugins={rehypePlugins} components={components}>
      {text}
    </Markdown>
  );
});
