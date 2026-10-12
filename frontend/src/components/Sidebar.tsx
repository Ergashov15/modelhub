import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  SquarePen, 
  MessageSquare, 
  Trash2, 
  Settings as SettingsIcon, 
  Search, 
  PanelLeftClose, 
  X 
} from 'lucide-react';
import { ModelHubLogo } from './ModelHubLogo';
import type { Conversation, Settings } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  settings: Settings;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  settings,
  isOpen,
  onToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Conversation | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChatToDelete(null);
      }
    };
    if (chatToDelete) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatToDelete]);

  const t = (key: TranslationKey) => getTranslation(settings.language, key);

  const getConversationTitle = React.useCallback((conv: Conversation) => {
    if (!conv.title || !conv.title.trim()) return getTranslation(settings.language, 'newChat');
    if (conv.title === 'Yangi suhbat' || conv.title === 'New Chat' || conv.title === 'Новый чат' || conv.title === 'New chat') {
      return getTranslation(settings.language, 'newChat');
    }
    return conv.title;
  }, [settings.language]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const title = getConversationTitle(c).toLowerCase();
      return title.includes(query);
    });
  }, [conversations, searchQuery, getConversationTitle]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 h-full w-72 bg-white dark:bg-[#181816] border-r border-[#E5E7EB] dark:border-[#333330] flex flex-col transition-all duration-200 ease-in-out shrink-0 ${
        isOpen
          ? 'translate-x-0 md:relative md:w-72'
          : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
      }`}
    >
      {/* 1. Header (Yuqori qism) */}
      <div className="p-3.5 pb-2.5 flex items-center justify-between shrink-0">
        {/* Chapda: ModelHub Premium Logo & Branding */}
        <ModelHubLogo size="md" showText={true} showBadge={true} />

        {/* Oʻngda: Qidiruv (Search) va panelni yashirish (Sidebar toggle) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((prev) => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            className={`p-2 rounded-lg text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#252522] transition-colors ${
              isSearchOpen ? 'bg-[#F3F4F6] dark:bg-[#252522] text-[#1F2937] dark:text-[#ECEBE8]' : ''
            }`}
            title={t('search')}
            aria-label="Search"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded-lg text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#252522] transition-colors"
            title={t('closeSidebar')}
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Qidiruv ochilganda (Inline Search Box) */}
      {isSearchOpen && (
        <div className="px-3.5 pb-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#20201E] border border-[#E5E7EB] dark:border-[#333330] rounded-xl text-sm text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] focus:outline-none focus:border-[#047857]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. "Yangi suhbat" tugmasi: Oq fon, yashil qalam ikonkasi, nozik chegara */}
      <div className="px-3.5 shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full py-2.5 px-3.5 rounded-xl bg-white hover:bg-[#F9FAFB] dark:bg-[#20201E] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#353531] text-[#1F2937] dark:text-[#ECEBE8] text-sm font-medium flex items-center justify-between transition-colors shadow-2xs group mb-2.5"
        >
          <span className="flex items-center gap-2.5">
            <SquarePen className="w-4.5 h-4.5 text-[#047857] dark:text-[#34D399] transition-colors" />
            <span>{t('newChat')}</span>
          </span>
        </button>
      </div>

      {/* 3. "Suhbatlar" sarlavhasi va ro'yxat */}
      <div className="flex-1 overflow-y-auto px-3.5 space-y-1">
        <div className="flex items-center justify-between px-1 py-1.5">
          <span className="text-xs sm:text-[13px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
            {t('chatHistory')}
          </span>
          {conversations.length > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#E6F4EA] text-[#047857] border border-[#86EFAC] font-medium dark:bg-[#064E3B]/40 dark:text-[#6EE7B7] dark:border-[#059669]/50">
              {conversations.length}
            </span>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {t('noChats')}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {searchQuery ? 'Topilmadi' : t('noChats')}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeId;
            const hasMessages = Boolean(conv.messages && conv.messages.length > 0);

            return (
              <div
                key={conv.id}
                onClick={() => onSelectChat(conv.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/30 text-[#047857] dark:text-[#6EE7B7] font-medium border border-[#86EFAC] dark:border-[#059669]/60 shadow-2xs'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-white dark:hover:bg-[#20201E] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-1">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#047857] dark:text-[#34D399]' : 'text-[#9CA3AF] dark:text-[#6B7280]'
                    }`}
                  />
                  <span className="truncate">{getConversationTitle(conv)}</span>
                </div>
                {hasMessages && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(conv);
                    }}
                    title={t('deleteChat')}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/30 rounded-lg transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Footer (Pastki qism: Faqat bitta element - Sozlamalar) */}
      <div className="p-3 border-t border-[#E5E7EB] dark:border-[#333330] shrink-0">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full py-2.5 px-3.5 rounded-xl text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-white dark:hover:bg-[#20201E] text-sm font-medium flex items-center gap-2.5 transition-colors"
        >
          <SettingsIcon className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          <span>{t('settings')}</span>
        </button>
      </div>

      {/* Suhbatni o'chirishni tasdiqlash modali (Page o'rtasida chiqishi uchun document.body ga createPortal orqali chiqariladi) */}
      {chatToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setChatToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] p-5 shadow-xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#FEE2E2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                  {t('confirmDeleteTitle')}
                </h3>
                <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                  {t('confirmDeleteDesc')}
                </p>
                {getConversationTitle(chatToDelete) && (
                  <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#F9FAFB] dark:bg-[#262624] text-sm font-mono text-[#1F2937] dark:text-[#ECEBE8] truncate border border-[#E5E7EB] dark:border-[#333330]">
                    &ldquo;{getConversationTitle(chatToDelete)}&rdquo;
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-[#1F2937] hover:text-black dark:text-[#ECEBE8] dark:hover:text-white bg-white dark:bg-[#262624] hover:bg-[#F9FAFB] dark:hover:bg-[#2E2E2A] border border-[#E5E7EB] dark:border-[#52504B] shadow-2xs transition-colors text-center"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteChat(chatToDelete.id);
                  setChatToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-xs transition-colors text-center"
              >
                {t('confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};
