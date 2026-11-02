import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import { splitBlocks } from "./blocks";

const components: Components = {
  // The link allow-list is empty: model output never links out, so links render as text.
  a: ({ children }) => <>{children}</>,
};

/**
 * The answer's Markdown, one block at a time: only the block still streaming is parsed again
 * each frame.
 */
export function AnswerBody({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {splitBlocks(text).map((block, index) => (
        // Blocks only ever append, so the index is a stable key.
        <MarkdownBlock key={index} text={block} />
      ))}
    </div>
  );
}

/**
 * Explicit memo, unlike the rest of the app: parsing is the cost this split exists to avoid,
 * so a settled block must stay unparsed wherever it runs, and a test can hold that here.
 * Vitest doesn't run the React Compiler.
 */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <Markdown skipHtml components={components}>
      {text}
    </Markdown>
  );
});
