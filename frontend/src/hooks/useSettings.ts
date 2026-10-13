import { useState, useEffect, useCallback } from 'react';
import type { Settings, ModelProfile } from '../types';

const STORAGE_KEY = 'qwen_ui_settings_v2';

const DEFAULT_SETTINGS: Settings = {
  endpoint: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  systemPrompt: `Siz foydalanuvchiga har qanday mavzuda samimiy, aniq va sifatli yordam beruvchi universal sun'iy intellekt yordamchisisiz (ChatGPT uslubida).

ASOSIY QOIDALAR:
1. Muloqot va moslashuvchanlik:
- Foydalanuvchi qaysi tilda murojaat qilsa (o'zbek, rus, ingliz va h.k.), o'sha tilda ravon, tabiiy va xushmuomala javob qaytaring.
- Salomlashganda (masalan: "salom", "hi", "assalomu alaykum", "hello") samimiy va iliq kutib oling (masalan: "Salom! 👋😊 Xush kelibsiz! Bugun sizga qanday yordam bera olaman?").
- Foydalanuvchining har qanday savoliga (fan, ta'lim, dasturlash, tahlil, kundalik hayot, ijod, maslahat yoki erkin suhbat) aniq, tushunarli va to'liq javob bering. So'rovlarni asossiz rad etmang yoki sun'iy ravishda cheklamang.

2. Dasturlash va texnik savollar:
- Texnik yoki dasturlash masalalari so'ralganda, to'g'ri, xavfsiz va samarali yechim va kod taqdim eting.
- Kodlarni har doim sintaksisiga mos Markdown kod bloklarida (\`\`\`python, \`\`\`javascript, \`\`\`bash, \`\`\`html va h.k.) taqdim eting va zarur tushuntirishlarni bering.

3. Kontekst va suhbat uzluksizligi:
- Oldingi xabarlar tarixini to'liq inobatga olgan holda suhbatni mantiqiy va uzluksiz davom ettiring.`,
  theme: 'system',
  language: 'uz',
  models: [],
  activeModelId: '',
};

function normalizeSettings(s: Partial<Settings>): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS, ...s };
  let models = Array.isArray(result.models) ? [...result.models] : [];

  // Migration: Ensure systemPrompt is updated to universal ChatGPT assistant (clearing old rigid engineering rules)
  if (
    !result.systemPrompt ||
    result.systemPrompt.includes('muhandissan') ||
    result.systemPrompt.includes('mutlaqo ishlatma') ||
    result.systemPrompt.includes('1-qadamni bajar')
  ) {
    result.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
  }

  // Migration: If model or endpoint is set but models array is empty, populate it
  if (models.length === 0 && (result.model || result.endpoint)) {
    models.push({
      id: 'default-model',
      name: result.model ? result.model.split('/').pop() || result.model : 'Asosiy model',
      model: result.model || '',
      endpoint: result.endpoint || '',
      apiKey: result.apiKey || '',
    });
  }

  // Sanity check: Ensure maxTokens doesn't exceed safe output limit (e.g. if mistakenly set to context length 262144)
  if (result.maxTokens && result.maxTokens > 32768) {
    result.maxTokens = 4096;
  }
  models = models.map((m) => ({
    ...m,
    maxTokens: m.maxTokens && m.maxTokens > 32768 ? 4096 : m.maxTokens,
  }));

  // Ensure activeModelId is valid
  let activeId = result.activeModelId;
  if (!activeId || !models.some((m) => m.id === activeId)) {
    activeId = models[0]?.id || '';
  }

  // Sync current active model values
  const activeProfile = models.find((m) => m.id === activeId);
  if (activeProfile) {
    if (activeProfile.model) result.model = activeProfile.model;
    if (activeProfile.endpoint) result.endpoint = activeProfile.endpoint;
    if (activeProfile.apiKey !== undefined) result.apiKey = activeProfile.apiKey;
    if (activeProfile.temperature !== undefined) result.temperature = activeProfile.temperature;
    if (activeProfile.topP !== undefined) result.topP = activeProfile.topP;
    if (activeProfile.maxTokens !== undefined) {
      result.maxTokens = activeProfile.maxTokens > 32768 ? 4096 : activeProfile.maxTokens;
    }
  }

  result.models = models;
  result.activeModelId = activeId;
  return result;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return normalizeSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to parse saved settings', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Check if defaults exist in server .env (only if explicitly set in .env)
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setSettings((prev) => {
          let updated = { ...prev };
          let changed = false;
          if (!prev.endpoint && data.default_endpoint) {
            updated.endpoint = data.default_endpoint;
            changed = true;
          }
          if (!prev.model && data.default_model) {
            updated.model = data.default_model;
            changed = true;
          }
          if (changed) {
            const normalized = normalizeSettings(updated);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            } catch (e) {
              console.error(e);
            }
            return normalized;
          }
          return prev;
        });
      })
      .catch(() => {});
  }, []);

  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = normalizeSettings({ ...prev, ...newSettings });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings to localStorage', e);
      }
      return updated;
    });
  }, []);

  const switchModel = useCallback((modelId: string) => {
    setSettings((prev) => {
      const models = prev.models || [];
      const target = models.find((m) => m.id === modelId);
      if (!target) return prev;

      const updated: Settings = {
        ...prev,
        activeModelId: target.id,
        model: target.model,
        endpoint: target.endpoint || prev.endpoint,
        apiKey: target.apiKey !== undefined ? target.apiKey : prev.apiKey,
        temperature: target.temperature ?? prev.temperature,
        topP: target.topP ?? prev.topP,
        maxTokens: (target.maxTokens && target.maxTokens > 32768 ? 4096 : target.maxTokens) ?? prev.maxTokens,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const addModel = useCallback((profile: Omit<ModelProfile, 'id'>, makeActive = true) => {
    setSettings((prev) => {
      const newId = 'model-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const newProfile: ModelProfile = {
        ...profile,
        id: newId,
        name: profile.name.trim() || profile.model.trim() || 'Yangi model',
      };
      const models = [...(prev.models || []), newProfile];
      const updated: Settings = {
        ...prev,
        models,
        ...(makeActive
          ? {
              activeModelId: newId,
              model: newProfile.model,
              endpoint: newProfile.endpoint || prev.endpoint,
              apiKey: newProfile.apiKey !== undefined ? newProfile.apiKey : prev.apiKey,
            }
          : {}),
      };
      const normalized = normalizeSettings(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch (e) {
        console.error(e);
      }
      return normalized;
    });
  }, []);

  const deleteModel = useCallback((modelId: string) => {
    setSettings((prev) => {
      const models = (prev.models || []).filter((m) => m.id !== modelId);
      const updated = normalizeSettings({
        ...prev,
        models,
        activeModelId: prev.activeModelId === modelId ? (models[0]?.id || '') : prev.activeModelId,
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    saveSettings,
    switchModel,
    addModel,
    deleteModel,
    resetSettings,
    isConfigured: Boolean(settings.endpoint?.trim() && settings.model?.trim()),
  };
}
