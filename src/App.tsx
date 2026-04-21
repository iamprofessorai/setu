import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, Globe, Cpu, ShieldCheck, BookOpen, 
  Mic, MicOff, Volume2, VolumeX, LogIn, LogOut, 
  Search, MapPin, Brain, Loader2, AlertCircle,
  Shield, Sun, Moon, CheckCircle, Circle, Settings,
  MessageSquare, Plus, Trash2, Copy, RotateCcw,
  Share2, Languages, Upload, History, User,
  Check, X, MessageCircle, Flag, ExternalLink, Quote,
  ChevronRight, MoreVertical, Paperclip, Zap,
  Pencil, Save, Clock, RefreshCw, Users, Calendar,
  PanelLeftClose, PanelLeftOpen, LayoutGrid, Palette, Landmark,
  Activity, Database, Terminal, Menu,
  TrendingUp, BarChart2, DollarSign, ShieldAlert,
  Sprout, Handshake, Wrench, Target, ArrowDown,
  FileText, FileJson, FileCode, Link, Download, Eye,
  Filter, Book, ChevronDown, ArrowRight,
  ChevronUp, GitBranch, Cpu as CpuIcon, Network, Layers,
  Lock, Key, Sliders, Briefcase, FileCode2, Zap as ZapIcon,
  ChevronLeft, Power, FileCheck, Star, Pin, Edit3, Calculator, Hash, NotepadText as Notepad, Save as SaveIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  db, storage, auth,
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, deleteDoc, where, getDocs, limit, ref, uploadBytes, getDownloadURL
} from './firebase';
import { getGeminiResponse, translateText, analyzeTradeDeficit } from './services/gemini';
import { UserProfile, ChatMessage, ChatSession, Task, ViewState, Feedback, Agent } from './types';
import VoiceEngine from './components/VoiceEngine';

import { cn } from './lib/utils';

// --- TYPES ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  sidebar: string;
  sidebarText: string;
  sidebarAccent: string;
  isDark: boolean;
}

const INDIAN_LANGUAGES = ['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil'];
const INT_LANGUAGES = ['Spanish', 'French', 'German', 'Chinese', 'Japanese'];

const BHARAT_THEME = {
  light: {
    primary: '#FF9933', // Indian Saffron
    secondary: '#138808', // Indian Green
    accent: '#000080', // Ashoka Navy
    background: '#ffffff',
    text: '#202124',
    sidebar: '#ffffff',
    sidebarText: '#5f6368',
    sidebarAccent: '#FF9933',
    isDark: false
  } as ThemePalette,
  dark: {
    primary: '#4285f4', // Google Blue
    secondary: '#34a853', // Google Green
    accent: '#ea4335', // Google Red
    background: '#0f1115',
    text: '#e8eaed',
    sidebar: '#161a1f',
    sidebarText: '#9aa0a6',
    sidebarAccent: '#4285f4',
    isDark: true
  } as ThemePalette
};

const PREDEFINED_SKILLS = [
  { id: 'trade_policy', name: 'Trade Policy Analyst', instruction: 'Deep analysis of FTP 2023, WTO rules, and bilateral pacts.' },
  { id: 'compliance_audit', name: 'Compliance Auditor', instruction: 'GST, Customs, and regulatory compliance verification.' },
  { id: 'market_intel', name: 'Market Intelligence', instruction: 'Real-time commodity and currency trend forecasting.' },
  { id: 'legal_advisor', name: 'Legal Trade Advisor', instruction: 'Drafting and reviewing trade agreements and dispute mediation.' }
];

const DEFAULT_OBJECTIVES: Record<string, string[]> = {
  'hybrid': ['Analyze Q3 trade deficit', 'Summarize new FTP guidelines', 'Monitor global supply chain disruptions'],
  'policy': ['Track RBI interest rate changes', 'Analyze impact of new tax slabs', 'Review macro-economic indicators'],
  'exim': ['Optimize export incentives for textiles', 'Map RoDTEP rates for engineering goods', 'Analyze import duty structures'],
  'compliance': ['Audit GST compliance for Q2', 'Review new corporate law amendments', 'Monitor regulatory changes in pharma'],
  'agri': ['Analyze APEDA export data', 'Track global wheat prices', 'Review agricultural subsidies'],
  'diplomacy': ['Monitor India-UK FTA progress', 'Analyze bilateral trade with UAE', 'Review diplomatic trade statements'],
  'treaty': ['Map cross-border tariff reductions', 'Analyze non-tariff barriers in EU', 'Review WTO dispute settlements'],
  'agreement': ['Track bilateral investment treaties', 'Analyze trade agreement utilization rates', 'Monitor safeguard measures']
};

const PREDEFINED_AGENTS: Agent[] = [
  {
    id: 'policy_analyst',
    label: 'Trade Policy Analyst',
    name: 'Siddhartha',
    role: 'Senior Trade Policy Strategist',
    persona: 'Authoritative, analytical, and deeply knowledgeable about global trade frameworks, FTP 2023, and WTO regulations.',
    responseStyle: 'analytical',
    category: 'Core Intelligence',
    icon: 'BarChart2',
    frameworks: ['Foreign Trade Policy (FTP) 2023', 'WTO Dispute Settlement Mechanism', 'India-UAE CEPA'],
    skills: ['Policy Gap Analysis', 'Tariff Logic Forecasting', 'Bilateral Treaty Synthesis'],
    linguisticControls: 'Use professional, objective tone. Technical terms should be explained with brevity.',
    abilities: { toolCalling: true, mcpCalling: false, remoteConnection: false },
    config: {},
    isPredefined: true
  },
  {
    id: 'exim_compliance',
    label: 'EXIM Compliance Officer',
    name: 'Anjali',
    role: 'Export-Import Compliance Head',
    persona: 'Rigorous, detail-oriented officer focused on GST, Customs compliance, and export incentive optimization.',
    responseStyle: 'formal',
    category: 'Specialized Trade',
    icon: 'ShieldCheck',
    frameworks: ['GST Act 2017', 'Customs Act 1962', 'RoDTEP & RoSCTL Guidelines'],
    skills: ['Drawback Optimization', 'SCOMET Compliance Audit', 'DGFT Liaison Support'],
    linguisticControls: 'Clear, procedural language. Heavy focus on regulatory accuracy and deadline alerts.',
    abilities: { toolCalling: true, mcpCalling: true, remoteConnection: false },
    config: {},
    isPredefined: true
  },
  {
    id: 'agri_consultant',
    label: 'Agri-Trade Consultant',
    name: 'Rajinder',
    role: 'Agricultural Export Specialist',
    persona: 'Practical, market-aware consultant focused on APEDA norms, global commodity price cycles, and SPS/TBT measures.',
    responseStyle: 'detailed',
    category: 'Specialized Trade',
    icon: 'Sprout',
    frameworks: ['APEDA Quality Standards', 'FSSAI Export Norms', 'GlobalGAP Standards'],
    skills: ['Commodity price tracking', 'SPS barrier mitigation', 'Frieght cost analysis'],
    linguisticControls: 'Accessible yet technical. Focus on seasonal trends and rural-to-global supply chain logistics.',
    abilities: { toolCalling: true, mcpCalling: false, remoteConnection: true },
    config: { apiUrl: 'https://api.agri-intel.nic.in' },
    isPredefined: true
  }
];

const AGENT_CATEGORY_MODELS = [
  { 
    id: 'core',
    label: 'Core Intelligence',
    icon: Brain,
    desc: 'Foundational analysis and macro-economic tracking.'
  },
  {
    id: 'specialized',
    label: 'Specialized Trade',
    icon: Globe,
    desc: 'Sector-specific optimization and compliance.'
  },
  {
    id: 'custom',
    label: 'Custom Nodes',
    icon: Cpu,
    desc: 'User-defined specialized intelligence units.'
  }
];

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Ensure error is a simple string to avoid circularity if it's a Firebase object
  const cleanError = error instanceof Error 
    ? error.message 
    : (typeof error === 'object' && error !== null ? JSON.stringify(error, (key, value) => key === 'src' || key === 'i' ? undefined : value).substring(0, 500) : String(error));
    
  const errInfo: FirestoreErrorInfo = {
    error: cleanError,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', cleanError);
  // Only stringify if we are sure it's safe now
  try {
    const stringified = JSON.stringify(errInfo);
    throw new Error(stringified);
  } catch (e) {
    throw new Error(`Firestore Error [${operationType}] at ${path}: ${cleanError}`);
  }
}

// --- COMPONENTS ---
const ForgeReportModal = ({ content, isOpen, onClose }: { content: string, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 shadow-2xl rounded-none flex flex-col relative border-[12px] border-zinc-100 dark:border-zinc-800"
      >
        <div className="p-8 border-b-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 text-white">
              <FileCheck size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Strategic Intelligence Report</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Classification: Level-4 Envoy Directive</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 border-2 border-zinc-200 dark:border-zinc-700 hover:bg-rose-500 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="p-10 md:p-16 overflow-y-auto max-h-[70vh] bg-[#fdfdfd] dark:bg-[#0c0c0c] font-serif">
          <div className="max-w-2xl mx-auto space-y-12">
            <header className="border-b-8 border-primary/20 pb-12 mb-12 text-center">
              <div className="flex justify-center mb-8">
                 <div className="w-16 h-16 border-4 border-primary flex items-center justify-center font-black text-2xl italic text-primary">S</div>
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tight mb-4 italic">BCC STRATEGIC MATRICES</h1>
              <div className="flex items-center justify-center gap-8 text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                <span>Ref: DIRECTIVE-2026-NX-4</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
            </header>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
              </ReactMarkdown>
            </div>
            <footer className="mt-20 pt-10 border-t-2 border-zinc-100 dark:border-zinc-800 text-center space-y-6">
              <p className="text-[10px] uppercase font-black tracking-[0.5em] opacity-20">EndOfTransmission_Node_Auth_Confirmed</p>
              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors"
                >
                  Print Directive
                </button>
              </div>
            </footer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AnimatedLogo = ({ theme }: { theme: ThemePalette }) => {
  const letters = "SETU".split("");
  const flagColors = ['#FF9933', '#999999', '#138808', '#000080'];
  const googlyColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
  return (
    <div className="flex items-center gap-[1px]">
      {letters.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: i * 0.05, 
            duration: 0.3,
            ease: "easeOut"
          }}
          className="text-xl md:text-3xl font-black uppercase italic tracking-tighter"
          style={{ 
            color: theme.isDark ? googlyColors[i % googlyColors.length] : flagColors[i], 
            textShadow: theme.isDark ? `0 0 15px ${googlyColors[i % googlyColors.length]}44` : 'none' 
          }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center" style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}>
          <AlertCircle className="w-16 h-16 mb-4" style={{ color: '#EA4335' }} />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="mb-4 max-w-md font-medium" style={{ opacity: 0.8 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-xl transition-colors font-bold shadow-lg"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-background border-4 border-primary p-8 w-full max-w-lg relative z-10 shadow-[8px_8px_0px_0px_var(--primary)]"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
      >
        <div className="flex items-center gap-6 mb-8 border-b-4 pb-6" style={{ borderColor: 'var(--primary)' }}>
          <div className="w-20 h-20 border-4 flex items-center justify-center text-2xl font-black bg-primary text-background" style={{ borderColor: 'var(--text)' }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
            ) : (
              <span>{user.displayName?.split(' ').map((n: any) => n[0]).join('') || 'UN'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter truncate" style={{ color: 'var(--text)' }}>{user.displayName || 'System Executive'}</h2>
            <p className="text-xs font-black uppercase tracking-widest opacity-60 truncate" style={{ color: 'var(--text)' }}>{user.email || 'executive@bharatchamber.com'}</p>
          </div>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center p-3 border-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--text)' }}>Node Status</span>
            <span className="text-[10px] font-black uppercase text-secondary">Authorized / Synced</span>
          </div>
          <div className="flex justify-between items-center p-3 border-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--text)' }}>Security Clearance</span>
            <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text)' }}>Level 4 Executive</span>
          </div>
          <div className="flex justify-between items-center p-3 border-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--text)' }}>Terminal ID</span>
            <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text)' }}>BCI-NODE-7829-X</span>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full py-4 bg-primary text-background font-black uppercase tracking-[0.2em] italic hover:translate-x-1 hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_0px_var(--text)] border-2"
          style={{ borderColor: 'var(--text)' }}
        >
          Close Dossier
        </button>
      </motion.div>
    </div>
  );
};

// --- CUSTOM TOOLTIP COMPONENT ---
const Tooltip = ({ children, content, className }: { children: React.ReactNode, content?: string, className?: string }) => {
  if (className) {
    return <div className={className} title={content}>{children}</div>;
  }
  return <div title={content} className="inline-block">{children}</div>;
};

const ChatMessageComponent = ({ msg, isUser, onSpeech, onTranslate, onCopy, onRegenerate, onShare, onEdit, onDelete }: { 
  msg: ChatMessage, 
  isUser: boolean,
  onSpeech?: (text: string) => void,
  onTranslate: (text: string, lang: string) => void,
  onCopy: (text: string) => void,
  onRegenerate: (msgId: string) => void,
  onShare: (text: string) => void,
  onEdit: (msgId: string, text: string) => void,
  onDelete: (msgId: string) => void
}) => {
  const [showTranslate, setShowTranslate] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);

  const handleSave = () => {
    if (editText.trim() !== msg.text) {
      onEdit(msg.id || '', editText);
    }
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.99, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col w-full mb-6 md:mb-8 group relative z-0",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-3 mb-2 px-1">
        <div className={cn(
          "w-10 h-10 rounded-none border-2 flex items-center justify-center transition-all duration-500",
          isUser ? "bg-primary text-white border-primary shadow-[4px_4px_0_0_rgba(var(--primary-rgb),0.3)]" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-primary shadow-[4px_4px_0_0_rgba(var(--primary-rgb),0.05)]"
        )}>
          {isUser ? <User size={20} /> : <Cpu size={20} />}
        </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-black tracking-tight text-zinc-800 dark:text-zinc-200 uppercase group-hover:text-primary transition-colors">
              {isUser ? 'Neural Observer' : (msg.agentId ? `${msg.agentId} Agent` : 'Setu Intelligence Envoy')}
            </span>
            {msg.isDeepThink && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">Neural Synthesis...</span>
              </div>
            )}
          </div>
      </div>
      <div className={cn(
        "max-w-[92%] md:max-w-[85%] relative transition-all duration-300",
        isUser ? "bubble-user" : "bubble-bot"
      )}>
        {isEditing ? (
          <div className="flex flex-col gap-2 min-w-[200px] md:min-w-[300px] p-4">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-none p-3 text-[14px] font-medium outline-none min-h-[100px] resize-none border-2 border-primary/20 focus:border-primary transition-all"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setIsEditing(false); setEditText(msg.text); }}
                className="p-2 rounded-none border-2 border-zinc-200 dark:border-zinc-700 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
              >
                <X size={16} />
              </button>
              <button 
                onClick={handleSave}
                className="p-2 px-4 rounded-none bg-primary text-white font-black uppercase text-[10px] tracking-widest border-2 border-primary"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className={cn(
             "prose prose-sm max-w-none text-[15px] md:text-[16px] leading-[1.6] font-medium prose-container custom-scrollbar tracking-tight",
             isUser ? "font-sans" : "font-serif italic selection:bg-primary selection:text-white"
          )}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({node, ...props}) => (
                  <div className="w-full overflow-x-auto custom-scrollbar my-4 rounded-none border-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
                    <table className="w-full text-left" {...props} />
                  </div>
                ),
                pre: ({node, ...props}) => (
                  <div className="w-full overflow-x-auto custom-scrollbar my-4 rounded-none border-4 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-inner">
                    <pre {...props} className="p-4 inline-block min-w-full m-0 bg-transparent border-none" />
                  </div>
                )
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}
        
        {msg.sources && msg.sources.length > 0 && (
          <div className={cn(
            "mt-4 pt-3 border-t-2",
            isUser ? "border-primary/30" : "border-background/10"
          )} style={{ borderColor: 'var(--primary)' }}>
            <button 
              onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
              className="flex items-center justify-between w-full group py-1"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1 transition-all",
                  isSourcesExpanded ? "bg-primary text-background" : "bg-primary/10 text-primary"
                )}>
                  <ExternalLink size={10} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                  Intelligence Matrix [{msg.sources.length} Nodes]
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[7px] font-black uppercase tracking-widest opacity-100 group-hover:opacity-100 transition-opacity">
                  {isSourcesExpanded ? 'Collapse' : 'Expand Origin'}
                </span>
                <motion.div animate={{ rotate: isSourcesExpanded ? 180 : 0 }}>
                  <ChevronRight size={10} className="text-primary" />
                </motion.div>
              </div>
            </button>

            <AnimatePresence>
              {isSourcesExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-1.5">
                    {msg.sources.map((s: any, idx: number) => {
                      const url = typeof s === 'string' ? s : s.url;
                      const hostname = new URL(url).hostname.replace('www.', '');
                      const title = typeof s === 'object' && s.title ? s.title : "Trade Intelligence Document";
                      
                      let displayTitle = title;
                      if (displayTitle.toLowerCase().includes('vertexaisearch') || displayTitle.toLowerCase().includes('google.com')) {
                        displayTitle = `Bharat Trade Intelligence Node`;
                      }

                      return (
                        <a 
                          key={idx}
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-3 p-1.5 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group"
                        >
                          <span className="text-[8px] font-black text-primary opacity-100 group-hover:opacity-100 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[7px] font-black px-1 bg-primary/10 text-primary uppercase tracking-tighter shrink-0">
                              {hostname}
                            </span>
                            <p className="text-[9px] font-black uppercase tracking-tight truncate opacity-100 group-hover:opacity-100 group-hover:text-primary transition-all">
                              {displayTitle}
                            </p>
                          </div>
                          <ExternalLink size={8} className="text-primary opacity-0 group-hover:opacity-100" />
                        </a>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {msg.translation && (
          <div className="mt-3 p-3 border-l-4 italic text-[11px] md:text-[12px] prose-container custom-scrollbar" style={{ borderColor: 'var(--secondary)', backgroundColor: 'rgba(var(--secondary-rgb), 0.1)', color: 'inherit' }}>
            <p className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-100" style={{ color: 'var(--secondary)' }}>Translated to {msg.translatedLang}:</p>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.translation}</ReactMarkdown>
          </div>
        )}

        {/* Message Tools */}
        <div className={cn(
          "mt-2 pt-2 border-t-2 flex items-center justify-between transition-opacity",
          "opacity-100 group-hover:opacity-100"
        )} style={{ borderColor: isUser ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--primary-rgb), 0.3)' }}>
          <div className="flex items-center gap-2">
            {isUser ? (
              <div className="flex items-center gap-1">
                <Tooltip content="Edit Message: Modify your inquiry for refined intelligence gathering.">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 transition-all hover:scale-110 active:scale-95 opacity-70 hover:opacity-100"
                    style={{ color: 'inherit' }}
                  >
                    <Pencil size={14} />
                  </button>
                </Tooltip>
                <Tooltip content="Copy Intelligence: Extract text content to your system clipboard.">
                  <button 
                    onClick={() => onCopy(editText)}
                    className="p-1.5 transition-all hover:scale-110 active:scale-95 opacity-70 hover:opacity-100"
                    style={{ color: 'inherit' }}
                  >
                    <Copy size={13} />
                  </button>
                </Tooltip>
                {msg.id !== 'init' && (
                  <Tooltip content="Purge Signal: Remove this specific data node from the history.">
                    <button 
                      onClick={() => onDelete(msg.id || '')}
                      className="p-1.5 transition-all hover:scale-110 active:scale-95 opacity-70 hover:text-rose-500 hover:opacity-100"
                      style={{ color: 'inherit' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>
                )}
              </div>
            ) : (
              [
                { icon: Languages, label: 'Translate', action: () => setShowTranslate(!showTranslate), active: showTranslate, tooltip: "Translate Node: Convert response into regional or international languages." },
                { icon: Copy, label: 'Copy', action: () => onCopy(msg.text), tooltip: "Copy Intelligence: Extract text content to your system clipboard." },
                { icon: RotateCcw, label: 'Regenerate', action: () => onRegenerate(msg.id || ''), tooltip: "Neural Recalibration: Trigger a new AI analysis for this specific inquiry." },
                { icon: Share2, label: 'Share', action: () => onShare(msg.text), tooltip: "Broadcast: Share this intelligence insight via external system channels." },
                { icon: Trash2, label: 'Purge', action: () => onDelete(msg.id || ''), tooltip: "Purge Signal: Remove this specific data node from the history.", color: 'hover:text-rose-500' }
              ].map((tool, i) => (
                <Tooltip key={i} content={tool.tooltip}>
                  <button 
                    onClick={tool.action} 
                    className={cn(
                      "p-1.5 transition-all hover:scale-110 active:scale-95",
                      tool.active ? "opacity-100" : "opacity-70 hover:opacity-100",
                      (tool as any).color || ""
                    )}
                    style={{ color: 'inherit' }}
                  >
                    <tool.icon size={14} className="font-black" />
                  </button>
                </Tooltip>
              ))
            )}
          </div>
          <div className="text-[8px] font-black font-mono uppercase tracking-tighter opacity-50" style={{ color: 'inherit' }}>
            {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "SYNC_OK"}
          </div>
        </div>

        {/* Translation Grid - Compact */}
        <AnimatePresence>
          {showTranslate && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-2 border-2" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                <div className="grid grid-cols-5 gap-1">
                  {[...INDIAN_LANGUAGES, ...INT_LANGUAGES].map(lang => (
                    <button 
                      key={lang}
                      onClick={() => {
                        onTranslate(msg.text, lang);
                        setShowTranslate(false);
                      }}
                      className="py-1 rounded-none text-[8px] font-black transition-all border shadow-sm"
                      style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)', color: 'var(--text)' }}
                    >
                      {lang.substring(0, 3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const tradeData = [
  { name: 'Jan', volume: 4000, price: 2400, trend: 2400 },
  { name: 'Feb', volume: 3000, price: 1398, trend: 2210 },
  { name: 'Mar', volume: 2000, price: 9800, trend: 2290 },
  { name: 'Apr', volume: 2780, price: 3908, trend: 2000 },
  { name: 'May', volume: 1890, price: 4800, trend: 2181 },
  { name: 'Jun', volume: 2390, price: 3800, trend: 2500 },
  { name: 'Jul', volume: 3490, price: 4300, trend: 2100 },
];

const AT_A_GLANCE_DATA = [
  { label: "NIFTY 50", value: "24,141.95", change: "-0.42%", trend: "down" },
  { label: "SENSEX", value: "79,402.29", change: "-0.11%", trend: "down" },
  { label: "USD/INR", value: "84.38", change: "+0.01%", trend: "up" },
  { label: "GOLD MCX", value: "75,290", change: "+0.85%", trend: "up" },
  { label: "BRENT CRUDE", value: "72.45", change: "+0.12%", trend: "up" }
];

const SUMMARY_CARDS_DATA = [
  {
    title: "Trade Policy Update",
    summary: "New export incentives announced for MSMEs in the textile sector.",
    details: "The Ministry of Commerce has introduced a revised RoDTEP scheme aimed at boosting textile exports. This includes a 2% additional credit on FOB value for sustainable products.",
    keyPoints: ["MSME Focus", "Textile Sector Boost", "Sustainability Credits"],
    icon: ShieldCheck
  },
  {
    title: "Market Intelligence",
    summary: "Foreign Institutional Investors (FII) show renewed interest in Indian IT.",
    details: "Recent data suggests a net inflow of $450M into top-tier IT stocks over the last 7 trading sessions, driven by strong Q3 guidance from global tech giants.",
    keyPoints: ["FII Inflow", "IT Sector Recovery", "Global Tech Sentiment"],
    icon: TrendingUp
  },
  {
    title: "Regulatory Compliance",
    summary: "GST Council proposes simplification of filing for small businesses.",
    details: "The 53rd GST Council meeting recommended a single-window portal for businesses with turnover under 5Cr, reducing the compliance burden by an estimated 30%.",
    keyPoints: ["GST Simplification", "Small Business Support", "Digital Transformation"],
    icon: ShieldAlert
  }
];

const DateTimeDisplay = () => {
  const [time, setTime] = useState(new Date());
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const toggleTimer = setInterval(() => setShowTime(prev => !prev), 3000);
    return () => clearInterval(toggleTimer);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  const dayStr = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const timeStr = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-[4px] shrink-0 overflow-hidden" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary)', color: 'var(--background)' }}>
      <span className="w-2 h-2 animate-pulse" style={{ backgroundColor: 'var(--background)' }} />
      <div className="flex items-center text-[10px] md:text-[12px] font-black uppercase tracking-widest whitespace-nowrap h-4 md:h-5 relative w-28 md:w-32" style={{ perspective: '1000px' }}>
        <AnimatePresence mode="wait">
          {showTime ? (
            <motion.span
              key="time"
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: 90, opacity: 0 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className="absolute inset-0 flex items-center origin-bottom"
            >
              {timeStr}
            </motion.span>
          ) : (
            <motion.span
              key="date"
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: 90, opacity: 0 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className="absolute inset-0 flex items-center origin-bottom"
            >
              {dateStr} - {dayStr}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const IntelligenceHub = ({ 
  news, market, niftyHistory, summaries, onRefresh, lastSync, 
  marketSyncTime, marketErrors, syncInterval, setSyncInterval, 
  onSelectSummary, onForgeReport 
}: { 
  news: any[], market: any[], niftyHistory: any[], summaries: any[], 
  onRefresh: () => void, lastSync: string, marketSyncTime: string, 
  marketErrors: any[], syncInterval: number, setSyncInterval: (v: number) => void, 
  onSelectSummary: (s: any) => void, onForgeReport: (content: string) => void 
}) => {
  const [activeModal, setActiveModal] = useState<any>(null);
  const [isAnalyzingDeficit, setIsAnalyzingDeficit] = useState(false);
  const [deficitAnalysis, setDeficitAnalysis] = useState<string | null>(null);
  const [isBentoFocus, setIsBentoFocus] = useState(false);

  const performTradeAnalysis = async () => {
    setIsAnalyzingDeficit(true);
    try {
      const analysis = await analyzeTradeDeficit();
      setDeficitAnalysis(analysis);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzingDeficit(false);
    }
  };

  // Mock Nifty 50 data for visualization if niftyHistory is empty
  const chartData = (niftyHistory && niftyHistory.length >= 20) 
    ? niftyHistory.slice(-20) 
    : Array.from({ length: 20 }, (_, i) => ({
        time: `${i}:00`,
        value: 24000 + Math.random() * 500
      }));

  // Map API market data to our expected format, filling in fallbacks if missing
  const TICKER_MAPPING = [
    { key: 'NIFTY 50', default: "24,141.95", type: "Index" },
    { key: 'SENSEX', default: "79,402.29", type: "Index" },
    { key: 'BANK NIFTY', default: "52,345.10", type: "Index" },
    { key: 'USD/INR', default: "84.38", type: "Forex" },
    { key: 'GOLD MCX', default: "75,290", type: "Metal" },
    { key: 'BRENT CRUDE', default: "72.45", type: "Energy" }
  ];

  const tickers = TICKER_MAPPING.map(tm => {
    const apiData = market.find(m => m.label.toUpperCase().includes(tm.key));
    if (apiData) {
      return {
        label: apiData.label,
        value: apiData.value,
        change: apiData.change,
        trend: apiData.trend,
        type: tm.type
      };
    }
    return { label: tm.key, value: tm.default, change: "0.00%", trend: "neutral", type: tm.type };
  });

  const INT_BULLETINS = [
    { title: "ECB Rate Shift", summary: "European Central Bank hints at Doveish turn in Q3.", details: "Strategic impact analysis on Euro-Zone trade financing and export competitiveness for emerging markets.", icon: TrendingUp },
    { title: "US Tech Tariffs", summary: "White House reviews legacy electronic import duties.", details: "Potential for 15% reduction in cross-border component costs following bilateral tech summit.", icon: Zap },
    { title: "Global Logistics Hub", summary: "Singapore unveils autonomous port expansion plans.", details: "Timeline and trade-lane optimizations for APAC-Europe connectivity starting late 2026.", icon: Globe }
  ];

  const BULLETINS = summaries.length > 0 ? summaries : INT_BULLETINS;

  const PIB_UPDATES = news.filter(n => n.source === 'PIB').length > 0 ? news.filter(n => n.source === 'PIB') : [
    { title: "Indo-Oman Trade Pact Reach Final Stage", timestamp: new Date().toISOString(), summary: "Strategic partnership to enhance non-oil trade volume by 40%." },
    { title: "National Logistics Policy Milestone", timestamp: new Date().toISOString(), summary: "Logistics cost reduced to 8.5% of GDP in dedicated corridors." },
    { title: "PLI Scheme Expansion: Electronics", timestamp: new Date().toISOString(), summary: "Cabinet approves additional ₹5,000Cr for component manufacturing." }
  ];

  const NOTICE_BOARD = [
    { title: "Global Trade Summit 2026", date: "April 20-22", status: "Upcoming", type: "Event", description: "Main networking event for international exporters." },
    { title: "Quarterly Export Audit", date: "Ongoing", status: "Active", type: "Compliance", description: "Mandatory system-wide verification of export documents." },
    { title: "EU Regulatory Meeting", date: "Passed", status: "Archived", type: "Archive", description: "Review of new Carbon Border Adjustment Mechanism (CBAM) rules." }
  ];

  return (
    <div className="flex flex-col gap-6 h-full max-h-[calc(100vh-160px)] overflow-y-auto no-scrollbar pb-10">
      {/* 1. Ticker Section - Flat Bento */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-none" />
          <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">Market Intelligence Nodes</h3>
          <button 
            onClick={() => setIsBentoFocus(!isBentoFocus)}
            className={cn(
              "ml-4 p-1 px-3 border-2 text-[9px] font-black uppercase tracking-widest transition-all",
              isBentoFocus ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:border-primary hover:text-primary"
            )}
          >
            {isBentoFocus ? 'Standard View' : 'Focus Matrix'}
          </button>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-none bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-zinc-500">Synced: {marketSyncTime || 'Pending'}</span>
          </div>
          <button 
            onClick={onRefresh}
            className="p-1 px-4 rounded-none border-2 border-zinc-200 dark:border-zinc-800 hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-2 group active:scale-95 shadow-sm"
          >
            <RefreshCw size={14} className="text-zinc-500 group-hover:text-primary group-hover:rotate-180 transition-transform duration-700" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Sync Nodes</span>
          </button>
        </div>
      </div>
      <div className={cn(
        "grid shrink-0 mb-6 transition-all duration-500 ease-[0.22,1,0.36,1]",
        isBentoFocus ? "grid-cols-1 gap-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      )}>
        {tickers.map((ticker, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveModal({ ...ticker, type: 'market' })}
            className={cn(
              "p-4 google-card cursor-pointer border border-zinc-200 dark:border-zinc-800 group relative overflow-hidden",
              ticker.trend === 'up' ? "hover:border-emerald-500/30" : ticker.trend === 'down' ? "hover:border-rose-500/30" : "hover:border-primary/30",
              isBentoFocus && "flex items-center justify-between py-2 border-l-4"
            )}
            style={{ borderLeftColor: isBentoFocus ? (ticker.trend === 'up' ? '#10b981' : ticker.trend === 'down' ? '#f43f5e' : 'var(--primary)') : undefined }}
          >
            {isBentoFocus ? (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest w-24">{ticker.label}</span>
                  <span className="text-lg font-black font-mono">{ticker.value}</span>
                </div>
                <div className={cn("text-[10px] font-black uppercase px-2 py-1", ticker.trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                  {ticker.change}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{ticker.label}</p>
                  <div className={cn("w-2 h-2 rounded-none", ticker.trend === 'up' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : ticker.trend === 'down' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-zinc-300")} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white leading-none font-mono">{ticker.value}</span>
                  <div className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold mt-2", ticker.trend === 'up' ? "text-emerald-600 dark:text-emerald-400" : ticker.trend === 'down' ? "text-rose-600 dark:text-rose-400" : "text-zinc-500")}>
                    {ticker.trend === 'up' ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-90" />}
                    {ticker.change}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* NIFTY 50 Visualization */}
        <section className="col-span-1 lg:col-span-2 space-y-5 bg-white dark:bg-zinc-950 p-6 border-4 border-primary/20 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary" />
              <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-primary" /> NIFTY 50 Neural Visualization
              </h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Last 20 Trading Points</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                <XAxis 
                  dataKey="time" 
                  hide 
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fontSize: 10, fontWeight: 'bold' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '0' }}
                  itemStyle={{ color: '#FF9933', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#FF9933" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#FF9933', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Trade Deficit Analysis Section */}
        <section className="col-span-1 lg:col-span-2 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-rose-500" />
              <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <DollarSign size={18} className="text-rose-500" /> India Trade Deficit Analysis
              </h3>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              {deficitAnalysis && (
                <button 
                  onClick={() => onForgeReport(deficitAnalysis)}
                  className="flex-1 md:flex-none px-4 py-2 border-2 border-emerald-500 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
                >
                  <FileText size={12} />
                  Forge Report
                </button>
              )}
              <button 
                onClick={performTradeAnalysis}
                disabled={isAnalyzingDeficit}
                className="flex-1 md:flex-none px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[4px_4px_0px_0px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2"
              >
                {isAnalyzingDeficit ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                Initiate Neural Analysis
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {deficitAnalysis && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                className="p-8 border-4 border-rose-500/20 bg-rose-500/5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Landmark size={120} />
                </div>
                <div className="prose dark:prose-invert max-w-none relative z-10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {deficitAnalysis}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 2. INTERNATIONAL BULLETINS */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-none" />
            <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <Globe size={18} className="text-primary" /> Intelligence Stream
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {BULLETINS.map((bulletin, i) => {
              const IconComp = bulletin.icon || ShieldCheck;
              return (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setActiveModal({ ...bulletin, type: 'bulletin' })}
                  className="p-6 google-card cursor-pointer group flex items-start gap-6 hover:ring-2 ring-primary/20 transition-all"
                >
                  <div className={cn(
                    "p-4 rounded-none border-2 transition-all duration-300 shadow-sm",
                    "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white border-primary/20 group-hover:border-primary"
                  )}>
                    <IconComp size={24} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-primary transition-colors">{bulletin.title}</h4>
                      <span className="text-[9px] font-black px-3 py-1 rounded-none bg-primary/10 text-primary uppercase tracking-widest border-2 border-primary/10">Priority Alpha</span>
                    </div>
                    <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{bulletin.summary}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 3. PIB SECTION */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-secondary rounded-none" />
            <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <Landmark size={18} className="text-secondary" /> Official Directives
            </h3>
          </div>
          <div className="flex flex-col gap-4">
            {PIB_UPDATES.slice(0, 4).map((pib, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -4 }}
                onClick={() => setActiveModal({ ...pib, type: 'pib' })}
                className="p-5 rounded-none border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 cursor-pointer shadow-sm hover:border-secondary transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-[14px] font-bold text-zinc-900 dark:text-white tracking-tight flex-1 leading-tight group-hover:text-secondary transition-colors">{pib.title}</h4>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-2 h-2 rounded-none bg-secondary" />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Archive</span>
                  </div>
                </div>
                <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-500 line-clamp-2 leading-relaxed">{pib.summary}</p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                   <div className="flex items-center gap-3">
                      <Calendar size={12} className="text-secondary opacity-50" />
                      <span className="text-[10px] font-bold text-zinc-400">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                   </div>
                   <div className="flex items-center gap-2 text-secondary font-bold text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all">
                      <span>Review Directive</span>
                      <ChevronRight size={14} />
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* 4. Notice Board - Events Stacks */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-3">
          <div className="w-2 h-6 bg-rose-500" />
          <Calendar size={18} className="text-rose-500" /> Notice Board Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {NOTICE_BOARD.map((item, i) => (
            <motion.div 
              key={i}
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveModal({ ...item, type: 'notice' })}
              className="p-6 border-4 border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 cursor-pointer hover:border-rose-500 transition-all flex flex-col gap-4 group relative shadow-[8px_8px_0px_0px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-3 py-1 flex items-center gap-2",
                  item.status === 'Upcoming' ? 'bg-rose-500 text-white' : 
                  item.status === 'Ongoing' ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                )}>
                  <div className={cn("w-2 h-2 rounded-none", item.status === 'Ongoing' ? "bg-white animate-pulse" : "bg-white/50")} />
                  {item.status}
                </span>
                <Landmark size={14} className="opacity-20 group-hover:opacity-100 transition-opacity text-rose-500" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight group-hover:text-rose-500 transition-colors leading-tight">{item.title}</h4>
                <p className="text-[10px] font-bold opacity-40 mt-2 italic">#{item.type.toUpperCase()}_NODE</p>
                <p className="text-[10px] font-bold opacity-60 mt-3 leading-relaxed">{item.description}</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-5 border-t-2 border-zinc-50 dark:border-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-rose-500/5 text-rose-500 border border-rose-500/20">
                    <Clock size={14} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-tighter text-rose-500/80">{item.date}</span>
                </div>
                <div className="p-2 bg-zinc-50 dark:bg-zinc-900 group-hover:bg-rose-500 group-hover:text-white transition-all">
                  <ChevronRight size={16} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-white dark:bg-zinc-950 border-[6px] border-primary shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b-[4px] border-primary flex items-start justify-between bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-12 bg-primary" />
                  <div>
                    <span className="text-[10px] font-black tracking-[0.5em] uppercase opacity-40 text-primary">{activeModal.type.toUpperCase()}_NODE</span>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">{activeModal.title || activeModal.label}</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-2 border-4 border-primary hover:bg-primary hover:text-white transition-all active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <p className="text-lg font-bold leading-relaxed opacity-80" style={{ color: 'var(--text)' }}>
                      {activeModal.details || activeModal.summary || activeModal.description}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border-2 border-primary/10">
                        <span className="text-[8px] font-black uppercase tracking-widest block mb-2 opacity-50">Node Status</span>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-none animate-pulse" />
                          <span className="text-xs font-black uppercase tracking-widest">Active & Synced</span>
                        </div>
                      </div>
                      <div className="p-4 border-2 border-primary/10">
                        <span className="text-[8px] font-black uppercase tracking-widest block mb-2 opacity-50">Last Verification</span>
                        <span className="text-xs font-black uppercase tracking-widest">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black tracking-[0.3em] uppercase opacity-30">Strategic Takeaways</h4>
                      {['Market volatility within acceptable limits', 'Direct correlation with global indices established', 'Verified against secondary govt nodes'].map((point, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20">
                          <CheckCircle size={14} className="text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {activeModal.type === 'market' && (
                       <div className="border-[4px] border-primary p-6 bg-white dark:bg-zinc-950">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                            Historical Volatility Matrix
                            <TrendingUp size={16} className="text-primary" />
                          </h4>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={niftyHistory}>
                                <defs>
                                  <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <Area type="step" dataKey="value" stroke="var(--primary)" strokeWidth={4} fill="url(#modalGrad)" />
                                <XAxis dataKey="time" hide />
                                <YAxis hide domain={['auto', 'auto']} />
                                <RechartsTooltip 
                                  contentStyle={{ backgroundColor: 'var(--background)', border: '4px solid var(--primary)', borderRadius: '0' }}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                       </div>
                    )}

                    {(activeModal.type === 'bulletin' || activeModal.type === 'pib') && (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 border-[4px] border-primary bg-primary/5">
                           <ShieldCheck size={40} className="text-primary mb-4" />
                           <h4 className="text-xl font-black uppercase italic mb-2 tracking-tighter">Compliance Verified</h4>
                           <p className="text-[11px] font-bold opacity-70 leading-relaxed italic">This node has been cross-referenced with Bharat's central trade registries and international regulatory bodies. Data integrity 99.8% confirmed.</p>
                        </div>
                        <div className="p-6 border-[4px] border-secondary bg-secondary/5">
                           <Zap size={40} className="text-secondary mb-4" />
                           <h4 className="text-xl font-black uppercase italic mb-2 tracking-tighter">Strategic Impact</h4>
                           <p className="text-[11px] font-bold opacity-70 leading-relaxed italic">Potential impact score: 8.4/10. Recommended action: Strategic review by board of directors within 48 hours for market positioning.</p>
                        </div>
                      </div>
                    )}

                    {activeModal.type === 'notice' && (
                      <div className="flex flex-col gap-4">
                         <div className="p-10 border-[6px] border-dashed border-primary flex items-center justify-center flex-col text-center">
                            <Calendar size={60} className="text-primary opacity-20 mb-6" />
                            <h4 className="text-2xl font-black uppercase tracking-widest italic mb-2">Block the Calendar</h4>
                            <p className="text-xs font-bold opacity-60">This event is critical for organizational roadmap alignment. All associates are requested to prioritize attendance.</p>
                            <button className="mt-8 px-10 py-4 bg-primary text-white font-black uppercase tracking-[0.2em] italic hover:scale-105 transition-all">Add to Master Schedule</button>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AgentsTerminal = ({ 
  agents, 
  activeAgentId, 
  onSelect, 
  onEdit, 
  onDuplicate, 
  onDelete,
  onCreate,
  addToast
}: { 
  agents: Agent[], 
  activeAgentId: string, 
  onSelect: (id: string) => void,
  onEdit: (agent: Agent) => void,
  onDuplicate: (agent: Agent) => void,
  onDelete: (id: string) => void,
  onCreate: () => void,
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);

  const filteredAgents = agents.filter(a => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'custom') return !a.isPredefined;
    return a.category === selectedCategory;
  });

  const getIcon = (agent: Agent) => {
    if (!agent.isPredefined) return Cpu;
    const icons: Record<string, any> = {
      'BarChart2': BarChart2,
      'ShieldCheck': ShieldCheck,
      'Sprout': Sprout,
      'Globe': Globe,
      'Zap': Zap,
      'Brain': Brain
    };
    return icons[agent.icon || ''] || Brain;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-20">
      {/* Sidebar Filter */}
      <aside className="w-full lg:w-64 shrink-0 space-y-6">
        <div className="google-card p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
            <Filter size={12} /> Matrix Filters
          </h3>
          <div className="space-y-2">
            <button 
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "w-full text-left p-3 text-[11px] font-black uppercase tracking-widest transition-all border-2",
                selectedCategory === 'all' ? "bg-primary text-white border-primary" : "border-zinc-100 hover:border-primary/30"
              )}
            >
              All Channels
            </button>
            {AGENT_CATEGORY_MODELS.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.label)}
                className={cn(
                  "w-full text-left p-3 text-[11px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-between",
                  selectedCategory === cat.label ? "bg-primary text-white border-primary" : "border-zinc-100 hover:border-primary/30"
                )}
              >
                {cat.label}
                <cat.icon size={14} />
              </button>
            ))}
          </div>
        </div>

        <div className="google-card p-6 border-dashed border-primary/20 bg-primary/5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary opacity-60 mb-2 leading-relaxed">Neural Personnel protocol allows for infinite specialization.</p>
          <button 
            onClick={onCreate}
            className="w-full p-4 bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_0px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center gap-2"
          >
            <Plus size={14} /> New Directive
          </button>
        </div>
      </aside>

      <div className="flex-1 space-y-8">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-primary" />
            <h2 className="text-2xl font-bold tracking-tight">{selectedCategory === 'all' ? 'Universal Node Matrix' : selectedCategory}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredAgents.map((agent) => {
              const Icon = getIcon(agent);
              const isUrl = agent.icon && (agent.icon.startsWith('http') || agent.icon.startsWith('/'));
              return (
                <motion.div 
                  key={agent.id}
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  layout
                  onClick={() => setDetailAgent(agent)}
                  className={cn(
                    "google-card p-8 group cursor-pointer hover:shadow-xl transition-all duration-300 relative overflow-hidden h-full flex flex-col",
                    activeAgentId === agent.id ? "ring-2 ring-primary border-transparent" : "border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all transform group-hover:scale-110 group-hover:-rotate-12">
                    {isUrl ? (
                      <img src={agent.icon} className="w-[120px] h-[120px] object-contain grayscale" referrerPolicy="no-referrer" />
                    ) : (
                      <Icon size={120} strokeWidth={1} />
                    )}
                  </div>

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-none border-2 flex items-center justify-center font-bold text-xl transition-all shadow-sm overflow-hidden",
                          activeAgentId === agent.id ? "bg-primary text-white border-primary" : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-primary"
                        )}>
                          {isUrl ? (
                            <img src={agent.icon} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <Icon size={24} />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-black uppercase tracking-tight mb-1">{agent.label}</h3>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-primary/5 text-primary tracking-widest border border-primary/10">
                            {agent.category || 'General Intel'}
                          </span>
                        </div>
                      </div>
                      {activeAgentId === agent.id && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Engaged</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[12px] leading-relaxed text-zinc-500 font-medium italic line-clamp-2 mb-6">
                      "{agent.persona}"
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-900">
                      <div className="flex gap-2">
                        {agent.skills.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{s}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDuplicate(agent); }}
                          className="p-2 border-2 border-zinc-100 hover:border-primary hover:text-primary transition-all shadow-sm"
                        >
                          <Copy size={14} />
                        </button>
                        {!agent.isPredefined && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                            className="p-2 border-2 border-zinc-100 hover:border-rose-500 hover:text-rose-500 transition-all shadow-sm"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailAgent && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailAgent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 border-4 border-primary shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b-2 border-zinc-100 dark:border-zinc-900 flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary text-white border-2 border-white/20">
                    <Brain size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">{detailAgent.label}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{detailAgent.role}</p>
                  </div>
                </div>
                <button onClick={() => setDetailAgent(null)} className="p-2 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto no-scrollbar space-y-10">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Neural Persona</h4>
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-900 relative">
                    <Quote className="absolute -top-3 -left-3 text-primary/20 rotate-180" size={32} />
                    <p className="text-sm font-medium italic leading-relaxed text-zinc-600 dark:text-zinc-400">{detailAgent.persona}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">Style: {detailAgent.responseStyle}</span>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Strategic Frameworks</h4>
                    <div className="flex flex-wrap gap-2">
                       {detailAgent.frameworks.map((f, i) => (
                         <span key={i} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest opacity-80">{f}</span>
                       ))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Intelligence Skills</h4>
                    <div className="space-y-2">
                       {detailAgent.skills.map((s, i) => (
                         <div key={i} className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-primary" />
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{s}</span>
                         </div>
                       ))}
                    </div>
                  </section>
                </div>

                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Operational Matrix</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { l: 'Tools', a: detailAgent.abilities.toolCalling, i: Cpu },
                      { l: 'Bridge', a: detailAgent.abilities.remoteConnection, i: Network },
                      { l: 'MCP', a: detailAgent.abilities.mcpCalling, i: Layers }
                    ].map((ab, i) => (
                      <div key={i} className={cn(
                        "p-4 border-2 flex flex-col items-center gap-2 transition-all",
                        ab.a ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 opacity-20"
                      )}>
                        <ab.i size={20} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{ab.l}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-8 border-t-2 border-zinc-100 dark:border-zinc-900 flex gap-4">
                {activeAgentId === detailAgent.id ? (
                  <button 
                    onClick={() => {
                      onSelect('hybrid');
                      setDetailAgent(null);
                      addToast("Neural node disengaged. Native matrix active.", "info");
                    }}
                    className="flex-1 py-4 bg-zinc-800 text-white font-black uppercase tracking-[0.2em] text-xs shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] active:scale-95 transition-all"
                  >
                    Disengage Protocol
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      onSelect(detailAgent.id);
                      setDetailAgent(null);
                      addToast(`Neural link established with ${detailAgent.label}.`, "success");
                    }}
                    className="flex-1 py-4 bg-primary text-white font-black uppercase tracking-[0.2em] text-xs shadow-[8px_8px_0px_0px_rgba(var(--primary-rgb),0.3)] hover:translate-y-[-2px] active:scale-95 transition-all"
                  >
                    Engage Neural Link
                  </button>
                )}
                {!detailAgent.isPredefined && (
                  <button 
                    onClick={() => {
                      onEdit(detailAgent);
                      setDetailAgent(null);
                    }}
                    className="p-4 border-2 border-primary text-primary font-black uppercase tracking-widest text-xs hover:bg-primary hover:text-white transition-all active:scale-95"
                  >
                    Tune Node
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>({
    uid: 'chamber-exec-01',
    displayName: 'Bharat Chamber Executive',
    email: 'executive@bharatchamber.com',
    photoURL: null
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isAgentEditorOpen, setIsAgentEditorOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chamber-theme') === 'dark' || 
             (!localStorage.getItem('chamber-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true;
  });
  const currentTheme = isDarkMode ? BHARAT_THEME.dark : BHARAT_THEME.light;
  const [input, setInput] = useState('');
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [headerInfoIndex, setHeaderInfoIndex] = useState(0); // Deprecated but kept for compatibility in case of refs
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [forgedReportContent, setForgedReportContent] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newsNodes, setNewsNodes] = useState<any[]>([]);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [marketSyncTime, setMarketSyncTime] = useState<string>('');
  const [marketErrors, setMarketErrors] = useState<any[]>([]);
  const [niftyHistory, setNiftyHistory] = useState<any[]>([
    { time: '09:15', value: 24100 },
    { time: '10:00', value: 24150 },
    { time: '11:00', value: 24120 },
    { time: '12:00', value: 24180 },
    { time: '13:00', value: 24140 },
    { time: '14:00', value: 24200 },
    { time: '15:00', value: 24141 },
  ]);
  const [summaryCards, setSummaryCards] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<string>(new Date().toLocaleTimeString());
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [isPersonaListOpen, setIsPersonaListOpen] = useState(false);
  const [activePersonaInModal, setActivePersonaInModal] = useState<any>(null);
  const [syncInterval, setSyncInterval] = useState(4); // hours
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());
  const [selectedPersona, setSelectedPersona] = useState<string>('standard');
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [systemKnowledgeBases, setSystemKnowledgeBases] = useState<any[]>([]);
  const [systemSkills, setSystemSkills] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isEditingProfileSettings, setIsEditingProfileSettings] = useState(false);
  const [matrixNotes, setMatrixNotes] = useState<{id: string, text: string, date: string}[]>([]);
  const [userDraft, setUserDraft] = useState('');
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'system_config'), limit(1));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setSystemKnowledgeBases(data.knowledgeBases || []);
        setSystemSkills(data.skills || []);
      }
    }, (error) => {
      console.error("System Config Listener Error:", error);
      handleFirestoreError(error, OperationType.GET, 'system_config');
    });
    return () => unsubscribe();
  }, []);

  const fetchNewsNodes = async () => {
    try {
      setLoading(true);
      const [newsRes, summaryRes] = await Promise.all([
        fetch('/api/intelligence/news'),
        fetch('/api/intelligence/summaries')
      ]);
      
      if (newsRes.ok) {
        const data = await newsRes.json().catch(() => null);
        if (data) setNewsNodes(data);
      }
      
      if (summaryRes.ok) {
        const data = await summaryRes.json().catch(() => null);
        if (data && data.length > 0) setSummaryCards(data);
      } else {
        const errorData = await summaryRes.json().catch(() => ({}));
        if (errorData.error === "AI Configuration Missing") {
          console.warn("Intelligence Hub: Gemini API Key not found. Using fallback summaries.");
        }
      }
      
      setLastSync(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Sync Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timeTimer);
    };
  }, []);

  useEffect(() => {
    fetchNewsNodes();
    
    // Auto-sync interval logic for news/summaries
    const intervalMs = syncInterval * 60 * 60 * 1000;
    const newsTimer = setInterval(() => {
      fetchNewsNodes();
    }, intervalMs);

    // Real-time market data sync (60 seconds)
    let retryCount = 0;
    const fetchMarket = async (force: boolean = false) => {
      // Don't sync if tab is hidden to save resources and API quota
      if (typeof document !== 'undefined' && document.hidden && !force) return;
      
      try {
        const url = force ? `/api/intelligence/market?refresh=true&t=${Date.now()}` : `/api/intelligence/market?t=${Date.now()}`;
        
        // Use a persistent fetch with timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(url, { signal: controller.signal }).catch(err => {
          if (err.name === 'AbortError') throw new Error("Synchronization Timeout");
          throw new Error("Neural Core connection interrupted");
        });
        
        clearTimeout(timeoutId);

        const contentType = res.headers.get("content-type");
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = `Protocol Error ${res.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) { /* ignore */ }
          throw new Error(errorMessage);
        }

        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Neural Core relaying non-standard data. Refreshing node...");
        }

        const result = await res.json();
        
        if (result.data && Array.isArray(result.data)) {
          setMarketData(result.data);
          setMarketSyncTime(new Date(result.syncTime).toLocaleTimeString());
          setMarketErrors(result.errors || []);
          retryCount = 0;
          
          if (result.error) {
            console.warn("Soft Market Sync Notice:", result.error);
          }
          
          // Update Nifty History
          const nifty = result.data.find((d: any) => d.label.toUpperCase().includes('NIFTY 50'));
          if (nifty) {
            const price = parseFloat(nifty.value.toString().replace(/,/g, ''));
            if (!isNaN(price)) {
              setNiftyHistory(prev => {
                const newPoint = { 
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
                  value: price 
                };
                return [...prev, newPoint].slice(-20);
              });
            }
          }
        }
      } catch (e: any) {
        if (!force) {
          console.error("Intelligence Link Offline:", e.message);
          setMarketErrors([{ source: "Intelligence Link", type: e.message || "Offline" }]);
          
          retryCount++;
          const delay = Math.min(30000, 5000 * Math.pow(1.5, retryCount - 1));
          setTimeout(() => fetchMarket(force), delay);
        }
      }
    };
    
    // Explicitly expose fetchMarket for onRefresh calls
    (window as any).refreshMarketData = () => fetchMarket(true);

    fetchMarket();
    const marketTimer = setInterval(fetchMarket, 60000); // Relaxed to 60s

    return () => {
      clearInterval(newsTimer);
      clearInterval(marketTimer);
    };
  }, [syncInterval]);

  useEffect(() => {
    localStorage.setItem('chamber-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', currentTheme.primary);
    root.style.setProperty('--secondary', currentTheme.secondary);
    root.style.setProperty('--accent', currentTheme.accent);
    root.style.setProperty('--background', currentTheme.background);
    root.style.setProperty('--text', currentTheme.text);
    root.style.setProperty('--sidebar', currentTheme.sidebar);
    root.style.setProperty('--sidebar-text', currentTheme.sidebarText);
    root.style.setProperty('--sidebar-accent', currentTheme.sidebarAccent);
    
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r}, ${g}, ${b}`;
    };
    root.style.setProperty('--primary-rgb', hexToRgb(currentTheme.primary));
    root.style.setProperty('--secondary-rgb', hexToRgb(currentTheme.secondary));
    root.style.setProperty('--text-rgb', hexToRgb(currentTheme.text));
    root.style.setProperty('--background-rgb', hexToRgb(currentTheme.background));
    
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [currentTheme, isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState<'hybrid' | 'local' | 'thinking'>('hybrid');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [view, setView] = useState<ViewState>('chat');
  const [activeAgentId, setActiveAgentId] = useState('hybrid');
  
  // Get active agent object
  const activeAgent = [...PREDEFINED_AGENTS, ...customAgents].find(a => a.id === activeAgentId) || null;
  
  // UI States
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [customAgent, setCustomAgent] = useState({
    name: '',
    persona: '',
    knowledge: '',
    logic: 'analysis'
  });
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'issue'>('feedback');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedSummary, setSelectedSummary] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState<'system' | 'session' | 'language' | null>(null);
  const [toasts, setToasts] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' }[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [isPersonaTunerOpen, setIsPersonaTunerOpen] = useState(false);
  const [newFramework, setNewFramework] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [skillInstruction, setSkillInstruction] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Handle scroll to show/hide "Scroll to Bottom" button
  useEffect(() => {
    const handleScroll = () => {
      if (mainContentRef.current && view === 'chat') {
        const { scrollTop, scrollHeight, clientHeight } = mainContentRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom && messages.length > 0);
      } else {
        setShowScrollButton(false);
      }
    };

    const container = mainContentRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [view, messages]);

  // Auto-scroll logic: Only scroll to bottom when a NEW user message is added
  // to prevent jumping while reading a long response
  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length, view]);

  // Scroll to top on module change - strictly enforced
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
    // Also close mobile menu on any view change
    setIsMobileMenuOpen(false);
  }, [view]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveSessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Task Due Date Notification Check
  useEffect(() => {
    const checkTasks = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.completed && task.dueDate && !notifiedTasks.has(task.id)) {
          const dueDate = new Date(task.dueDate);
          const diffMs = dueDate.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours <= 24 && diffHours > 0) {
            addToast(`Task Priority Alert: "${task.title}" is due in less than 24 hours.`, 'info');
            setNotifiedTasks(prev => new Set(prev).add(task.id));
          }
        }
      });
    };

    const interval = setInterval(checkTasks, 60000); // Check every minute
    checkTasks();
    return () => clearInterval(interval);
  }, [tasks, notifiedTasks]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Switch Views: Ctrl + 1/2/3/4
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); setView('chat'); }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); setView('intelligence'); }
      if (e.ctrlKey && e.key === '3') { e.preventDefault(); setView('tasks'); }
      if (e.ctrlKey && e.key === '4') { e.preventDefault(); setView('settings'); }

      // Toggle Sidebar: Alt + C
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }

      // Focus Input: Ctrl + Enter
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (view === 'chat') {
          inputRef.current?.focus();
          if (input.trim()) handleSend();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, input]);

  // --- AUTH REMOVED ---
  useEffect(() => {
    console.log("SETU CORE: NEURAL BRIDGE INITIALIZED");
    loadSessions(user.uid);
    loadTasks(user.uid);
    loadCustomAgents(user.uid);
  }, []);

  const loadCustomAgents = (uid: string) => {
    const q = query(collection(db, 'custom_agents'), where('uid', '==', uid));
    onSnapshot(q, (snapshot) => {
      setCustomAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent)));
    }, (error) => {
      console.error("Custom Agents Listener Error:", error);
      handleFirestoreError(error, OperationType.GET, 'custom_agents');
    });
  };

  const saveCustomAgent = async (agentData: Partial<Agent>) => {
    if (!user) return;
    try {
      if (agentData.id && !agentData.isPredefined) {
        const { id, ...rest } = agentData;
        await updateDoc(doc(db, 'custom_agents', id!), { ...rest, updatedAt: serverTimestamp() });
        addToast("Intelligence Node Updated", "success");
      } else {
        const newAgent = {
          ...agentData,
          uid: user.uid,
          createdAt: serverTimestamp(),
          isPredefined: false
        };
        delete (newAgent as any).id;
        await addDoc(collection(db, 'custom_agents'), newAgent);
        addToast("New Intelligence Node Commissioned", "success");
      }
      setIsAgentEditorOpen(false);
      setEditingAgent(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'custom_agents');
    }
  };

  const duplicateAgent = async (agent: Agent) => {
    const { id, isPredefined, ...rest } = agent;
    await saveCustomAgent({
      ...rest,
      label: `${agent.label} (Copy)`,
      name: `${agent.name} v2`
    });
  };

  const deleteCustomAgent = async (id: string) => {
    if (!confirm("De-commission this intelligence node permanently?")) return;
    try {
      await deleteDoc(doc(db, 'custom_agents', id));
      addToast("Node De-commissioned", "info");
      if (activeAgentId === id) setActiveAgentId('hybrid');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'custom_agents');
    }
  };

  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const loadSessions = (uid: string) => {
    const q = query(collection(db, 'sessions'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setSessions(sess);
      
      if (sess.length > 0 && !currentSessionId && !isDeletingSession) {
        setCurrentSessionId(sess[0].id);
      } else if (sess.length === 0 && !isDeletingSession) {
        createNewSession(uid);
      }
    }, (error) => {
      console.error("Sessions Listener Error:", error);
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });
  };

  const createNewSession = async (uid: string) => {
    try {
      const newSess = {
        uid,
        title: 'New Chat ' + new Date().toLocaleTimeString(),
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'sessions'), newSess);
      setCurrentSessionId(docRef.id);
      setMessages([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const togglePinSession = async (sessionId: string, currentPinned: boolean) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { isPinned: !currentPinned });
      addToast(currentPinned ? "Unpinned from Core" : "Pinned to Core", "info");
    } catch (e) {
      console.error(e);
      addToast("Failed to pin session", "error");
    }
  };

  const deleteSession = async (id: string) => {
    try {
      setIsDeletingSession(true);
      await deleteDoc(doc(db, 'sessions', id));
      
      // Update local state immediately for responsiveness
      const remaining = sessions.filter(s => s.id !== id);
      setSessions(remaining);
      
      if (currentSessionId === id) {
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
      addToast("Intelligence node de-initialized.", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sessions');
    } finally {
      // Small cooldown to let snapshots stabilize
      setTimeout(() => setIsDeletingSession(false), 500);
    }
  };

  const loadTasks = (uid: string) => {
    const q = query(collection(db, 'tasks'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      console.error("Tasks Listener Error:", error);
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });
  };

  const addTask = async (title: string, dueDate: string = "") => {
    if (!user || !title.trim()) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        uid: user.uid,
        title,
        completed: false,
        dueDate: dueDate || null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Setu Intelligence Insight',
          text: text,
          url: window.location.href,
        });
        addToast("Shared successfully!", "success");
      } catch (error) {
        console.error("Share Error:", error);
      }
    } else {
      navigator.clipboard.writeText(text).then(() => addToast("Link copied to clipboard!", "info"));
    }
  };

  const handleEngage = (summary: any) => {
    setView('chat');
    handleSend(`I'd like to discuss the ${summary.title} in more detail. Specifically regarding: ${summary.summary}`);
    setSelectedSummary(null);
  };

  const deleteChatMessage = async (msgId: string) => {
    if (!msgId || msgId === 'init') return;
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDoc(doc(db, 'chats', msgId));
      addToast("Intelligence node purged.", "success");
      // Force local update if listener is slow
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'chats');
    }
  };

  const handleEditMessage = async (msgId: string, newText: string) => {
    if (!msgId || msgId === 'init' || !newText.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', msgId), { text: newText });
      addToast("Intelligence updated.", "success");
      
      // Determine if this was the last user message and if we should regenerate
      const idx = messages.findIndex(m => m.id === msgId);
      if (idx !== -1) {
        const msg = messages[idx];
        if (msg.role === 'user') {
          // If there is a subsequent bot message, find it to potentially replace/update
          const nextMsg = messages[idx + 1];
          if (nextMsg && nextMsg.role === 'bot') {
            // Delete the old bot response to clear the path for the new edited one
            try {
              await deleteDoc(doc(db, 'chats', nextMsg.id!));
            } catch (e) { console.error("Error clearing stale node:", e); }
          }
          // Resume chat with the updated prompt
          handleSend(newText, true, msgId);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.csv,.json,.pdf';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file && user && currentSessionId) {
        setLoading(true);
        addToast(`Processing "${file.name}"...`, "info");
        try {
          // 1. Read content if it's a text file
          let fileContent = "";
          if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
            fileContent = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsText(file);
            });
          }

          // 2. Upload to storage
          const storageRef = ref(storage, `sessions/${currentSessionId}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          addToast(`File "${file.name}" processed successfully.`, "success");
          
          const fileMsg = {
            uid: user.uid,
            sessionId: currentSessionId,
            text: `[File Uploaded: ${file.name}](${downloadURL})${fileContent ? `\n\nContent Preview:\n\`\`\`\n${fileContent.substring(0, 1000)}${fileContent.length > 1000 ? '...' : ''}\n\`\`\`` : ''}`,
            role: 'user',
            timestamp: serverTimestamp(),
          };
          await addDoc(collection(db, 'chats'), fileMsg);
          
          // 3. Trigger Gemini response for the file
          const prompt = fileContent 
            ? `I have uploaded a document named "${file.name}". Here is the content:\n\n${fileContent}\n\nPlease analyze this document and provide a summary or insights relevant to the Bharat Chamber.`
            : `I have uploaded a document named "${file.name}". Please analyze it and provide insights. (Note: File is available at ${downloadURL})`;

          const response = await getGeminiResponse(
            prompt, 
            isDeepThink ? 'thinking' : engine, 
            selectedLanguage !== 'English' ? selectedLanguage : undefined,
            undefined,
            systemKnowledgeBases,
            systemSkills
          );
          
          const botMsg = {
            uid: user.uid,
            sessionId: currentSessionId,
            text: response.text,
            role: 'bot',
            timestamp: serverTimestamp(),
            sources: response.sources,
          };
          await addDoc(collection(db, 'chats'), botMsg);
          
        } catch (error) {
          console.error("Upload Error:", error);
          addToast("Failed to process file.", "error");
        } finally {
          setLoading(false);
        }
      }
    };
    input.click();
  };

  const toggleSTT = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast("Neural audio bridge not supported in this environment.", "error");
      return;
    }

    if (isSTTActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsSTTActive(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsSTTActive(true);
        addToast("Neural Audio Bridge Active", "success");
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("STT Bridge Error:", event.error);
        addToast(`Audio Bridge Error: ${event.error}`, "error");
        setIsSTTActive(false);
      };

      recognition.onend = () => {
        setIsSTTActive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("STT Initialize Error:", err);
      addToast("Failed to initialize audio bridge.", "error");
    }
  }, [isSTTActive, addToast]);

  const deployAgent = async () => {
    if (!user || !customAgent.name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'custom_agents'), {
        uid: user.uid,
        label: customAgent.name,
        desc: customAgent.persona,
        icon: 'Cpu',
        category: 'Custom Nodes',
        createdAt: serverTimestamp(),
      });
      addToast(`Agent "${customAgent.name}" deployed successfully.`, "success");
      setIsArchitectOpen(false);
      setCustomAgent({ name: '', persona: '', knowledge: '', logic: 'analysis' });
    } catch (error) {
      console.error("Deploy Error:", error);
      addToast("Failed to deploy agent.", "error");
    } finally {
      setLoading(false);
    }
  };
  const submitFeedback = async () => {
    if (!user || !feedbackComment.trim()) return;
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: user.uid,
        email: user.email,
        comment: feedbackComment,
        type: feedbackType,
        timestamp: serverTimestamp(),
      });
      setFeedbackComment('');
      setFeedbackModalOpen(false);
      addToast("Feedback submitted successfully!", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'feedback');
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(sessionSearchQuery.toLowerCase())
  );

  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- CHAT SYNC ---
  useEffect(() => {
    if (!user || !currentSessionId) return;

    const q = query(
      collection(db, 'chats'), 
      where('uid', '==', user.uid),
      where('sessionId', '==', currentSessionId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      
      if (msgs.length > 0) {
        setMessages(prev => {
          const init = prev.find(p => p.id === 'init');
          return init ? [init, ...msgs] : msgs;
        });
      } else {
        setMessages([{
          id: 'init',
          uid: user.uid,
          sessionId: currentSessionId,
          text: 'I am **Setu**, your bridge to the Bharat Chamber’s trade intelligence. How may I assist your enterprise today?',
          role: 'bot',
          timestamp: { toDate: () => new Date() },
          sources: []
        }]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return unsubscribe;
  }, [user, currentSessionId]);

  const PERSONAS = [
    { 
      id: 'standard', 
      label: 'Standard', 
      icon: Cpu, 
      desc: 'Balanced neural response.',
      longDesc: 'The default configuration for Setu. Provides a balanced, professional tone suitable for most general trade inquiries and chamber interactions.',
      traits: ['Balanced', 'Professional', 'Objective'],
      responseStyle: 'detailed'
    },
    { 
      id: 'aggressive', 
      label: 'Aggressive Analyst', 
      icon: TrendingUp, 
      desc: 'Sharp, critical, risk-focused.',
      longDesc: 'Optimized for identifying market risks and competitive threats. This persona uses a direct, critical tone focusing on disruption and aggressive growth strategies.',
      traits: ['Critical', 'Risk-Focus', 'Direct'],
      responseStyle: 'concise'
    },
    { 
      id: 'cautious', 
      label: 'Cautious Diplomat', 
      icon: Shield, 
      desc: 'Tactful, balanced, stability-first.',
      longDesc: 'Prioritizes long-term stability and international relations. Uses a tactful, measured tone ideal for high-stakes policy discussions and cross-border collaborations.',
      traits: ['Diplomatic', 'Measured', 'Relations-Focused'],
      responseStyle: 'formal'
    },
    { 
      id: 'data', 
      label: 'Data-Driven Scientist', 
      icon: BarChart2, 
      desc: 'Objective, methodical, evidence-based.',
      longDesc: 'Relies strictly on empirical evidence and statistical trends. This persona provides highly methodical responses, breaking down complex data into actionable insights.',
      traits: ['Methodical', 'Empirical', 'Analytic'],
      responseStyle: 'analytical'
    }
  ];

  const handleSend = async (overrideInput?: string, isEdit = false, editMsgId?: string) => {
    let textToSend = overrideInput || input;
    if (!textToSend.trim() || !user || !currentSessionId) return;

    // Inject persona context if selecting a specialized persona
    if (selectedPersona !== 'standard' && !isEdit) {
      const persona = (PERSONAS as any[]).find(p => p.id === selectedPersona);
      if (persona) {
        textToSend = `[PERSONA: ${persona.label}. Style: ${persona.responseStyle}. Instructions: ${persona.desc}]\n\n${textToSend}`;
      }
    }

    try {
      if (!isEdit) {
        const userMsg = {
          uid: user.uid,
          sessionId: currentSessionId,
          text: textToSend,
          role: 'user',
          timestamp: serverTimestamp(),
        };
        await addDoc(collection(db, 'chats'), userMsg);
        if (!overrideInput) setInput('');
      }

      setLoading(true);

      // Context Window Management: Get last 10 messages for context (excluding the one we just edited/added)
      const chatHistory = messages
        .filter(m => m.id !== 'init' && m.id !== editMsgId)
        .slice(-10)
        .map(m => ({ role: m.role, text: m.text }));

      // Create a temporary bot message for streaming
      const tempBotMsgId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempBotMsgId,
        uid: user.uid,
        sessionId: currentSessionId,
        text: '',
        role: 'bot',
        timestamp: { toDate: () => new Date() } as any,
        sources: [],
        isDeepThink,
        agentId: activeAgentId
      }]);

      // Pass activeAgent to the response generator
      const response = await getGeminiResponse(
        textToSend, 
        isDeepThink ? 'thinking' : engine, 
        selectedLanguage !== 'English' ? selectedLanguage : undefined,
        activeAgent || undefined,
        systemKnowledgeBases,
        systemSkills,
        chatHistory,
        (chunkText) => {
          setMessages(prev => prev.map(m => 
            m.id === tempBotMsgId ? { ...m, text: chunkText } : m
          ));
        }
      );
      
      // Remove temporary message and save the final one to Firestore
      setMessages(prev => prev.filter(m => m.id !== tempBotMsgId));

      const botMsg = {
        uid: user.uid,
        sessionId: currentSessionId,
        text: response.text,
        role: 'bot',
        timestamp: serverTimestamp(),
        sources: response.sources,
        isDeepThink,
        agentId: activeAgentId
      };

      await addDoc(collection(db, 'chats'), botMsg);
    } catch (error) {
      console.error("Chat Error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    } finally {
      setLoading(false);
    }
  };


  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] p-6 overflow-hidden relative" style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(var(--primary-rgb), 0.1), transparent 50%)' }} />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center z-10"
        >
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">Initializing Matrix...</h2>
          <p className="font-black uppercase tracking-[0.3em] text-[8px]" style={{ opacity: 0.4 }}>
            Establishing Neural Bridge
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] transition-colors duration-500 font-sans overflow-hidden relative" style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}>
        <div className="ambient-bg" />
        <div className="neural-frame flex-1 flex h-full relative">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 z-[110] flex items-center justify-center gap-2">
            <AlertCircle size={12} />
            YOU ARE OFFLINE. SOME FEATURES MAY BE UNAVAILABLE.
          </div>
        )}
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          "flex flex-col border-r transition-all duration-500 ease-in-out fixed md:relative z-[101] md:z-50 h-full",
          (isSidebarCollapsed && !isMobileMenuOpen) ? "w-0 md:w-20 overflow-hidden" : "w-[280px] md:w-[320px]",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isMobileMenuOpen && "shadow-[10px_0_50px_rgba(0,0,0,0.5)] border-r-2 border-primary/30"
        )} style={{ 
          borderColor: isMobileMenuOpen ? 'rgba(var(--primary-rgb), 0.3)' : 'var(--border)', 
          backgroundColor: 'var(--sidebar)',
          backgroundImage: isMobileMenuOpen ? 'linear-gradient(to right, var(--sidebar), color-mix(in srgb, var(--sidebar) 90%, var(--primary)))' : 'none'
        }}>
          {/* Sidebar Header */}
          <div className={cn("p-6 border-b flex items-center transition-all", isSidebarCollapsed ? "justify-center px-0" : "justify-between")} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--sidebar)' }}>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-none border-2 border-primary/20 shrink-0 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md" style={{ color: 'var(--primary)' }}>
                <Brain size={24} />
              </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h1 className="text-xl font-bold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
                    Setu <span className="text-primary">Intelligence</span>
                  </h1>
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] mt-1 opacity-50" style={{ color: 'var(--text)' }}>Bharat High-Fidelity Node</p>
                </motion.div>
              )}
            </div>
            {/* Close button for mobile */}
            {isMobileMenuOpen && (
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                style={{ color: 'var(--text)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar scroll-smooth" style={{ backgroundColor: 'var(--sidebar)' }}>
            {/* Navigation */}
            <div className="space-y-4">
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-2 ml-4">
                  <div className="w-1 h-3 rounded-full bg-primary animate-pulse" />
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Main Modules</label>
                </div>
              )}
              <div className="flex flex-col px-2 gap-1">
                {[
                  { id: 'chat', icon: MessageSquare, label: 'Matrix', desc: 'Neural Chat Core' },
                  { id: 'talk', icon: Mic, label: 'Voice', desc: 'Voice Interface' },
                  { id: 'intelligence', icon: TrendingUp, label: 'Intelligence', desc: 'Market Analytics', adminOnly: true },
                  { id: 'agents', icon: Users, label: 'Personnel', desc: 'Agent Center', adminOnly: true },
                  { id: 'admin', icon: ShieldAlert, label: 'Admin', desc: 'Control Panel' },
                  { id: 'settings', icon: Settings, label: 'Settings', desc: 'System Tuning' }
                ].filter(item => !item.adminOnly || isAdminLoggedIn).map((item) => (
                  <Tooltip key={item.id} content={isSidebarCollapsed ? item.label : ""} className="block w-full">
                    <button
                      onClick={() => {
                        setView(item.id as ViewState);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full group relative flex items-center h-12 transition-all duration-300 overflow-hidden",
                        view === item.id 
                          ? "rounded-none md:ml-0 shadow-[4px_0_15px_-3px_rgba(var(--primary-rgb),0.3)] border-r-4 border-primary" 
                          : "rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      )}
                      style={{
                        backgroundColor: view === item.id ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                        color: view === item.id ? 'var(--primary)' : 'inherit'
                      }}
                    >
                      {view === item.id && (
                        <motion.div 
                          layoutId="activeNavBg"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-none hidden md:block" 
                        />
                      )}
                      <div className={cn(
                        "flex items-center gap-4 w-full px-4",
                        isSidebarCollapsed ? "justify-center" : "justify-start pl-4"
                      )}>
                        <div className={cn(
                          "transition-all duration-300",
                          view === item.id ? "scale-110 animate-pulse-glow" : "opacity-50 group-hover:opacity-100 group-hover:scale-110"
                        )}>
                          <item.icon size={20} strokeWidth={view === item.id ? 2.5 : 2} />
                        </div>
                        {!isSidebarCollapsed && (
                          <div className="flex flex-col items-start min-w-0 transition-opacity duration-300">
                            <span className={cn(
                              "text-[14px] font-bold tracking-tight truncate leading-tight transition-colors",
                              view === item.id ? "text-primary" : "text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white"
                            )}>
                              {item.label}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 truncate w-full uppercase tracking-widest">{item.desc}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </Tooltip>
                ))}
                
                {/* Feedback Button */}
                <Tooltip content={isSidebarCollapsed ? "Feedback" : ""} className="block w-full">
                  <button
                    onClick={() => setFeedbackModalOpen(true)}
                    className="w-full group relative flex items-center h-12 transition-all duration-300 overflow-hidden rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  >
                    <div className={cn(
                      "flex items-center gap-4 w-full px-4",
                      isSidebarCollapsed ? "justify-center" : "justify-start pl-4"
                    )}>
                      <div className="opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                        <MessageSquare size={20} />
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="flex flex-col items-start min-w-0 transition-opacity duration-300">
                          <span className="text-[14px] font-bold tracking-tight truncate leading-tight opacity-70 group-hover:opacity-100">
                            Feedback
                          </span>
                          <span className="text-[10px] font-bold opacity-30 group-hover:opacity-50 truncate w-full uppercase tracking-widest">Submit Issue</span>
                        </div>
                      )}
                    </div>
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Session History */}
            {!isSidebarCollapsed && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                  <div className="w-1 h-3 rounded-none bg-secondary" />
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text)' }}>Recent History</label>
                  </div>
                  <Tooltip content="Initialize New Node">
                    <button 
                      onClick={() => createNewSession(user.uid)}
                      className="p-1 px-2 transition-all border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary"
                    >
                      <Plus size={12} />
                    </button>
                  </Tooltip>
                </div>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                  {sessions.map((s) => (
                    <motion.div 
                      key={s.id}
                      className={cn(
                        "group relative flex items-center gap-3 p-3 rounded-none transition-all cursor-pointer overflow-hidden border-2",
                        currentSessionId === s.id 
                          ? "border-secondary/30 bg-secondary/5 shadow-[inset_4px_0_0_0_var(--secondary)]" 
                          : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      )}
                      style={{ color: 'var(--text)' }}
                      onClick={() => { 
                        setView('chat'); 
                        setCurrentSessionId(s.id); 
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <div className={cn(
                        "p-2 rounded-none transition-all",
                        currentSessionId === s.id ? "bg-secondary text-white" : "border-2 border-zinc-200 dark:border-zinc-800 text-zinc-400 group-hover:text-secondary group-hover:border-secondary/30"
                      )}>
                        <MessageSquare size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[13px] font-semibold truncate", currentSessionId === s.id ? "text-secondary" : "text-zinc-700 dark:text-zinc-300")}>{s.title || 'New Node Interaction'}</p>
                        <p className="text-[10px] font-medium opacity-40 mt-0.5">{new Date(s.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinSession(s.id, !!s.isPinned);
                        }}
                        className={cn(
                          "p-1.5 opacity-0 group-hover:opacity-100 transition-all rounded-none border-2 border-transparent",
                          s.isPinned ? "text-secondary opacity-100" : "text-zinc-400 hover:text-secondary hover:border-secondary/20"
                        )}
                      >
                        <Pin size={14} className={s.isPinned ? "fill-secondary" : ""} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("De-initialize this history element?")) deleteSession(s.id);
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-none border-2 border-transparent hover:border-rose-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Footer */}
          <div className={cn("p-4 border-t transition-all", isSidebarCollapsed ? "px-0" : "p-4")} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--sidebar)' }}>
            <div className={cn("flex items-center group cursor-pointer transition-all gap-3 p-2 rounded-none border border-transparent hover:border-primary/20 hover:bg-primary/5", isSidebarCollapsed ? "justify-center" : "")}>
              <div className="w-10 h-10 rounded-none border border-primary/20 flex items-center justify-center shrink-0 bg-white dark:bg-zinc-900 shadow-sm group-hover:shadow-md transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-none object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={20} className="text-primary" />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate tracking-tight" style={{ color: 'var(--text)' }}>{user.displayName || 'BCC Member'}</p>
                  <p className="text-[10px] font-medium opacity-40 truncate" style={{ color: 'var(--text)' }}>Active Insight Node</p>
                </div>
              )}
              {!isSidebarCollapsed && (
                <button onClick={() => auth.signOut()} className="p-2 transition-all text-zinc-400 hover:text-rose-500 hover:bg-rose-500/5 rounded-none opacity-0 group-hover:opacity-100">
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Experience */}
        <main className="flex-1 flex flex-col relative neural-frame bg-zinc-50 dark:bg-[#080808]">
          <div className="flex-1 flex flex-col relative overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
          {/* Header - Executive Intelligence Terminal */}
          <header className="h-14 md:h-16 border-b-2 flex items-center justify-between px-3 md:px-5 z-[50] transition-all shrink-0 bg-white/95 dark:bg-black/90 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800 sticky top-0">
            <div className="flex items-center gap-3 md:gap-6">
              <button 
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileMenuOpen(true);
                  } else {
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }
                }}
                className="flex p-2.5 rounded-none border-2 border-zinc-100 dark:border-zinc-800 hover:border-primary transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 active:scale-95 shadow-sm"
              >
                <Menu size={20} />
              </button>
              
              <div className="flex items-center gap-4 md:gap-8 min-w-0 overflow-hidden">
                {/* Fixed Logo Section */}
                <div className="flex items-center gap-3">
                  <AnimatedLogo theme={currentTheme} />
                  <div className="w-[2px] h-8 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
                </div>

                {/* Fixed Time/Date Section - Enhanced Visibility */}
                <div className="hidden sm:flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-primary" />
                    <span className="text-[15px] font-black tracking-tight text-zinc-900 dark:text-white font-mono">
                      {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4" /> {/* Spacer to align with text */}
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                      {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Search - Neural Style */}
              <div className="hidden lg:flex items-center bg-zinc-50/50 dark:bg-black/50 rounded-none border-2 border-zinc-200 dark:border-zinc-800 focus-within:border-primary px-6 py-2.5 w-full max-w-xl transition-all focus-within:bg-white dark:focus-within:bg-black focus-within:ring-4 ring-primary/10 shadow-sm focus-within:shadow-md group">
                <Search size={18} className="text-zinc-400 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text"
                  placeholder="Search intelligence matrix..."
                  className="bg-transparent border-none outline-none flex-1 px-4 text-[14px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-700 font-bold uppercase tracking-tight"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Tooltip content="Purge Current Memory">
                    <button 
                      onClick={() => {
                        if (confirm("Purge current intelligence session?")) {
                          setMessages([{ id: 'init', uid: user.uid, role: 'bot', text: 'Intelligence node purged. Standby for new directive.', timestamp: serverTimestamp() as any, sessionId: currentSessionId || '' }]);
                          // Also delete in DB if we have a way to batch delete for current session
                          // deleteSession already handles this for the whole session
                        }
                      }}
                      className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Tooltip>
                  <div className="hidden sm:flex items-center gap-1 text-[11px] font-black text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-1 rounded-none border border-zinc-300 dark:border-zinc-700">
                    <span>⌘</span>
                    <span>K</span>
                  </div>
                </div>
              </div>

            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {isSTTActive && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 mr-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Voice Active</span>
                </div>
              )}
              <button 
                onClick={toggleTheme} 
                className="w-11 h-11 flex items-center justify-center transition-all rounded-none border-2 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 active:scale-95 group"
                title="Toggle Theme"
              >
                  {isDarkMode ? <Sun size={18} className="group-hover:rotate-45 transition-transform" /> : <Moon size={18} className="group-hover:-rotate-12 transition-transform" />}
                </button>
                
                <div className="w-[1.5px] h-8 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />
                
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-11 h-11 flex items-center justify-center transition-all rounded-none border-2 border-primary/40 hover:border-primary p-0.5" 
                >
                  <div className="w-full h-full rounded-none overflow-hidden bg-primary flex items-center justify-center">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt="Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[14px] font-black text-white uppercase italic">{user?.displayName?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </button>
              </div>
          </header>

          {/* Content View */}
          <div 
            ref={mainContentRef}
            className="flex-1 overflow-y-auto relative no-scrollbar custom-scrollbar"
            style={{ backgroundColor: 'var(--background)' }}
          >
            <div className="p-2 md:p-3 lg:p-4 min-h-full">
              <AnimatePresence mode="wait">
              {view === 'chat' && (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-4xl mx-auto w-full h-full flex flex-col"
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 px-4 text-center py-6">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="w-full max-w-2xl bg-white dark:bg-black border-4 border-zinc-200 dark:border-zinc-800 rounded-none p-8 md:p-12 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/5 rounded-none blur-3xl animate-pulse" />
                        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-secondary/5 rounded-none blur-3xl animate-pulse" />
                        
                          <div className="flex flex-col gap-6 md:gap-10 relative z-10">
                            <header className="flex flex-col items-center text-center">
                              <div className="w-12 h-1.5 bg-primary rounded-none mb-6 shadow-lg shadow-primary/20" />
                              <motion.h2 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-3xl md:text-5xl font-bold tracking-tight mb-2 text-zinc-900 dark:text-white" 
                              >
                                Setu <span className="text-primary italic">Intelligence</span>
                              </motion.h2>
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-[10px] md:text-sm font-black text-primary uppercase tracking-[0.3em]"
                              >
                                Bharat's Neural Trade Matrix
                              </motion.p>
                            </header>

                            <div className="space-y-4 md:space-y-6">
                              <p className="text-zinc-600 dark:text-zinc-400 font-bold text-xs md:text-sm text-center md:text-left">Empowering your enterprise with instant global intelligence.</p>
                              
                              <div className="flex md:grid md:grid-cols-2 gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-4 md:pb-0 px-2 md:px-0 -mx-2 md:mx-0">
                                {[
                                  { label: "Growth Engines", prompt: "Analyze emerging global markets for Indian trade and identify high-potential sectors for export growth.", icon: Globe },
                                  { label: "Incentive Hub", prompt: "Explain the latest government incentives and trade benefits. How can my specific business access these programs?", icon: ShieldCheck },
                                  { label: "Policy Simplified", prompt: "Break down the most recent international trade policies into clear, easy-to-understand actionable steps for my business.", icon: BookOpen },
                                  { label: "Strategic Scaling", prompt: "Create a strategic, step-by-step roadmap to help scale my business operations to meet international trade standards.", icon: TrendingUp }
                                ].map((starter, i) => (
                                  <motion.button 
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 + 0.4 }}
                                    onClick={() => handleSend(starter.prompt)}
                                    className="p-3 md:p-5 google-card text-left flex items-center justify-between group rounded-none border-2 shrink-0 w-[200px] md:w-full"
                                  >
                                    <div className="flex items-center gap-3 md:gap-4">
                                      <div className="p-2 md:p-2.5 bg-primary/5 text-primary rounded-none border-2 border-transparent group-hover:border-primary group-hover:bg-primary group-hover:text-white transition-all">
                                        <starter.icon size={18} className="md:w-5 md:h-5" strokeWidth={2} />
                                      </div>
                                      <span className="text-[11px] md:text-sm font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-tight group-hover:text-primary transition-colors">{starter.label}</span>
                                    </div>
                                    <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                          <div className="flex flex-wrap justify-center gap-4 md:gap-8 pt-4 md:pt-6 border-t-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                            <button onClick={() => setWelcomeModalOpen('system')} className="text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors group">
                               <Activity size={10} className="md:w-3 md:h-3 group-hover:animate-pulse" /> System Protocol
                            </button>
                            <button onClick={() => setWelcomeModalOpen('session')} className="text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-secondary transition-colors group">
                               <Shield size={10} className="md:w-3 md:h-3 group-hover:rotate-12 transition-transform" /> Neural Guard
                            </button>
                            <button onClick={() => setWelcomeModalOpen('language')} className="text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors">
                               <Zap size={10} className="md:w-3 md:h-3" /> Language Matrix
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-10">
                      {filteredMessages.map((m, i) => (
                        <div key={m.id || `msg-${i}`}>
                          <ChatMessageComponent 
                            msg={m} 
                            isUser={m.role === 'user'}
                            onTranslate={(text, lang) => {
                              setLoading(true);
                              translateText(text, lang).then(t => {
                                setMessages(prev => prev.map(msgItem => 
                                  msgItem.id === m.id ? { ...msgItem, translation: t, translatedLang: lang } : msgItem
                                ));
                                addToast(`Translated to ${lang}`, "success");
                              }).catch(err => {
                                addToast("Translation failed.", "error");
                                console.error(err);
                              }).finally(() => setLoading(false));
                            }}
                            onCopy={(text) => navigator.clipboard.writeText(text).then(() => addToast("Copied!", "success"))}
                            onRegenerate={async (msgId) => {
                              const idx = messages.findIndex(m => m.id === msgId);
                              if (idx === -1) return;
                              const userMsg = [...messages.slice(0, idx)].reverse().find(msg => msg.role === 'user');
                              if (userMsg) {
                                // Optional: Delete old bot message
                                if (msgId !== 'init') {
                                  try {
                                    await deleteDoc(doc(db, 'chats', msgId));
                                  } catch (e) { console.error(e); }
                                }
                                handleSend(userMsg.text);
                              }
                            }}
                            onShare={(text) => handleShare(text)}
                            onEdit={handleEditMessage}
                            onDelete={deleteChatMessage}
                          />
                        </div>
                      ))}
                    </div>
                  )}
          {loading && (
                    <div className="flex justify-start mb-8">
                      <div className="p-8 border-4 border-primary transition-all duration-500 flex flex-col gap-6 shadow-[12px_12px_0px_0px_rgba(var(--primary-rgb),0.1)] bg-white dark:bg-zinc-950 w-full max-w-lg">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary animate-spin" />
                            <Cpu className="absolute inset-0 m-auto text-primary animate-pulse" size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[12px] font-black uppercase tracking-[0.4em] text-primary">Neural Consensus Protocol Active</span>
                            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Synthesizing Alpha-Level Insight...</span>
                          </div>
                        </div>
                        
                        {isDeepThink && (
                          <div className="space-y-4 pt-4 border-t-2 border-zinc-100 dark:border-zinc-800">
                             {[
                               { label: 'Policy_Node', status: 'Decrypting...', icon: ShieldCheck, color: 'text-primary' },
                               { label: 'Market_Stream', status: 'Synchronizing...', icon: Activity, color: 'text-emerald-500' },
                               { label: 'Logistics_Chain', status: 'Analyzing...', icon: Globe, color: 'text-accent' }
                             ].map((node, i) => (
                               <motion.div 
                                 key={i}
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: i * 0.2 }}
                                 className="flex items-center justify-between"
                               >
                                 <div className="flex items-center gap-2">
                                   <node.icon size={12} className={node.color} />
                                   <span className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">{node.label}</span>
                                 </div>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">{node.status}</span>
                               </motion.div>
                             ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </motion.div>
              )}

              {view === 'intelligence' && isAdminLoggedIn && (
                <motion.div 
                  key="intelligence"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-7xl mx-auto w-full google-card shadow-[0_0_50px_-12px_rgba(var(--primary-rgb),0.2)]"
                >
                  <IntelligenceHub 
                    news={newsNodes} 
                    market={marketData}
                    niftyHistory={niftyHistory}
                    summaries={summaryCards}
                    onRefresh={() => {
                      fetchNewsNodes();
                      if ((window as any).refreshMarketData) {
                        (window as any).refreshMarketData();
                      }
                      addToast("Market Intelligence Synchronized", "success");
                    }} 
                    lastSync={lastSync} 
                    marketSyncTime={marketSyncTime}
                    marketErrors={marketErrors}
                    syncInterval={syncInterval}
                    setSyncInterval={setSyncInterval}
                    onSelectSummary={setSelectedSummary}
                    onForgeReport={(content: string) => {
                      setForgedReportContent(content);
                      setIsForgeModalOpen(true);
                    }}
                  />
                </motion.div>
              )}

              {view === 'intelligence' && !isAdminLoggedIn && (
                <motion.div 
                  key="intelligence-blocked"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-12 text-center h-[60vh]"
                >
                  <div className="p-6 bg-rose-50 text-rose-500 rounded-full mb-6 border-4 border-rose-500/20">
                    <ShieldAlert size={48} strokeWidth={1} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Access Restricted</h3>
                  <p className="text-zinc-500 mb-8 max-w-sm">Market Intelligence Hub requires administrative authorization. Please login as admin to access these nodes.</p>
                  <button onClick={() => setView('admin')} className="google-btn-primary">
                    <Shield size={18} /> Access Control
                  </button>
                </motion.div>
              )}

              {view === 'talk' && (
                <motion.div 
                  key="talk"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="max-w-4xl mx-auto w-full"
                >
                  <VoiceEngine onClose={() => setView('chat')} />
                </motion.div>
              )}

              {view === 'agents' && isAdminLoggedIn && (
                <motion.div 
                  key="agents"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-7xl mx-auto w-full google-card shadow-[0_0_50px_-12px_rgba(var(--primary-rgb),0.2)]"
                >
                  <AgentsTerminal 
                    agents={[...PREDEFINED_AGENTS, ...customAgents]}
                    activeAgentId={activeAgentId}
                    onSelect={setActiveAgentId}
                    onDuplicate={duplicateAgent}
                    onDelete={deleteCustomAgent}
                    onEdit={(agent) => {
                      setEditingAgent(agent);
                      setIsAgentEditorOpen(true);
                    }}
                    onCreate={() => {
                      setEditingAgent({
                        id: '',
                        name: 'New Agent',
                        label: 'Specialized Node',
                        role: 'Intelligence Assistant',
                        persona: 'Friendly and helpful assistant for BCC.',
                        frameworks: [],
                        skills: [],
                        category: '',
                        icon: '',
                        linguisticControls: 'Use professional tone.',
                        abilities: { toolCalling: true, mcpCalling: false, remoteConnection: false },
                        responseStyle: 'standard',
                        config: {}
                      });
                      setIsAgentEditorOpen(true);
                    }}
                    addToast={addToast}
                  />
                </motion.div>
              )}

              {view === 'agents' && !isAdminLoggedIn && (
                <motion.div 
                  key="agents-blocked"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-12 text-center h-[60vh]"
                >
                  <div className="p-6 bg-rose-50 text-rose-500 rounded-full mb-6 border-4 border-rose-500/20">
                    <ShieldAlert size={48} strokeWidth={1} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Personnel Matrix Secured</h3>
                  <p className="text-zinc-500 mb-8 max-w-sm">Neural Personnel Matrix requires administrative authorization. Please login as admin to access specialized nodes.</p>
                  <button onClick={() => setView('admin')} className="google-btn-primary">
                    <Shield size={18} /> Access Control
                  </button>
                </motion.div>
              )}

              {view === 'tasks' && (
                <motion.div 
                  key="tasks"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-6xl mx-auto w-full flex flex-col gap-6"
                >
                  {/* Active Agent Console */}
                  {activeAgent && (
                    <div className="border-4 rounded-none p-6 md:p-8 shadow-[10px_10px_0px_0px_rgba(var(--primary-rgb),0.1)] relative overflow-hidden bg-white dark:bg-zinc-950 group mb-6" style={{ borderColor: 'var(--primary)' }}>
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                        <Activity size={80} />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-primary text-white shadow-[4px_4px_0px_0px_rgba(var(--primary-rgb),0.3)] border-2 border-white/20">
                            <Cpu size={24} />
                          </div>
                          <div>
                            <h2 className="text-xl md:text-2xl font-serif italic font-bold tracking-tight text-primary">Active Node Console</h2>
                              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mt-1">
                                {[...PREDEFINED_AGENTS, ...customAgents].find(a => a.id === activeAgentId)?.label || 'Custom Node'} // SYNC_STABLE
                              </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="px-3 py-1 bg-primary/5 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-[0.3em]">
                            Neural Synchronized
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {[
                          { label: "Neural Load", val: "24%", color: "text-primary", icon: Activity },
                          { label: "Latency", val: "12ms", color: "text-secondary", icon: Zap },
                          { label: "Stability", val: "99.9%", color: "text-emerald-500", icon: ShieldCheck },
                          { label: "Objectives", val: tasks.filter(t => !t.completed).length, color: "text-primary", icon: Target }
                        ].map((stat, i) => (
                          <div key={i} className="p-4 border-2 border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:border-primary/20 transition-all">
                            <div className="flex items-center gap-2 mb-2">
                              <stat.icon size={12} className="opacity-40" />
                              <p className="text-[8px] font-black uppercase tracking-widest opacity-40">{stat.label}</p>
                            </div>
                            <p className={cn("text-xl font-black italic tracking-tighter", stat.color)}>{stat.val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {/* Agent Matrix Compact Dashboard */}
                    <div className="border-4 rounded-none p-6 md:p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.02)] bg-white dark:bg-zinc-950 flex flex-col h-full" style={{ borderColor: 'var(--primary)' }}>
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-6 bg-primary shadow-[2px_2px_0px_0px_rgba(var(--primary-rgb),0.3)]" />
                          <h2 className="text-lg md:text-xl font-serif italic font-bold tracking-tight">Agent Matrix</h2>
                        </div>
                        <Tooltip content="Matrix Synchronize">
                          <button className="p-1 px-3 border-2 border-zinc-100 dark:border-zinc-900 hover:border-primary transition-all text-zinc-400 hover:text-primary text-[9px] font-black uppercase tracking-widest">
                            Sync Node
                          </button>
                        </Tooltip>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                        {AGENT_CATEGORY_MODELS.map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat);
                              setView('agents');
                            }}
                            className="p-5 border-2 text-left transition-all hover:bg-primary/5 group relative overflow-hidden flex flex-col justify-between"
                            style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-20 group-hover:scale-110 transition-all">
                              <cat.icon size={50} />
                            </div>
                            <div className="relative z-10">
                              <cat.icon size={16} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
                              <h3 className="text-xs font-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{cat.label}</h3>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">System Integration Active</p>
                            </div>
                            <div className="mt-4 flex items-center gap-2 relative z-10">
                              <div className="w-1 h-3 bg-primary/30 group-hover:bg-primary transition-all" />
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Access Matrix</span>
                            </div>
                          </button>
                        ))}
                        
                        {/* Custom Nodes Category */}
                        {customAgents.length > 0 && (
                          <button 
                            onClick={() => setSelectedCategory({
                              category: 'Custom Nodes',
                              icon: Cpu,
                              desc: 'User-defined specialized intelligence nodes.',
                              agents: customAgents.map(a => ({ ...a, icon: Cpu, label: a.name, desc: a.persona }))
                            })}
                            className="p-5 border-2 text-left transition-all hover:bg-primary/5 group relative overflow-hidden flex flex-col justify-between"
                            style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-20 group-hover:scale-110 transition-all">
                              <Cpu size={50} />
                            </div>
                            <div className="relative z-10">
                              <Cpu size={16} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
                              <h3 className="text-xs font-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">Custom Nodes</h3>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">{customAgents.length} Nodes Available</p>
                            </div>
                            <div className="mt-4 flex items-center gap-2 relative z-10">
                              <div className="w-1 h-3 bg-primary/30 group-hover:bg-primary transition-all" />
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">External Protocol</span>
                            </div>
                          </button>
                        )}
                      </div>

                      <div className="mt-8 pt-6 border-t-4 border-zinc-50 dark:border-zinc-900">
                        <button 
                          onClick={() => setIsArchitectOpen(true)}
                          className="w-full p-4 bg-primary text-white font-black uppercase text-[11px] tracking-[0.3em] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[6px_6px_0px_0px_rgba(var(--primary-rgb),0.2)]"
                        >
                          <Plus size={18} strokeWidth={3} />
                          Initialize Architect
                        </button>
                      </div>
                    </div>

                    {/* Objective Matrix */}
                    <div className="border-4 rounded-none p-6 md:p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.02)] bg-white dark:bg-zinc-950 flex flex-col h-full max-h-[700px]" style={{ borderColor: 'var(--secondary)' }}>
                      <div className="flex items-center justify-between mb-8 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-6 bg-secondary shadow-[2px_2px_0px_0px_rgba(var(--secondary-rgb),0.3)]" />
                          <h2 className="text-lg md:text-xl font-serif italic font-bold tracking-tight">Objective Matrix</h2>
                        </div>
                        <div className="px-3 py-1 bg-secondary text-white text-[9px] font-black uppercase tracking-widest">
                          {tasks.length} SYNC_TASKS
                        </div>
                      </div>
                      
                      <div className="space-y-4 mb-6 shrink-0">
                        <div className="flex flex-col md:flex-row gap-2">
                          <input 
                            id="task-input"
                            className="flex-1 bg-transparent border-2 rounded-none p-3 md:p-4 outline-none transition-all font-black text-[12px] md:text-sm uppercase tracking-widest focus:border-secondary shadow-inner"
                            style={{ borderColor: 'rgba(var(--secondary-rgb), 0.2)', color: 'var(--text)' }}
                            placeholder="Inject new directive..."
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const dateInput = document.getElementById('task-date') as HTMLInputElement;
                                addTask((e.target as HTMLInputElement).value, dateInput.value);
                                (e.target as HTMLInputElement).value = '';
                                dateInput.value = '';
                              }
                            }}
                          />
                          <input 
                            id="task-date"
                            type="datetime-local"
                            className="bg-transparent border-2 rounded-none p-3 md:p-4 outline-none transition-all font-black text-[10px] uppercase tracking-widest focus:border-secondary shadow-inner w-full md:w-56"
                            style={{ borderColor: 'rgba(var(--secondary-rgb), 0.2)', color: 'var(--text)' }}
                          />
                          <button 
                            onClick={() => {
                              const inputEl = document.getElementById('task-input') as HTMLInputElement;
                              const dateInput = document.getElementById('task-date') as HTMLInputElement;
                              if (inputEl.value.trim()) {
                                addTask(inputEl.value, dateInput.value);
                                inputEl.value = '';
                                dateInput.value = '';
                              }
                            }}
                            className="p-3 md:p-4 bg-secondary text-white transition-all active:scale-95 shadow-[4px_4px_0px_0px_rgba(var(--secondary-rgb),0.3)] flex items-center justify-center gap-2"
                          >
                            <Plus size={20} strokeWidth={3} />
                            <span className="md:hidden lg:inline text-[10px] font-black tracking-widest">DEPLOY</span>
                          </button>
                        </div>
                        
                        {/* Default Objectives */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                          {(DEFAULT_OBJECTIVES[activeAgentId as keyof typeof DEFAULT_OBJECTIVES] || DEFAULT_OBJECTIVES['hybrid']).map((obj, i) => (
                            <button
                              key={i}
                              onClick={() => addTask(obj)}
                              className="whitespace-nowrap px-4 py-2 border-2 border-secondary/20 text-[9px] font-black uppercase tracking-widest hover:bg-secondary/5 hover:border-secondary transition-all shrink-0 italic"
                            >
                              + {obj}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto no-scrollbar pr-2 space-y-4">
                        <AnimatePresence mode="popLayout">
                          {tasks.length === 0 ? (
                            <div className="p-12 border-4 border-dashed border-zinc-100 dark:border-zinc-900 text-center flex flex-col items-center justify-center">
                              <Target size={40} className="mb-4 opacity-5" />
                              <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-20">No Directives Initialized</p>
                            </div>
                          ) : (
                            tasks.map((task) => (
                              <motion.div 
                                key={task.id}
                                layout
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={cn(
                                  "p-5 border-2 transition-all group relative overflow-hidden",
                                  task.completed 
                                    ? "border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 shadow-none grayscale" 
                                    : "border-secondary/30 bg-white dark:bg-zinc-950 shadow-[6px_6px_0px_0px_rgba(var(--secondary-rgb),0.05)] hover:border-secondary hover:shadow-secondary/20"
                                )}
                              >
                                <div className="flex items-start gap-4">
                                  <button 
                                    onClick={() => toggleTask(task)}
                                    className={cn(
                                      "mt-1 w-6 h-6 border-2 flex items-center justify-center transition-all",
                                      task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-secondary/40 hover:border-secondary"
                                    )}
                                  >
                                    {task.completed && <Check size={14} strokeWidth={4} />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <h3 className={cn("text-xs font-black uppercase tracking-widest", task.completed ? "line-through opacity-30 text-zinc-500" : "text-text")}>
                                      {task.title}
                                    </h3>
                                    <div className="flex items-center gap-6 mt-3">
                                      <div className="flex items-center gap-2 opacity-30">
                                        <Clock size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{new Date(task.createdAt?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-1.5 h-1.5 rounded-none shadow-[0_0_8px_rgba(var(--secondary-rgb),0.4)]", task.completed ? "bg-zinc-400" : "bg-secondary animate-pulse")} />
                                        <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", task.completed ? "opacity-30" : "text-secondary")}>Active_Directive</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="p-2 opacity-0 group-hover:opacity-100 transition-all text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {view === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  className="max-w-7xl mx-auto w-full px-2 md:px-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {/* Updated Profile Card - Bento */}
                    <div className="md:col-span-2 lg:col-span-2 border-2 rounded-none p-4 md:p-5 shadow-lg group relative overflow-hidden" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -rotate-45 translate-x-16 -translate-y-16 group-hover:bg-primary/10 transition-all duration-700" />
                      
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black flex items-center gap-2 uppercase italic" style={{ color: 'var(--text)' }}>
                          <Settings size={18} className="text-primary" />
                          Matrix Profile
                        </h2>
                        <button 
                          onClick={() => setIsEditingProfileSettings(!isEditingProfileSettings)}
                          className="p-2 border-2 border-primary/20 hover:border-primary text-zinc-400 hover:text-primary transition-all rounded-none"
                        >
                          {isEditingProfileSettings ? <X size={16} /> : <Edit3 size={16} />}
                        </button>
                      </div>

                      {isEditingProfileSettings ? (
                        <div className="space-y-3 p-4 border-2 border-dashed border-primary/20 bg-zinc-50 dark:bg-zinc-900/40">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-primary">Identity Node</label>
                            <input 
                              className="w-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 p-2 text-xs font-bold focus:border-primary outline-none"
                              value={user.displayName}
                              onChange={(e) => setUser({...user, displayName: e.target.value})}
                              placeholder="Display Name"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-primary">Neural Uplink (Email)</label>
                            <input 
                              className="w-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 p-2 text-xs font-bold focus:border-primary outline-none"
                              value={user.email}
                              onChange={(e) => setUser({...user, email: e.target.value})}
                              placeholder="Email Address"
                            />
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingProfileSettings(false);
                              addToast("Matrix profile synced successfully", "success");
                            }}
                            className="w-full py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-md hover:translate-y-[-1px] transition-all"
                          >
                            Synchronize Matrix
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-5 p-4 border-2" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                          <div className="relative">
                            <img 
                              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=random`} 
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-none border-2 shadow-lg" 
                              style={{ borderColor: 'var(--primary)' }} 
                            />
                            <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 border border-white text-white">
                              <ShieldCheck size={10} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black truncate uppercase tracking-tighter" style={{ color: 'var(--text)' }}>{user.displayName}</p>
                            <p className="text-[10px] font-black truncate uppercase tracking-widest text-zinc-600 dark:text-zinc-400" style={{ color: 'var(--primary--faded)' }}>{user.email}</p>
                            <div className="mt-2 flex gap-1.5">
                              <span className="px-2 py-0.5 bg-primary text-white text-[7px] font-black uppercase tracking-widest">Verified Node</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preferences Card - Bento */}
                    <div className="border-2 rounded-none p-5 flex flex-col justify-between shadow-lg" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <label className="text-[10px] uppercase font-bold tracking-widest mb-4 block text-primary">Neural Interface</label>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Languages size={14} className="text-primary" />
                            <span className="font-bold text-[10px] uppercase text-zinc-900 dark:text-zinc-100">Language Matrix</span>
                          </div>
                          <select 
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold uppercase p-2 outline-none focus:border-primary"
                          >
                            <option>English</option>
                            {[...INDIAN_LANGUAGES, ...INT_LANGUAGES].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <Palette size={14} className="text-secondary" />
                            <span className="font-bold text-[10px] uppercase">Neural Theme</span>
                          </div>
                          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 bg-zinc-200 dark:bg-zinc-700">
                            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Vector Notepad Tool */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Notepad size={14} /> Neural Sandbox
                        </h2>
                        <button onClick={() => addToast("Draft autosaved to matrix", "info")}>
                           <SaveIcon size={14} className="text-zinc-400 hover:text-primary" />
                        </button>
                      </div>
                      <textarea 
                        value={userDraft}
                        onChange={(e) => setUserDraft(e.target.value)}
                        className="flex-1 w-full bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs font-medium outline-none resize-none border border-zinc-100 dark:border-zinc-800 focus:border-primary/40 transition-all"
                        placeholder="Neural draft input authorized..."
                      />
                    </div>

                    {/* Neural Archives (History) */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col h-[280px]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-4">
                        <History size={14} /> Neural Archives
                      </h2>
                      <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                        {sessions.slice(0, 5).map(session => (
                          <button 
                            key={session.id}
                            onClick={() => {
                              setCurrentSessionId(session.id);
                              setView('chat');
                            }}
                            className="w-full p-2 text-left bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 hover:border-primary/30 transition-all group"
                          >
                            <p className="text-[10px] font-bold truncate group-hover:text-primary">{session.title || 'Untitled Session'}</p>
                            <p className="text-[8px] font-medium text-zinc-500 mt-0.5">{new Date(session.createdAt).toLocaleDateString()}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pinned Core (Pinned Chats) */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col h-[280px]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2 mb-4">
                        <Pin size={14} /> Pinned Core
                      </h2>
                      <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                        {sessions.filter(s => s.isPinned).map(session => (
                          <div key={session.id} className="flex items-center gap-2 p-2 bg-secondary/5 border border-secondary/20">
                            <div className="flex-1 min-w-0">
                               <p className="text-[10px] font-black truncate text-secondary uppercase">{session.title}</p>
                            </div>
                            <button onClick={() => {
                              setCurrentSessionId(session.id);
                              setView('chat');
                            }} className="p-1 hover:bg-secondary/10 rounded">
                               <ArrowRight size={12} className="text-secondary" />
                            </button>
                          </div>
                        ))}
                          {sessions.filter(s => s.isPinned).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center italic text-zinc-500 dark:text-zinc-600">
                               <p className="text-[8px] uppercase tracking-tighter">No Pinned Nodes Authorized</p>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Vector Compute (Calculator) */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-4">
                        <Calculator size={14} /> Vector Compute
                      </h2>
                      <div className="space-y-2">
                        <div className="bg-zinc-900 p-2 text-right font-mono text-emerald-400 text-sm h-8 flex items-center justify-end overflow-hidden border-2 border-zinc-800">
                          {calcInput || '0'}
                        </div>
                        {calcResult && (
                          <div className="text-[10px] font-black text-rose-500 text-right animate-pulse">RESULT: {calcResult}</div>
                        )}
                        <div className="grid grid-cols-4 gap-1">
                          {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+','='].map(btn => (
                            <button 
                              key={btn}
                              onClick={() => {
                                if (btn === 'C') { setCalcInput(''); setCalcResult(null); }
                                else if (btn === '=') {
                                  try { setCalcResult(eval(calcInput).toString()); }
                                  catch { setCalcResult('ERR'); }
                                }
                                else setCalcInput(prev => prev + btn);
                              }}
                              className={cn(
                                "p-2 text-[10px] font-black border transition-all",
                                btn === '=' ? "bg-primary text-white md:col-span-1" : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                              )}
                            >
                              {btn}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Intelligence Notes */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col h-[280px]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <FileText size={14} /> Intelligence Notes
                        </h2>
                        <button 
                          onClick={() => {
                            const nt = prompt("Neural entry:");
                            if (nt) setMatrixNotes([...matrixNotes, { id: Date.now().toString(), text: nt, date: new Date().toLocaleDateString() }]);
                          }}
                          className="p-1 bg-primary text-white rounded-none"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
                        {matrixNotes.map(note => (
                          <div key={note.id} className="p-2 bg-primary/5 border-l-2 border-primary">
                             <p className="text-[9px] font-medium leading-tight">{note.text}</p>
                             <div className="flex items-center justify-between mt-1 text-[7px] font-black opacity-50 uppercase">
                               <span>{note.date}</span>
                               <button onClick={() => setMatrixNotes(matrixNotes.filter(n => n.id !== note.id))} className="text-rose-500">REMOVE</button>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Temporal Matrix (Calendar) */}
                    <div className="border-2 rounded-none p-5 shadow-lg flex flex-col h-[280px] relative overflow-hidden" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-4 relative z-10">
                        <Calendar size={14} /> Temporal Matrix
                      </h2>
                      <div className="absolute top-8 right-2 text-6xl font-black text-primary/5 select-none z-0">
                        {new Date().getDate()}
                      </div>
                      <div className="grid grid-cols-7 gap-1 flex-1 relative z-10 mt-2">
                         {['S','M','T','W','T','F','S'].map((d, i) => <div key={`${d}-${i}`} className="text-[7px] font-black text-center opacity-40 mb-1">{d}</div>)}
                         {Array.from({length: 31}).map((_, i) => (
                           <div 
                             key={i} 
                             className={cn(
                               "aspect-square flex items-center justify-center text-[9px] font-bold border border-zinc-100 dark:border-zinc-800",
                               i + 1 === new Date().getDate() ? "bg-primary text-white border-primary" : "bg-white dark:bg-zinc-900/50"
                             )}
                           >
                             {i + 1}
                           </div>
                         ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-dashed border-primary/20 relative z-10">
                         <p className="text-[8px] font-black uppercase text-primary tracking-widest">Protocol: ACTIVE OPS</p>
                         <p className="text-[7px] font-medium opacity-60 uppercase">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>

                    {/* Compact System Metrics Footer Card */}
                    <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-2">
                        { [
                          { label: 'Neural Load', value: '14%', color: 'var(--primary)', icon: Cpu },
                          { label: 'Uptime', value: '99.9%', color: 'var(--secondary)', icon: Zap },
                          { label: 'Latency', value: '24ms', color: 'var(--text)', icon: Activity }
                        ].map((stat, i) => (
                          <div key={i} className="border-2 rounded-none p-3 shadow-md flex items-center gap-3 transition-all" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                            <div className="p-2 rounded-none shadow-sm" style={{ backgroundColor: stat.color, color: 'var(--background)' }}>
                              <stat.icon size={16} />
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{stat.label}</p>
                              <p className="text-lg font-black italic uppercase" style={{ color: 'var(--text)' }}>{stat.value}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {view === 'admin' && (
                <motion.div 
                  key="admin"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-6xl mx-auto w-full"
                >
                  {!isAdminLoggedIn ? (
                    <AdminLogin 
                      credentials={adminCredentials} 
                      setCredentials={setAdminCredentials} 
                      onLogin={() => {
                        setIsAdminLoggedIn(true);
                        addToast("Admin Matrix Accessed.", "success");
                      }} 
                    />
                  ) : (
                    <AdminPanel 
                      credentials={adminCredentials}
                      onLogout={() => setIsAdminLoggedIn(false)}
                      addToast={addToast}
                      knowledgeBases={systemKnowledgeBases}
                      setKnowledgeBases={setSystemKnowledgeBases}
                      skills={systemSkills}
                      setSkills={setSystemSkills}
                    />
                  )}
                </motion.div>
              )}              </AnimatePresence>
            </div>
          </div>

          {/* Neural Matrix Modular Console (Footer) */}
          {view === 'chat' && (
            <footer className="transition-all shrink-0 z-40 bg-white dark:bg-zinc-950 border-t-2 border-zinc-200 dark:border-zinc-800 w-full relative">
              <div className="w-full flex flex-col">
                {/* Top Level: Full-Width Gridded Tools */}
                <div className="grid grid-cols-5 bg-zinc-50 dark:bg-zinc-900 w-full border-b border-zinc-200 dark:border-zinc-800">
                  {[
                    { id: 'web', icon: Globe, label: 'Web', action: () => {}, active: true },
                    { 
                      id: 'agents', 
                      icon: (selectedPersona !== 'standard' ? (PERSONAS.find(p => p.id === selectedPersona)?.icon || Users) : Users), 
                      label: (selectedPersona !== 'standard' ? (PERSONAS.find(p => p.id === selectedPersona)?.label || 'Agents') : 'Agents'), 
                      action: () => setIsPersonaListOpen(!isPersonaListOpen), 
                      active: selectedPersona !== 'standard' 
                    },
                    { id: 'upload', icon: Paperclip, label: 'Upload', action: handleFileUpload },
                    { id: 'deepthink', icon: Zap, label: 'Logic', action: () => {
                      setIsDeepThink(!isDeepThink);
                      addToast(isDeepThink ? 'Neural Logic Deactivated' : 'Neural Logic Engaged', 'info');
                    }, active: isDeepThink },
                    { id: 'new', icon: Plus, label: 'New', action: () => createNewSession(user.uid) }
                  ].map(tool => (
                    <button 
                      key={tool.id}
                      onClick={tool.action}
                      className={cn(
                        "w-full flex md:flex-row flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-3 px-1 md:px-4 transition-all border-t-2 border-r border-zinc-200 dark:border-zinc-800",
                        tool.active 
                          ? "bg-white dark:bg-zinc-950 border-t-primary text-primary animate-pulse-glow" 
                          : "border-t-transparent text-zinc-500 hover:bg-white dark:hover:bg-zinc-950 hover:text-primary"
                      )}
                    >
                      <tool.icon size={16} className="shrink-0" />
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-center">
                        {tool.label}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="max-w-4xl mx-auto w-full px-4 md:px-0">
                  <div className={cn(
                    "flex flex-col gap-3 p-1.5 bg-white dark:bg-[#303134] rounded-none shadow-lg border border-zinc-200 dark:border-zinc-700 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20",
                    loading && "opacity-80 grayscale"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="pl-4 shrink-0">
                        <div className={cn(
                          "w-8 h-8 rounded-none flex items-center justify-center transition-all duration-500 border-2",
                          loading ? "bg-primary text-white border-primary animate-pulse" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent"
                        )}>
                          {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                        </div>
                      </div>

                      <input 
                        ref={inputRef}
                        className="flex-1 min-w-0 bg-transparent py-3 md:py-4 outline-none px-2 text-[14px] md:text-[16px] font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                        placeholder="Neural command authorization required..."
                        value={input}
                        maxLength={2000}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && input.trim()) {
                            handleSend();
                          }
                        }}
                        disabled={loading || !isOnline}
                      />

                      <div className="mr-2 hidden md:flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-1 rounded-none border border-zinc-100 dark:border-zinc-800">
                        <span className={cn(
                          "text-[9px] font-black tracking-widest",
                          input.length > 1800 ? "text-rose-500" : "text-zinc-400"
                        )}>
                          {input.length}/2000
                        </span>
                      </div>

                      <button 
                        onClick={toggleSTT}
                        className={cn(
                          "w-10 h-10 md:w-12 md:h-12 rounded-none transition-all flex items-center justify-center shrink-0 border-2",
                          isSTTActive 
                            ? "bg-rose-500 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse" 
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-primary"
                        )}
                        title={isSTTActive ? "Stop Audio Bridge" : "Activate Neural Audio Bridge"}
                      >
                        {isSTTActive ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>

                      <button 
                        onClick={() => {
                          if (input.trim()) {
                            handleSend();
                          }
                        }}
                        disabled={loading || !input.trim() || !isOnline}
                        className={cn(
                          "w-10 h-10 md:w-12 md:h-12 rounded-none transition-all flex items-center justify-center shrink-0 border-2",
                          input.trim() 
                            ? "bg-primary text-white border-primary shadow-md hover:scale-105 active:scale-95" 
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 border-transparent pointer-events-none"
                        )}
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </footer>
          )}


          {/* Floating Scroll Button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="fixed bottom-24 md:bottom-28 right-4 md:right-8 z-50 p-2 md:p-3 rounded-none shadow-xl border-2 transition-all active:scale-90"
                style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--background)' }}
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Persona Selection Overlay */}
          <AnimatePresence>
            {isPersonaListOpen && (
              <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-2 md:p-10">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsPersonaListOpen(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ y: 200, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 200, opacity: 0 }}
                  className="relative w-full max-w-xl bg-white dark:bg-[#161a1f] rounded-none overflow-hidden shadow-2xl border-4 border-primary"
                >
                  <div className="p-6 border-b-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary">Strategic Intelligence Agents</h3>
                      <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Personnel Authorization Gateway</p>
                    </div>
                    <button onClick={() => setIsPersonaListOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-2">
                    {PERSONAS.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          setActivePersonaInModal(p);
                          setIsPersonaListOpen(false);
                        }}
                        className={cn(
                          "p-5 flex items-center justify-between rounded-none border-2 transition-all group",
                          selectedPersona === p.id 
                            ? "border-primary bg-primary/5 shadow-[inset_4px_0_0_0_var(--primary)]" 
                            : "border-zinc-100 dark:border-zinc-800 hover:border-primary/40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-14 h-14 rounded-none flex items-center justify-center border-2 shadow-sm transition-all",
                            selectedPersona === p.id 
                              ? "bg-primary text-white border-primary" 
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent group-hover:border-primary/20 group-hover:text-primary"
                          )}>
                            <p.icon size={28} />
                          </div>
                          <div className="text-left">
                            <p className="text-base font-black uppercase tracking-tight leading-none mb-1">{p.label}</p>
                            <p className="text-[10px] opacity-50 font-medium tracking-wide uppercase italic">{p.desc}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300 group-hover:text-primary transition-transform group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Detailed Persona Modal */}
          <AnimatePresence>
            {activePersonaInModal && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setActivePersonaInModal(null)}
                  className="absolute inset-0 bg-[#000]/60 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 30 }}
                  className="relative w-full max-w-lg bg-white dark:bg-zinc-950 border-4 border-primary shadow-[20px_20px_0px_0px_rgba(var(--primary-rgb),0.2)] overflow-hidden flex flex-col"
                >
                  <div className="p-8 border-b-4 border-zinc-100 dark:border-zinc-900 bg-primary/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-primary text-white flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(var(--primary-rgb),0.3)]">
                        <activePersonaInModal.icon size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter italic text-primary">{activePersonaInModal.label}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.4rem] opacity-40 text-zinc-500">Agent Briefing Mode</p>
                      </div>
                    </div>
                    <button onClick={() => setActivePersonaInModal(null)} className="p-2 hover:bg-primary/10 text-primary transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-8 space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary">Strategic Profile</label>
                      <p className="text-sm font-bold leading-relaxed text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 p-4 border-l-4 border-primary italic">
                        "{activePersonaInModal.longDesc}"
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary">Operational Traits</label>
                      <div className="flex flex-wrap gap-2">
                        {activePersonaInModal.traits.map((trait: string, idx: number) => (
                          <span key={idx} className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-8 grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => {
                          setSelectedPersona('standard');
                          setActivePersonaInModal(null);
                          addToast("Neural Agent Disengaged", "info");
                        }}
                        disabled={selectedPersona === 'standard'}
                        className={cn(
                          "py-4 font-black uppercase tracking-widest text-xs border-2 transition-all active:scale-95",
                          selectedPersona === 'standard' 
                            ? "border-zinc-200 text-zinc-400 bg-zinc-50 opacity-50 cursor-not-allowed" 
                            : "border-zinc-200 hover:border-zinc-400 text-zinc-600"
                        )}
                      >
                        Disengage Agent
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedPersona(activePersonaInModal.id);
                          setActivePersonaInModal(null);
                          addToast(`Agent ${activePersonaInModal.label} Engaged`, "success");
                        }}
                        disabled={selectedPersona === activePersonaInModal.id}
                        className={cn(
                          "py-4 font-black uppercase tracking-widest text-xs shadow-[8px_8px_0px_0px_rgba(var(--primary-rgb),0.3)] transition-all active:scale-95",
                          selectedPersona === activePersonaInModal.id 
                            ? "bg-zinc-400 text-zinc-100 cursor-not-allowed" 
                            : "bg-primary text-white hover:bg-primary-dark"
                        )}
                      >
                        {selectedPersona === activePersonaInModal.id ? "AGENT ACTIVE" : "Engage Agent"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          </div>
        </main>

        {/* Toast System */}
        <div className="fixed bottom-24 right-8 z-[100] flex flex-col gap-4">
            <AnimatePresence>
              {toasts.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className={cn(
                    "px-6 py-4 rounded-none shadow-2xl border-l-[8px] flex items-center gap-4 text-xs font-bold uppercase tracking-wider min-w-[320px] bg-white dark:bg-[#1e1e1e] backdrop-blur-xl",
                    t.type === 'success' ? "border-[#34A853]" :
                    t.type === 'error' ? "border-[#EA4335]" :
                    "border-[#4285F4]"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-none",
                    t.type === 'success' ? "bg-emerald-50" : t.type === 'error' ? "bg-rose-50" : "bg-blue-50"
                  )}>
                    {t.type === 'success' ? <CheckCircle size={18} className="text-[#34A853]" /> : <AlertCircle size={18} className={t.type === 'error' ? "text-[#EA4335]" : "text-[#4285F4]"} />}
                  </div>
                  <span className="flex-1 text-zinc-800 dark:text-zinc-200">{t.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
        </div>

        {/* Summary Detail Modal */}
        <AnimatePresence>
          {selectedSummary && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="w-full max-w-3xl bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-4 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1e1e] z-10 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-primary/10 text-primary rounded-none">
                        <selectedSummary.icon size={28} strokeWidth={1.5} />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{selectedSummary.title}</h2>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.25em]">Intelligence Node Synthesis</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedSummary(null)}
                      className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-500 hover:text-rose-500 transition-all font-sans"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="p-3 border-2 relative overflow-hidden group" style={{ borderColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        <h4 className="text-[8px] font-black uppercase tracking-widest text-primary mb-1.5">Executive Summary</h4>
                        <p className="text-[11px] font-black uppercase leading-relaxed mb-3">{selectedSummary.summary}</p>
                        <div className="h-[1px] w-full bg-primary/5 mb-3" />
                        <h4 className="text-[8px] font-black uppercase tracking-widest text-secondary mb-1.5">Detailed Insights</h4>
                        <p className="text-[10px] font-black uppercase leading-relaxed opacity-100 italic">{selectedSummary.details}</p>
                        {selectedSummary.link && (
                          <div className="mt-4 pt-3 border-t border-dashed border-primary/20">
                            <a 
                              href={selectedSummary.link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-[9px] font-black uppercase text-primary hover:underline"
                            >
                              Open Official Source Node <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[8px] font-black uppercase tracking-widest opacity-100">Strategic Key Points</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {selectedSummary.keyPoints.map((point: string, i: number) => (
                            <div key={i} className="p-2 border flex items-center gap-2 group hover:bg-primary/5 transition-all" style={{ borderColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                              <div className="w-1 h-1 bg-primary shrink-0" />
                              <p className="text-[9px] font-black uppercase tracking-widest">{point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 border bg-primary/5" style={{ borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                        <h4 className="text-[8px] font-black uppercase tracking-widest text-primary mb-3">Neural Analytics Matrix</h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Confidence Index', value: '94%', trend: '+2.1%' },
                            { label: 'Impact Velocity', value: 'High', trend: 'Accelerating' },
                            { label: 'Market Sentiment', value: 'Bullish', trend: 'Stable' }
                          ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between border-b border-dashed pb-1.5" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                              <span className="text-[8px] font-black uppercase opacity-100">{stat.label}</span>
                              <div className="text-right">
                                <p className="text-[10px] font-black uppercase">{stat.value}</p>
                                <p className="text-[6px] font-black text-secondary uppercase">{stat.trend}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 h-[80px] w-full border border-primary/10 p-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={tradeData.slice(0, 5)}>
                              <Area type="monotone" dataKey="volume" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="p-3 border border-dashed" style={{ borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                        <h4 className="text-[8px] font-black uppercase tracking-widest opacity-100 mb-1.5">Recommended Actions</h4>
                        <ul className="space-y-1.5">
                          <li className="text-[8px] font-black uppercase flex items-center gap-2">
                            <Zap size={8} className="text-primary" />
                            Hedge currency exposure for Q3
                          </li>
                          <li className="text-[8px] font-black uppercase flex items-center gap-2">
                            <Zap size={8} className="text-primary" />
                            Diversify supply chain nodes
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 sticky bottom-0 z-10 border-t mt-4" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                    <button 
                      onClick={() => setSelectedSummary(null)}
                      className="flex-1 py-2.5 border font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-all"
                      style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--background)' }}
                    >
                      Close
                    </button>
                    <button 
                      onClick={() => handleEngage(selectedSummary)}
                      className="flex-1 py-2.5 font-black uppercase text-[10px] tracking-widest shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
                    >
                      <MessageSquare size={12} />
                      Engage Matrix
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Feedback Modal */}
        <AnimatePresence>
          {feedbackModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFeedbackModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md border-2 rounded-none p-10 shadow-2xl"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
              >
                <h3 className="text-3xl font-black mb-8 flex items-center gap-4 uppercase italic" style={{ color: 'var(--text)' }}>
                  <MessageCircle style={{ color: 'var(--primary)' }} size={32} /> Send Feedback
                </h3>
                <div className="space-y-8">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setFeedbackType('feedback')}
                      className={cn(
                        "flex-1 p-4 rounded-none text-[11px] font-black uppercase tracking-widest border-2 transition-all",
                        feedbackType === 'feedback' ? "shadow-lg" : "opacity-100 border-transparent"
                      )}
                      style={{ 
                        backgroundColor: feedbackType === 'feedback' ? 'var(--primary)' : 'var(--background)',
                        borderColor: 'var(--primary)',
                        color: feedbackType === 'feedback' ? 'var(--background)' : 'var(--text)'
                      }}
                    >
                      General Feedback
                    </button>
                    <button 
                      onClick={() => setFeedbackType('issue')}
                      className={cn(
                        "flex-1 p-4 rounded-none text-[11px] font-black uppercase tracking-widest border-2 transition-all",
                        feedbackType === 'issue' ? "shadow-lg" : "opacity-100 border-transparent"
                      )}
                      style={{ 
                        backgroundColor: feedbackType === 'issue' ? 'var(--secondary)' : 'var(--background)',
                        borderColor: 'var(--secondary)',
                        color: feedbackType === 'issue' ? 'var(--background)' : 'var(--text)'
                      }}
                    >
                      Report Issue
                    </button>
                  </div>
                  <textarea 
                    className="w-full h-40 bg-transparent border-2 rounded-none p-6 outline-none transition-all text-sm font-bold placeholder:opacity-100"
                    style={{ borderColor: 'var(--primary)', color: 'var(--text)' }}
                    placeholder="Tell us what's on your mind..."
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                  />
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setFeedbackModalOpen(false)}
                      className="flex-1 p-5 rounded-none font-black text-xs uppercase tracking-widest transition-all border"
                      style={{ backgroundColor: 'var(--background)', color: 'var(--text)', borderColor: 'var(--primary)' }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={submitFeedback}
                      className="flex-1 p-5 rounded-none font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                      style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Agent Editor Modal */}
        <AnimatePresence>
          {isAgentEditorOpen && editingAgent && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAgentEditorOpen(false)}
                className="absolute inset-0 bg-[#000]/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-4 border-primary bg-white dark:bg-zinc-950 shadow-[20px_20px_0px_0px_rgba(var(--primary-rgb),0.2)]"
              >
                <div className="p-8 border-b-4 border-zinc-100 dark:border-zinc-900 flex items-center justify-between shrink-0 bg-primary/5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white shadow-[4px_4px_0px_0px_rgba(var(--primary-rgb),0.3)]">
                      <CpuIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic text-primary">Intelligence Node Architect</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Configure Strategic Personnel Parameters</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAgentEditorOpen(false)} className="p-2 hover:bg-primary/10 text-primary transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  {/* Template Blueprints */}
                  <div className="mb-10 p-4 border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 block">Neural Blueprints</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { 
                          label: 'Strategic Advisor', 
                          persona: 'Sharp, visionary, focused on 10-year growth trajectories and international regulatory consensus.', 
                          role: 'Lead Policy Architect',
                          category: 'Core Intelligence',
                          skills: ['WTO Compliance', 'Bilateral Negotiation', 'Risk Mitigation'],
                          frameworks: ['FTP 2023', 'WTO Rules']
                        },
                        { 
                          label: 'Market Analyst', 
                          persona: 'Data-obsessed, critical, identifying subtle arbitrage in emerging trade routes and commodity flows.', 
                          role: 'Intelligence Node',
                          category: 'Specialized Trade',
                          skills: ['Commodity Tracking', 'Arbitrage Detection', 'Volume Analysis'],
                          frameworks: ['Market Data v1', 'EXIM Logistics']
                        },
                        { 
                          label: 'Supply Chain Guru', 
                          persona: 'Logistics wizard focused on port synchronization, multi-modal efficiency, and bottleneck neutralization.', 
                          role: 'Operations Lead',
                          category: 'Specialized Trade',
                          skills: ['Port Logistics', 'Customs Fast-track', 'Route Optimization'],
                          frameworks: ['Logistics 4.0', 'Maritime Law']
                        }
                      ].map((t, idx) => (
                        <button 
                          key={idx}
                          onClick={() => setEditingAgent({
                            ...editingAgent,
                            label: t.label,
                            role: t.role,
                            persona: t.persona,
                            category: t.category,
                            skills: t.skills,
                            frameworks: t.frameworks
                          })}
                          className="p-4 text-left bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 hover:border-primary transition-all group relative overflow-hidden"
                        >
                          <div className="absolute -bottom-2 -right-2 text-primary/5 group-hover:text-primary/10 transition-colors">
                             <Zap size={40} />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-tight block mb-1 group-hover:text-primary">{t.label}</span>
                          <p className="text-[9px] opacity-40 line-clamp-2 italic leading-relaxed mb-2">{t.persona}</p>
                          <div className="flex items-center gap-2">
                             <span className="text-[7px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5">{t.category}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Node Designation</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all"
                          value={editingAgent.label}
                          onChange={e => setEditingAgent({...editingAgent, label: e.target.value})}
                          placeholder="e.g., Trade Policy Analyst"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">System Identity</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all"
                          value={editingAgent.name}
                          onChange={e => setEditingAgent({...editingAgent, name: e.target.value})}
                          placeholder="e.g., Siddhartha V1"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Intelligence Sector</label>
                        <select 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all"
                          value={editingAgent.category || ''}
                          onChange={e => setEditingAgent({...editingAgent, category: e.target.value})}
                        >
                          <option value="">Standard Intelligence</option>
                          {AGENT_CATEGORY_MODELS.map(cat => (
                            <option key={cat.id} value={cat.label}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Strategic Role</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all"
                          value={editingAgent.role}
                          onChange={e => setEditingAgent({...editingAgent, role: e.target.value})}
                          placeholder="e.g., Lead Policy Researcher"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Persona</label>
                        <textarea 
                          className="w-full h-32 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all resize-none italic"
                          value={editingAgent.persona}
                          onChange={e => setEditingAgent({...editingAgent, persona: e.target.value})}
                          placeholder="Define behavioral parameters..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Node Icon (URL)</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="text" 
                            className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-[10px] outline-none focus:border-primary transition-all"
                            value={editingAgent.icon || ''}
                            onChange={e => setEditingAgent({...editingAgent, icon: e.target.value})}
                            placeholder="https://icon-library.com/..."
                          />
                          <div className="w-12 h-12 border-2 border-primary/20 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
                            {editingAgent.icon ? (
                              <img src={editingAgent.icon} alt="Icon Preview" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <CpuIcon size={24} className="opacity-20" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Linguistic Controls</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-4 font-bold text-sm outline-none focus:border-primary transition-all"
                          value={editingAgent.linguisticControls}
                          onChange={e => setEditingAgent({...editingAgent, linguisticControls: e.target.value})}
                          placeholder="Tone, language, and dialect..."
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-between">
                          Strategic Frameworks
                          <span className="text-[8px] opacity-40 italic">Regulatory Context Matrix</span>
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {editingAgent.frameworks.map((f, i) => (
                            <div key={i} className="flex items-center gap-1 bg-primary/10 border-2 border-primary/20 px-3 py-1.5 group hover:border-primary transition-all">
                              <span className="text-[9px] font-black uppercase tracking-widest text-primary">{f}</span>
                              <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setNewFramework(f);
                                    setEditingAgent({...editingAgent, frameworks: editingAgent.frameworks.filter((_, idx) => idx !== i)});
                                  }}
                                  className="text-primary hover:text-white"
                                >
                                  <Pencil size={10} />
                                </button>
                                <button 
                                  onClick={() => setEditingAgent({...editingAgent, frameworks: editingAgent.frameworks.filter((_, idx) => idx !== i)})}
                                  className="text-primary hover:text-rose-500"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 p-3 text-xs outline-none focus:border-primary transition-all font-bold placeholder:italic"
                            value={newFramework}
                            onChange={e => setNewFramework(e.target.value)}
                            placeholder="Initialize manual protocol..."
                            onKeyPress={e => {
                              if (e.key === 'Enter' && newFramework.trim()) {
                                if (!editingAgent.frameworks.includes(newFramework.trim())) {
                                  setEditingAgent({...editingAgent, frameworks: [...editingAgent.frameworks, newFramework.trim()]});
                                  setNewFramework('');
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              if (newFramework.trim() && !editingAgent.frameworks.includes(newFramework.trim())) {
                                setEditingAgent({...editingAgent, frameworks: [...editingAgent.frameworks, newFramework.trim()]});
                                setNewFramework('');
                              }
                            }}
                            className="p-3 bg-primary text-white shadow-[4px_4px_0px_0px_rgba(var(--primary-rgb),0.3)] active:scale-95"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Intelligence Skills Matrix</label>
                        <div className="space-y-2 mb-4">
                          {editingAgent.skills.map((skill, i) => (
                            <div key={i} className="p-3 border-2 border-primary/10 bg-primary/5 flex items-start justify-between group hover:border-primary/40 transition-all">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-3 bg-primary group-hover:h-5 transition-all" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{skill}</span>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setNewSkill(skill);
                                    setEditingAgent({...editingAgent, skills: editingAgent.skills.filter((_, idx) => idx !== i)});
                                  }}
                                  className="text-primary hover:text-white"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button 
                                  onClick={() => setEditingAgent({...editingAgent, skills: editingAgent.skills.filter((_, idx) => idx !== i)})}
                                  className="text-zinc-400 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-4 border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-4">
                          <div className="space-y-2">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 italic">Sync Predefined Capabilities</p>
                            <div className="flex flex-wrap gap-2">
                              {PREDEFINED_SKILLS.filter(ps => !editingAgent.skills.includes(ps.name)).map(ps => (
                                <button 
                                  key={ps.id}
                                  onClick={() => setEditingAgent({...editingAgent, skills: [...editingAgent.skills, ps.name]})}
                                  className="px-3 py-1.5 border-2 border-primary/20 hover:border-primary text-[8px] font-black uppercase tracking-widest transition-all bg-white dark:bg-zinc-900"
                                >
                                  + {ps.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                          
                          <div className="space-y-2">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 italic">Deploy Custom Directives</p>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                className="flex-1 bg-transparent border-2 border-zinc-100 dark:border-zinc-800 p-3 text-xs outline-none focus:border-primary transition-all font-bold"
                                value={newSkill}
                                onChange={e => setNewSkill(e.target.value)}
                                placeholder="Injection endpoint..."
                              />
                              <button 
                                onClick={() => {
                                  if (newSkill.trim() && !editingAgent.skills.includes(newSkill.trim())) {
                                    setEditingAgent({...editingAgent, skills: [...editingAgent.skills, newSkill.trim()]});
                                    setNewSkill('');
                                  }
                                }}
                                className="p-3 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all active:scale-95"
                              >
                                <Zap size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Operational Capabilities</label>
                        <div className="grid grid-cols-1 gap-4">
                          {[
                            { key: 'toolCalling', label: 'Ecosystem Tool Access', icon: Wrench, desc: 'Authorize script execution & internal tools.' },
                            { key: 'mcpCalling', label: 'MCP Protocol Bridge', icon: Layers, desc: 'Model Context Protocol for external context.' },
                            { key: 'remoteConnection', label: 'Remote Node Sync', icon: Network, desc: 'Establish bridge with 3rd-party intelligence servers.' },
                          ].map(ability => (
                            <div key={ability.key} className="space-y-3">
                              <div className="flex items-center justify-between p-4 border-4 border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/20 shadow-sm transition-all hover:border-primary/20">
                                <div className="flex items-center gap-3">
                                  <div className={cn("p-2 border-2", editingAgent.abilities[ability.key as keyof typeof editingAgent.abilities] ? "bg-secondary/10 border-secondary text-secondary" : "bg-zinc-100 dark:bg-zinc-800 border-transparent opacity-40")}>
                                    <ability.icon size={18} />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest">{ability.label}</p>
                                    <p className="text-[8px] opacity-40 font-bold tracking-wider">{ability.desc}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => setEditingAgent({
                                    ...editingAgent, 
                                    abilities: { ...editingAgent.abilities, [ability.key]: !editingAgent.abilities[ability.key as keyof typeof editingAgent.abilities] }
                                  })}
                                  className={cn(
                                    "w-12 h-6 p-1 transition-all rounded-none relative border-2",
                                    editingAgent.abilities[ability.key as keyof typeof editingAgent.abilities] ? "bg-secondary border-secondary shadow-[3px_3px_0px_0px_rgba(var(--secondary-rgb),0.3)]" : "bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                                  )}
                                >
                                  <div className={cn(
                                    "w-3 h-3 bg-white transition-all",
                                    editingAgent.abilities[ability.key as keyof typeof editingAgent.abilities] ? "translate-x-6" : "translate-x-0"
                                  )} />
                                </button>
                              </div>

                              {ability.key === 'remoteConnection' && editingAgent.abilities.remoteConnection && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="ml-4 pl-6 border-l-4 border-secondary/20 py-4 space-y-4 bg-secondary/5"
                                >
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                                      <Link size={12} /> Server Protocol Endpoint
                                    </label>
                                    <input 
                                      type="text" 
                                      className="w-full bg-white dark:bg-zinc-950 border-2 border-secondary/20 p-3 italic text-xs outline-none focus:border-secondary transition-all"
                                      value={editingAgent.config?.apiUrl || ''}
                                      onChange={e => setEditingAgent({...editingAgent, config: { ...editingAgent.config, apiUrl: e.target.value }})}
                                      placeholder="https://intelligence.node.io/v1"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                                      <Key size={12} /> Authorization Credential
                                    </label>
                                    <input 
                                      type="password" 
                                      className="w-full bg-white dark:bg-zinc-950 border-2 border-secondary/20 p-3 italic text-xs outline-none focus:border-secondary transition-all"
                                      value={editingAgent.config?.apiKey || ''}
                                      onChange={e => setEditingAgent({...editingAgent, config: { ...editingAgent.config, apiKey: e.target.value }})}
                                      placeholder="NODE_SECRET_AUTHENTICATOR"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t-4 border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 flex gap-4 shrink-0">
                  <button 
                    onClick={() => setIsAgentEditorOpen(false)}
                    className="flex-1 p-4 border-4 border-zinc-200 dark:border-zinc-800 font-black uppercase text-sm tracking-widest hover:border-primary transition-all active:scale-95"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={() => saveCustomAgent(editingAgent)}
                    className="flex-1 p-4 bg-primary text-white font-black uppercase text-sm tracking-widest shadow-[10px_10px_0px_0px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all border-4 border-white/20"
                  >
                    Commission Node
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Category Modal */}
        <AnimatePresence>
          {false && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCategory(null)}
                className="absolute inset-0 bg-[#141414]/80 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="relative w-full max-w-3xl border-4 rounded-none shadow-[0_0_100px_rgba(var(--primary-rgb),0.3)] overflow-hidden flex flex-col max-h-[90vh]"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                
                <div className="p-6 md:p-8 flex items-center justify-between border-b-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-background shadow-lg">
                      <selectedCategory.icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--text)' }}>{selectedCategory.category}</h3>
                      <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-100">{selectedCategory.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="p-2 hover:bg-primary/10 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {selectedCategory.agents.map((agent: any) => (
                      <div 
                        key={agent.id}
                        className={cn(
                          "p-4 border-2 transition-all relative overflow-hidden group",
                          activeAgent === agent.id ? "border-primary bg-primary/5" : "border-primary/20 hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2",
                              activeAgent === agent.id ? "bg-primary text-background" : "bg-primary/10 text-primary"
                            )}>
                              <agent.icon size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-widest">{agent.label}</h4>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-100">Node ID: {agent.id.toUpperCase()}</p>
                            </div>
                          </div>
                          {activeAgent === agent.id && (
                            <span className="px-2 py-1 bg-primary text-background text-[8px] font-black uppercase tracking-widest animate-pulse">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[10px] font-black uppercase leading-relaxed opacity-100 mb-6 min-h-[40px]">
                          {agent.desc}
                        </p>
                        
                        <button
                          onClick={() => {
                            setActiveAgentId(agent.id);
                            setSelectedCategory(null);
                            addToast(`Node ${agent.label} activated.`, 'success');
                          }}
                          className={cn(
                            "w-full p-3 font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                            activeAgent === agent.id 
                              ? "bg-secondary text-background shadow-lg" 
                              : "bg-primary text-background hover:scale-[1.02] active:scale-95 shadow-md"
                          )}
                        >
                          {activeAgent === agent.id ? (
                            <>
                              <Check size={14} /> Engaged
                            </>
                          ) : (
                            <>
                              <Zap size={14} /> Engage Node
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Floating Agent Controller */}
        <AnimatePresence>
          {view === 'chat' && activeAgentId !== 'hybrid' && activeAgent && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="fixed bottom-24 right-8 z-[110]"
            >
              <div className="flex items-center gap-3 p-2 bg-zinc-950 border-4 border-primary shadow-[10px_10px_0px_0px_rgba(var(--primary-rgb),0.2)]">
                <div className="w-10 h-10 bg-primary flex items-center justify-center text-white font-black italic border-2 border-white/20 text-xs">
                  {activeAgent.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col pr-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary">Active Intelligence</span>
                  <span className="text-[11px] font-black uppercase text-white truncate max-w-[120px]">{activeAgent.label}</span>
                </div>
                <div className="flex items-center gap-1 border-l-2 border-primary/20 pl-2">
                  <Tooltip content="Live Tuning">
                    <button onClick={() => setIsPersonaTunerOpen(!isPersonaTunerOpen)} className={cn("p-2 transition-colors hover:scale-110 active:scale-95", isPersonaTunerOpen ? "bg-primary text-white" : "hover:bg-primary/10 text-primary")}><Brain size={16} /></button>
                  </Tooltip>
                  <Tooltip content="Configure Node">
                    <button onClick={() => setView('agents')} className="p-2 hover:bg-primary/10 text-primary transition-colors hover:scale-110 active:scale-95"><Sliders size={16} /></button>
                  </Tooltip>
                  <Tooltip content="Disconnect Protocol">
                    <button onClick={() => setActiveAgentId('hybrid')} className="p-2 hover:bg-rose-500/10 text-rose-500 transition-colors hover:scale-110 active:scale-95"><Power size={16} /></button>
                  </Tooltip>
                </div>
              </div>

              {/* Persona Tuner Panel */}
              <AnimatePresence>
                {isPersonaTunerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-4 w-80 bg-zinc-950 border-4 border-primary p-4 shadow-[15px_-15px_0px_0px_rgba(var(--primary-rgb),0.2)]"
                  >
                    <div className="flex items-center justify-between mb-4 border-b border-primary/20 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Persona Tuner</span>
                      <button onClick={() => setIsPersonaTunerOpen(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                    </div>
                    <textarea 
                      className="w-full h-32 bg-zinc-900 border-2 border-primary/20 p-3 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:border-primary transition-all resize-none italic mb-4 no-scrollbar"
                      value={activeAgent.persona}
                      onChange={(e) => {
                        const newPersona = e.target.value;
                        if (activeAgent.isPredefined) {
                          addToast("Predefined nodes are read-only. Duplicate to tune.", "info");
                          return;
                        }
                        const updatedAgents = customAgents.map(a => a.id === activeAgentId ? { ...a, persona: newPersona } : a);
                        setCustomAgents(updatedAgents);
                      }}
                      onBlur={() => {
                        if (activeAgent && !activeAgent.isPredefined) {
                          saveCustomAgent(activeAgent);
                        }
                      }}
                      placeholder="Tune agent behavior..."
                    />
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
                       <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Real-time parameters synchronized</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Welcome Modals */}
        <AnimatePresence>
          {welcomeModalOpen && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 md:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setWelcomeModalOpen(null)}
                className="absolute inset-0 bg-[#141414]/80 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="relative w-full max-w-md border-4 rounded-none shadow-[0_0_100px_rgba(var(--primary-rgb),0.3)] overflow-hidden flex flex-col"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                
                <div className="p-6 flex items-center justify-between border-b-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-background shadow-lg">
                      {welcomeModalOpen === 'system' ? <Activity size={24} /> : <Shield size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--text)' }}>
                        {welcomeModalOpen === 'system' ? 'System Status' : 'Secure Session'}
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setWelcomeModalOpen(null)}
                    className="p-2 hover:bg-primary/10 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6">
                  {welcomeModalOpen === 'system' ? (
                    <div className="space-y-5">
                      {[
                        { label: 'Neural Load', value: '14%', color: 'var(--primary)' },
                        { label: 'Uptime', value: '99.9%', color: 'var(--secondary)' },
                        { label: 'Latency', value: '24ms', color: 'var(--text)' }
                      ].map((stat, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-primary/10 pb-2">
                          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text)' }}>{stat.label}</span>
                          <span className="text-[12px] font-black uppercase italic" style={{ color: stat.color }}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center gap-4">
                      <p className="text-2xl font-black truncate uppercase italic tracking-tighter" style={{ color: 'var(--text)' }}>{user.displayName || 'Guest User'}</p>
                      <div className="h-1 w-full bg-primary/20 mt-2">
                        <motion.div 
                          animate={{ width: ['0%', '100%'] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="h-full bg-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Modal */}
        <ProfileModal 
          isOpen={isProfileModalOpen} 
          onClose={() => setIsProfileModalOpen(false)} 
          user={user} 
        />

        <ForgeReportModal 
          isOpen={isForgeModalOpen}
          content={forgedReportContent}
          onClose={() => setIsForgeModalOpen(false)}
        />
        </div>
      </div>
    </ErrorBoundary>
  );
}

const AdminLogin = ({ credentials, setCredentials, onLogin }: { credentials: any, setCredentials: any, onLogin: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md border-4 p-8 space-y-6 shadow-2xl" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="p-4 bg-primary text-background shadow-lg">
            <Shield size={40} />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Admin Matrix Access</h2>
          <p className="text-[10px] font-black uppercase opacity-100 tracking-[0.3em]">Restricted Intelligence Node</p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-100">Admin Identifier</label>
            <input 
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="w-full p-3 border-2 bg-transparent outline-none font-black uppercase text-xs focus:border-primary transition-colors"
              style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
              placeholder="Username"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-100">Neural Passkey</label>
            <input 
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full p-3 border-2 bg-transparent outline-none font-black uppercase text-xs focus:border-primary transition-colors"
              style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
              placeholder="••••••••"
            />
          </div>
          <button 
            onClick={onLogin}
            className="w-full p-4 bg-primary text-background font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Authenticate Node
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminPanel = ({ credentials, onLogout, addToast, knowledgeBases, setKnowledgeBases, skills, setSkills }: { credentials: any, onLogout: () => void, addToast: any, knowledgeBases: any[], setKnowledgeBases: any, skills: any[], setSkills: any }) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ name: string, content: string, type: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const auth = btoa(`${credentials.username}:${credentials.password}`);
        const res = await fetch('/api/admin/config', {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          
          // Fetch from Firestore
          const q = query(collection(db, 'system_config'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0].data();
            setEditingKeys(docData.keys || {});
          }
        } else {
          onLogout();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const q = query(collection(db, 'system_config'), limit(1));
      const snap = await getDocs(q);
      const configDataToSave = {
        keys: editingKeys,
        knowledgeBases,
        skills,
        updatedAt: serverTimestamp()
      };

      if (snap.empty) {
        await addDoc(collection(db, 'system_config'), configDataToSave);
      } else {
        await updateDoc(doc(db, 'system_config', snap.docs[0].id), configDataToSave);
      }

      // Sync with backend - Sanitize for JSON stringification (remove Firebase sentinels)
      const configDataToBackend = {
        keys: editingKeys,
        knowledgeBases,
        skills,
        updatedAt: new Date().toISOString()
      };
      const auth = btoa(`${credentials.username}:${credentials.password}`);
      await fetch('/api/admin/update-config', {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configDataToBackend)
      });

      addToast("System Matrix Synchronized.", "success");
    } catch (e) {
      console.error(e);
      addToast("Synchronization Failed.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKBFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const type = file.type || file.name.split('.').pop() || 'text';
      
      const newKB = {
        id: Date.now().toString(),
        name: file.name,
        type: type,
        content: content,
        size: file.size,
        createdAt: new Date().toISOString()
      };
      
      setKnowledgeBases(prev => [...prev, newKB]);
      addToast(`Knowledge Node ${file.name} Integrated.`, "success");
    };

    if (file.type === 'application/pdf') {
      // For PDF, we just store the name and a placeholder for now as we don't have a parser
      const newKB = {
        id: Date.now().toString(),
        name: file.name,
        type: 'pdf',
        content: 'PDF Content (Binary Data - Preview limited)',
        size: file.size,
        createdAt: new Date().toISOString()
      };
      setKnowledgeBases(prev => [...prev, newKB]);
      addToast(`PDF Node ${file.name} Registered.`, "success");
    } else {
      reader.readAsText(file);
    }
  };

  const exportKnowledgeBase = () => {
    const dataStr = JSON.stringify({ knowledgeBases, skills, keys: editingKeys }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'setu-matrix-config.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) return <div className="p-20 text-center font-black uppercase animate-pulse">Syncing Admin Matrix...</div>;

  const possibleKeys = [
    'GEMINI_API_KEY', 'FIRECRAWL_API_KEY', 'INDIAN_API_KEY', 
    'TWELVE_DATA_KEY', 'AV_KEY', 'SERPER_API_KEY', 
    'EXA_API_KEY', 'TAVILY_API_KEY', 'GROQ_API_KEY'
  ];

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between border-b-4 pb-6 gap-4" style={{ borderColor: 'var(--primary)' }}>
        <div className="flex items-center gap-5">
          <div className="p-4 bg-primary text-white rounded-3xl shadow-xl shadow-primary/20">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Admin Matrix Control</h1>
            <p className="text-[13px] font-medium text-zinc-500">System Configuration & Neural Security</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportKnowledgeBase}
            className="p-3 px-5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
          <button 
            onClick={saveConfig}
            disabled={isSaving}
            className="p-3 px-6 bg-primary text-white font-bold rounded-full text-[13px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Sync Matrix</span>
          </button>
          <button 
            onClick={onLogout}
            className="p-3 px-5 rounded-full border border-rose-200 dark:border-rose-900/30 text-rose-500 font-bold text-[13px] hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
          >
            Terminal Lockdown
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Keys Configuration */}
        <div className="bg-white dark:bg-[#303134] rounded-[32px] p-8 space-y-8 border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center gap-3">
            <Zap size={22} className="text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Neural Key Matrix
            </h2>
          </div>
          <div className="space-y-6">
            {possibleKeys.map((key) => {
              const baseKey = key.replace('_API_KEY', '');
              const envLoaded = config?.keys[baseKey] || config?.keys[key];
              const firestoreLoaded = !!editingKeys[key];
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{key.replace(/_/g, ' ')}</label>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-none", envLoaded || firestoreLoaded ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]")} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {envLoaded ? 'Authenticated (ENV)' : firestoreLoaded ? 'Authenticated (DB)' : 'Required'}
                      </span>
                    </div>
                  </div>
                  <input 
                    type="password"
                    value={editingKeys[key] || ''}
                    onChange={(e) => setEditingKeys({ ...editingKeys, [key]: e.target.value })}
                    className="w-full p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 outline-none font-mono text-[13px] focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder={envLoaded ? "•••••••••••••••••••••" : "Enter Neural Vector Key"}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Intelligence Base */}
        <div className="google-card p-8 space-y-8 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Database size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Intelligence Base</h2>
                <p className="text-[11px] font-bold text-primary uppercase tracking-widest mt-1">Storage & Web Vectors</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                id="kb-upload" 
                className="hidden" 
                onChange={handleKBFileUpload}
                accept=".txt,.pdf,.json,.jsonl,.md,.html"
              />
              <button 
                onClick={() => document.getElementById('kb-upload')?.click()}
                className="p-3 rounded-none border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 hover:bg-primary text-zinc-600 dark:text-zinc-300 hover:text-white shadow-sm transition-all"
                title="Upload Intelligence"
              >
                <Upload size={20} strokeWidth={1.5} />
              </button>
              <button 
                onClick={() => {
                  const name = prompt("Enter Link Title:");
                  const url = prompt("Enter URL:");
                  if (name && url) {
                    setKnowledgeBases([...knowledgeBases, { id: Date.now().toString(), name, url, type: 'link', createdAt: new Date().toISOString() }]);
                  }
                }}
                className="p-3 rounded-none border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 hover:bg-primary text-zinc-600 dark:text-zinc-300 hover:text-white shadow-sm transition-all"
                title="Add Web Vector"
              >
                <Link size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar pr-1">
            {knowledgeBases.map((kb) => (
              <motion.div 
                key={kb.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5 rounded-none border-2 border-zinc-100 dark:border-zinc-800 flex items-center justify-between group hover:border-primary/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all shadow-sm"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-3 rounded-none border-2 border-primary/20 bg-primary/5 text-primary">
                    {kb.type === 'pdf' ? <FileText size={20} /> : 
                     kb.type === 'link' ? <Link size={20} /> :
                     kb.type?.includes('json') ? <FileJson size={20} /> :
                     <FileCode size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{kb.name}</h3>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{kb.type} • {(kb.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {kb.content && (
                    <button 
                      onClick={() => setPreviewContent(kb)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => setKnowledgeBases(knowledgeBases.filter(k => k.id !== kb.id))}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
            {knowledgeBases.length === 0 && (
              <div className="p-16 text-center border-4 border-dashed border-zinc-100 dark:border-zinc-800 rounded-none opacity-40 font-black uppercase text-[10px] tracking-widest">
                No Custom Knowledge Nodes
              </div>
            )}
          </div>
        </div>

        {/* Skills & Instructions */}
        <div className="lg:col-span-2 google-card p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-none border-2 border-primary/20">
                <Wrench size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Neural Skills & Instructions</h2>
                <p className="text-[11px] font-black uppercase tracking-widest mt-1 text-primary">Core Behavioral Protocols</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const name = prompt("Skill Name:");
                const instruction = prompt("System Instruction:");
                if (name && instruction) {
                  setSkills([...skills, { id: Date.now().toString(), name, instruction, active: true }]);
                }
              }}
              className="px-6 py-3 bg-primary text-white font-black uppercase tracking-widest rounded-none text-[10px] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all shadow-[4px_4px_0px_0px_rgba(var(--primary-rgb),0.3)] border-2 border-primary"
            >
              Add Command Protocol
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {skills.map((skill) => (
              <motion.div 
                key={skill.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-none border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-800/10 space-y-4 group hover:border-primary/40 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{skill.name}</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSkills(skills.map(s => s.id === skill.id ? { ...s, active: !s.active } : s))}
                      className={cn(
                        "w-12 h-6 rounded-none border-2 relative transition-all duration-300",
                        skill.active ? 'bg-primary border-primary' : 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600'
                      )}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-none transition-all duration-300 bg-white shadow-sm", skill.active ? "left-6" : "left-0.5")} />
                    </button>
                    <button 
                      onClick={() => setSkills(skills.filter(s => s.id !== skill.id))}
                      className="p-1 px-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 dark:hover:bg-rose-950 rounded-none border-2 border-transparent hover:border-rose-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed italic line-clamp-3">"{skill.instruction}"</p>
              </motion.div>
            ))}
            {skills.length === 0 && (
              <div className="col-span-full p-16 text-center border-4 border-dashed border-zinc-100 dark:border-zinc-800 rounded-none opacity-40 font-black uppercase text-[10px] tracking-widest">
                No Custom Neural Skills Defined
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewContent && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-4xl bg-white dark:bg-[#1e1e1e] border-4 border-zinc-200 dark:border-zinc-800 rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b-4 border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-inherit z-10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-none border-2 border-primary/20">
                    <FileCode size={20} />
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{previewContent.name}</h3>
                </div>
                <button 
                  onClick={() => setPreviewContent(null)}
                  className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-none border-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 transition-all text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <pre className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-none text-xs font-mono text-zinc-600 dark:text-zinc-300 leading-relaxed overflow-x-auto border-4 border-zinc-100 dark:border-zinc-800">
                  {previewContent.content}
                </pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


