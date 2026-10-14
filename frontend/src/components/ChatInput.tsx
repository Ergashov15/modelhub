import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Square, 
  Paperclip, 
  FileText, 
  X, 
  Globe, 
  Video as VideoIcon, 
  Loader2, 
  Image as ImageIcon,
  Zap,
  Brain,
  Check
} from 'lucide-react';
import type { Settings, FileAttachment, ChatMode } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { compressAndResizeImage, extractVideoFrames, formatDuration } from '../utils/media';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: FileAttachment[], mode?: ChatMode) => void;
  onStop: () => void;
  isStreaming: boolean;
  settings: Settings;
  onOpenSettings: () => void;
  isCentered?: boolean;
  insertedText?: string;
  chatMode: ChatMode;
  onChangeChatMode: (mode: ChatMode) => void;
}

const MAX_IMAGES_LIMIT = 15;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStop,
  isStreaming,
  settings,
  onOpenSettings,
  isCentered = false,
  insertedText,
  chatMode,
  onChangeChatMode,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModeModalOpen) {
        setIsModeModalOpen(false);
      }
    };
    if (isModeModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModeModalOpen]);

  const t = useCallback(
    (key: TranslationKey) => getTranslation(settings.language, key),
    [settings.language]
  );
  const isModelConfigured = Boolean(settings.model && settings.model.trim());

  const currentImageCount = attachments.filter((a) => a.isImage).length;

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

  const DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.ps1', '.sh', '.vbs', '.msi', '.dll', '.scr',
    '.jar', '.com', '.hta', '.html', '.htm', '.php', '.phtml', '.asp', '.aspx', '.jsp'
  ];

  const sanitizeSvg = (svgText: string): string => {
    return svgText
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/(?:href|xlink:href)\s*=\s*(['"])\s*javascript:.*?\1/gi, '$1#$1')
      .replace(/<(?:foreignObject|iframe|embed|object)[\s\S]*?<\/(?:foreignObject|iframe|embed|object)>/gi, '')
      .replace(/<(?:foreignObject|iframe|embed|object)[^>]*\/?>/gi, '');
  };

  /**
   * Core helper to process files (from file picker, paste, or drag-and-drop).
   * Enforces security validations, 15 images limit, SVG XSS sanitization, and media processing.
   */
  const processFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    const newAttachments: FileAttachment[] = [];
    const imageFilesToProcess: File[] = [];
    const otherFilesToProcess: File[] = [];

    // 1. File Upload Security: Block dangerous script and executable extensions
    const safeFiles: File[] = [];
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasDangerousExt = DANGEROUS_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      if (hasDangerousExt) {
        alert(
          settings.language === 'uz'
            ? `Xavfsizlik cheklovi: "${file.name}" fayl turi dastur xavfsizligini ta'minlash maqsadida qabul qilinmaydi.`
            : settings.language === 'ru'
            ? `Ограничение безопасности: Файл "${file.name}" заблокирован в целях безопасности.`
            : `Security restriction: File "${file.name}" is blocked for security reasons.`
        );
        continue;
      }
      safeFiles.push(file);
    }

    if (safeFiles.length === 0) {
      setIsProcessingMedia(false);
      return;
    }

    // Separate images, videos, and documents
    for (const file of safeFiles) {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      if (isImg) {
        imageFilesToProcess.push(file);
      } else {
        otherFilesToProcess.push(file);
      }
    }

    // Check 15 images limit
    if (imageFilesToProcess.length > 0) {
      const availableImageSlots = MAX_IMAGES_LIMIT - currentImageCount;

      if (availableImageSlots <= 0) {
        alert(t('maxImagesReached'));
      } else {
        const allowedImages = imageFilesToProcess.slice(0, availableImageSlots);
        if (imageFilesToProcess.length > availableImageSlots) {
          alert(t('maxImagesExceeded'));
        }

        for (const file of allowedImages) {
          try {
            let dataUrl = '';
            // If SVG: sanitize XML to eliminate Stored XSS before creating preview URL
            if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
              const rawSvg = await file.text();
              const safeSvg = sanitizeSvg(rawSvg);
              dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSvg)}`;
            } else {
              dataUrl = await compressAndResizeImage(file);
            }

            const attId = 'att-img-' + Date.now() + Math.random().toString(36).substring(2, 6);
            newAttachments.push({
              id: attId,
              name: file.name,
              size: file.size,
              type: file.type || 'image/jpeg',
              isImage: true,
              previewUrl: dataUrl,
            });
          } catch (err) {
            console.error('Rasm yuklashda xatolik:', err);
          }
        }
      }
    }

    // Process videos and other documents
    for (const file of otherFilesToProcess) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);
      const attId = 'att-' + Date.now() + Math.random().toString(36).substring(2, 6);

      if (isVideo) {
        if (file.size > 100 * 1024 * 1024) {
          alert(t('videoTooLarge'));
          continue;
        }

        try {
          const videoData = await extractVideoFrames(file);
          newAttachments.push({
            id: attId,
            name: file.name,
            size: file.size,
            type: file.type || 'video/mp4',
            isImage: false,
            isVideo: true,
            previewUrl: videoData.previewUrl,
            thumbnailUrl: videoData.thumbnailUrl,
            videoDuration: videoData.duration,
            videoFrames: videoData.frames,
          });
        } catch (err) {
          console.error('Video tahlil xatosi:', err);
          alert(settings.language === 'uz' 
            ? 'Videoni yuklash yoki kadrlarni ajratishda xatolik yuz berdi.' 
            : 'Error processing video frames.');
        }
      } else {
        // Text / code / data files
        if (file.size > 20 * 1024 * 1024) {
          alert(t('fileTooLarge'));
          continue;
        }

        try {
          const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve('');
            reader.readAsText(file);
          });
          newAttachments.push({
            id: attId,
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            isImage: false,
            isVideo: false,
            content: text,
          });
        } catch (err) {
          console.error('Faylni o‘qishda xatolik:', err);
        }
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    setIsProcessingMedia(false);
  }, [currentImageCount, settings.language, t]);

  const lastPasteTimeRef = useRef<number>(0);

  /**
   * Handle pasting images and files from clipboard (Ctrl+V)
   */
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const filesToUpload: File[] = [];
    const seenFiles = new Set<string>();

    // 1. Inspect clipboard items
    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const key = `${file.name}-${file.size}-${file.type}`;
            if (!seenFiles.has(key)) {
              seenFiles.add(key);
              const isImg = file.type.startsWith('image/');
              const fileName = file.name && file.name !== 'image.png'
                ? file.name
                : isImg
                ? `image-${Date.now()}-${filesToUpload.length + 1}.png`
                : file.name || `file-${Date.now()}`;
              const renamedFile = new File([file], fileName, { type: file.type });
              filesToUpload.push(renamedFile);
            }
          }
        }
      }
    }

    // 2. Fallback to clipboardData.files
    if (filesToUpload.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        const key = `${file.name}-${file.size}-${file.type}`;
        if (!seenFiles.has(key)) {
          seenFiles.add(key);
          filesToUpload.push(file);
        }
      }
    }

    if (filesToUpload.length > 0) {
      // Prevent browser default paste of raw image binary and event bubbling
      e.preventDefault();
      e.stopPropagation();

      // Guard against rapid duplicate paste events
      const now = Date.now();
      if (now - lastPasteTimeRef.current < 500) {
        return;
      }
      lastPasteTimeRef.current = now;

      // If user also copied text alongside files, preserve text
      const pastedText = clipboardData.getData('text/plain');
      if (pastedText && pastedText.trim()) {
        setInput((prev) => (prev ? `${prev} ${pastedText}` : pastedText));
      }

      await processFiles(filesToUpload);
    }
  };

  /**
   * File input change handler
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
    e.target.value = '';
  };

  /**
   * Drag and drop handlers
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if (isProcessingMedia) return;
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    if (!isModelConfigured) {
      onOpenSettings();
      return;
    }
    onSendMessage(input, attachments, chatMode);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFocus = () => {
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, 200);
  };

  const placeholderText = t('inputPlaceholderConfigured');

  return (
    <div
      className={
        isCentered
          ? 'w-full max-w-4xl mx-auto px-2 pb-3 sm:pb-0'
          : 'w-full shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#181816] dark:via-[#181816]/95 dark:to-transparent pt-1.5 sm:pt-4 pb-mobile-chat'
      }
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={isCentered ? 'w-full' : 'w-full max-w-3xl lg:max-w-4xl mx-auto px-2 sm:px-4'}>
        <div
          onPaste={handlePaste}
          className={`relative w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-[#20201E] border transition-all ${
            isDraggingOver
              ? 'border-[#047857] ring-2 ring-[#047857]/40 bg-[#F0FDF4] dark:bg-[#064E3B]/20'
              : 'border-[#E5E7EB] dark:border-[#333330] focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20'
          } ${isCentered ? 'shadow-lg hover:border-[#047857]/40' : 'shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)]'}`}
        >
          {/* Drag Overlay visual feedback */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-[#047857]/10 backdrop-blur-xs flex items-center justify-center pointer-events-none">
              <span className="font-semibold text-sm text-[#047857] dark:text-[#34D399] bg-white dark:bg-[#20201E] px-4 py-2 rounded-xl shadow-sm border border-[#047857]/30">
                {t('dragFilesHere')}
              </span>
            </div>
          )}

          {/* Attachment Preview Row */}
          {(attachments.length > 0 || isProcessingMedia) && (
            <div className="px-3 sm:px-3.5 pt-2.5 sm:pt-3 pb-2 border-b border-[#E5E7EB]/60 dark:border-[#383835]/60">
              {/* Attachment summary counter */}
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#374151] dark:text-[#D1D5DB]">
                    {t('attachFile')}
                  </span>
                  {currentImageCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#E6F4EA] dark:bg-[#064E3B]/60 text-[#047857] dark:text-[#34D399] font-mono text-[11px] font-semibold">
                      {currentImageCount} / {MAX_IMAGES_LIMIT} {t('imagesCount')}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline text-[11px] text-[#9CA3AF]">
                  {t('pasteImagesHint')}
                </span>
              </div>

              {/* Attachment chips row: Horizontal scroll on mobile to save vertical space, wrap on desktop */}
              <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-y-auto max-h-24 sm:max-h-36 no-scrollbar py-0.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 pr-2 sm:pr-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#181816] border border-[#E5E7EB] dark:border-[#383835] text-xs sm:text-sm font-mono shadow-2xs group shrink-0 sm:shrink"
                  >
                    {att.isImage && att.previewUrl ? (
                      <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-black/5 shrink-0">
                        <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 px-1 rounded-tl bg-black/60 text-[9px] text-white">
                          <ImageIcon className="w-2.5 h-2.5 inline" />
                        </span>
                      </div>
                    ) : att.isVideo ? (
                      <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-black/10 shrink-0 flex items-center justify-center">
                        {att.thumbnailUrl ? (
                          <img src={att.thumbnailUrl} alt={att.name} className="w-full h-full object-cover" />
                        ) : (
                          <VideoIcon className="w-5 h-5 text-[#047857]" />
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center font-mono leading-tight">
                          {att.videoDuration ? formatDuration(att.videoDuration) : 'video'}
                        </span>
                      </div>
                    ) : (
                      <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#047857] shrink-0 ml-1" />
                    )}

                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="truncate max-w-[110px] sm:max-w-[130px] font-medium text-[#1F2937] dark:text-[#ECEBE8] leading-tight text-xs sm:text-sm">
                        {att.name}
                      </span>
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] leading-tight font-mono">
                        {(att.size / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="p-1 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#2C2C29] transition-colors touch-manipulation"
                      title={t('deleteChat')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Media processing spinner */}
                {isProcessingMedia && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E6F4EA] dark:bg-[#064E3B]/40 border border-[#86EFAC] text-xs text-[#047857] dark:text-[#34D399] font-medium animate-pulse shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('videoProcessing')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input & Action controls row: items-end ensures alignment when typing multiline on mobile */}
          <div className="flex items-end gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2">
            {/* File attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isProcessingMedia}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-[#6B7280] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F9FAFB] dark:hover:bg-[#333330] transition-colors shrink-0 disabled:opacity-40 touch-manipulation mb-0.5 sm:mb-0"
              title={`${t('attachFile')} (rasmlar, video, hujjatlar)`}
            >
              <Paperclip className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#047857] dark:text-[#34D399]" />
            </button>

            {/* Compact Mode Selector Icon Button (Minimalist, human-crafted, no duplicate text/icons) */}
            <button
              type="button"
              onClick={() => setIsModeModalOpen(true)}
              disabled={isStreaming}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all shrink-0 select-none touch-manipulation mb-0.5 sm:mb-0 border ${
                chatMode === 'fast'
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-2xs'
                  : chatMode === 'think'
                  ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 shadow-2xs'
                  : 'bg-[#047857]/10 hover:bg-[#047857]/20 text-[#047857] dark:text-[#34D399] border-[#047857]/30 shadow-2xs'
              }`}
              title={`${t('modeModalTitle')}: ${
                chatMode === 'fast' ? t('modeFast') : chatMode === 'think' ? t('modeDeepThink') : t('modeWebSearch')
              }`}
              aria-label="Muloqot rejimini tanlash"
            >
              {chatMode === 'fast' && <Zap className="w-4.5 h-4.5" />}
              {chatMode === 'think' && <Brain className="w-4.5 h-4.5" />}
              {chatMode === 'search' && <Globe className="w-4.5 h-4.5" />}
            </button>

            {/* Hidden file input supporting up to 15 images, videos, and documents */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.txt,.pdf,.md,.py,.js,.ts,.tsx,.jsx,.json,.csv,.log,.sql,.css"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Textarea: text-base ensures iOS Safari does NOT zoom in automatically */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={placeholderText}
              rows={1}
              disabled={isStreaming}
              className={`flex-1 bg-transparent text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] resize-none focus:outline-none font-sans py-2 sm:py-2.5 max-h-[140px] sm:max-h-[160px] leading-relaxed text-base ${
                isCentered ? 'sm:text-lg' : 'sm:text-base'
              }`}
            />

            {/* Send / Stop button */}
            <div className="shrink-0 flex items-center mb-0.5 sm:mb-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-2xs transition-colors touch-manipulation"
                  title={t('stop')}
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isProcessingMedia}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-30 disabled:hover:bg-[#047857] text-white shadow-2xs transition-colors touch-manipulation"
                  title={t('send')}
                >
                  <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ChatGPT Style Disclaimer under the input bar (Desktop only; hidden on mobile for clean thumb clearance) */}
        {!isCentered && (
          <p className="hidden sm:block text-[11px] text-center text-[#9CA3AF] dark:text-[#6B7280] pt-1.5 pb-0.5 select-none tracking-tight">
            {t('disclaimer')}
          </p>
        )}
      </div>

      {/* Responsive Mode Selection Mini Modal / Mobile Bottom Sheet */}
      {isModeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 dark:bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsModeModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-[#1E1E1C] border-t sm:border border-[#E5E7EB] dark:border-[#333330] rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 pb-8 sm:pb-5 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mx-auto mb-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E7EB]/60 dark:border-[#333330]/60">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-[#1F2937] dark:text-[#ECEBE8]">
                  {t('modeModalTitle')}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                  {t('modeModalSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModeModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#2A2A28] transition-colors"
                title="Yopish (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Cards */}
            <div className="space-y-2">
              {/* 1. Fast Mode */}
              <button
                type="button"
                onClick={() => {
                  onChangeChatMode('fast');
                  setIsModeModalOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                  chatMode === 'fast'
                    ? 'bg-amber-500/10 border-2 border-amber-500/40 shadow-xs'
                    : 'bg-[#FAFAFA] dark:bg-[#252523] border border-[#E5E7EB] dark:border-[#333330] hover:border-amber-500/30'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                      {t('modeFast')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-bold">
                      0.1s
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-snug mt-0.5">
                    {t('modeFastDesc')}
                  </p>
                </div>
                {chatMode === 'fast' && (
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* 2. Deep-Think Mode */}
              <button
                type="button"
                onClick={() => {
                  onChangeChatMode('think');
                  setIsModeModalOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                  chatMode === 'think'
                    ? 'bg-purple-500/10 border-2 border-purple-500/40 shadow-xs'
                    : 'bg-[#FAFAFA] dark:bg-[#252523] border border-[#E5E7EB] dark:border-[#333330] hover:border-purple-500/30'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                      {t('modeDeepThink')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono font-bold">
                      Mantiq
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-snug mt-0.5">
                    {t('modeDeepThinkDesc')}
                  </p>
                </div>
                {chatMode === 'think' && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* 3. Web Search Mode */}
              <button
                type="button"
                onClick={() => {
                  onChangeChatMode('search');
                  setIsModeModalOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                  chatMode === 'search'
                    ? 'bg-[#047857]/10 border-2 border-[#047857]/40 shadow-xs'
                    : 'bg-[#FAFAFA] dark:bg-[#252523] border border-[#E5E7EB] dark:border-[#333330] hover:border-[#047857]/30'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#047857]/15 text-[#047857] dark:text-[#34D399] flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                      {t('modeWebSearch')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#047857]/15 text-[#047857] dark:text-[#34D399] font-mono font-bold">
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-snug mt-0.5">
                    {t('modeWebSearchDesc')}
                  </p>
                </div>
                {chatMode === 'search' && (
                  <div className="w-5 h-5 rounded-full bg-[#047857] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
