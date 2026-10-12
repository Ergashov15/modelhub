export type ThemeMode = 'system' | 'dark' | 'light';
export type Language = 'uz' | 'en' | 'ru';

export interface ModelProfile {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  apiKey?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface Settings {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  theme: ThemeMode;
  language: Language;
  models?: ModelProfile[];
  activeModelId?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  previewUrl?: string;
  content?: string;
}

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  attachments?: FileAttachment[];
  sources?: WebSource[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
