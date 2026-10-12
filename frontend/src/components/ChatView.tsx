import React, { useEffect, useRef, useState } from 'react';
import { 
  User, 
  Copy, 
  Check, 
  AlertTriangle,
  FileText,
  Sparkles,
  Code2,
  Image as ImageIcon,
  Globe,
  ExternalLink
} from 'lucide-react';
import type { ChatMessage, Settings } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatViewProps {
  messages: ChatMessage[];
  settings: Settings;
  onInsertCode?: (code: string) => void;
}

interface ThinkingStatus {
  text: string;
  icon: 'sparkles' | 'code' | 'image' | 'file';
}

function getThinkingStatus(
  prevMessage?: ChatMessage,
  lang: 'uz' | 'en' | 'ru' = 'uz'
): ThinkingStatus {
  if (!prevMessage) {
    return {
      text: lang === 'uz' ? 'Fikrlanmoqda...' : lang === 'ru' ? 'Думаю...' : 'Thinking...',
      icon: 'sparkles',
    };
  }

  // 1. Image analysis
  if (prevMessage.attachments && prevMessage.attachments.some((a) => a.isImage)) {
    return {
      text: lang === 'uz' ? 'Rasm tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ изображения...' : 'Analyzing image...',
      icon: 'image',
    };
  }

  // 2. Document/File analysis
  if (prevMessage.attachments && prevMessage.attachments.length > 0) {
    return {
      text: lang === 'uz' ? 'Fayllar tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ файлов...' : 'Analyzing files...',
      icon: 'file',
    };
  }

  const text = (prevMessage.content || '').toLowerCase();

  // 3. Code & debugging analysis
  const codeKeywords = [
    'kod', 'code', 'xato', 'bug', 'error', 'funksiya', 'function', 'class',
    'import', 'python', 'javascript', 'typescript', 'sql', 'react', 'refactor',
    'tuzat', 'dastur', 'algoritm', 'algorithm'
  ];
  if (codeKeywords.some((k) => text.includes(k))) {
    return {
      text: lang === 'uz' ? 'Kod tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ кода...' : 'Analyzing code...',
      icon: 'code',
    };
  }

  // 4. Translation
  if (text.includes('tarjima') || text.includes('translate') || text.includes('перевод')) {
    return {
      text: lang === 'uz' ? 'Tarjima qilinmoqda...' : lang === 'ru' ? 'Перевод текста...' : 'Translating...',
      icon: 'sparkles',
    };
  }

  // 5. Default reasoning
  return {
    text: lang === 'uz' ? 'Fikrlanmoqda...' : lang === 'ru' ? 'Думаю...' : 'Thinking...',
    icon: 'sparkles',
  };
}

function parseThoughtAndContent(content: string) {
  if (!content) return { thought: null, response: '', isThinking: false };

  const thinkMatch = content.match(/^<think>([\s\S]*?)(?:<\/think>|$)([\s\S]*)$/);
  if (thinkMatch) {
    const isClosed = content.includes('</think>');
    return {
      thought: thinkMatch[1].trim(),
      response: isClosed ? thinkMatch[2].trimStart() : '',
      isThinking: !isClosed,
    };
  }

  return { thought: null, response: content, isThinking: false };
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  settings,
  onInsertCode,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const t = (key: TranslationKey) => getTranslation(settings.language, key);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderThinkingIcon = (icon: 'sparkles' | 'code' | 'image' | 'file') => {
    switch (icon) {
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />;
      case 'file':
        return <FileText className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />;
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-5 max-w-3xl w-full mx-auto">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const prevMessage = index > 0 ? messages[index - 1] : undefined;
        const thinkingStatus = getThinkingStatus(prevMessage, settings.language);
        const parsed = parseThoughtAndContent(message.content);
        // During streaming: keep thoughts completely hidden behind the loading indicator
        const displayResponse = message.isStreaming
          ? parsed.response
          : (parsed.response || parsed.thought || '');

        return (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar: User -> User icon; Assistant -> Sparkles icon */}
            <div
              className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs shadow-2xs select-none ${
                isUser
                  ? 'bg-[#E5E7EB] dark:bg-[#333330] text-[#6B7280] dark:text-[#ECEBE8]'
                  : 'bg-[#047857] text-white'
              }`}
            >
              {isUser ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? 'bg-[#EFECE4] dark:bg-[#2C2C29] text-[#1F2937] dark:text-[#ECEBE8] border border-[#E5E7EB] dark:border-[#383835] rounded-tr-xs shadow-2xs'
                  : 'bg-white dark:bg-[#20201E] border border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8] rounded-tl-xs shadow-2xs'
              }`}
            >
              {/* Assistant Header: Model Name */}
              {!isUser && (
                <div className="flex items-center gap-1.5 mb-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] select-none">
                  <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                    {settings.model ? settings.model.split('/').pop() : 'ModelHub'}
                  </span>
                </div>
              )}

              {/* Attachments preview */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {message.attachments.map((att) =>
                    att.isImage && att.previewUrl ? (
                      <a
                        key={att.id}
                        href={att.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#383835] hover:opacity-90 transition-opacity shadow-xs"
                      >
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="max-h-56 max-w-full rounded-xl object-contain bg-black/5 dark:bg-black/20"
                        />
                      </a>
                    ) : (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] text-xs font-mono shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#047857]" />
                        <span className="truncate max-w-[180px] font-medium text-[#1F2937] dark:text-[#ECEBE8]">{att.name}</span>
                        <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Error message */}
              {message.error ? (
                <div className="flex items-start gap-2 text-[#DC2626] dark:text-[#F87171] text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">{t('errorOccurred')}</p>
                    <p className="opacity-90">{message.error}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Web Search Sources Bar (Perplexity & ChatGPT style) */}
                  {!isUser && message.sources && message.sources.length > 0 && (
                    <div className="mb-3.5 pt-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#34D399] tracking-wider mb-2 select-none">
                        <Globe className="w-3.5 h-3.5" />
                        <span>{t('sources')} ({message.sources.length})</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                        {message.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#F7F5EE] dark:bg-[#262624] hover:bg-[#EFECE4] dark:hover:bg-[#30302D] border border-[#E5E7EB] dark:border-[#383835] text-xs transition-all shrink-0 max-w-[210px] group shadow-2xs"
                            title={`${src.title}\n${src.url}`}
                          >
                            <span className="w-4 h-4 rounded-full bg-[#E6F4EA] dark:bg-[#064E3B]/80 text-[#047857] dark:text-[#34D399] flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium text-[11px] text-[#1F2937] dark:text-[#ECEBE8] group-hover:text-[#047857] dark:group-hover:text-[#34D399]">
                                {src.title}
                              </span>
                              <span className="truncate text-[9.5px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                                {src.domain || 'web'}
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Loading indicator while model is generating/thinking and no response text yet */}
                  {!isUser && message.isStreaming && !displayResponse && (
                    <div className="flex items-center gap-2.5 py-2 px-3.5 rounded-xl bg-[#F7F5EE]/90 dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] text-xs text-[#6B7280] dark:text-[#9CA3AF] my-1 select-none shadow-2xs animate-pulse">
                      {message.sources && message.sources.length > 0 ? (
                        <>
                          <Globe className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />
                          <span className="font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                            {t('searchingWeb')}
                          </span>
                        </>
                      ) : (
                        <>
                          {renderThinkingIcon(thinkingStatus.icon)}
                          <span className="font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                            {thinkingStatus.text}
                          </span>
                        </>
                      )}
                      <span className="flex gap-1 items-center ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  )}

                  {/* Main Response Content */}
                  {displayResponse && (
                    isUser ? (
                      <div className="whitespace-pre-wrap font-sans text-xs md:text-sm">
                        {displayResponse}
                      </div>
                    ) : (
                      <MarkdownRenderer
                        content={displayResponse}
                        onInsertCode={onInsertCode}
                        uiLanguage={settings.language}
                        isStreaming={message.isStreaming}
                      />
                    )
                  )}
                </>
              )}

              {/* Action buttons (Copy & Timestamp) */}
              {!isUser && displayResponse && (
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E5E7EB]/60 dark:border-[#333330]/60 text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                  <span className="font-mono text-[#9CA3AF] dark:text-[#6B7280]">
                    {new Date(message.timestamp).toLocaleTimeString(
                      settings.language === 'uz' ? 'uz-UZ' : settings.language === 'ru' ? 'ru-RU' : 'en-US',
                      { hour: '2-digit', minute: '2-digit' }
                    )}
                  </span>
                  <button
                    onClick={() => handleCopy(displayResponse, message.id)}
                    className="flex items-center gap-1 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] transition-colors p-1 rounded"
                    title={t('copy')}
                  >
                    {copiedId === message.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#047857]" />
                        <span className="text-[#047857] font-medium">{t('copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t('copy')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={scrollEndRef} />
    </div>
  );
};
