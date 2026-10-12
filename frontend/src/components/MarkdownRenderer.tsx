import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Language } from '../types';

interface MarkdownRendererProps {
  content: string;
  onInsertCode?: (code: string) => void;
  uiLanguage?: Language;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onInsertCode,
  uiLanguage = 'uz',
  isStreaming = false,
}) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none font-sans text-xs md:text-sm leading-relaxed text-[#1F1E1D] dark:text-[#ECEBE8] break-words">
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

            // Inline code pill: bg-neutral-100 px-1.5 py-0.5 rounded
            return (
              <code
                className="bg-neutral-100 dark:bg-[#2A2A27] text-[#1F1E1D] dark:text-[#ECEBE8] border border-neutral-200 dark:border-[#383835] px-1.5 py-0.5 rounded font-mono text-[12px] font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Headings styling
          h1: ({ children }) => (
            <h1 className="text-lg sm:text-xl font-bold text-[#1F1E1D] dark:text-[#ECEBE8] mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base sm:text-lg font-semibold text-[#1F1E1D] dark:text-[#ECEBE8] mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm sm:text-base font-semibold text-[#1F1E1D] dark:text-[#ECEBE8] mt-3 mb-1">
              {children}
            </h3>
          ),

          // Lists styling
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 my-2 space-y-1 text-[#2E2D29] dark:text-[#DCD9D0]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 my-2 space-y-1 text-[#2E2D29] dark:text-[#DCD9D0]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="my-2 leading-relaxed">{children}</p>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-[#047857] pl-3 py-1 my-2 text-[#6B7280] dark:text-[#9CA3AF] bg-[#F7F5EE]/80 dark:bg-[#1A1A18]/80 rounded-r-lg italic">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-[#E5E7EB] dark:border-[#2E2E2B]">
              <table className="min-w-full divide-y divide-[#E5E7EB] dark:divide-[#2E2E2B] text-xs font-sans">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#EFECE4] dark:bg-[#20201D] text-[#1F2937] dark:text-[#ECEBE8]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-[#E5E7EB] dark:border-[#2E2E2B] text-[#1F2937] dark:text-[#DCD9D0]">
              {children}
            </td>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#047857] hover:underline underline-offset-2 font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-[#047857] animate-pulse align-middle" />
      )}
    </div>
  );
};
