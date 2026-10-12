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
import { SettingsModal } from './components/SettingsModal';
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
  } = useChat(settings);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        return <Sun className="w-4 h-4 text-[#CC785C]" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-[#D97757]" />;
      case 'system':
      default:
        return <Monitor className="w-4 h-4 text-[#6F6D66] dark:text-[#99978F]" />;
    }
  };

  const [insertedCode, setInsertedCode] = useState<string>('');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F5EE] dark:bg-[#181816] text-[#1F2937] dark:text-[#ECEBE8] font-sans antialiased">
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
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={settings}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/25 dark:bg-black/50 z-30 md:hidden backdrop-blur-2xs transition-opacity"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Navbar: z-30 ensures dropdown and controls float on top of chat content */}
        <header className="relative z-30 h-14 border-b border-[#E5E7EB] dark:border-[#333330] bg-[#F7F5EE]/90 dark:bg-[#181816]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#EFECE4] dark:hover:bg-[#252522] shrink-0 transition-colors"
                title="Panelni ochish"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centered Model Selector: z-40 floats above everything in header */}
          <div className="absolute left-1/2 -translate-x-1/2 z-40">
            <ModelSelector
              models={settings.models || []}
              activeModelId={settings.activeModelId}
              currentModelName={settings.model}
              onSelectModel={switchModel}
              onOpenSettings={() => setIsSettingsOpen(true)}
              language={settings.language}
            />
          </div>

          {/* Right Header Actions: Stable, fixed-dimension buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={handleCycleTheme}
              className="w-8 h-8 rounded-lg bg-white dark:bg-[#20201E] hover:bg-[#F9FAFB] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8] flex items-center justify-center transition-colors shadow-xs"
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
              className="w-12 h-8 rounded-lg bg-white dark:bg-[#20201E] hover:bg-[#F9FAFB] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#333330] text-xs font-mono font-medium text-[#1F2937] dark:text-[#ECEBE8] flex items-center justify-center transition-colors shadow-xs select-none"
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
              onOpenSettings={() => setIsSettingsOpen(true)}
              isCentered={false}
              insertedText={insertedCode}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-2xl mx-auto -mt-10 sm:-mt-16 animate-in fade-in duration-200">
            {/* Centered ModelHub Brand Mark */}
            <div className="mb-4 sm:mb-5 transition-transform hover:scale-105 duration-200">
              <ModelHubLogo size="lg" showText={false} />
            </div>

            {/* Centered Greeting: "Welcome" / "Xush kelibsiz" */}
            <h1 className="text-3xl sm:text-4xl font-serif font-medium text-[#1F2937] dark:text-[#ECEBE8] tracking-tight mb-6 sm:mb-8 text-center select-none">
              {t('welcomeTitle')}
            </h1>

            {/* Centered Chat Input Form */}
            <ChatInput
              onSendMessage={sendMessage}
              onStop={stopGeneration}
              isStreaming={isStreaming}
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
              isCentered={true}
              insertedText={insertedCode}
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
      />
    </div>
  );
}

export default App;
