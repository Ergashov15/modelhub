import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Language, WebSource } from '../types';

interface MarkdownRendererProps {
  content: string;
  onInsertCode?: (code: string) => void;
  uiLanguage?: Language;
  isStreaming?: boolean;
  sources?: WebSource[];
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onInsertCode,
  uiLanguage = 'uz',
  isStreaming = false,
  sources,
}) => {
  // Convert [1], [2] citations into markdown links if sources are provided
  const processedContent = useMemo(() => {
    if (!sources || sources.length === 0 || !content) return content;

    // Convert [1], [2] etc. to [[1]](sourceUrl) when not already linked
    return content.replace(/\[(\d+)\](?!\()/g, (match, numStr) => {
      const idx = parseInt(numStr, 10) - 1;
      if (idx >= 0 && idx < sources.length && sources[idx]?.url) {
        return `[[${numStr}]](${sources[idx].url})`;
      }
      return match;
    });
  }, [content, sources]);

  return (
    <div className="prose prose-base dark:prose-invert max-w-none w-full font-sans text-sm sm:text-base leading-relaxed text-[#1F1E1D] dark:text-[#ECEBE8] break-words [transform:translateZ(0)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Unwrap <pre> to let CodeBlock handle entire container
          pre({ children }) {
            return <>{children}</>;
          },

          // Handle inline code vs code block
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isMultiLine = codeString.includes('\n');

            // Block code with language or newlines
            if (match || isMultiLine) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  code={codeString}
                  onInsert={onInsertCode}
                  uiLanguage={uiLanguage}
                />
              );
            }

            // Inline code pill
            return (
              <code
                className="bg-neutral-100 dark:bg-[#2A2A27] text-[#1F1E1D] dark:text-[#ECEBE8] border border-neutral-200 dark:border-[#383835] px-2 py-0.5 rounded-md font-mono text-[13px] sm:text-sm font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Headings styling
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F1E1D] dark:text-[#ECEBE8] mt-5 mb-2.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-semibold text-[#1F1E1D] dark:text-[#ECEBE8] mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base sm:text-lg font-semibold text-[#1F1E1D] dark:text-[#ECEBE8] mt-3.5 mb-1.5">
              {children}
            </h3>
          ),

          // Lists styling
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 my-2.5 space-y-1.5 text-[#2E2D29] dark:text-[#DCD9D0]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 my-2.5 space-y-1.5 text-[#2E2D29] dark:text-[#DCD9D0]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="my-2.5 leading-relaxed">{children}</p>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#047857] pl-3.5 py-1.5 my-2.5 text-[#6B7280] dark:text-[#9CA3AF] bg-[#F9FAFB] dark:bg-[#1A1A18]/80 rounded-r-lg italic">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#2E2E2B]">
              <table className="min-w-full divide-y divide-[#E5E7EB] dark:divide-[#2E2E2B] text-sm font-sans">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#F3F4F6] dark:bg-[#20201D] text-[#1F2937] dark:text-[#ECEBE8]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 border-t border-[#E5E7EB] dark:border-[#2E2E2B] text-[#1F2937] dark:text-[#DCD9D0]">
              {children}
            </td>
          ),

          // Links & Web Search Citations
          a: ({ href, children }) => {
            const strChildren = String(children);
            const isCitation = /^\[?\d+\]?$/.test(strChildren.trim());

            if (isCitation) {
              const cleanNum = strChildren.replace(/[[\]]/g, '');
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 mx-0.5 rounded-full bg-[#E6F4EA] dark:bg-[#064E3B]/60 text-[#047857] dark:text-[#34D399] hover:bg-[#047857] hover:text-white dark:hover:bg-[#34D399] dark:hover:text-[#181816] text-[10px] font-mono font-bold transition-all no-underline shadow-2xs align-baseline"
                  title={href}
                >
                  {cleanNum}
                </a>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[#047857] hover:underline underline-offset-2 font-medium"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#047857] dark:bg-[#34D399] rounded-2xs animate-pulse align-baseline select-none" />
      )}
    </div>
  );
};
