import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, Globe, Cpu, ShieldCheck, BookOpen, 
  Mic, MicOff, Volume2, VolumeX, LogIn, LogOut, 
  Search, MapPin, Brain, Loader2, AlertCircle,
  Shield, Sun, Moon, CheckCircle, Circle, Settings,
  MessageSquare, Plus, Trash2, Copy, RotateCcw,
  Share2, Languages, Upload, History, User,
  Check, X, MessageCircle, Flag, ExternalLink,
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
  ChevronLeft, Power
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
import { getGeminiResponse, getLiveSession, generateSpeech, translateText } from './services/gemini';
import { UserProfile, ChatMessage, ChatSession, Task, ViewState, Feedback, Agent } from './types';

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  sidebar: string;
  sidebarText: string;
  isDark: boolean;
}

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
    frameworks: ['APEDA Quality Standards', 'FSSAI Export Norms', 'GlobalGAP Standards'],
     skills: ['Commodity price tracking', 'SPS barrier mitigation', 'Frieght cost analysis'],
    linguisticControls: 'Accessible yet technical. Focus on seasonal trends and rural-to-global supply chain logistics.',
    abilities: { toolCalling: true, mcpCalling: false, remoteConnection: true },
    config: { apiUrl: 'https://api.agri-intel.nic.in' },
    isPredefined: true
  }
];

const AGENT_CATEGORIES = [
  { 
    category: 'Core Intelligence',
    icon: Brain,
    desc: 'Foundational analysis and macro-economic tracking.',
    agents: [
      { id: 'hybrid', label: 'Core Matrix', icon: Zap, desc: 'Multi-sector trade intelligence & neural analysis.' },
      { id: 'policy_analyst', label: 'Policy Analyst', icon: BarChart2, desc: 'Macro-economic shift detection & FTP alignment.' }
    ]
  },
  {
    category: 'Specialized Trade',
    icon: Globe,
    desc: 'Sector-specific optimization and compliance.',
    agents: [
      { id: 'exim_compliance', label: 'EXIM Strategist', icon: Globe, desc: 'Export-Import optimization & incentive mapping.' },
      { id: 'compliance', label: 'Compliance Node', icon: ShieldCheck, desc: 'GST, legal frameworks & regulatory monitoring.' },
      { id: 'agri_consultant', label: 'Agri-Trade Node', icon: Sprout, desc: 'APEDA specialist for global agricultural flows.' }
    ]
  }
];

const THEMES: ThemePalette[] = [
  {
    id: 'day-matrix',
    name: 'Day Matrix',
    primary: '#0f172a', // Slate 900 (Black/Blue feel)
    secondary: '#2563eb', // Royal Blue
    accent: '#3b82f6', 
    background: '#f8fafc', 
    text: '#0f172a',
    sidebar: '#ffffff',
    sidebarText: '#0f172a',
    isDark: false
  },
  {
    id: 'night-neural',
    name: 'Night Neural',
    primary: '#f59e0b', // Amber (Yellow)
    secondary: '#ef4444', // Red
    accent: '#f97316', 
    background: '#09090b',
    text: '#fafafa',
    sidebar: '#18181b',
    sidebarText: '#fafafa',
    isDark: true
  },
  {
    id: 'googly-fusion',
    name: 'Googly Fusion',
    primary: '#4285F4', // Google Blue
    secondary: '#34A853', // Google Green
    accent: '#FBBC05', // Google Yellow
    background: '#ffffff',
    text: '#202124',
    sidebar: '#f1f3f4',
    sidebarText: '#202124',
    isDark: false
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
const AnimatedLogo = ({ theme }: { theme: ThemePalette }) => {
  const letters = "SETU".split("");
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
          style={{ color: 'var(--primary)', textShadow: theme.id === 'night-neural' ? '0 0 10px rgba(var(--primary-rgb), 0.5)' : 'none' }}
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

const ChatMessageComponent = ({ msg, isUser, onSpeech, onTranslate, onCopy, onRegenerate, onShare, onEdit }: { 
  msg: ChatMessage, 
  isUser: boolean,
  onSpeech: (text: string) => void,
  onTranslate: (text: string, lang: string) => void,
  onCopy: (text: string) => void,
  onRegenerate: (msgId: string) => void,
  onShare: (text: string) => void,
  onEdit: (msgId: string, text: string) => void
}) => {
  const [showTranslate, setShowTranslate] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const INDIAN_LANGUAGES = ['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil'];
  const INT_LANGUAGES = ['Spanish', 'French', 'German', 'Chinese', 'Japanese'];

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
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className={cn(
          "w-6 h-6 flex items-center justify-center"
        )} style={{ backgroundColor: isUser ? 'var(--primary)' : 'var(--secondary)', color: 'var(--background)' }}>
          {isUser ? <User size={14} /> : <Cpu size={14} />}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text)' }}>
          {isUser ? 'User Node' : (msg.agentId ? `${msg.agentId.toUpperCase()} AGENT` : 'Setu Intelligence')}
        </span>
        {msg.isDeepThink && (
          <span className="px-2 py-0.5 border text-[7px] font-black uppercase tracking-widest animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.1)', borderColor: 'rgba(var(--primary-rgb), 0.2)', color: 'var(--primary)' }}>
            Deep Thinking
          </span>
        )}
      </div>
      <div className={cn(
        "max-w-[92%] md:max-w-[85%] p-4 md:p-6 rounded-2xl md:rounded-3xl border-[4px] relative transition-all duration-300 shadow-sm",
        isUser 
          ? "rounded-tr-none" 
          : "rounded-tl-none"
      )} style={{ 
        backgroundColor: isUser ? 'var(--background)' : 'var(--text)', 
        borderColor: isUser ? 'rgba(var(--primary-rgb), 0.2)' : 'var(--primary)',
        color: isUser ? 'var(--text)' : 'var(--background)'
      }}>
        {isEditing ? (
          <div className="flex flex-col gap-2 min-w-[200px] md:min-w-[300px]">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-transparent border-2 rounded-none p-3 text-[13px] md:text-[14px] font-medium outline-none min-h-[100px] resize-none"
              style={{ borderColor: 'var(--primary)', color: 'inherit' }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Tooltip content="Cancel Edit: Discard changes and return to the original message.">
                <button 
                  onClick={() => { setIsEditing(false); setEditText(msg.text); }}
                  className="p-2 rounded-none transition-all border"
                  style={{ borderColor: 'var(--primary)', color: 'inherit' }}
                >
                  <X size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Save Changes: Update the message content in the history matrix.">
                <button 
                  onClick={handleSave}
                  className="p-2 rounded-none transition-all shadow-lg font-bold"
                  style={{ backgroundColor: 'var(--secondary)', color: 'var(--background)' }}
                >
                  <Check size={14} />
                </button>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className={cn(
            "prose prose-sm max-w-none text-[13px] md:text-[15px] leading-relaxed font-normal prose-container custom-scrollbar tracking-wide",
            isUser ? "" : "prose-invert"
          )} style={{ color: 'inherit' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({node, ...props}) => (
                  <div className="w-full overflow-x-auto custom-scrollbar my-4 rounded-xl border-[1.5px] bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--primary)' }}>
                    <table className="w-full text-left" {...props} />
                  </div>
                ),
                pre: ({node, ...props}) => (
                  <div className="w-full overflow-x-auto custom-scrollbar my-4 rounded-xl border-[1.5px] bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--primary)' }}>
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
              <Tooltip content="Edit Message: Modify your inquiry for refined intelligence gathering.">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 transition-all hover:scale-110 active:scale-95"
                      style={{ color: 'inherit' }}
                    >
                      <Pencil size={14} />
                    </button>
              </Tooltip>
            ) : (
              [
                { icon: Volume2, label: 'Listen', action: () => onSpeech(msg.text), tooltip: "Neural TTS: Convert intelligence text into high-fidelity synthesized speech." },
                { icon: Languages, label: 'Translate', action: () => setShowTranslate(!showTranslate), active: showTranslate, tooltip: "Translate Node: Convert response into regional or international languages." },
                { icon: Copy, label: 'Copy', action: () => onCopy(msg.text), tooltip: "Copy Intelligence: Extract text content to your system clipboard." },
                { icon: RotateCcw, label: 'Regenerate', action: () => onRegenerate(msg.id || ''), tooltip: "Neural Recalibration: Trigger a new AI analysis for this specific inquiry." },
                { icon: Share2, label: 'Share', action: () => onShare(msg.text), tooltip: "Broadcast: Share this intelligence insight via external system channels." }
              ].map((tool, i) => (
                <Tooltip key={i} content={tool.tooltip}>
                  <button 
                    onClick={tool.action} 
                    className={cn(
                      "p-1.5 transition-all hover:scale-110 active:scale-95",
                      tool.active ? "opacity-100" : "opacity-70 hover:opacity-100"
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

const IntelligenceHub = ({ news, market, niftyHistory, summaries, onRefresh, lastSync, marketSyncTime, marketErrors, syncInterval, setSyncInterval, onSelectSummary }: { news: any[], market: any[], niftyHistory: any[], summaries: any[], onRefresh: () => void, lastSync: string, marketSyncTime: string, marketErrors: any[], syncInterval: number, setSyncInterval: (v: number) => void, onSelectSummary: (s: any) => void }) => {
  const [activeModal, setActiveModal] = useState<any>(null);

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-primary shadow-[2px_2px_0px_0px_rgba(var(--primary-rgb),0.3)]" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.5em] italic">Real-Time Market Nodes</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Last Synced: {marketSyncTime || 'Pending'}</span>
          </div>
          <button 
            onClick={onRefresh}
            className="p-1 px-3 border-2 border-primary/40 hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-3 group active:scale-95 shadow-[2px_2px_0px_0px_rgba(var(--primary-rgb),0.1)]"
          >
            <RefreshCw size={12} className="text-primary group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[9px] font-black uppercase tracking-widest">Neural Sync</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0 mb-4">
        {tickers.map((ticker, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveModal({ ...ticker, type: 'market' })}
            className={cn(
              "p-4 border-2 cursor-pointer transition-all hover:translate-y-[-4px] bg-white dark:bg-zinc-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]",
              ticker.trend === 'up' ? "border-emerald-500/30 hover:shadow-emerald-500/20" : ticker.trend === 'down' ? "border-rose-500/30 hover:shadow-rose-500/20" : "border-zinc-500/20 hover:shadow-zinc-500/10"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">{ticker.label}</p>
              <div className={cn("w-1.5 h-1.5 rounded-full", ticker.trend === 'up' ? "bg-emerald-500" : "bg-rose-500")} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter italic leading-none">{ticker.value}</span>
              <span className={cn("text-[10px] font-black mt-1", ticker.trend === 'up' ? "text-emerald-500" : ticker.trend === 'down' ? "text-rose-500" : "text-zinc-500")}>
                {ticker.trend === 'up' ? '▲' : '▼'} {ticker.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. INTERNATIONAL BULLETINS */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-3">
            <div className="w-2 h-6 bg-primary" />
            <Globe size={18} className="text-primary" /> International Bulletins
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {BULLETINS.map((bulletin, i) => (
              <motion.div 
                key={i}
                whileHover={{ x: 8, borderColor: 'var(--primary)' }}
                onClick={() => setActiveModal({ ...bulletin, type: 'bulletin' })}
                className="p-5 border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,0.03)] hover:shadow-primary/20 transition-all flex items-start gap-4 relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                <div className="p-3 bg-primary/5 border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                  {bulletin.icon ? <bulletin.icon size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest">{bulletin.title}</h4>
                    <span className="text-[7px] font-black uppercase tracking-[0.3em] px-2 py-1 bg-primary text-white italic">Priority Alpha</span>
                  </div>
                  <p className="text-[11px] font-bold opacity-60 leading-relaxed line-clamp-2">{bulletin.summary}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 3. PIB SECTION */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-3">
            <div className="w-2 h-6 bg-secondary" />
            <Landmark size={18} className="text-secondary" /> PIB Section
          </h3>
          <div className="flex flex-col gap-4">
            {PIB_UPDATES.slice(0, 4).map((pib, i) => (
              <motion.div 
                key={i}
                whileHover={{ x: -8, borderColor: 'var(--secondary)' }}
                onClick={() => setActiveModal({ ...pib, type: 'pib' })}
                className="p-5 border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 cursor-pointer hover:shadow-secondary/10 transition-all relative group"
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-secondary opacity-20 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-[12px] font-black uppercase tracking-tight flex-1 leading-tight group-hover:text-secondary transition-colors">{pib.title}</h4>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    <span className="text-[8px] font-black opacity-30 italic whitespace-nowrap">Official Archive</span>
                  </div>
                </div>
                <p className="text-[10px] font-bold opacity-50 line-clamp-2 leading-relaxed">{pib.summary}</p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                   <div className="flex items-center gap-3">
                      <Calendar size={12} className="text-secondary opacity-50" />
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                   </div>
                   <div className="flex items-center gap-2 text-secondary font-black text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                      <span>Neural Verify</span>
                      <ChevronRight size={12} />
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
                  <div className={cn("w-1.5 h-1.5 rounded-full", item.status === 'Ongoing' ? "bg-white animate-pulse" : "bg-white/50")} />
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
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
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
  onCreate
}: { 
  agents: Agent[], 
  activeAgentId: string, 
  onSelect: (id: string) => void,
  onEdit: (agent: Agent) => void,
  onDuplicate: (agent: Agent) => void,
  onDelete: (id: string) => void,
  onCreate: () => void
}) => {
  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-primary">Intelligence Matrix</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mt-1">BCC Neural Personnel Terminal</p>
        </div>
        <button 
          onClick={onCreate}
          className="p-4 bg-primary text-white font-black uppercase text-xs tracking-widest shadow-[6px_6px_0px_0px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border-2 border-white/20"
        >
          <Plus size={18} /> Commission New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <motion.div 
            key={agent.id}
            layout
            className={cn(
              "border-4 p-6 relative overflow-hidden transition-all group h-full flex flex-col justify-between",
              activeAgentId === agent.id ? "shadow-[12px_12px_0px_0px_rgba(var(--primary-rgb),0.1)] border-primary" : "border-zinc-200 dark:border-zinc-800 hover:border-primary/50"
            )}
            style={{ backgroundColor: 'white' }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Brain size={120} />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 border-2 flex items-center justify-center font-black italic",
                    activeAgentId === agent.id ? "bg-primary text-white border-primary" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 group-hover:border-primary/30"
                  )}>
                    {agent.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest leading-none mb-1">{agent.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
                        {agent.role}
                      </span>
                      {agent.isPredefined && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-secondary/10 text-secondary border border-secondary/20">
                          System Node
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onDuplicate(agent)} title="Duplicate" className="p-2 hover:bg-primary/10 text-primary transition-colors border border-transparent hover:border-primary/20"><Copy size={14} /></button>
                  {!agent.isPredefined && <button onClick={() => onEdit(agent)} title="Edit" className="p-2 hover:bg-primary/10 text-primary transition-colors border border-transparent hover:border-primary/20"><Pencil size={14} /></button>}
                  {!agent.isPredefined && <button onClick={() => onDelete(agent.id)} title="Delete" className="p-2 hover:bg-rose-500/10 text-rose-500 transition-colors border border-transparent hover:border-rose-500/20"><Trash2 size={14} /></button>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 opacity-40">
                    <History size={10} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Neural Persona</span>
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-70 italic line-clamp-3">"{agent.persona}"</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 opacity-40">
                    <GitBranch size={10} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Strategic Frameworks</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.frameworks.map((f, i) => (
                      <span key={i} className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">{f}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-900 mt-auto">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <CpuIcon size={12} className={agent.abilities.toolCalling ? "text-primary" : "text-zinc-300"} />
                    <span className={cn("text-[8px] font-black uppercase", agent.abilities.toolCalling ? "opacity-100" : "opacity-20")}>Tools</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Network size={12} className={agent.abilities.remoteConnection ? "text-secondary" : "text-zinc-300"} />
                    <span className={cn("text-[8px] font-black uppercase", agent.abilities.remoteConnection ? "opacity-100" : "opacity-20")}>Remote</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers size={12} className={agent.abilities.mcpCalling ? "text-primary" : "text-zinc-300"} />
                    <span className={cn("text-[8px] font-black uppercase", agent.abilities.mcpCalling ? "opacity-100" : "opacity-20")}>MCP</span>
                  </div>
                </div>

                <button 
                  onClick={() => onSelect(agent.id)}
                  className={cn(
                    "px-6 py-2 font-black uppercase text-[10px] tracking-[0.2em] transition-all",
                    activeAgentId === agent.id 
                      ? "bg-secondary text-white shadow-[4px_4px_0px_0px_rgba(var(--secondary-rgb),0.3)]" 
                      : "border-2 border-primary text-primary hover:bg-primary hover:text-white"
                  )}
                >
                  {activeAgentId === agent.id ? 'Active Intelligence' : 'Deploy Protocol'}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [user] = useState<any>({
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
  const [currentTheme, setCurrentTheme] = useState<ThemePalette>(THEMES[0]);
  const [input, setInput] = useState('');
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [headerInfoIndex, setHeaderInfoIndex] = useState(0); // 0: Logo, 1: Time/Date
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
  const [syncInterval, setSyncInterval] = useState(4); // hours
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [systemKnowledgeBases, setSystemKnowledgeBases] = useState<any[]>([]);
  const [systemSkills, setSystemSkills] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
    const switchTimer = setInterval(() => setHeaderInfoIndex(prev => (prev + 1) % 2), 6000);
    return () => {
      clearInterval(timeTimer);
      clearInterval(switchTimer);
    };
  }, []);

  useEffect(() => {
    fetchNewsNodes();
    
    // Auto-sync interval logic for news/summaries
    const intervalMs = syncInterval * 60 * 60 * 1000;
    const newsTimer = setInterval(() => {
      fetchNewsNodes();
    }, intervalMs);

    // Real-time market data sync (30 seconds)
    const fetchMarket = async (force: boolean = false) => {
      try {
        const url = force ? `/api/intelligence/market?refresh=true&t=${Date.now()}` : `/api/intelligence/market?t=${Date.now()}`;
        const res = await fetch(url).catch(err => {
          console.error("Fetch implementation error:", err);
          throw new Error("Network connection bridge blocked. Ensure Neural Core (Server) is active.");
        });

        const contentType = res.headers.get("content-type");
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = `Server protocol error: ${res.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) {
            // Not JSON
          }
          throw new Error(errorMessage);
        }

        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Neural Core relaying non-standard data format. Re-initializing protocol...");
        }

        const result = await res.json();
        
        if (result.data && Array.isArray(result.data)) {
          setMarketData(result.data);
          setMarketSyncTime(new Date(result.syncTime).toLocaleTimeString());
          setMarketErrors(result.errors || []);
          
          if (result.error) {
            console.warn("Soft Market Sync Error:", result.error);
          }
          
          // Update Nifty History
          const nifty = result.data.find((d: any) => d.label.toUpperCase().includes('NIFTY 50'));
          if (nifty) {
            const price = parseFloat(nifty.value.toString().replace(/,/g, ''));
            if (!isNaN(price)) {
              setNiftyHistory(prev => {
                const newPoint = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), value: price };
                const updated = [...prev, newPoint].slice(-20); 
                return updated;
              });
            }
          }
        } else if (Array.isArray(result)) {
          setMarketData(result);
          setMarketSyncTime(new Date().toLocaleTimeString());
        }
      } catch (e: any) {
        console.error("Intelligence Core Sync Error:", e);
        setMarketErrors([{ source: "Intelligence Hub", type: e.message || "Failed to establish node connection" }]);
        
        // Simple retry after 5s on network failures
        if (e.message.includes("Failed to fetch") || e.message.includes("connection")) {
          setTimeout(() => fetchMarket(force), 5000);
        }
      }
    };
    
    // Explicitly expose fetchMarket for onRefresh calls
    (window as any).refreshMarketData = () => fetchMarket(true);

    fetchMarket();
    const marketTimer = setInterval(fetchMarket, 30000);

    return () => {
      clearInterval(newsTimer);
      clearInterval(marketTimer);
    };
  }, [syncInterval]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', currentTheme.primary);
    root.style.setProperty('--secondary', currentTheme.secondary);
    root.style.setProperty('--accent', currentTheme.accent);
    root.style.setProperty('--background', currentTheme.background);
    root.style.setProperty('--text', currentTheme.text);
    root.style.setProperty('--sidebar', currentTheme.sidebar);
    root.style.setProperty('--sidebar-text', currentTheme.sidebarText);
    
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
    
    if (currentTheme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [currentTheme]);

  const cycleTheme = () => {
    const currentIndex = THEMES.findIndex(t => t.id === currentTheme.id);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setCurrentTheme(THEMES[nextIndex]);
    // Removed annoying toast
  };
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState<'hybrid' | 'local' | 'thinking'>('hybrid');
  const [isLive, setIsLive] = useState(false);
  const [isTTS, setIsTTS] = useState(true);
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
  const [isHandsFree, setIsHandsFree] = useState(false);
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

  const INDIAN_LANGUAGES = ['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil'];
  const INT_LANGUAGES = ['Spanish', 'French', 'German', 'Chinese', 'Japanese'];

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

  const loadSessions = (uid: string) => {
    const q = query(collection(db, 'sessions'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setSessions(sess);
      if (sess.length > 0 && !currentSessionId) {
        setCurrentSessionId(sess[0].id);
      } else if (sess.length === 0) {
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

  const deleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      addToast("Intelligence node de-initialized.", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sessions');
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

  const addTask = async (title: string) => {
    if (!user || !title.trim()) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        uid: user.uid,
        title,
        completed: false,
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

  const handleEditMessage = async (msgId: string, newText: string) => {
    if (!msgId || !newText.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', msgId), { text: newText });
      addToast("Message updated", "success");
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
  const toggleHandsFree = () => {
    if (!isHandsFree) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          setInput(transcript);
        };
        recognitionRef.current.start();
        setIsHandsFree(true);
        addToast("Hands-free mode active. Speak now.", "info");
      } else {
        addToast("Speech recognition not supported in this browser.", "error");
      }
    } else {
      recognitionRef.current?.stop();
      setIsHandsFree(false);
      addToast("Hands-free mode deactivated.", "info");
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

  const toggleLive = async () => {
    if (!isLive) {
      try {
        const sessionPromise = getLiveSession({
          onopen: () => {
            addToast("Voice session active. Speak freely.", "success");
            setIsLive(true);
          },
          onmessage: (message: any) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              playAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
            }
            if (message.serverContent?.interrupted) {
              // Stop current playback if needed
            }
          },
          onclose: () => {
            cleanupLive();
          },
          onerror: (err: any) => {
            console.error("Live Session Error:", err);
            cleanupLive();
            addToast("Voice session error.", "error");
          }
        });

        liveSessionRef.current = await sessionPromise;

        // Setup Audio Capture
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          
          if (liveSessionRef.current) {
            liveSessionRef.current.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        };

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

      } catch (error) {
        console.error("Live Session Error:", error);
        addToast("Failed to start voice session. Check microphone permissions.", "error");
        cleanupLive();
      }
    } else {
      cleanupLive();
    }
  };

  const cleanupLive = () => {
    setIsLive(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (liveSessionRef.current) {
      // liveSessionRef.current.close(); // If SDK supports it
      liveSessionRef.current = null;
    }
    addToast("Voice session ended.", "info");
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

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || !user || !currentSessionId) return;

    const userMsg = {
      uid: user.uid,
      sessionId: currentSessionId,
      text: textToSend,
      role: 'user',
      timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'chats'), userMsg);
      if (!overrideInput) setInput('');
      setLoading(true);

      // Context Window Management: Get last 10 messages for context
      const chatHistory = messages
        .filter(m => m.id !== 'init')
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

      if (isTTS) {
        const audioData = await generateSpeech(response.text);
        if (audioData) playAudio(audioData);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (base64: string) => {
    if (!base64) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const binary = atob(base64);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
      
      const int16Array = new Int16Array(buffer);
      const audioBuffer = audioContextRef.current.createBuffer(1, int16Array.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (err) {
      console.error("Audio playback error:", err);
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
      <div className="flex h-[100dvh] transition-colors duration-500 font-sans overflow-hidden relative technical-grid" style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}>
        {/* Offline Banner */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 z-[100] flex items-center justify-center gap-2">
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
          "flex flex-col border-r-[4px] transition-all duration-500 ease-in-out fixed md:relative z-[101] md:z-50 h-full",
          (isSidebarCollapsed && !isMobileMenuOpen) ? "w-0 md:w-20 overflow-hidden" : "w-[280px] md:w-[320px]",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )} style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--sidebar)' }}>
          {/* Sidebar Header */}
          <div className={cn("p-6 border-b-2 flex items-center transition-all", isSidebarCollapsed ? "justify-center px-0" : "justify-between")} style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)', backgroundColor: 'var(--sidebar)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 shadow-[2px_2px_0px_0px_var(--primary)] shrink-0 bg-white dark:bg-zinc-950" style={{ borderColor: 'var(--primary)' }}>
                <Brain size={20} className="text-primary" />
              </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none" style={{ color: 'var(--text)' }}>Setu <span className="text-primary">Matrix</span></h1>
                  <p className="text-[7px] font-black uppercase tracking-[0.4em] mt-1 opacity-50" style={{ color: 'var(--text)' }}>Neural Envoy v1.2</p>
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
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-1 h-3 bg-primary" />
                  <label className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40" style={{ color: 'var(--text)' }}>Intelligence Nodes</label>
                </div>
              )}
              <div className="space-y-2 flex flex-col">
                {[
                  { id: 'chat', icon: MessageSquare, label: 'Neural Chat', desc: 'Core LLM Interface' },
                  { id: 'intelligence', icon: TrendingUp, label: 'Intelligence Hub', desc: 'Real-time Analytics' },
                  { id: 'agents', icon: Users, label: 'Agent Terminal', desc: 'BCC Personnel Matrix' },
                  { id: 'admin', icon: Shield, label: 'Admin Matrix', desc: 'System Oversight' },
                  { id: 'settings', icon: Settings, label: 'System Config', desc: 'Node Parameters' }
                ].map((item) => (
                  <Tooltip key={item.id} content={isSidebarCollapsed ? item.label : ""} className="block w-full">
                    <button
                      onClick={() => {
                        setView(item.id as ViewState);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full p-4 flex items-center border-2 transition-all group relative overflow-hidden font-black uppercase text-[11px] tracking-widest",
                        isSidebarCollapsed ? "justify-center px-0" : "gap-4",
                        view === item.id 
                          ? "shadow-[4px_4px_0px_0px_var(--primary)] translate-x-1" 
                          : "border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-white/50 dark:hover:bg-zinc-900/50"
                      )}
                      style={{ 
                        backgroundColor: view === item.id ? 'var(--background)' : 'transparent',
                        borderColor: view === item.id ? 'var(--primary)' : undefined,
                        color: 'var(--text)',
                      }}
                    >
                      <div className={cn(
                        "p-2 border transition-all shrink-0",
                        view === item.id ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-400 group-hover:text-primary group-hover:border-primary/30"
                      )}>
                        <item.icon size={16} />
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="flex flex-col items-start transition-all">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest truncate", view === item.id ? "text-primary" : "text-zinc-500 group-hover:text-text")}>{item.label}</span>
                          <span className="text-[6px] font-black opacity-30 tracking-[0.2em]">{item.desc}</span>
                        </div>
                      )}
                      {view === item.id && (
                        <motion.div 
                          layoutId="active-nav"
                          className="absolute right-0 w-1 h-3/4 my-auto bg-primary"
                        />
                      )}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Session History */}
            {!isSidebarCollapsed && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-secondary" />
                    <label className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40" style={{ color: 'var(--text)' }}>Neural History</label>
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
                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                  {sessions.map((s) => (
                    <motion.div 
                      key={s.id}
                      whileHover={{ x: 3 }}
                      className={cn(
                        "group relative flex items-center gap-3 p-3 border-2 transition-all cursor-pointer overflow-hidden",
                        currentSessionId === s.id 
                          ? "shadow-[3px_3px_0px_0px_var(--secondary)] border-secondary" 
                          : "border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                      )}
                      style={{ 
                        backgroundColor: currentSessionId === s.id ? 'var(--background)' : 'transparent',
                        color: 'var(--text)',
                      }}
                      onClick={() => { 
                        setView('chat'); 
                        setCurrentSessionId(s.id); 
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <div className={cn(
                        "p-1.5 border transition-all",
                        currentSessionId === s.id ? "bg-secondary/10 border-secondary text-secondary" : "border-zinc-200 dark:border-zinc-800 text-zinc-400 group-hover:text-secondary group-hover:border-secondary/30"
                      )}>
                        <MessageSquare size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[9px] font-black uppercase tracking-widest truncate", currentSessionId === s.id ? "text-secondary" : "text-zinc-500 group-hover:text-text")}>{s.title || 'New Intelligence Node'}</p>
                        <p className="text-[6px] font-black uppercase opacity-30 mt-0.5 tracking-[0.2em]">{new Date(s.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("De-initialize this intelligence node?")) deleteSession(s.id);
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Footer */}
          <div className={cn("p-4 border-t-2 transition-all", isSidebarCollapsed ? "px-0" : "p-6")} style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)', backgroundColor: 'var(--sidebar)' }}>
            <div className={cn("flex items-center group cursor-pointer transition-all gap-4 p-3 border-2 border-transparent hover:border-primary/20 bg-white/50 dark:bg-zinc-900/50", isSidebarCollapsed ? "justify-center p-1" : "")}>
              <div className="w-8 h-8 rounded-none border-2 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_var(--primary)]" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--background)' }}>
                {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <User size={16} className="text-primary" />}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color: 'var(--text)' }}>{user.displayName || 'Executive Node'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[7px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text)' }}>Active Session</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Experience */}
        <main className="flex-1 flex flex-col relative overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
          {/* Header - Executive Intelligence Terminal */}
          <header className="h-16 md:h-20 border-b-[1px] flex items-center justify-between px-4 md:px-8 z-[50] transition-all shrink-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-0">
            <div className="flex items-center gap-3 md:gap-5">
              <button 
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileMenuOpen(true);
                  } else {
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }
                }}
                className="flex p-2.5 rounded-xl transition-all bg-zinc-100 dark:bg-zinc-900 text-primary hover:scale-105 active:scale-95"
              >
                <Menu size={20} />
              </button>
              
              <div className="flex items-center gap-2 md:gap-4 min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                  {headerInfoIndex === 0 ? (
                    <motion.div 
                      key="logo"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary animate-pulse shrink-0" />
                      <AnimatedLogo theme={currentTheme} />
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="time"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex flex-col"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-primary" />
                        <span className="text-xs md:text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text)' }}>
                          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar size={10} className="text-secondary opacity-60" />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text)' }}>
                          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="h-10 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden md:block mx-1" />
                
                <div className="hidden sm:flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-30" style={{ color: 'var(--text)' }}>Active Node</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--text)' }}>{view}</span>
                    <div className="w-1 h-1 rounded-full bg-primary/40" />
                  </div>
                </div>
              </div>
            </div>

            {/* Global Matrix Search - Centered on Desktop */}
            <div className="hidden lg:flex items-center border-2 rounded-none px-4 py-2 w-80 transition-all focus-within:ring-2 ring-primary/20 group"
                 style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
              <Search size={14} className="opacity-30 group-focus-within:opacity-100 transition-opacity" style={{ color: 'var(--text)' }} />
              <input 
                type="text"
                placeholder="Query Intelligence Network..."
                className="bg-transparent border-none outline-none text-[10px] font-bold w-full px-3 placeholder:opacity-40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ color: 'var(--text)' }}
              />
              <div className="px-1.5 py-0.5 border text-[7px] font-black opacity-30" style={{ borderColor: 'var(--text)', color: 'var(--text)' }}>⌘K</div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-4 shrink-0 overflow-visible">
              <div className="flex items-center gap-1.5 md:gap-3">
                <button 
                  onClick={cycleTheme} 
                  className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transition-all border-2 active:scale-95 group shadow-[2px_2px_0px_0px_var(--primary)] text-primary"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
                >
                  <Palette size={18} className="group-hover:text-primary transition-colors" />
                </button>
                <button 
                  onClick={() => setIsTTS(!isTTS)} 
                  className={cn(
                    "w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transition-all active:scale-95 border-2 shadow-[2px_2px_0px_0px_var(--secondary)]", 
                    isTTS && "animate-pulse-glow"
                  )}
                  style={{ 
                    backgroundColor: isTTS ? 'var(--primary)' : 'var(--background)', 
                    borderColor: isTTS ? 'var(--primary)' : 'var(--text)', 
                    color: isTTS ? 'var(--background)' : 'var(--text)' 
                  }}
                >
                  {isTTS ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                
                <div className="w-[1px] h-8 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />
                
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center font-black transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[3px_3px_0px_0px_var(--primary)] border-2 text-[12px] md:text-[14px] overflow-hidden" 
                  style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--text)', color: 'var(--background)' }}
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{user.displayName.substring(0, 2).toUpperCase()}</span>
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Content View */}
          <div 
            ref={mainContentRef}
            className="flex-1 overflow-y-auto relative no-scrollbar custom-scrollbar" 
            style={{ backgroundColor: 'var(--background)' }}
          >
            <div className="p-4 md:p-6 lg:p-8">
              <AnimatePresence mode="wait">
              {view === 'chat' && (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-4xl mx-auto w-full h-full flex flex-col"
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 px-4 text-center py-6">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="w-full max-w-2xl border-4 rounded-none p-6 md:p-12 shadow-[12px_12px_0px_0px_rgba(var(--primary-rgb),0.1)] relative overflow-hidden bg-white dark:bg-zinc-950"
                        style={{ borderColor: 'var(--primary)' }}
                      >
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl" />
                        
                        <div className="flex flex-col gap-8 md:gap-10 relative z-10">
                          <header className="flex flex-col items-center text-center border-b-4 pb-8" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                            <div className="w-16 h-1 bg-primary mb-6 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                            <motion.h2 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                              className="text-4xl md:text-6xl font-black tracking-tighter mb-2 uppercase italic leading-none" 
                              style={{ color: 'var(--text)' }}
                            >
                              SETU <span className="text-primary italic">DIGITAL</span>
                            </motion.h2>
                            <motion.p 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.3 }}
                              className="text-[11px] md:text-[14px] font-black uppercase tracking-[0.5em] mt-2 italic" 
                              style={{ color: 'var(--secondary)' }}
                            >
                              Bharat's Global Gateway
                            </motion.p>
                          </header>

                          <div className="space-y-6">
                            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] opacity-30 text-center">Empowering your enterprise with instant global intelligence</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { label: "Uncover Growth Markets", prompt: "Analyze emerging global markets for Indian trade and identify high-potential sectors for export growth.", icon: Globe },
                                { label: "Claim Trade Benefits", prompt: "Explain the latest government incentives and trade benefits. How can my specific business access these programs?", icon: ShieldCheck },
                                { label: "Simplify Complex Policies", prompt: "Break down the most recent international trade policies into clear, easy-to-understand actionable steps for my business.", icon: BookOpen },
                                { label: "Scale My Export Journey", prompt: "Create a strategic, step-by-step roadmap to help scale my business operations to meet international trade standards.", icon: TrendingUp }
                              ].map((starter, i) => (
                                <button 
                                  key={i}
                                  onClick={() => handleSend(starter.prompt)}
                                  className="p-5 border-2 rounded-none transition-all text-left flex items-center justify-between group hover:bg-primary/5 hover:border-primary active:scale-[0.98] shadow-sm hover:shadow-md"
                                  style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)', color: 'var(--text)' }}
                                >
                                  <div className="flex items-center gap-3">
                                    <starter.icon size={16} className="text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{starter.label}</span>
                                  </div>
                                  <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-center gap-8 pt-6 border-t-2" style={{ borderColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                            <button onClick={() => setWelcomeModalOpen('system')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-primary transition-colors group">
                              <Activity size={12} className="group-hover:animate-pulse" /> System Protocol
                            </button>
                            <button onClick={() => setWelcomeModalOpen('session')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-secondary transition-colors group">
                              <Shield size={12} className="group-hover:rotate-12 transition-transform" /> Neural Guard
                            </button>
                            <button onClick={() => setWelcomeModalOpen('language')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-primary transition-colors">
                              <Zap size={12} /> Language Matrix
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="space-y-6 pb-20">
                      {filteredMessages.map((m, i) => (
                        <div key={m.id || `msg-${i}`}>
                          <ChatMessageComponent 
                            msg={m} 
                            isUser={m.role === 'user'}
                            onSpeech={(text) => generateSpeech(text).then(playAudio)}
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
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {loading && (
                    <div className="flex justify-start mb-8">
                      <div className="p-5 rounded-none border-4 flex items-center gap-4 shadow-[8px_8px_0px_0px_rgba(var(--secondary-rgb),0.1)] bg-white dark:bg-zinc-950" style={{ borderColor: 'var(--secondary)' }}>
                        <div className="relative">
                          <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-secondary/20 border-t-secondary animate-spin" />
                          <Cpu className="absolute inset-0 m-auto text-secondary animate-pulse" size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary">Neural Synchronizing</span>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-40">Decrypting Strategy Layers...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </motion.div>
              )}

              {view === 'intelligence' && (
                <motion.div 
                  key="intelligence"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-7xl mx-auto w-full"
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
                  />
                </motion.div>
              )}

              {view === 'agents' && (
                <motion.div 
                  key="agents"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-7xl mx-auto w-full"
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
                        linguisticControls: 'Use professional tone.',
                        abilities: { toolCalling: true, mcpCalling: false, remoteConnection: false },
                        config: {}
                      });
                      setIsAgentEditorOpen(true);
                    }}
                  />
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
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] italic text-primary">Active Node Console</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mt-1">
                              {AGENT_CATEGORIES.flatMap(c => c.agents).find(a => a.id === activeAgentId)?.label || 'Custom Node'} // SYNC_STABLE
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
                          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.5em] italic">Agent Matrix</h2>
                        </div>
                        <Tooltip content="Matrix Synchronize">
                          <button className="p-1 px-3 border-2 border-zinc-100 dark:border-zinc-900 hover:border-primary transition-all text-zinc-400 hover:text-primary text-[9px] font-black uppercase tracking-widest">
                            Sync Node
                          </button>
                        </Tooltip>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                        {AGENT_CATEGORIES.map(group => (
                          <button 
                            key={group.category}
                            onClick={() => setSelectedCategory(group)}
                            className="p-5 border-2 text-left transition-all hover:bg-primary/5 group relative overflow-hidden flex flex-col justify-between"
                            style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-20 group-hover:scale-110 transition-all">
                              <group.icon size={50} />
                            </div>
                            <div className="relative z-10">
                              <group.icon size={16} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
                              <h3 className="text-xs font-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{group.category}</h3>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">{group.agents.length} Nodes Available</p>
                            </div>
                            <div className="mt-4 flex items-center gap-2 relative z-10">
                              <div className="w-1 h-3 bg-primary/30 group-hover:bg-primary transition-all" />
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Initialize Layer</span>
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
                          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.5em] italic">Objective Matrix</h2>
                        </div>
                        <div className="px-3 py-1 bg-secondary text-white text-[9px] font-black uppercase tracking-widest">
                          {tasks.length} SYNC_TASKS
                        </div>
                      </div>
                      
                      <div className="space-y-4 mb-6 shrink-0">
                        <div className="flex gap-2">
                          <input 
                            id="task-input"
                            className="flex-1 bg-transparent border-2 rounded-none p-3 md:p-4 outline-none transition-all font-black text-[12px] md:text-sm uppercase tracking-widest focus:border-secondary shadow-inner"
                            style={{ borderColor: 'rgba(var(--secondary-rgb), 0.2)', color: 'var(--text)' }}
                            placeholder="Inject new directive..."
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addTask((e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              const inputEl = document.getElementById('task-input') as HTMLInputElement;
                              if (inputEl.value.trim()) {
                                addTask(inputEl.value);
                                inputEl.value = '';
                              }
                            }}
                            className="p-3 md:p-4 bg-secondary text-white transition-all active:scale-95 shadow-[4px_4px_0px_0px_rgba(var(--secondary-rgb),0.3)]"
                          >
                            <Plus size={20} strokeWidth={3} />
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
                                        <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--secondary-rgb),0.4)]", task.completed ? "bg-zinc-400" : "bg-secondary animate-pulse")} />
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
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-6xl mx-auto w-full"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Profile Card - Bento */}
              <Tooltip content="System Config: Manage your profile and interface preferences.">
                <div className="md:col-span-2 lg:col-span-2 border-2 rounded-none p-4 md:p-6 shadow-xl" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                  <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3 uppercase italic" style={{ color: 'var(--text)' }}>
                    <div className="p-2 rounded-none shadow-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                      <Settings size={20} style={{ color: 'var(--background)' }} />
                    </div>
                    System Config
                  </h2>
                  <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 p-4 md:p-6 border-2" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                    <div className="relative shrink-0">
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=User&background=random`} 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 md:w-20 md:h-20 rounded-none border-2 shadow-lg" 
                        style={{ borderColor: 'var(--primary)' }} 
                      />
                      <div className="absolute -bottom-1 -right-1 p-1 rounded-none border shadow-md" style={{ backgroundColor: 'var(--secondary)', borderColor: 'var(--background)' }}>
                        <ShieldCheck size={10} style={{ color: 'var(--background)' }} />
                      </div>
                    </div>
                    <div className="text-center sm:text-left min-w-0">
                      <p className="text-lg md:text-xl font-black truncate uppercase" style={{ color: 'var(--text)' }}>{user.displayName || 'Active Intelligence'}</p>
                      <p className="text-[10px] md:text-xs font-black truncate uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{user.email || 'Anonymous Session'}</p>
                      <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-1.5">
                        <span className="px-2 py-0.5 rounded-none text-[7px] md:text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}>Verified</span>
                        <span className="px-2 py-0.5 rounded-none text-[7px] md:text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: 'var(--secondary)', color: 'var(--background)' }}>Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Tooltip>

              {/* Preferences Card - Bento */}
              <Tooltip content="Interface Preferences: Customize the language and visual settings.">
                <div className="border-2 rounded-none p-4 md:p-6 shadow-xl flex flex-col justify-between" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                  <label className="text-[9px] uppercase font-black tracking-[0.2em] mb-4 block" style={{ color: 'var(--primary)' }}>Interface</label>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5 p-2 border-2" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                      <div className="flex items-center gap-2">
                        <Languages size={14} style={{ color: 'var(--secondary)' }} />
                        <span className="font-black text-[10px] uppercase" style={{ color: 'var(--text)' }}>Language</span>
                      </div>
                      <select 
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-transparent border rounded-none text-[8px] font-black uppercase tracking-widest p-1 outline-none"
                        style={{ borderColor: 'rgba(var(--primary-rgb), 0.2)', color: 'var(--text)' }}
                      >
                        <option>English</option>
                        {[...INDIAN_LANGUAGES, ...INT_LANGUAGES].map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-none border text-center" style={{ borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-100" style={{ color: 'var(--primary)' }}>Prototype Version</p>
                    <p className="text-[10px] font-black uppercase italic" style={{ color: 'var(--secondary)' }}>v1.2.0-STABLE</p>
                  </div>
                </div>
              </Tooltip>

                    {/* System Metrics - New Bento Card */}
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        { [
                          { label: 'Neural Load', value: '14%', color: 'var(--primary)', icon: Cpu },
                          { label: 'Uptime', value: '99.9%', color: 'var(--secondary)', icon: Zap },
                          { label: 'Latency', value: '24ms', color: 'var(--text)', icon: Activity }
                        ].map((stat, i) => (
                          <Tooltip key={i} content={`${stat.label}: Current system health metric.`}>
                            <div className="border-2 rounded-none p-4 md:p-6 shadow-lg flex items-center gap-4 group transition-all" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}>
                              <div className="p-3 rounded-none shadow-md" style={{ backgroundColor: stat.color, color: 'var(--background)' }}>
                                <stat.icon size={20} />
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{stat.label}</p>
                                <p className="text-xl md:text-2xl font-black italic uppercase" style={{ color: 'var(--text)' }}>{stat.value}</p>
                              </div>
                            </div>
                          </Tooltip>
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
                    { id: 'upload', icon: Paperclip, label: 'Upload', action: handleFileUpload },
                    { id: 'handsfree', icon: Mic, label: 'Voice', action: toggleLive, active: isLive },
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
                      <tool.icon size={16} className={cn("shrink-0", tool.id === 'handsfree' && isLive && "animate-pulse")} />
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-center">
                        {tool.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Bottom Level: Full-Width Input Control */}
                <div className="running-line-border flex items-center p-0 bg-white dark:bg-zinc-950 w-full relative group shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                  <div className="pl-6 md:pl-8 shrink-0">
                    <Zap className={cn("transition-all duration-500", loading ? "text-primary animate-spin" : "text-zinc-400 dark:text-zinc-600 group-focus-within:text-primary animate-tilt")} size={24} />
                  </div>

                  <input 
                    ref={inputRef}
                    className="flex-1 min-w-0 bg-transparent py-4 md:py-5 outline-none px-4 md:px-6 text-[13px] md:text-[16px] font-black uppercase tracking-[0.05em] placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-colors"
                    placeholder="Authorize neural command..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && input.trim()) {
                        handleSend();
                      }
                    }}
                    disabled={loading || !isOnline}
                    style={{ color: 'var(--text)' }}
                  />

                  <button 
                    onClick={() => {
                      if (input.trim()) {
                        handleSend();
                      }
                    }}
                    disabled={loading || !input.trim() || !isOnline}
                    className="h-full min-h-[64px] md:min-h-[72px] w-16 md:w-24 rounded-none bg-zinc-900 dark:bg-white text-white dark:text-black transition-all disabled:opacity-20 shrink-0 hover:bg-primary dark:hover:bg-primary active:scale-95 flex items-center justify-center border-l border-zinc-200 dark:border-zinc-800"
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </button>
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
                className="fixed bottom-24 md:bottom-28 right-4 md:right-8 z-50 p-2 md:p-3 rounded-full shadow-xl border transition-all active:scale-90"
                style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--background)' }}
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </main>

        {/* Toast System */}
        <div className="fixed bottom-24 right-8 z-[100] flex flex-col gap-3">
            <AnimatePresence>
              {toasts.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "px-6 py-4 rounded-none shadow-2xl border-l-[6px] flex items-center gap-4 text-xs font-black uppercase tracking-wider min-w-[300px]",
                    t.type === 'success' ? "bg-white border-[#34A853] text-[#1a1a1a]" :
                    t.type === 'error' ? "bg-white border-[#EA4335] text-[#1a1a1a]" :
                    "bg-white border-[#4285F4] text-[#1a1a1a]"
                  )}
                  style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,0.1)' }}
                >
                  {t.type === 'success' ? <CheckCircle size={18} className="text-[#34A853]" /> : <AlertCircle size={18} className={t.type === 'error' ? "text-[#EA4335]" : "text-[#4285F4]"} />}
                  <span className="flex-1">{t.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
        </div>

        {/* Summary Detail Modal */}
        <AnimatePresence>
          {selectedSummary && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-3xl border-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
              >
                <div className="p-4 md:p-6 space-y-4 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between sticky top-0 bg-inherit z-10 pb-3 border-b" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary text-background shadow-md">
                        <selectedSummary.icon size={18} />
                      </div>
                      <div>
                        <h2 className="text-sm md:text-base font-black uppercase italic tracking-wider">{selectedSummary.title}</h2>
                        <p className="text-[8px] font-black uppercase opacity-100 tracking-[0.2em]">Intelligence Briefing Matrix</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedSummary(null)}
                      className="p-1.5 hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
                    >
                      <X size={16} />
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
                       <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary text-background shadow-xl">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Admin Matrix Control</h1>
            <p className="text-[10px] font-black uppercase opacity-100 tracking-[0.3em]">System Configuration & Neural Keys</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportKnowledgeBase}
            className="p-3 border-2 border-secondary text-secondary font-black uppercase text-[10px] tracking-widest hover:bg-secondary hover:text-background transition-all flex items-center gap-2"
          >
            <Download size={14} /> Export Backup
          </button>
          <button 
            onClick={saveConfig}
            disabled={isSaving}
            className="p-3 bg-secondary text-background font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-100"
          >
            {isSaving ? 'Syncing...' : 'Synchronize Matrix'}
          </button>
          <Tooltip content="Sign Out: Terminate the current local and neural session.">
            <button 
              onClick={onLogout}
              className="p-3 border-2 border-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-background transition-all"
            >
              De-Authenticate
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Keys Configuration */}
        <div className="border-2 p-6 space-y-6" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
          <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
            <Zap size={20} className="text-primary" />
            Neural Key Matrix
          </h2>
          <div className="space-y-4">
            {possibleKeys.map((key) => {
              const baseKey = key.replace('_API_KEY', '');
              const envLoaded = config?.keys[baseKey] || config?.keys[key];
              const firestoreLoaded = !!editingKeys[key];
              
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-100">{key}</label>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", envLoaded || firestoreLoaded ? "bg-secondary shadow-[0_0_10px_var(--secondary)]" : "bg-red-500")} />
                      <span className="text-[7px] font-black uppercase opacity-100">
                        {envLoaded ? 'ENV LOADED' : firestoreLoaded ? 'FIRESTORE OVERRIDE' : 'MISSING'}
                      </span>
                    </div>
                  </div>
                  <input 
                    type="password"
                    value={editingKeys[key] || ''}
                    onChange={(e) => setEditingKeys({ ...editingKeys, [key]: e.target.value })}
                    className="w-full p-2.5 border-2 bg-transparent outline-none font-mono text-[10px] focus:border-primary transition-colors"
                    style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}
                    placeholder={envLoaded ? "•••••••• (Using Environment Variable)" : "Enter API Key"}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Knowledge Bases */}
        <div className="border-2 p-6 space-y-6" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
              <Database size={20} className="text-primary" />
              Knowledge Base
            </h2>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                id="kb-upload" 
                className="hidden" 
                onChange={handleKBFileUpload}
                accept=".txt,.pdf,.json,.jsonl,.md,.html"
              />
              <button 
                onClick={() => document.getElementById('kb-upload')?.click()}
                className="p-2 bg-primary text-background font-black uppercase text-[9px] tracking-widest shadow-lg flex items-center gap-2"
              >
                <Upload size={12} /> Upload Node
              </button>
              <button 
                onClick={() => {
                  const name = prompt("Enter Link Title:");
                  const url = prompt("Enter URL:");
                  if (name && url) {
                    setKnowledgeBases([...knowledgeBases, { id: Date.now().toString(), name, url, type: 'link', createdAt: new Date().toISOString() }]);
                  }
                }}
                className="p-2 border-2 border-primary text-primary font-black uppercase text-[9px] tracking-widest flex items-center gap-2"
              >
                <Link size={12} /> Add Link
              </button>
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
            {knowledgeBases.map((kb) => (
              <div key={kb.id} className="p-4 border-2 flex items-center justify-between group hover:border-primary transition-all" style={{ borderColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-primary/5 text-primary">
                    {kb.type === 'pdf' ? <FileText size={16} /> : 
                     kb.type === 'link' ? <Link size={16} /> :
                     kb.type?.includes('json') ? <FileJson size={16} /> :
                     <FileCode size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[10px] font-black uppercase tracking-widest truncate">{kb.name}</h3>
                    <p className="text-[8px] opacity-100 uppercase">{kb.type} • {(kb.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {kb.content && (
                    <button 
                      onClick={() => setPreviewContent(kb)}
                      className="p-2 text-primary hover:bg-primary/10 transition-all"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setKnowledgeBases(knowledgeBases.filter(k => k.id !== kb.id))}
                    className="p-2 text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {knowledgeBases.length === 0 && (
              <div className="p-10 text-center border-2 border-dashed opacity-20 font-black uppercase text-[10px]">
                No Custom Knowledge Nodes
              </div>
            )}
          </div>
        </div>

        {/* Skills & Instructions */}
        <div className="lg:col-span-2 border-2 p-6 space-y-6" style={{ borderColor: 'rgba(var(--primary-rgb), 0.1)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
              <Wrench size={20} className="text-primary" />
              Neural Skills & Instructions
            </h2>
            <button 
              onClick={() => {
                const name = prompt("Skill Name:");
                const instruction = prompt("System Instruction:");
                if (name && instruction) {
                  setSkills([...skills, { id: Date.now().toString(), name, instruction, active: true }]);
                }
              }}
              className="p-2 bg-secondary text-background font-black uppercase text-[9px] tracking-widest shadow-lg"
            >
              Add Skill
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map((skill) => (
              <div key={skill.id} className="p-4 border-2 space-y-3 group hover:border-secondary transition-all" style={{ borderColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-secondary">{skill.name}</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSkills(skills.map(s => s.id === skill.id ? { ...s, active: !s.active } : s))}
                      className={cn("w-8 h-4 rounded-full relative transition-all")}
                      style={{ backgroundColor: skill.active ? 'var(--secondary)' : 'rgba(var(--text-rgb), 0.2)' }}
                    >
                      <div className={cn("absolute top-1 w-2 h-2 rounded-full transition-all", skill.active ? "right-1" : "left-1")} style={{ backgroundColor: 'var(--background)' }} />
                    </button>
                    <button 
                      onClick={() => setSkills(skills.filter(s => s.id !== skill.id))}
                      className="p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] font-black uppercase opacity-100 line-clamp-2">{skill.instruction}</p>
              </div>
            ))}
            {skills.length === 0 && (
              <div className="col-span-full p-10 text-center border-2 border-dashed opacity-20 font-black uppercase text-[10px]">
                No Custom Neural Skills Defined
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewContent && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl border-4 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--primary)' }}
            >
              <div className="p-4 border-b-2 flex items-center justify-between" style={{ borderColor: 'var(--primary)' }}>
                <h3 className="text-sm font-black uppercase tracking-widest">{previewContent.name}</h3>
                <button onClick={() => setPreviewContent(null)}><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs whitespace-pre-wrap custom-scrollbar">
                {previewContent.content}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


