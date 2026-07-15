import type { ReactNode } from "react";
import { Fragment } from "react";

/**
 * Minimal, injection-proof markdown rendering for assistant replies.
 * Text is never parsed as HTML — everything is emitted as React nodes.
 * Supports: fenced code blocks, inline code, **bold**, *italic*,
 * [links](https://…) (https only), bullet/numbered lists, paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize links, inline code, bold, italic.
  const pattern =
    /(\[([^\]]+)\]\((https:\/\/[^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(
        <a
          key={`${keyPrefix}-a-${i}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(<code key={`${keyPrefix}-c-${i}`}>{match[5]}</code>);
    } else if (match[6]) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[7]}</strong>);
    } else if (match[8]) {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{match[9]}</em>);
    }
    lastIndex = pattern.lastIndex;
    i += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function renderMarkdown(text: string): ReactNode {
  const blocks: ReactNode[] = [];
  const segments = text.split(/```/);

  segments.forEach((segment, segmentIndex) => {
    if (segmentIndex % 2 === 1) {
      // Code block; first line may be a language tag.
      const lines = segment.replace(/^\n/, "").split("\n");
      const first = lines[0]?.trim() ?? "";
      const isLang = /^[a-zA-Z0-9+#-]{1,20}$/.test(first) && lines.length > 1;
      const code = (isLang ? lines.slice(1) : lines).join("\n").trimEnd();
      blocks.push(
        <pre key={`code-${segmentIndex}`}>
          <code>{code}</code>
        </pre>
      );
      return;
    }

    const paragraphs = segment.split(/\n{2,}/);
    paragraphs.forEach((paragraph, pIndex) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return;
      const key = `p-${segmentIndex}-${pIndex}`;
      const lines = trimmed.split("\n");

      const isBullets = lines.every((l) => /^\s*[-•*]\s+/.test(l));
      const isNumbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));

      if (isBullets && lines.length > 0) {
        blocks.push(
          <ul key={key}>
            {lines.map((line, lineIndex) => (
              <li key={`${key}-${lineIndex}`}>
                {renderInline(
                  line.replace(/^\s*[-•*]\s+/, ""),
                  `${key}-${lineIndex}`
                )}
              </li>
            ))}
          </ul>
        );
      } else if (isNumbered && lines.length > 0) {
        blocks.push(
          <ol key={key}>
            {lines.map((line, lineIndex) => (
              <li key={`${key}-${lineIndex}`}>
                {renderInline(
                  line.replace(/^\s*\d+[.)]\s+/, ""),
                  `${key}-${lineIndex}`
                )}
              </li>
            ))}
          </ol>
        );
      } else {
        blocks.push(
          <p key={key}>
            {lines.map((line, lineIndex) => (
              <Fragment key={`${key}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, `${key}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      }
    });
  });

  return <>{blocks}</>;
}
