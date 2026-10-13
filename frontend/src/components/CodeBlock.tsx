import React, { useState, useMemo } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  ArrowDownToLine, 
  Play, 
  Terminal, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { getFormattedLanguageName, highlightCode, getLanguageKey } from '../utils/prismLoader';
import type { Language } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';

interface CodeBlockProps {
  language?: string;
  code: string;
  onInsert?: (code: string) => void;
  uiLanguage?: Language;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  code,
  onInsert,
  uiLanguage = 'uz',
}) => {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<string>('');

  const t = (key: TranslationKey) => getTranslation(uiLanguage, key);

  const langDisplayName = useMemo(() => {
    return getFormattedLanguageName(language);
  }, [language]);

  const langKey = useMemo(() => {
    return getLanguageKey(language);
  }, [language]);

  const highlightedHtml = useMemo(() => {
    return highlightCode(code, language);
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(code);
    } else {
      navigator.clipboard.writeText(code);
    }
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const handleRun = () => {
    setOutputOpen(true);
    setIsRunning(true);
    setOutputLogs([]);
    const startTime = performance.now();

    setTimeout(() => {
      const logs: string[] = [];

      // 1. If it's JavaScript or TypeScript, try client evaluation
      if (langKey === 'javascript' || langKey === 'js') {
        const capturedLogs: string[] = [];
        const originalLog = console.log;
        try {
          console.log = (...args: any[]) => {
            capturedLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
          };
          const fn = new Function(code);
          const res = fn();
          console.log = originalLog;

          if (capturedLogs.length > 0) {
            logs.push(...capturedLogs);
          }
          if (res !== undefined) {
            logs.push(`=> ${typeof res === 'object' ? JSON.stringify(res) : String(res)}`);
          }
          if (logs.length === 0) {
            logs.push('[Success] Kod xatosiz bajarildi (konsolga chiqish yo‘q).');
          }
        } catch (err: any) {
          console.log = originalLog;
          logs.push(`[Error] ${err.name}: ${err.message}`);
        }
      } else {
        // 2. For Python, PowerShell, Bash, SQL, etc., simulate CLI execution output
        const cmdPrefix = langKey === 'python' 
          ? '$ python script.py' 
          : langKey === 'powershell' 
          ? 'PS> .\\script.ps1' 
          : langKey === 'bash' || langKey === 'sh'
          ? '$ bash script.sh'
          : langKey === 'sql'
          ? 'SQL> EXPLAIN / QUERY EXEC'
          : `$ run ${langDisplayName.toLowerCase()}`;

        logs.push(cmdPrefix);

        // Extract print/echo/output statements if present
        const printLines: string[] = [];
        const lines = code.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          const pyPrint = trimmed.match(/^print\((.*)\)$/);
          if (pyPrint) {
            printLines.push(pyPrint[1].replace(/^['"]|['"]$/g, ''));
          }
          const echoMatch = trimmed.match(/^echo\s+(.*)$/i);
          if (echoMatch) {
            printLines.push(echoMatch[1].replace(/^['"]|['"]$/g, ''));
          }
        }

        if (printLines.length > 0) {
          logs.push(...printLines);
        } else {
          logs.push(`[Process finished with exit code 0]`);
        }
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      setExecutionTime(`${elapsed}s`);
      setOutputLogs(logs);
      setIsRunning(false);
    }, 400);
  };

  return (
    <div className="w-full my-3.5 rounded-2xl bg-[#F9FAFB] dark:bg-[#181816] border border-[#E5E7EB] dark:border-[#2C2C29] overflow-hidden shadow-2xs font-sans text-sm">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-[#E5E7EB] dark:border-[#2C2C29] bg-[#F3F4F6]/80 dark:bg-[#141412]/85 select-none gap-2">
        {/* Left: </> icon + Language Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Code2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#6B7280] dark:text-[#9CA3AF] shrink-0" />
          <span className="text-xs sm:text-sm font-mono font-semibold text-[#1F2937] dark:text-[#ECEBE8] truncate">
            {langDisplayName}
          </span>
        </div>

        {/* Right: Action Buttons (Insert / Copy / Run) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 1. Insert into chat / editor button */}
          <button
            type="button"
            onClick={handleInsert}
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#E5E7EB] dark:hover:bg-[#252522] transition-colors touch-manipulation"
            title={t('insertCode')}
          >
            <ArrowDownToLine className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
            <span className="hidden sm:inline">{inserted ? t('codeInserted') : t('insertCode')}</span>
          </button>

          {/* 2. Copy code button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#E5E7EB] dark:hover:bg-[#252522] transition-colors touch-manipulation"
            title={t('copy')}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#047857]" />
                <span className="text-[#047857] font-semibold text-xs">{t('copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">{t('copy')}</span>
              </>
            )}
          </button>

          {/* 3. Run button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="group flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-[13px] font-semibold bg-white dark:bg-[#222220] hover:bg-[#047857] hover:text-white border border-[#E5E7EB] dark:border-[#333330] hover:border-[#047857] text-[#1F2937] dark:text-[#ECEBE8] transition-colors shadow-2xs ml-0.5 disabled:opacity-50 touch-manipulation"
            title={t('runCode')}
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#047857] group-hover:text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current text-[#047857] group-hover:text-white" />
            )}
            <span>{t('runCode')}</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="w-full p-3 sm:p-4 overflow-x-auto max-h-[520px] overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed selection:bg-[#E6F4EA]">
        <pre className="w-full m-0 p-0 bg-transparent">
          <code className="block w-full" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>
      </div>

      {/* Interactive Execution Output Console Drawer */}
      {outputOpen && (
        <div className="border-t border-[#E5E7EB] dark:border-[#2C2C29] bg-[#141412] text-[#E0DFD5] p-3.5 font-mono text-xs sm:text-sm rounded-b-2xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2C2C29] text-xs text-[#8C8A82]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
              <span className="font-semibold text-[#ECEBE8]">
                {t('output')} ({langDisplayName})
              </span>
              {executionTime && (
                <span className="text-[11px] text-[#5B8A6E] bg-[#5B8A6E]/15 px-2 py-0.5 rounded font-sans">
                  ● {executionTime}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOutputOpen(false)}
              className="p-1 text-[#8C8A82] hover:text-[#ECEBE8] hover:bg-[#222220] rounded transition-colors"
              title={t('clearOutput')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto text-[#D6D5CD] leading-normal">
            {isRunning ? (
              <div className="flex items-center gap-2 text-[#8C8A82] py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CC785C]" />
                <span>{t('runningCode')}</span>
              </div>
            ) : outputLogs.length > 0 ? (
              outputLogs.map((line, idx) => (
                <div
                  key={idx}
                  className={`whitespace-pre-wrap ${
                    line.startsWith('$') || line.startsWith('PS>')
                      ? 'text-[#5B8A6E] font-semibold'
                      : line.startsWith('[Error]')
                      ? 'text-[#E87A64]'
                      : 'text-[#ECEBE8]'
                  }`}
                >
                  {line}
                </div>
              ))
            ) : (
              <div className="text-[#8C8A82] italic">Natija bo‘sh</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
