export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  preferences?: {
    theme: 'light' | 'dark';
    language: string;
  };
}

export interface ChatSource {
  url: string;
  title?: string;
}

export interface ChatMessage {
  id?: string;
  uid: string;
  sessionId: string;
  text: string;
  role: 'user' | 'bot';
  timestamp: any;
  sources?: (string | ChatSource)[];
  translation?: string;
  translatedLang?: string;
  isDeepThink?: boolean;
  agentId?: string;
}

export interface ChatSession {
  id: string;
  uid: string;
  title: string;
  createdAt: any;
}

export interface Feedback {
  id?: string;
  uid: string;
  email?: string;
  comment: string;
  type: 'feedback' | 'issue';
  timestamp: any;
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  completed: boolean;
  createdAt: any;
}

export interface Agent {
  id: string;
  name: string;
  label: string;
  role: string;
  persona: string;
  frameworks: string[];
  skills: string[];
  linguisticControls: string;
  avatar?: string;
  abilities: {
    toolCalling: boolean;
    mcpCalling: boolean;
    remoteConnection: boolean;
  };
  config: {
    apiUrl?: string;
    apiKey?: string;
    credentials?: string;
  };
  isPredefined?: boolean;
}

export type ViewState = 'chat' | 'agents' | 'settings' | 'intelligence' | 'admin' | 'tasks';
