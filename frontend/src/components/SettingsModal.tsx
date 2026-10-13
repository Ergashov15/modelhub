import React, { useState } from 'react';
import { 
  X, 
  Key, 
  Globe, 
  Cpu, 
  Sliders, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Sparkles, 
  Sun, 
  Moon, 
  Languages, 
  Plus, 
  Trash2, 
  Check, 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  LogOut, 
  Download, 
  HardDrive, 
  Database,
  Layers,
  Settings as SettingsIcon,
  Calendar,
  Mail
} from 'lucide-react';
import type { Settings, ThemeMode, Language, ModelProfile } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { applyTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { 
  exportAllChats, 
  clearAllChatsStorage, 
  getStorageUsage 
} from '../utils/storage';

export type SettingsTab = 'account' | 'models' | 'params' | 'general' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  initialTab = 'general',
}) => {
  if (!isOpen) return null;

  return (
    <SettingsModalContent
      settings={settings}
      onClose={onClose}
      onSave={onSave}
      initialTab={initialTab}
    />
  );
};

interface SettingsModalContentProps {
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Partial<Settings>) => void;
  initialTab: SettingsTab;
}

const SettingsModalContent: React.FC<SettingsModalContentProps> = ({
  settings,
  onClose,
  onSave,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Auth Hook
  const { 
    user, 
    isAuthenticated, 
    isLoading: isAuthLoading, 
    authError, 
    setAuthError, 
    login, 
    register, 
    logout 
  } = useAuth();

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // General settings state
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [showKey, setShowKey] = useState(false);
  const [temperature, setTemperature] = useState(settings.temperature);
  const [topP, setTopP] = useState(settings.topP);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme || 'system');
  const [language, setLanguage] = useState<Language>(settings.language || 'uz');

  // Multi-model profiles state
  const [modelsList, setModelsList] = useState<ModelProfile[]>(() => {
    if (settings.models && settings.models.length > 0) return settings.models;
    if (settings.model || settings.endpoint) {
      return [{
        id: 'default-1',
        name: settings.model.split('/').pop() || settings.model || 'Standart model',
        model: settings.model,
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
      }];
    }
    return [];
  });
  const [activeModelId, setActiveModelId] = useState<string>(() => {
    return settings.activeModelId || modelsList[0]?.id || '';
  });

  // Add model form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelEndpoint, setNewModelEndpoint] = useState('');
  const [newModelApiKey, setNewModelApiKey] = useState('');

  // Test connection state
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Data management state
  const [storageUsage, setStorageUsage] = useState(() => getStorageUsage());
  const [dataNotice, setDataNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const t = (key: TranslationKey) => getTranslation(language, key);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleClose = () => {
    applyTheme(settings.theme || 'system');
    onClose();
  };

  const handleSelectProfile = (profile: ModelProfile) => {
    setActiveModelId(profile.id);
    setModel(profile.model);
    if (profile.endpoint) setEndpoint(profile.endpoint);
    if (profile.apiKey !== undefined) setApiKey(profile.apiKey);
  };

  const handleAddNewModel = () => {
    if (!newModelId.trim()) return;
    const newProf: ModelProfile = {
      id: 'model-' + Date.now(),
      name: newModelName.trim() || newModelId.trim().split('/').pop() || newModelId.trim(),
      model: newModelId.trim(),
      endpoint: newModelEndpoint.trim() || endpoint.trim(),
      apiKey: newModelApiKey.trim() || apiKey.trim(),
    };
    const updated = [...modelsList, newProf];
    setModelsList(updated);
    handleSelectProfile(newProf);
    setNewModelName('');
    setNewModelId('');
    setNewModelEndpoint('');
    setNewModelApiKey('');
    setShowAddForm(false);
  };

  const handleDeleteModel = (id: string) => {
    const updated = modelsList.filter((m) => m.id !== id);
    setModelsList(updated);
    if (activeModelId === id) {
      if (updated.length > 0) {
        handleSelectProfile(updated[0]);
      } else {
        setActiveModelId('');
      }
    }
  };

  const handleAddAllFound = (found: string[]) => {
    const existingModelIds = new Set(modelsList.map((m) => m.model));
    const newProfiles: ModelProfile[] = [];
    found.forEach((m) => {
      if (!existingModelIds.has(m)) {
        newProfiles.push({
          id: 'model-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name: m.split('/').pop() || m,
          model: m,
          endpoint: endpoint.trim(),
          apiKey: apiKey.trim(),
        });
      }
    });
    if (newProfiles.length > 0) {
      const merged = [...modelsList, ...newProfiles];
      setModelsList(merged);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    setTestMessage(t('testingConnection'));
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: endpoint.trim(),
          api_key: apiKey.trim() || undefined,
          model: model.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        const count = data.models?.length || 0;
        setTestMessage(`${t('connectionSuccess')} (${count} ${t('modelsFound')})`);
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
        }
      } else {
        setTestStatus('error');
        let errMsg = t('connectionFailed');
        const rawMsg = data.message || data.detail || '';
        if (res.status === 401 || res.status === 403 || rawMsg.includes('401') || rawMsg.includes('Avtorizatsiya')) {
          errMsg = t('authError');
        } else if (res.status === 404 || rawMsg.includes('404')) {
          errMsg = t('notFoundError');
        } else if (rawMsg.includes('Timeout') || rawMsg.includes('vaqti tugadi')) {
          errMsg = t('timeoutError');
        }
        setTestMessage(errMsg);
      }
    } catch {
      setTestStatus('error');
      setTestMessage(`${t('errorOccurred')} ${t('connectionFailed')}`);
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: endpoint.trim(),
          api_key: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        if (!model || !data.models.includes(model)) {
          setModel(data.models[0]);
        }
      } else {
        alert(t('modelsNotFound'));
      }
    } catch {
      alert(t('fetchModelsFailed'));
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg('');

    if (authMode === 'login') {
      const res = await login(authUsername, authPassword);
      if (res.success) {
        setAuthSuccessMsg(t('loginSuccess'));
        setAuthPassword('');
      }
    } else {
      const res = await register(authUsername, authPassword);
      if (res.success) {
        setAuthSuccessMsg(t('registerSuccess'));
        setAuthPassword('');
      }
    }
  };

  // Data Management Handlers
  const handleExportChats = () => {
    try {
      const json = exportAllChats();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modelhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataNotice({ type: 'success', text: 'Zaxira fayli muvaffaqiyatli yuklab olindi!' });
    } catch (err) {
      console.error(err);
      setDataNotice({ type: 'error', text: 'Zaxira faylini yaratishda xatolik yuz berdi.' });
    }
  };

  const handleClearAllChats = () => {
    if (window.confirm(t('clearAllConfirm'))) {
      clearAllChatsStorage();
      setDataNotice({ type: 'success', text: 'Barcha chatlar tozalandi!' });
      setStorageUsage(getStorageUsage());
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const handleSave = () => {
    let finalModels = [...modelsList];
    if (model.trim()) {
      const existing = finalModels.find((m) => m.id === activeModelId || m.model === model.trim());
      if (existing) {
        existing.model = model.trim();
        existing.endpoint = endpoint.trim();
        existing.apiKey = apiKey.trim();
      } else {
        const newProf: ModelProfile = {
          id: 'model-' + Date.now(),
          name: model.trim().split('/').pop() || model.trim(),
          model: model.trim(),
          endpoint: endpoint.trim(),
          apiKey: apiKey.trim(),
        };
        finalModels.push(newProf);
      }
    }

    onSave({
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models: finalModels,
      activeModelId,
      temperature,
      topP,
      maxTokens,
      systemPrompt,
      theme,
      language,
    });
    applyTheme(theme);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/45 dark:bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:w-[640px] max-w-2xl h-[min(620px,calc(100dvh-16px))] sm:h-[min(580px,calc(100dvh-32px))] bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#1F2937] dark:text-[#ECEBE8] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-[#E5E7EB] dark:border-[#2D2D2A] bg-white dark:bg-[#1E1E1C] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F3F4F6] dark:bg-[#262624] text-[#1F2937] dark:text-[#ECEBE8] flex items-center justify-center border border-[#E5E7EB] dark:border-[#333330]">
              <SettingsIcon className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[#1F2937] dark:text-[#ECEBE8] leading-tight">
                {t('settingsTitle')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#262624] transition-colors touch-manipulation"
            title={t('closeSidebar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar: Horizontal scrollable chips on mobile, equal distribution on desktop */}
        <div className="px-2.5 sm:px-6 pt-2 pb-2 border-b border-[#E5E7EB] dark:border-[#2D2D2A] bg-[#FAFAF9] dark:bg-[#181816] shrink-0">
          <div className="flex p-1 bg-[#EEEEEA] dark:bg-[#252522] rounded-xl gap-1 overflow-x-auto no-scrollbar scroll-smooth">
            {/* 1. Account Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`shrink-0 sm:flex-1 sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 sm:px-2.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all select-none touch-manipulation ${
                activeTab === 'account'
                  ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
              }`}
            >
              <UserIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{t('tabAccount')}</span>
              {isAuthenticated && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#047857] dark:bg-[#34D399]" />
              )}
            </button>

            {/* 2. Models Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={`shrink-0 sm:flex-1 sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 sm:px-2.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all select-none touch-manipulation ${
                activeTab === 'models'
                  ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
              }`}
            >
              <Cpu className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{t('tabModels')}</span>
            </button>

            {/* 3. Parameters Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('params')}
              className={`shrink-0 sm:flex-1 sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 sm:px-2.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all select-none touch-manipulation ${
                activeTab === 'params'
                  ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
              }`}
            >
              <Sliders className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{t('tabParams')}</span>
            </button>

            {/* 4. General Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`shrink-0 sm:flex-1 sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 sm:px-2.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all select-none touch-manipulation ${
                activeTab === 'general'
                  ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
              }`}
            >
              <Layers className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{t('tabGeneral')}</span>
            </button>

            {/* 5. Data & Backup Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`shrink-0 sm:flex-1 sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 sm:px-2.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-all select-none touch-manipulation ${
                activeTab === 'data'
                  ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
              }`}
            >
              <Database className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{t('tabData')}</span>
            </button>
          </div>
        </div>

        {/* Tab Body: Smooth internal scroll with comfortable mobile padding */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-4 sm:space-y-5 text-sm">
          {/* TAB 1: ACCOUNT & AUTH */}
          {activeTab === 'account' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {isAuthenticated && user ? (
                /* Logged in User Card */
                <div className="space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#047857] text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
                        {(user.display_name || user.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-[#1F2937] dark:text-[#ECEBE8] truncate">
                            {user.display_name || user.username}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E6F4EA] text-[#047857] dark:bg-[#064E3B]/40 dark:text-[#34D399] border border-[#86EFAC] dark:border-[#059669]/50 font-semibold">
                            Faol
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono mt-0.5 truncate">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={logout}
                      className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/30 border border-[#FCA5A5] dark:border-[#7F1D1D] transition-colors shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </div>

                  {/* Profile Details */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                      {t('accountDetails')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
                        <UserIcon className="w-4 h-4 text-[#047857] shrink-0" />
                        <span>Foydalanuvchi:</span>
                        <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8]">{user.username}</span>
                      </div>
                      {user.email && (
                        <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
                          <Mail className="w-4 h-4 text-[#047857] shrink-0" />
                          <span>Email:</span>
                          <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8] truncate">{user.email}</span>
                        </div>
                      )}
                      {user.created_at && (
                        <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
                          <Calendar className="w-4 h-4 text-[#047857] shrink-0" />
                          <span>{t('memberSince')}:</span>
                          <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Login / Register Form */
                <div className="space-y-4">
                  {/* Guest status banner */}
                  <div className="p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#047857] dark:text-[#34D399] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                        {t('guestUser')}
                      </h4>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 leading-relaxed">
                        {t('guestDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Mode switcher toggle */}
                  <div className="grid grid-cols-2 p-1 bg-[#EEEEEA] dark:bg-[#252522] rounded-xl border border-[#E5E7EB] dark:border-[#333330]">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                        setAuthSuccessMsg('');
                      }}
                      className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs sm:text-sm transition-all ${
                        authMode === 'login'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{t('login')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                        setAuthSuccessMsg('');
                      }}
                      className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs sm:text-sm transition-all ${
                        authMode === 'register'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{t('register')}</span>
                    </button>
                  </div>

                  {/* Feedback alerts */}
                  {authError && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-[#DC2626] dark:text-[#F87171] text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authSuccessMsg && (
                    <div className="p-3 rounded-xl bg-[#E6F4EA] dark:bg-[#064E3B]/20 border border-[#86EFAC] dark:border-[#059669]/50 text-[#047857] dark:text-[#34D399] text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>{authSuccessMsg}</span>
                    </div>
                  )}

                  {/* Form fields */}
                  <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-1">
                        {t('username')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder="masalan: akmal99"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-sm text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-1">
                        {t('password')} *
                      </label>
                      <div className="relative">
                        <input
                          type={showAuthPassword ? 'text' : 'password'}
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="kamida 6 ta belgi"
                          className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-sm text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAuthPassword(!showAuthPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]"
                        >
                          {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading || !authUsername.trim() || !authPassword.trim()}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#047857] hover:bg-[#065F46] text-white shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                    >
                      {isAuthLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : authMode === 'login' ? (
                        <LogIn className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>{authMode === 'login' ? t('login') : t('register')}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODELS & SERVER */}
          {activeTab === 'models' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Section: Multiple Saved Models Manager */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0">
                  <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('savedModels')} ({modelsList.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setNewModelName('');
                      setNewModelId('');
                      setNewModelEndpoint('');
                      setNewModelApiKey('');
                      setShowAddForm(!showAddForm);
                    }}
                    className="self-start sm:self-auto text-xs sm:text-sm text-[#047857] dark:text-[#34D399] hover:underline flex items-center gap-1.5 font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('addModelBtn')}</span>
                  </button>
                </div>

                {/* List of Models */}
                <div className="space-y-2">
                  {modelsList.map((m) => {
                    const isActive = m.id === activeModelId || (!activeModelId && m.model === model);
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectProfile(m)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/30 border-[#86EFAC] dark:border-[#059669]/60 shadow-2xs'
                            : 'bg-white dark:bg-[#1E1E1C] border-[#E5E7EB] dark:border-[#333330] hover:border-[#86EFAC]'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#1F2937] dark:text-[#ECEBE8] truncate">
                              {m.name || m.model}
                            </span>
                            {isActive && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-[#047857] text-white font-mono font-medium">
                                {t('activeModelBadge')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono truncate">
                            <span>{m.model}</span>
                            {m.endpoint && <span className="opacity-60">• {m.endpoint}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActive ? (
                            <div className="w-7 h-7 rounded-full bg-[#047857] text-white flex items-center justify-center">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProfile(m);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#F9FAFB] dark:bg-[#2A2A27] border border-[#E5E7EB] dark:border-[#383835] hover:border-[#047857] hover:text-[#047857] text-[#1F2937] dark:text-[#ECEBE8] transition-colors"
                            >
                              {t('select')}
                            </button>
                          )}
                          {modelsList.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModel(m.id);
                              }}
                              className="p-2 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#2C2C29] rounded-lg transition-colors"
                              title={t('deleteChat')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Model Form */}
                {showAddForm && (
                  <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] space-y-3.5 animate-in fade-in duration-150">
                    <div className="font-semibold text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                      {t('addNewModel')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                          {t('modelDisplayName')}
                        </label>
                        <input
                          type="text"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="Masalan: Qwen 3.8 27B"
                          className="w-full px-3 py-2 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-sm font-sans text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                          {t('modelApiId')}
                        </label>
                        <input
                          type="text"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          placeholder="Masalan: Qwen/Qwen3.8-27B-FP8"
                          className="w-full px-3 py-2 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-sm font-mono text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                        {t('endpointLabel')}
                      </label>
                      <input
                        type="text"
                        value={newModelEndpoint}
                        onChange={(e) => setNewModelEndpoint(e.target.value)}
                        placeholder="http://localhost:11434 yoki http://localhost:8000/v1"
                        className="w-full px-3 py-2 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-sm font-mono text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                      />
                      {(newModelEndpoint.toLowerCase().includes('localhost') || newModelEndpoint.includes('127.0.0.1')) && (
                        <div className="mt-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{t('localhostWarning')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2.5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3.5 py-2 rounded-xl text-sm text-[#6B7280] hover:bg-black/5"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewModel}
                        disabled={!newModelId.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#047857] hover:bg-[#065F46] text-white disabled:opacity-50"
                      >
                        {t('addModelBtn')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Endpoint & Auth Inputs */}
              <div className="space-y-4 pt-4 border-t border-[#E5E7EB] dark:border-[#333330]">
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('serverConnection')}
                </h3>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
                    {t('endpointLabel')}
                  </label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder={t('endpointPlaceholder')}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:border-[#047857] text-sm font-mono"
                  />
                  {(endpoint.toLowerCase().includes('localhost') || endpoint.includes('127.0.0.1')) && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{t('localhostWarning')}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('apiKeyLabel')}
                    </span>
                    <span className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">{t('apiKeyOptional')}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t('apiKeyPlaceholder')}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:border-[#047857] text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 mb-1.5">
                    <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('modelLabel')}
                    </label>
                    <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                      {availableModels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAddAllFound(availableModels)}
                          className="text-xs text-[#047857] dark:text-[#34D399] hover:underline font-semibold"
                        >
                          {t('addAllFound')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleFetchModels}
                        disabled={isFetchingModels || !endpoint}
                        className="text-xs text-[#047857] dark:text-[#34D399] hover:underline flex items-center gap-1.5 font-semibold disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                        {isFetchingModels ? t('fetchingModels') : t('fetchModels')}
                      </button>
                    </div>
                  </div>

                  {availableModels.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857] text-sm font-mono"
                      >
                        {availableModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAvailableModels([])}
                        className="text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:underline"
                      >
                        {t('typeModelManually')}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={t('modelPlaceholder')}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:border-[#047857] text-sm font-mono"
                    />
                  )}
                </div>

                {/* Test Connection Button & Status */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus === 'loading' || !endpoint}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#F9FAFB] dark:bg-[#2A2A27] dark:hover:bg-[#333330] border border-[#E5E7EB] dark:border-[#383835] text-[#1F2937] dark:text-[#ECEBE8] text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    {testStatus === 'loading' ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#047857] dark:text-[#34D399]" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                    )}
                    {testStatus === 'loading' ? t('testingConnection') : t('testConnection')}
                  </button>

                  {testStatus === 'success' && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#E6F4EA] dark:bg-[#1E2822] border border-[#86EFAC] dark:border-[#2D4536] text-[#065F46] dark:text-[#78B48B] text-sm flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#047857] dark:text-[#34D399] shrink-0 mt-0.5" />
                      <div>{testMessage}</div>
                    </div>
                  )}

                  {testStatus === 'error' && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#FEE2E2] dark:bg-[#2C1F1B] border border-[#FCA5A5] dark:border-[#5C2B1D] text-[#991B1B] dark:text-[#F87171] text-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-[#DC2626] dark:text-[#F87171] shrink-0 mt-0.5" />
                      <div>{testMessage}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GENERATION PARAMETERS */}
          {activeTab === 'params' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('modelParams')}
              </h3>

              {/* Temperature & Top P */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8] mb-1.5 font-medium">
                    <span>{t('temperature')}</span>
                    <span className="font-mono text-[#047857] dark:text-[#34D399] font-semibold">{temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#047857] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8] mb-1.5 font-medium">
                    <span>{t('topP')}</span>
                    <span className="font-mono text-[#047857] dark:text-[#34D399] font-semibold">{topP}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full accent-[#047857] cursor-pointer"
                  />
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-0 mb-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                    {t('maxTokens')}
                  </label>
                  <span className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    Standart: 4096 (Tavsiya: 2048 – 8192)
                  </span>
                </div>
                <input
                  type="number"
                  min="256"
                  max="32768"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857] text-sm font-mono"
                />

                {/* Quick token presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mr-1">Tezkor tanlash:</span>
                  {[2048, 4096, 8192, 16384].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxTokens(val)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        maxTokens === val
                          ? 'bg-[#047857] text-white font-semibold'
                          : 'bg-[#F3F4F6] dark:bg-[#2A2A28] text-[#4B5563] dark:text-[#D1D5DB] hover:bg-[#E5E7EB] dark:hover:bg-[#333330]'
                      }`}
                    >
                      {val} {val === 4096 ? '(Standart)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
                  {t('systemPrompt')}
                </label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t('systemPromptPlaceholder')}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:border-[#047857] text-sm leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Privacy Notice */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8]">
                <ShieldCheck className="w-5 h-5 text-[#047857] dark:text-[#34D399] shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
                  <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                    {t('privacyNotice')}
                  </span>
                </div>
              </div>

              {/* Theme & Language Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330]">
                {/* Theme Selector */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-2 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('theme')}
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEEEEA] dark:bg-[#252522] rounded-xl border border-[#E5E7EB] dark:border-[#383835]">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs sm:text-sm transition-all ${
                        theme === 'light'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-[#CC785C]" />
                      <span>{t('themeLight')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs sm:text-sm transition-all ${
                        theme === 'dark'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-semibold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>{t('themeDark')}</span>
                    </button>
                  </div>
                </div>

                {/* Language Selector */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-2 flex items-center gap-1.5">
                    <Languages className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('language')}
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#EEEEEA] dark:bg-[#252522] rounded-xl border border-[#E5E7EB] dark:border-[#383835]">
                    <button
                      type="button"
                      onClick={() => setLanguage('uz')}
                      className={`py-1.5 px-2 rounded-lg text-xs sm:text-sm font-mono transition-all text-center ${
                        language === 'uz'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-bold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      uz
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`py-1.5 px-2 rounded-lg text-xs sm:text-sm font-mono transition-all text-center ${
                        language === 'en'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-bold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      eng
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('ru')}
                      className={`py-1.5 px-2 rounded-lg text-xs sm:text-sm font-mono transition-all text-center ${
                        language === 'ru'
                          ? 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#ECEBE8] shadow-xs font-bold'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] font-medium'
                      }`}
                    >
                      ru
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DATA MANAGEMENT & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {dataNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center gap-2 animate-in fade-in ${
                    dataNotice.type === 'success'
                      ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/20 border-[#86EFAC] text-[#047857] dark:text-[#34D399]'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 text-[#DC2626] dark:text-[#F87171]'
                  }`}
                >
                  {dataNotice.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  <span>{dataNotice.text}</span>
                </div>
              )}

              {/* Storage Usage Stat */}
              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                    <HardDrive className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                    <span>{t('storageUsage')}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                    {storageUsage.usedKb} KB ({storageUsage.usedMb} MB) {t('storageUsed')}
                  </span>
                </div>
                <div className="w-full bg-[#E5E7EB] dark:bg-[#333330] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#047857] dark:bg-[#34D399] h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(Math.max((storageUsage.usedKb / 5120) * 100, 2), 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Export & Import actions */}
              <div className="space-y-3">
                {/* Export Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-[#1F2937] dark:text-[#ECEBE8]">
                      {t('exportChats')}
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                      {t('exportChatsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportChats}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#262624] hover:bg-[#F9FAFB] dark:hover:bg-[#2C2C29] border border-[#E5E7EB] dark:border-[#383835] text-[#1F2937] dark:text-[#ECEBE8] shadow-2xs transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                    <span>{t('exportBtn')}</span>
                  </button>
                </div>

                {/* Danger Zone: Clear All Chats */}
                <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-[#DC2626] dark:text-[#F87171]">
                      {t('clearAllChats')}
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                      {t('clearAllChatsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllChats}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-2xs transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('clearAllBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3 border-t border-[#E5E7EB] dark:border-[#2D2D2A] bg-white dark:bg-[#1E1E1C] shrink-0 pb-safe">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#252522] transition-colors touch-manipulation"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#047857] hover:bg-[#065F46] text-white shadow-xs transition-colors touch-manipulation"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
