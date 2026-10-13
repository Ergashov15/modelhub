import { useState } from 'react';
import { 
  PanelLeftOpen, 
  Sun, 
  Moon, 
  Monitor
} from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { ChatInput } from './components/ChatInput';
import { SettingsModal, type SettingsTab } from './components/SettingsModal';
import { ModelSelector } from './components/ModelSelector';
import { ModelHubLogo } from './components/ModelHubLogo';
import { getTranslation, type TranslationKey } from './i18n/translations';
import type { ThemeMode, Language } from './types';

export function App() {
  const { settings, saveSettings, switchModel } = useSettings();
  useTheme(settings.theme);

  const {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createNewChat,
    deleteChat,
    sendMessage,
    stopGeneration,
    isStreaming,
    streamingChatIds,
  } = useChat(settings);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');

  const handleOpenSettings = (tab: SettingsTab = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };
  const [isWebSearchActive, setIsWebSearchActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('modelhub_web_search') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleWebSearch = () => {
    setIsWebSearchActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('modelhub_web_search', String(next));
      } catch {}
      return next;
    });
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const handleNewChat = () => {
    createNewChat();
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const t = (key: TranslationKey) => getTranslation(settings.language, key);

  // Quick theme toggle cycle: system -> light -> dark -> system
  const handleCycleTheme = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const currentIndex = order.indexOf(settings.theme || 'system');
    const nextTheme = order[(currentIndex + 1) % order.length];
    saveSettings({ theme: nextTheme });
  };

  // Quick language toggle cycle: uz -> en -> ru -> uz
  const handleCycleLanguage = () => {
    const order: Language[] = ['uz', 'en', 'ru'];
    const currentIndex = order.indexOf(settings.language || 'uz');
    const nextLang = order[(currentIndex + 1) % order.length];
    saveSettings({ language: nextLang });
  };

  const getLanguageCode = (lang: Language) => {
    switch (lang) {
      case 'uz':
        return 'uz';
      case 'en':
        return 'eng';
      case 'ru':
        return 'ru';
      default:
        return 'uz';
    }
  };

  const getThemeIcon = (theme: ThemeMode) => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#CC785C]" />;
      case 'dark':
        return <Moon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#D97757]" />;
      case 'system':
      default:
        return <Monitor className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#6F6D66] dark:text-[#99978F]" />;
    }
  };

  const [insertedCode, setInsertedCode] = useState<string>('');

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-white dark:bg-[#181816] text-[#1F2937] dark:text-[#ECEBE8] font-sans antialiased">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectChat={(id) => {
          setActiveId(id);
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsSidebarOpen(false);
          }
        }}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
        onOpenSettings={handleOpenSettings}
        settings={settings}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        streamingChatIds={streamingChatIds}
      />

      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 md:hidden backdrop-blur-2xs transition-opacity"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden relative bg-white dark:bg-[#181816]">
        {/* Top Navbar: Responsive flex on mobile to prevent overlapping */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-[#E5E7EB] dark:border-[#333330] bg-white/95 dark:bg-[#181816]/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0">
          {/* Left: Sidebar toggle button (only visible when sidebar is closed) */}
          <div className="flex items-center min-w-[36px] sm:min-w-0">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 sm:p-2.5 rounded-xl text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#252522] shrink-0 transition-colors touch-manipulation"
                title="Panelni ochish"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </button>
            )}
          </div>

          {/* Center: Model Selector (Flexes on mobile, absolutely centered on desktop) */}
          <div className="flex items-center justify-center flex-1 sm:flex-initial sm:absolute sm:left-1/2 sm:-translate-x-1/2 z-40 px-1">
            <ModelSelector
              models={settings.models || []}
              activeModelId={settings.activeModelId}
              currentModelName={settings.model}
              onSelectModel={switchModel}
              onOpenSettings={(tab) => handleOpenSettings((tab as SettingsTab) || 'models')}
              language={settings.language}
            />
          </div>

          {/* Right Header Actions: Compact on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={handleCycleTheme}
              className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-[#20201E] hover:bg-[#F9FAFB] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8] flex items-center justify-center transition-colors shadow-xs touch-manipulation"
              title={`${t('theme')}: ${
                settings.theme === 'light'
                  ? t('themeLight')
                  : settings.theme === 'dark'
                  ? t('themeDark')
                  : t('themeSystem')
              }`}
            >
              {getThemeIcon(settings.theme || 'system')}
            </button>

            {/* Quick Language Switcher */}
            <button
              type="button"
              onClick={handleCycleLanguage}
              className="w-11 h-8.5 sm:w-14 sm:h-10 rounded-xl bg-white dark:bg-[#20201E] hover:bg-[#F9FAFB] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#333330] text-xs sm:text-sm font-mono font-semibold text-[#1F2937] dark:text-[#ECEBE8] flex items-center justify-center transition-colors shadow-xs select-none touch-manipulation"
              title={`${t('language')}: ${settings.language || 'uz'}`}
            >
              <span>{getLanguageCode(settings.language || 'uz')}</span>
            </button>
          </div>
        </header>

        {/* Messages Body or Centered Landing Form */}
        {activeConversation?.messages && activeConversation.messages.length > 0 ? (
          <>
            <ChatView
              messages={activeConversation.messages}
              settings={settings}
              onInsertCode={(code) => setInsertedCode(code)}
            />
            <ChatInput
              onSendMessage={sendMessage}
              onStop={stopGeneration}
              isStreaming={isStreaming}
              settings={settings}
              onOpenSettings={() => handleOpenSettings('general')}
              isCentered={false}
              insertedText={insertedCode}
              isWebSearchActive={isWebSearchActive}
              onToggleWebSearch={handleToggleWebSearch}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 w-full max-w-4xl lg:max-w-5xl mx-auto -mt-4 sm:-mt-16 animate-in fade-in duration-200">
            {/* Centered ModelHub Brand Mark */}
            <div className="mb-4 sm:mb-6 transition-transform hover:scale-105 duration-200">
              <ModelHubLogo size="xl" showText={false} />
            </div>

            {/* Centered Greeting: "Welcome" / "Xush kelibsiz" */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-[#1F2937] dark:text-[#ECEBE8] tracking-tight mb-6 sm:mb-8 text-center select-none">
              {t('welcomeTitle')}
            </h1>

            {/* Centered ChatInput Form */}
            <ChatInput
              onSendMessage={sendMessage}
              onStop={stopGeneration}
              isStreaming={isStreaming}
              settings={settings}
              onOpenSettings={() => handleOpenSettings('general')}
              isCentered={true}
              insertedText={insertedCode}
              isWebSearchActive={isWebSearchActive}
              onToggleWebSearch={handleToggleWebSearch}
            />
          </div>
        )}
      </div>

      {/* Settings Modal (Single place configured, opened from Sidebar) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
        initialTab={settingsTab}
      />
    </div>
  );
}

export default App;
