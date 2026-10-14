import React, { useEffect, useRef, useState } from 'react';
import { 
  Copy, 
  Check, 
  AlertTriangle,
  FileText,
  Sparkles,
  Code2,
  Image as ImageIcon,
  Film,
  Globe,
  ExternalLink,
  X,
  Maximize2,
  Brain,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { ChatMessage, Settings, FileAttachment } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { formatDuration } from '../utils/media';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatViewProps {
  messages: ChatMessage[];
  settings: Settings;
  onInsertCode?: (code: string) => void;
}

interface ThinkingStatus {
  text: string;
  icon: 'sparkles' | 'code' | 'image' | 'video' | 'file';
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

  // 1. Video analysis
  if (prevMessage.attachments && prevMessage.attachments.some((a) => a.isVideo)) {
    return {
      text: lang === 'uz' ? 'Video tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ видео...' : 'Analyzing video...',
      icon: 'video',
    };
  }

  // 2. Multiple or single image analysis
  const imgCount = prevMessage.attachments?.filter((a) => a.isImage).length || 0;
  if (imgCount > 1) {
    return {
      text: lang === 'uz' ? `${imgCount} ta rasm tahlil qilinmoqda...` : lang === 'ru' ? `Анализ ${imgCount} изображений...` : `Analyzing ${imgCount} images...`,
      icon: 'image',
    };
  }
  if (imgCount === 1) {
    return {
      text: lang === 'uz' ? 'Rasm tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ изображения...' : 'Analyzing image...',
      icon: 'image',
    };
  }

  // 3. Document/File analysis
  if (prevMessage.attachments && prevMessage.attachments.length > 0) {
    return {
      text: lang === 'uz' ? 'Fayllar tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ файлов...' : 'Analyzing files...',
      icon: 'file',
    };
  }

  const text = (prevMessage.content || '').toLowerCase();

  // 4. Code & debugging analysis
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

  // 5. Translation
  if (text.includes('tarjima') || text.includes('translate') || text.includes('перевод')) {
    return {
      text: lang === 'uz' ? 'Tarjima qilinmoqda...' : lang === 'ru' ? 'Перевод текста...' : 'Translating...',
      icon: 'sparkles',
    };
  }

  // 6. Default reasoning
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

/**
 * Collapsible Thinking/Reasoning block for live streaming thoughts (Deep-Think mode)
 */
const ThinkingBlock: React.FC<{
  thought: string;
  isThinking: boolean;
  language: 'uz' | 'en' | 'ru';
}> = ({ thought, isThinking, language }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isThinking);

  useEffect(() => {
    if (isThinking) {
      setIsExpanded(true);
    }
  }, [isThinking]);

  const t = (key: TranslationKey) => getTranslation(language, key);

  return (
    <div className="w-full mb-3 rounded-2xl border border-purple-200/70 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 overflow-hidden transition-all shadow-2xs">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-purple-800 dark:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className={`w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 ${isThinking ? 'animate-pulse' : ''}`} />
          <span className="truncate font-semibold text-xs sm:text-[13px]">
            {isThinking ? t('thinkingInProgress') : t('thinkingFinished')}
          </span>
          {isThinking && (
            <span className="flex gap-1 items-center ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 shrink-0">
          <span className="text-[11px] opacity-80 hidden sm:inline">
            {isExpanded ? (language === 'uz' ? 'Yashirish' : language === 'ru' ? 'Скрыть' : 'Collapse') : (language === 'uz' ? 'Ko‘rish' : language === 'ru' ? 'Показать' : 'Expand')}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-2 text-xs sm:text-[13px] text-gray-700 dark:text-gray-300 font-sans leading-relaxed border-t border-purple-200/50 dark:border-purple-900/30 whitespace-pre-wrap select-text max-h-96 overflow-y-auto no-scrollbar border-l-2 border-l-purple-500/70 ml-2 pl-3 my-1">
          {thought}
        </div>
      )}
    </div>
  );
};

/**
 * Message attachments display component supporting video playback,
 * responsive photo grid for up to 15 images, and documents.
 */
const MessageAttachments: React.FC<{
  attachments: FileAttachment[];
  onPreviewImage: (url: string, name: string) => void;
}> = ({ attachments, onPreviewImage }) => {
  const videoFiles = attachments.filter((a) => a.isVideo);
  const imageFiles = attachments.filter((a) => a.isImage && a.previewUrl);
  const documentFiles = attachments.filter((a) => !a.isImage && !a.isVideo);

  return (
    <div className="w-full space-y-2.5 mb-2.5">
      {/* Videos */}
      {videoFiles.map((vid) => (
        <div
          key={vid.id}
          className="w-full max-w-lg rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/95 shadow-sm"
        >
          <video
            controls
            playsInline
            src={vid.previewUrl}
            className="w-full max-h-72 object-contain bg-black"
          />
          <div className="px-3.5 py-2 flex items-center justify-between text-xs bg-[#1F2937] text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Film className="w-4 h-4 text-[#34D399] shrink-0" />
              <span className="truncate font-medium">{vid.name}</span>
            </div>
            {vid.videoDuration && (
              <span className="font-mono text-[11px] opacity-80 shrink-0 ml-2">
                {formatDuration(vid.videoDuration)}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Images Grid (Handles 1 up to 15 images cleanly) */}
      {imageFiles.length === 1 && (
        <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 max-w-sm sm:max-w-md">
          <img
            src={imageFiles[0].previewUrl}
            alt={imageFiles[0].name}
            onClick={() => onPreviewImage(imageFiles[0].previewUrl!, imageFiles[0].name)}
            className="max-h-64 sm:max-h-80 w-auto rounded-2xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
          />
        </div>
      )}

      {imageFiles.length >= 2 && imageFiles.length <= 4 && (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 max-w-lg">
          {imageFiles.map((img, idx) => (
            <div
              key={img.id}
              onClick={() => onPreviewImage(img.previewUrl!, img.name)}
              className="relative aspect-4/3 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 cursor-pointer group bg-black/5 shadow-2xs"
            >
              <img
                src={img.previewUrl}
                alt={img.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] text-white font-mono font-medium">
                #{idx + 1}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {img.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {imageFiles.length > 4 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2 w-full">
          {imageFiles.map((img, idx) => (
            <div
              key={img.id}
              onClick={() => onPreviewImage(img.previewUrl!, img.name)}
              className="relative aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 cursor-pointer group bg-black/5 shadow-2xs"
              title={img.name}
            >
              <img
                src={img.previewUrl}
                alt={img.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white font-mono font-medium">
                #{idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {documentFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {documentFiles.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1C] border border-black/10 dark:border-white/10 text-xs sm:text-sm font-mono"
            >
              <FileText className="w-4 h-4 text-[#047857]" />
              <span className="truncate max-w-[200px] font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                {att.name}
              </span>
              <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {(att.size / 1024).toFixed(0)} KB
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  settings,
  onInsertCode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{ url: string; name: string } | null>(null);

  const t = (key: TranslationKey) => getTranslation(settings.language, key);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if user is scrolled near bottom (within 150px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      // Direct scroll without animation eliminates subpixel font jitter and text flickering
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Handle ESC key to close image preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewModal) {
        setPreviewModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModal]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderThinkingIcon = (icon: 'sparkles' | 'code' | 'image' | 'video' | 'file') => {
    switch (icon) {
      case 'video':
        return <Film className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'file':
        return <FileText className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto w-full no-scrollbar">
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-6 sm:pb-8 space-y-5 sm:space-y-7">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const prevMessage = index > 0 ? messages[index - 1] : undefined;
          const thinkingStatus = getThinkingStatus(prevMessage, settings.language);
          const parsed = parseThoughtAndContent(message.content);
          const displayResponse = parsed.response || (!parsed.thought ? message.content : '');

          if (isUser) {
            return (
              <div key={message.id} className="w-full flex justify-end">
                <div className="max-w-[92%] sm:max-w-[75%] rounded-2xl sm:rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 bg-[#F4F4F5] dark:bg-[#2F2F2F] text-[#1F2937] dark:text-[#ECEBE8] text-sm sm:text-base leading-relaxed break-words">
                  {/* Attachments preview */}
                  {message.attachments && message.attachments.length > 0 && (
                    <MessageAttachments
                      attachments={message.attachments}
                      onPreviewImage={(url, name) => setPreviewModal({ url, name })}
                    />
                  )}

                  {/* Text Content */}
                  {message.content && (
                    <div className="whitespace-pre-wrap font-sans">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="w-full group">
              <div className="w-full text-sm sm:text-base leading-relaxed text-[#1F2937] dark:text-[#ECEBE8]">
                {/* Assistant attachments if any */}
                {message.attachments && message.attachments.length > 0 && (
                  <MessageAttachments
                    attachments={message.attachments}
                    onPreviewImage={(url, name) => setPreviewModal({ url, name })}
                  />
                )}

                {/* Error message */}
                {message.error ? (
                  <div className="flex items-start gap-2.5 text-[#DC2626] dark:text-[#F87171] text-xs sm:text-sm p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">{t('errorOccurred')}</p>
                      <p className="opacity-90">{message.error}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 1. Real-time Thinking Block (Deep-Think mode) */}
                    {parsed.thought && (
                      <ThinkingBlock
                        thought={parsed.thought}
                        isThinking={parsed.isThinking}
                        language={settings.language}
                      />
                    )}

                    {/* 2. Loading indicator before first token arrives */}
                    {message.isStreaming && !parsed.thought && !displayResponse && (
                      <div className="flex items-center gap-2.5 py-2.5 text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] my-1.5 select-none animate-pulse">
                        {message.sources && message.sources.length > 0 ? (
                          <>
                            <Globe className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
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
                        <span className="flex gap-1.5 items-center ml-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    )}

                    {/* Main Response Content */}
                    {displayResponse && (
                      <div className="w-full">
                        <MarkdownRenderer
                          content={displayResponse}
                          onInsertCode={onInsertCode}
                          uiLanguage={settings.language}
                          isStreaming={message.isStreaming}
                          sources={message.sources}
                        />
                      </div>
                    )}

                    {/* Web Search Sources: Compact, small font at the end of the information (ChatGPT style) */}
                    {displayResponse && message.sources && message.sources.length > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-[#E5E7EB]/60 dark:border-[#333330]/60">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[#6B7280] dark:text-[#9CA3AF] text-[11px] font-medium flex items-center gap-1 mr-1 select-none">
                            <Globe className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" />
                            {t('sources')}:
                          </span>
                          {message.sources.map((src, idx) => (
                            <a
                              key={idx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F4F5] dark:bg-[#20201E] hover:bg-[#E5E7EB] dark:hover:bg-[#282826] text-[#374151] dark:text-[#ECEBE8] hover:text-[#047857] dark:hover:text-[#34D399] border border-[#E5E7EB] dark:border-[#333330] text-[11px] transition-all group shadow-2xs select-none"
                              title={`${src.title}\n${src.url}`}
                            >
                              <span className="w-3.5 h-3.5 rounded-full bg-[#047857]/15 dark:bg-[#34D399]/20 text-[#047857] dark:text-[#34D399] flex items-center justify-center text-[9px] font-bold">
                                {idx + 1}
                              </span>
                              <span className="truncate max-w-[150px] font-mono text-[11px]">{src.domain || 'web'}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Minimal Clean Action Buttons */}
                {displayResponse && (
                  <div className="flex items-center gap-3 mt-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    <button
                      onClick={() => handleCopy(displayResponse, message.id)}
                      className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#262624] transition-colors py-1 px-2 rounded-lg"
                      title={t('copy')}
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#047857]" />
                          <span className="text-[#047857] font-semibold">{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('copy')}</span>
                        </>
                      )}
                    </button>
                    <span className="font-mono text-[11px] text-[#9CA3AF] dark:text-[#6B7280] select-none">
                      {new Date(message.timestamp).toLocaleTimeString(
                        settings.language === 'uz' ? 'uz-UZ' : settings.language === 'ru' ? 'ru-RU' : 'en-US',
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="h-2" />
      </div>

      {/* Lightbox Preview Modal for attached images */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92dvh] w-full bg-transparent flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 px-1 text-white/90 text-xs sm:text-sm font-medium">
              <span className="truncate max-w-[200px] sm:max-w-md">{previewModal.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors touch-manipulation"
                  title="To‘liq hajmda ochish"
                >
                  <Maximize2 className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors touch-manipulation"
                  title="Yopish (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img
              src={previewModal.url}
              alt={previewModal.name}
              className="max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};
