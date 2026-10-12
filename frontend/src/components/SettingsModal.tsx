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
  Monitor, 
  Languages,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import type { Settings, ThemeMode, Language, ModelProfile } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { applyTheme } from '../hooks/useTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <SettingsModalContent
      settings={settings}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

interface SettingsModalContentProps {
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Partial<Settings>) => void;
}

const SettingsModalContent: React.FC<SettingsModalContentProps> = ({
  settings,
  onClose,
  onSave,
}) => {
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

  // Inline "Add model" form state - by default all fields are empty
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelEndpoint, setNewModelEndpoint] = useState('');
  const [newModelApiKey, setNewModelApiKey] = useState('');

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#242422] border border-[#E5E5DF] dark:border-[#333330] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] text-[#1F1E1D] dark:text-[#ECEBE8]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] dark:border-[#333330] bg-[#F7F5EE] dark:bg-[#1E1E1C]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E6F4EA] dark:bg-[#064E3B]/30 text-[#047857] dark:text-[#34D399] border border-[#86EFAC]/60">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                {t('settingsTitle')}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#EFECE4] dark:hover:bg-[#2C2C29] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Security Banner */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F5EE] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8]">
            <ShieldCheck className="w-5 h-5 text-[#047857] dark:text-[#34D399] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
              <span className="font-semibold text-[#1F2937] dark:text-[#ECEBE8]">
                {t('privacyNotice')}
              </span>
            </div>
          </div>

          {/* Theme & Language Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F7F5EE] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330]">
            {/* Theme Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-2 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('theme')}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#EFECE4] dark:bg-[#2A2A27] rounded-xl border border-[#E5E7EB] dark:border-[#383835]">
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'system'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{t('themeSystem')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{t('themeLight')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t('themeDark')}</span>
                </button>
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#ECEBE8] mb-2 flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('language')}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#EFECE4] dark:bg-[#2A2A27] rounded-xl border border-[#E5E7EB] dark:border-[#383835]">
                <button
                  type="button"
                  onClick={() => setLanguage('uz')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium font-mono transition-colors text-center ${
                    language === 'uz'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  uz
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium font-mono transition-colors text-center ${
                    language === 'en'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  eng
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ru')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium font-mono transition-colors text-center ${
                    language === 'ru'
                      ? 'bg-white dark:bg-[#1E1E1C] text-[#047857] dark:text-[#34D399] shadow-2xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                  }`}
                >
                  ru
                </button>
              </div>
            </div>
          </div>

          {/* Section: Multiple Saved Models Manager */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5">
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
                className="text-xs text-[#047857] dark:text-[#34D399] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
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
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/30 border-[#86EFAC] dark:border-[#059669]/60 shadow-2xs'
                        : 'bg-white dark:bg-[#1E1E1C] border-[#E5E7EB] dark:border-[#333330] hover:border-[#86EFAC]'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1F2937] dark:text-[#ECEBE8] truncate">
                          {m.name || m.model}
                        </span>
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#047857] text-white font-mono font-medium">
                            {t('activeModelBadge')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6B7280] dark:text-[#9CA3AF] font-mono truncate">
                        <span>{m.model}</span>
                        {m.endpoint && <span className="opacity-60">• {m.endpoint}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <div className="w-6 h-6 rounded-full bg-[#047857] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProfile(m);
                          }}
                          className="px-2 py-1 text-[11px] font-medium rounded-lg bg-[#F9FAFB] dark:bg-[#2A2A27] border border-[#E5E7EB] dark:border-[#383835] hover:border-[#047857] hover:text-[#047857] text-[#1F2937] dark:text-[#ECEBE8] transition-colors"
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
                          className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#2C2C29] rounded transition-colors"
                          title={t('deleteChat')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Model Form */}
            {showAddForm && (
              <div className="p-4 rounded-xl bg-[#F7F5EE] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] space-y-3 animate-in fade-in duration-150">
                <div className="font-semibold text-xs text-[#1F2937] dark:text-[#ECEBE8]">
                  {t('addNewModel')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                      {t('modelDisplayName')}
                    </label>
                    <input
                      type="text"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      placeholder="Masalan: Qwen 3.8 27B"
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-lg text-xs font-sans text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                      {t('modelApiId')}
                    </label>
                    <input
                      type="text"
                      value={newModelId}
                      onChange={(e) => setNewModelId(e.target.value)}
                      placeholder="Masalan: Qwen/Qwen3.8-27B-FP8"
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-lg text-xs font-mono text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                    {t('endpointLabel')}
                  </label>
                  <input
                    type="text"
                    value={newModelEndpoint}
                    onChange={(e) => setNewModelEndpoint(e.target.value)}
                    placeholder="http://localhost:11434 yoki http://localhost:8000/v1"
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] rounded-lg text-xs font-mono text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:border-[#047857]"
                  />
                  {/* Quick endpoint presets */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">Tezkor:</span>
                    <button
                      type="button"
                      onClick={() => setNewModelEndpoint('http://localhost:11434')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#047857] transition-colors"
                    >
                      Ollama (11434)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewModelEndpoint('http://localhost:1234/v1')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#047857] transition-colors"
                    >
                      LM Studio (1234)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewModelEndpoint('http://localhost:8000/v1')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#047857] transition-colors"
                    >
                      vLLM (8000)
                    </button>
                  </div>
                </div>

                {/* Available models quick chips if fetched */}
                {availableModels.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280] mb-1">
                      Topilgan modellar (bosib tanlang):
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {availableModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setNewModelId(m);
                            if (!newModelName) setNewModelName(m.split('/').pop() || m);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-[#262624] border border-[#86EFAC] text-[#047857] dark:text-[#34D399] hover:bg-[#E6F4EA] font-mono transition-colors"
                        >
                          + {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewModelName('');
                      setNewModelId('');
                      setNewModelEndpoint('');
                      setNewModelApiKey('');
                      setShowAddForm(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-[#6B7280] hover:bg-black/5"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewModel}
                    disabled={!newModelId.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#047857] hover:bg-[#065F46] text-white disabled:opacity-50"
                  >
                    {t('addModelBtn')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Endpoint & Auth of Active Model */}
          <div className="space-y-4 pt-4 border-t border-[#E5E7EB] dark:border-[#333330]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('serverConnection')}
            </h3>

            {/* Endpoint */}
            <div>
              <label className="block text-xs font-medium text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
                {t('endpointLabel')}
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={t('endpointPlaceholder')}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-sm font-mono"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-[#1F2937] dark:text-[#ECEBE8] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" /> {t('apiKeyLabel')}
                </span>
                <span className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280]">{t('apiKeyOptional')}</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-sm font-mono"
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

            {/* Model Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#1F2937] dark:text-[#ECEBE8] flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" /> {t('modelLabel')}
                </label>
                <div className="flex items-center gap-3">
                  {availableModels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddAllFound(availableModels)}
                      className="text-[11px] text-[#047857] dark:text-[#34D399] hover:underline font-medium"
                    >
                      {t('addAllFound')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={isFetchingModels || !endpoint}
                    className="text-[11px] text-[#047857] dark:text-[#34D399] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                    {isFetchingModels ? t('fetchingModels') : t('fetchModels')}
                  </button>
                </div>
              </div>

              {availableModels.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-sm font-mono"
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
                    className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] hover:underline"
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
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-sm font-mono"
                />
              )}
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'loading' || !endpoint}
                className="w-full py-2 px-4 rounded-xl bg-white hover:bg-[#F9FAFB] dark:bg-[#2A2A27] dark:hover:bg-[#333330] border border-[#E5E7EB] dark:border-[#383835] text-[#1F2937] dark:text-[#ECEBE8] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-2xs"
              >
                {testStatus === 'loading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#047857] dark:text-[#34D399]" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                )}
                {testStatus === 'loading' ? t('testingConnection') : t('testConnection')}
              </button>

              {testStatus === 'success' && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#E6F4EA] dark:bg-[#1E2822] border border-[#86EFAC] dark:border-[#2D4536] text-[#065F46] dark:text-[#78B48B] text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-[#34D399] shrink-0 mt-0.5" />
                  <div>{testMessage}</div>
                </div>
              )}

              {testStatus === 'error' && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#FEE2E2] dark:bg-[#2C1F1B] border border-[#FCA5A5] dark:border-[#5C2B1D] text-[#991B1B] dark:text-[#F87171] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] shrink-0 mt-0.5" />
                  <div>{testMessage}</div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Generation Parameters */}
          <div className="space-y-4 pt-4 border-t border-[#E5E7EB] dark:border-[#333330]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#047857] dark:text-[#34D399]" /> {t('modelParams')}
            </h3>

            {/* Temperature & Top P */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
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
                <div className="flex justify-between text-xs text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                  {t('maxTokens')}
                </label>
                <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
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
                className="w-full px-3.5 py-2 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-sm font-mono"
              />

              {/* Tezkor preset tugmalari */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mr-1">Tezkor tanlash:</span>
                {[2048, 4096, 8192, 16384].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxTokens(val)}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-mono transition-colors ${
                      maxTokens === val
                        ? 'bg-[#047857] text-white font-semibold'
                        : 'bg-[#F3F4F6] dark:bg-[#2A2A28] text-[#4B5563] dark:text-[#D1D5DB] hover:bg-[#E5E7EB] dark:hover:bg-[#333330]'
                    }`}
                  >
                    {val} {val === 4096 ? '(Standart)' : ''}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1.5 leading-relaxed">
                Bu modelning bitta javobida hosil qiladigan maksimal tokenlar (so‘z/belgi) soni. Umumiy kontekst oynasi (masalan, 256k / 262144) bilan adashtirmang.
              </p>

              {maxTokens > 16384 && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-1.5">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>
                    Diqqat: {maxTokens} token juda katta. Agar bu qiymat modelning umumiy kontekstiga teng yoki yaqin bo‘lsa, so‘rov kiritishga joy qolmaydi va <strong>400 xatolik</strong> beradi. 4096 yoki 8192 ni tanlash tavsiya etiladi.
                  </span>
                </div>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-medium text-[#1F2937] dark:text-[#ECEBE8] mb-1.5">
                {t('systemPrompt')}
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('systemPromptPlaceholder')}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] rounded-xl text-[#1F2937] dark:text-[#ECEBE8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857] text-xs leading-relaxed resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] dark:border-[#333330] bg-[#F7F5EE] dark:bg-[#1E1E1C]">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#ECEBE8] hover:bg-[#EFECE4] dark:hover:bg-[#2C2C29] transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#047857] hover:bg-[#065F46] text-white shadow-xs transition-colors"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
