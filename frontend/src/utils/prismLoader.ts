import Prism from 'prismjs';

// Import Prism language definitions
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-docker';

const LANGUAGE_MAP: Record<string, string> = {
  py: 'python',
  python: 'python',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  powershell: 'powershell',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  html: 'markup',
  xml: 'markup',
  go: 'go',
  golang: 'go',
  rs: 'rust',
  rust: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  docker: 'docker',
  dockerfile: 'docker',
};

const DISPLAY_NAMES: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  bash: 'Bash',
  powershell: 'PowerShell',
  json: 'JSON',
  yaml: 'YAML',
  sql: 'SQL',
  markdown: 'Markdown',
  css: 'CSS',
  markup: 'HTML',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  docker: 'Dockerfile',
};

export function getLanguageKey(lang?: string): string {
  if (!lang) return 'text';
  const clean = lang.trim().toLowerCase();
  return LANGUAGE_MAP[clean] || clean;
}

export function getFormattedLanguageName(lang?: string): string {
  if (!lang || !lang.trim()) return 'Code';
  const key = getLanguageKey(lang);
  return DISPLAY_NAMES[key] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightCode(code: string, lang?: string): string {
  if (!code) return '';
  const key = getLanguageKey(lang);
  const grammar = Prism.languages[key];

  if (grammar) {
    try {
      return Prism.highlight(code, grammar, key);
    } catch {
      return escapeHtml(code);
    }
  }

  return escapeHtml(code);
}
