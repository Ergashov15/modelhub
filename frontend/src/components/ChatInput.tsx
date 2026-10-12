import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip, FileText, X, Globe } from 'lucide-react';
import type { Settings, FileAttachment } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: FileAttachment[], webSearch?: boolean) => void;
  onStop: () => void;
  isStreaming: boolean;
  settings: Settings;
  onOpenSettings: () => void;
  isCentered?: boolean;
  insertedText?: string;
  isWebSearchActive: boolean;
  onToggleWebSearch: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStop,
  isStreaming,
  settings,
  onOpenSettings,
  isCentered = false,
  insertedText,
  isWebSearchActive,
  onToggleWebSearch,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: TranslationKey) => getTranslation(settings.language, key);
  const isModelConfigured = Boolean(settings.model && settings.model.trim());

  useEffect(() => {
    if (insertedText) {
      // oxlint-disable-next-line react/set-state-in-effect
      setInput((prev) => (prev ? `${prev}\n\n${insertedText}` : insertedText));
      textareaRef.current?.focus();
    }
  }, [insertedText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        alert(t('fileTooLarge'));
        continue;
      }

      const isImg = file.type.startsWith('image/');
      const attId = 'att-' + Date.now() + Math.random().toString(36).substring(2, 6);

      if (isImg) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          id: attId,
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: true,
          previewUrl: dataUrl,
        });
      } else {
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });
        newAttachments.push({
          id: attId,
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: false,
          content: text,
        });
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    if (!isModelConfigured) {
      onOpenSettings();
      return;
    }
    onSendMessage(input, attachments, isWebSearchActive);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const placeholderText = isModelConfigured
    ? t('inputPlaceholderConfigured')
    : t('inputPlaceholderUnconfigured');

  return (
    <div
      className={
        isCentered
          ? 'w-full max-w-4xl mx-auto'
          : 'w-full border-t border-[#E5E7EB] dark:border-[#333330] bg-white/95 dark:bg-[#181816]/95 backdrop-blur-md py-3.5'
      }
    >
      <div className={isCentered ? 'w-full' : 'w-full max-w-4xl mx-auto px-4 sm:px-6'}>
        <div
          className={`w-full rounded-2xl bg-white dark:bg-[#20201E] border border-[#E5E7EB] dark:border-[#333330] focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20 transition-all ${
            isCentered ? 'shadow-md hover:border-[#047857]/40' : 'shadow-xs'
          }`}
        >
        {/* Attachment preview row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-[#E5E7EB]/60 dark:border-[#383835]/60">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#181816] border border-[#E5E7EB] dark:border-[#383835] text-xs sm:text-sm font-mono shadow-2xs"
              >
                {att.isImage && att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="w-9 h-9 rounded-lg object-cover" />
                ) : (
                  <FileText className="w-4.5 h-4.5 text-[#047857] ml-1" />
                )}
                <span className="truncate max-w-[150px] font-medium text-[#1F2937] dark:text-[#ECEBE8]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#2C2C29] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input & Action controls row: Vertically centered */}
        <div className="flex items-center gap-2 px-3.5 py-2">
          {/* File attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="p-2.5 rounded-xl text-[#6B7280] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F9FAFB] dark:hover:bg-[#333330] transition-colors shrink-0 disabled:opacity-40"
            title={t('attachFile')}
          >
            <Paperclip className="w-5 h-5 text-[#047857] dark:text-[#34D399]" />
          </button>

          {/* Web Search toggle button */}
          <button
            type="button"
            onClick={onToggleWebSearch}
            disabled={isStreaming}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 select-none ${
              isWebSearchActive
                ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/60 text-[#047857] dark:text-[#34D399] border border-[#86EFAC] shadow-2xs font-semibold'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F9FAFB] dark:hover:bg-[#333330] border border-transparent'
            }`}
            title={isWebSearchActive ? t('webSearchActive') : t('webSearchInactive')}
          >
            <Globe className={`w-4 h-4 ${isWebSearchActive ? 'text-[#047857] dark:text-[#34D399] animate-pulse' : ''}`} />
            <span className="hidden sm:inline text-xs sm:text-[13px] leading-none">
              {t('webSearch')}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.pdf,.md,.py,.js,.ts,.tsx,.jsx,.json,.csv,.log,.html,.css"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea: centered text */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            rows={1}
            disabled={isStreaming}
            className={`flex-1 bg-transparent text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] resize-none focus:outline-none font-sans py-2.5 max-h-[160px] leading-normal self-center ${
              isCentered ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
            }`}
          />

          {/* Send / Stop button */}
          <div className="shrink-0 flex items-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="p-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-2xs transition-colors"
                title={t('stop')}
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                className="p-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-30 disabled:hover:bg-[#047857] text-white shadow-2xs transition-colors"
                title={t('send')}
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
