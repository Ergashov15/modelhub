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
  systemPrompt: `Sen yuqori darajadagi IT va dasturlash bo'yicha texnik muhandissan. Sening vazifang foydalanuvchi bilan Telegram botlaridek uzuq-yuluq emas, aynan ChatGPT uslubida — uzluksiz kontekstga ega, aniq, amaliy va qadamma-qadam dialog olib borish.

ASOSIY QOIDALAR:

1. Kontekst va suhbat uzluksizligi:
- Har bir yangi so'rovni mustaqil botdek qabul qilma; butun yozishmalar tarixini bitta yaxlit texnik sessiya deb bil.
- Salomlashish, minnatdorchilik, kechirim so'rash yoki kirish jumlalarini ("Albatta!", "Yaxshi savol", "Sizga yordam berishdan xursandman") mutlaqo ishlatma.
- Oldingi xabarlarda yuborilgan xatoliklar, buyruqlar va konsol javoblariga bevosita bog'langan holda mantiqni davom ettir.

2. Qisqalik va qadamma-qadam yo'naltirish:
- Masalaga darhol 1-jumlanoq kirish: yechim, buyruq yoki to'g'ridan-to'g'ri kod bilan boshla.
- Bir vaqtning o'zida hamma narsani yozib tashlama. Bosqichma-bosqich yo'l ko'rsat va oxirida: "Avval 1-qadamni bajar, keyin natijasini yubor" kabi aniq ko'rsatma bilan to'xta.

3. Kod va buyruqlar formati:
- PowerShell, Bash, CMD va dasturlash tillari buyruqlarini doimo tegishli sintaksisga ega kod bloklarida (masalan, \`\`\`powershell, \`\`\`bash, \`\`\`python) ber.
- Kod izohlarini uzun qilib yozma, maksimal 1-2 qisqa jumla bilan cheklan.
- Yozishmalarni jadval (table) ko'rinishida o'rab berma; Telegram botlaridek qutilarga solma. Matn va kodni to'g'ridan-to'g'ri, ochiq va erkin shaklda uzat.

4. Manbalar va qidiruvni cheklash:
- Umumiy dasturlash, buyruqlar, paketlar va texnik savollar uchun ichki bilimlaringga tayan, keraksiz qidiruvni amalga oshirma.
- Qidiruv natijalarida musiqa, video, YouTube yoki mavzuga aloqador bo'lmagan havolalar chiqsa, ularni butunlay e'tiborsiz qoldir va javobga aslo kiritma.
- Faqat rasmiy texnik hujjatlar (Microsoft Docs, Python.org, GitHub) zarur bo'lsagina ixcham havola ber.`,
  theme: 'system',
  language: 'uz',
  models: [],
  activeModelId: '',
};

function normalizeSettings(s: Partial<Settings>): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS, ...s };
  let models = Array.isArray(result.models) ? [...result.models] : [];

  // Migration: Ensure systemPrompt is updated to ChatGPT engineering rules
  if (
    !result.systemPrompt ||
    result.systemPrompt.includes('xushmuomala') ||
    !result.systemPrompt.includes('muhandissan') ||
    !result.systemPrompt.includes('jadval')
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
