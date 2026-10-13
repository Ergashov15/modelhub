import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, ChevronDown, Check, Plus, X } from 'lucide-react';
import type { ModelProfile, Language } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';

interface ModelSelectorProps {
  models: ModelProfile[];
  activeModelId?: string;
  currentModelName: string;
  onSelectModel: (id: string) => void;
  onOpenSettings: (tab?: string) => void;
  language: Language;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  activeModelId,
  currentModelName,
  onSelectModel,
  onOpenSettings,
  language,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = (key: TranslationKey) => getTranslation(language, key);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const effectiveModels: ModelProfile[] = models.length > 0
    ? models
    : currentModelName
    ? [{
        id: 'active-current',
        name: currentModelName.split('/').pop() || currentModelName,
        model: currentModelName,
        endpoint: '',
      }]
    : [];

  const activeModel = effectiveModels.find((m) => m.id === activeModelId || m.model === currentModelName);
  const displayName = activeModel?.name || currentModelName?.split('/').pop() || currentModelName || t('selectModel');

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2 py-1.5 px-2 sm:py-2 sm:px-3 rounded-xl border text-xs sm:text-sm transition-colors shadow-2xs select-none max-w-[130px] sm:max-w-[280px] touch-manipulation ${
          isOpen
            ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/30 border-[#86EFAC] dark:border-[#059669]/60 text-[#1F2937] dark:text-[#ECEBE8]'
            : 'bg-white dark:bg-[#1E1E1C] hover:bg-[#F9FAFB] dark:hover:bg-[#282825] border-[#E5E7EB] dark:border-[#333330] text-[#1F2937] dark:text-[#ECEBE8]'
        }`}
        title={t('switchModel')}
      >
        <Cpu className="w-4 h-4 text-[#047857] dark:text-[#34D399] shrink-0" />
        <span className="font-semibold truncate text-left">{displayName}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Model Selection Modal: Rendered via Portal directly into document.body to guarantee 100% visibility on all mobile browsers */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#333330] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title + count + Close button */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#333330] flex items-center justify-between bg-[#F3F4F6] dark:bg-[#252522]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                  {t('savedModels')}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#E6F4EA] text-[#047857] border border-[#86EFAC] font-semibold dark:bg-[#064E3B]/40 dark:text-[#6EE7B7] dark:border-[#059669]/50">
                  {effectiveModels.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#E5E7EB] dark:hover:bg-[#333330] transition-colors"
                title="Yopish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Model List */}
            <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto p-2 space-y-1">
              {effectiveModels.length === 0 ? (
                <div className="py-6 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  {t('noSavedModels')}
                </div>
              ) : (
                effectiveModels.map((m) => {
                  const isActive = m.id === activeModelId || m.model === currentModelName;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-sm text-left transition-colors ${
                        isActive
                          ? 'bg-[#E6F4EA] dark:bg-[#064E3B]/30 text-[#1F2937] dark:text-[#ECEBE8] border border-[#86EFAC] dark:border-[#059669]/60 shadow-2xs'
                          : 'bg-white dark:bg-[#1E1E1C] text-[#1F2937] dark:text-[#C5C3BA] hover:bg-[#F9FAFB] dark:hover:bg-[#262624] hover:text-[#1F2937] dark:hover:text-[#ECEBE8]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-sm text-[#1F2937] dark:text-[#ECEBE8] truncate flex items-center gap-2">
                          <span>{m.name || m.model}</span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#047857] text-white font-mono font-medium">
                              {t('activeModelBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono truncate mt-0.5">
                          {m.model}
                        </div>
                      </div>
                      {isActive && (
                        <Check className="w-5 h-5 text-[#047857] dark:text-[#34D399] shrink-0 stroke-[2.5]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer: Add Model / Open Settings */}
            <div className="p-2.5 border-t border-[#E5E7EB] dark:border-[#333330] bg-[#F9FAFB] dark:bg-[#181816]/60">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings('models');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-sm font-semibold text-[#1F2937] dark:text-[#ECEBE8] hover:bg-[#F9FAFB] dark:hover:bg-[#262624] border border-[#E5E7EB] dark:border-[#383835] transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                <span>{t('addModelBtn')} / {t('settings')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
