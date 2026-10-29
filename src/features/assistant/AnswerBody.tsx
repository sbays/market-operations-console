import Markdown, { type Components } from "react-markdown";
import type { Citation } from "@/domain/schema";
import { splitBlocks } from "./blocks";
import { CitationChip } from "./CitationChip";
import { CitationsContext } from "./citations";
import { rehypeCitations } from "./rehypeCitations";

const rehypePlugins = [rehypeCitations];

const components: Components = {
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
  /** Undefined while the answer streams: markers render as pending chips. */
  citations?: Citation[];
};

/**
 * The answer's Markdown, one block at a time: settled blocks keep their props, so only the
 * block still streaming is parsed again on each frame. Citations arrive through context, so
 * resolving them re-renders the chips without re-parsing the text.
 */
export function AnswerBody({ text, citations }: Props) {
  return (
    <CitationsContext value={citations}>
      <div className="space-y-2 text-sm leading-relaxed">
        {splitBlocks(text).map((block, index) => (
          // Blocks only ever append, so the index is a stable key.
          <MarkdownBlock key={index} text={block} />
        ))}
      </div>
    </CitationsContext>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  return (
    <Markdown skipHtml rehypePlugins={rehypePlugins} components={components}>
      {text}
    </Markdown>
  );
}
