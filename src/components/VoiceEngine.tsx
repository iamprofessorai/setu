import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, X, Activity, Zap, Shield, AlertCircle, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLiveSession } from '../services/gemini';
import VAD from '../lib/vad';

interface VoiceEngineProps {
  onClose: () => void;
}

const VoiceEngine: React.FC<VoiceEngineProps> = ({ onClose }) => {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState<'standby' | 'listening' | 'responding' | 'error'>('standby');
  const [volume, setVolume] = useState(0);
  const [smoothedVolume, setSmoothedVolume] = useState(0);
  const [freqData, setFreqData] = useState<Uint8Array>(new Uint8Array(32).fill(0));
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);

  const socketRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vadRef = useRef<VAD | null>(null);

  const cleanup = () => {
    setIsLive(false);
    setStatus('standby');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    socketRef.current = null;
    audioQueue.current = [];
    isPlayingRef.current = false;
  };

  const playNextInQueue = async () => {
    if (audioQueue.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      if (audioQueue.current.length === 0) setStatus('listening');
      return;
    }

    isPlayingRef.current = true;
    setStatus('responding');
    
    const pcmData = audioQueue.current.shift()!;
    const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 16000);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }
    
    const source = audioContextRef.current.createBufferSource();
    currentSourceRef.current = source;
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      currentSourceRef.current = null;
      playNextInQueue();
    };
    
    source.start();
  };

  const handleInterrupt = () => {
    if (status === 'responding') {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current = null;
      }
      audioQueue.current = [];
      isPlayingRef.current = false;
      setStatus('listening');
      
      // Notify backend of interruption
      if (socketRef.current) {
        socketRef.current.sendRealtimeInput({
          interrupt: true
        });
      }
    }
  };

  const toggleLiveSession = async () => {
    if (!isLive) {
      try {
        setStatus('standby');
        
        // Initialize VAD if not already
        if (!vadRef.current) {
          vadRef.current = new VAD();
          await vadRef.current.init();
        }

        const sessionPromise = getLiveSession({
          onopen: () => {
            setIsLive(true);
            setStatus('listening');
          },
          onmessage: (message: any) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Data = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binary = atob(base64Data);
              const pcmData = new Int16Array(new ArrayBuffer(binary.length));
              const view = new Uint8Array(pcmData.buffer);
              for (let i = 0; i < binary.length; i++) {
                view[i] = binary.charCodeAt(i);
              }
              audioQueue.current.push(pcmData);
              playNextInQueue();
            }
            if (message.serverContent?.interrupted) {
              audioQueue.current = [];
              isPlayingRef.current = false;
              if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current = null;
              }
            }
          },
          onclose: () => cleanup(),
          onerror: (err: any) => {
            console.error("Voice Engine Error:", err);
            setStatus('error');
            cleanup();
          }
        });

        socketRef.current = await sessionPromise;

        // Setup Microhone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        await audioContextRef.current.resume();

        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Setup Analyser for Visuals
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        
        // Use ScriptProcessor for VAD and PCM capture
        const processor = audioContextRef.current.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        let vadCooldown = 0;

        processor.onaudioprocess = async (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Visual Frequency Data
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          setFreqData(new Uint8Array(dataArray));

          // Simple Volume Meter for direct scaling
          let sum = 0;
          for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
          const curVol = Math.sqrt(sum / inputData.length);
          setVolume(curVol);
          setSmoothedVolume(prev => prev * 0.7 + curVol * 0.3);

          // VAD Logic
          if (vadRef.current) {
            const prob = await vadRef.current.process(new Float32Array(inputData));
            const isSpeech = prob > 0.65;
            setIsSpeechDetected(isSpeech);

            if (isSpeech) {
              vadCooldown = 15; // Stability frames
              // If user starts speaking during response, interrupt
              if (status === 'responding') {
                handleInterrupt();
              }
            } else {
              vadCooldown = Math.max(0, vadCooldown - 1);
            }

            // Only send if speech is active or coasting through cooldown
            if (isSpeech || vadCooldown > 0) {
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              if (socketRef.current) {
                socketRef.current.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            }
          }
        };

        source.connect(analyser);
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

      } catch (err) {
        console.error("Failed to start voice stream:", err);
        setStatus('error');
      }
    } else {
      cleanup();
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const mandalaPoints = Array.from({ length: 8 });

  return (
    <div className="relative w-full h-[600px] md:h-[750px] bg-[#0c0c0e] text-white rounded-none shadow-3xl border-4 border-primary/20 overflow-hidden flex flex-col font-sans mb-8">
      {/* Cyber-Vedic Ambient Grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ background: 'linear-gradient(rgba(255,153,51,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,153,51,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className={cn(
        "absolute inset-0 transition-opacity duration-1000 pointer-events-none opacity-40",
        isLive ? "bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.15),transparent_70%)]" : ""
      )} />

      {/* Header Controls */}
      <div className="relative z-10 flex justify-between items-center w-full px-8 py-6 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-3 w-3 rounded-none transition-all duration-300",
            status === 'listening' ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]" :
            status === 'responding' ? "bg-primary animate-bounce shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)]" :
            status === 'error' ? "bg-rose-500 shadow-[0_0_12px_#f43f5e]" : "bg-white/10"
          )} />
          <div className="flex flex-col">
            <span className="text-[12px] font-black uppercase tracking-[0.2em]">
              {status === 'listening' ? 'NEURAL LISTENING' : 
               status === 'responding' ? 'CORE TRANSMITTING' :
               status === 'error' ? 'BRIDGE FAILURE' : 'SYSTEM STANDBY'}
            </span>
            <span className="text-[8px] font-bold opacity-40 uppercase tracking-widest">
              {isSpeechDetected ? 'Vocal Signal Detected' : 'VAD Monitor Active'}
            </span>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-3 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition-all active:scale-95 border border-transparent hover:border-white/10"
        >
          <X size={20} />
        </button>
      </div>

      {/* Central Pulsing Mandala */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center py-12">
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
          {/* Signal Amplitude Meter Ring */}
          <div className="absolute inset-[-20px] pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full rotate-[-90deg]">
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
                strokeDasharray="1 3"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="1 2"
                animate={{ 
                  strokeDashoffset: isLive ? (301.59 - (smoothedVolume * 500)) : 301.59,
                  opacity: isLive ? [0.2, 0.4, 0.2] : 0
                }}
                style={{ strokeDasharray: "301.59" }}
              />
            </svg>
          </div>

          {/* Static Background Pattern */}
          <div className="absolute inset-0 opacity-10 scale-150 pointer-events-none">
             <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_60s_linear_infinite]">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                <path d="M50 5 L50 95 M5 50 L95 50" stroke="currentColor" strokeWidth="0.2" />
             </svg>
          </div>

          {/* Dynamic Mandala Rings */}
          <AnimatePresence>
            {mandalaPoints.map((_, i) => (
              <motion.div
                key={i}
                className="absolute border border-primary/20 rounded-[35%] w-full h-full"
                animate={{ 
                  rotate: [i * 45, i * 45 + 360],
                  scale: isLive ? [1, 1 + (freqData[i % 32] / 500) + (volume * 0.5), 1] : 1,
                  borderColor: isLive ? `rgba(var(--primary-rgb), ${0.1 + (freqData[i % 32] / 255)})` : 'rgba(255,255,255,0.1)'
                }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 15 + i * 5, ease: "linear" },
                  scale: { duration: 0.1 }
                }}
                style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 40%' }}
              />
            ))}
          </AnimatePresence>

          {/* Central Core */}
          <motion.div 
            animate={{ 
              scale: isLive ? [1, 1.1 + (smoothedVolume * 2), 1] : 1,
              boxShadow: isLive ? `0 0 ${80 + smoothedVolume * 1000}px rgba(var(--${status === 'responding' ? 'secondary' : status === 'error' ? 'primary' : 'primary'}-rgb), ${0.4 + smoothedVolume})` : 'none',
              backgroundColor: status === 'responding' ? 'rgba(var(--secondary-rgb), 1)' : 
                               isSpeechDetected ? 'rgba(16, 185, 129, 0.95)' : 'rgba(var(--primary-rgb), 0.8)',
              borderColor: status === 'responding' ? 'var(--secondary)' : 
                           status === 'error' ? '#f43f5e' : 
                           isSpeechDetected ? '#10b981' : 'rgba(255,255,255,0.4)'
            }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={cn(
              "relative z-20 flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-none transition-all duration-700 border-4",
              isLive 
                ? "text-white shadow-2xl shadow-primary/20" 
                : "bg-white/5 border border-white/10 opacity-50"
            )}
          >
            {status === 'responding' ? (
              <Activity className="animate-pulse" size={40} />
            ) : isSpeechDetected ? (
              <motion.div animate={{ scale: [1, 1.2 + volume * 2, 1] }} transition={{ duration: 0.1 }}>
                 <Mic size={40} />
              </motion.div>
            ) : (
              <Volume2 size={40} />
            )}

            {/* Subtle Speech Activity Ripple */}
            {isSpeechDetected && (
              <motion.div 
                className="absolute inset-0 rounded-full bg-emerald-500/20"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </motion.div>
        </div>

        <div className="mt-12 text-center max-w-sm space-y-4 px-6 relative z-30">
          <motion.h3 
            className="text-2xl font-black uppercase tracking-tight"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            {status === 'responding' ? "ENVIRONMENT SYNTHESIS" : 
             status === 'listening' ? "AWAITING DIRECTIVE" : "VOICE ARCHITECTURE"}
          </motion.h3>
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-bold text-primary tracking-[0.3em] uppercase">Setu Neural Edge</p>
            <p className="text-[11px] font-medium text-white/40 leading-relaxed max-w-[280px] mx-auto italic">
              {isLive ? "High-fidelity audio stream engaged. Interruption handling and VAD protocol authorized." : "Initialize secure audio bridge for real-time trade intelligence synthesis."}
            </p>
          </div>
        </div>
      </div>

      {/* Error Overlay */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="p-6 bg-rose-500/20 rounded-none mb-6 border-4 border-rose-500/50">
              <AlertCircle size={48} className="text-rose-500 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Neural Bridge Failure</h2>
            <p className="text-rose-200/60 text-sm font-medium leading-relaxed max-w-sm mb-12 italic">
              Critical interruption detected in audio synthesis relay. Protocol re-initialization required.
            </p>
            <button 
              onClick={() => {
                cleanup();
                toggleLiveSession();
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-none font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
            >
              Re-establish Bridge
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Module */}
      <div className="relative z-20 w-full flex flex-col items-center gap-10 mt-auto pb-12">
        <div className="flex items-center gap-12">
          <div className="flex flex-col items-center gap-2 opacity-30">
            <Shield size={20} className="text-secondary" />
            <span className="text-[9px] font-black tracking-widest uppercase">SSL SECURE</span>
          </div>

          <button 
            onClick={toggleLiveSession}
            className={cn(
              "relative group w-28 h-28 rounded-none transition-all duration-500 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center active:scale-95 border-4",
              isLive 
                ? "bg-rose-500 border-rose-500/20 text-white" 
                : "bg-primary border-primary/20 text-white"
            )}
          >
            {isLive ? <MicOff size={36} /> : <Mic size={36} />}
            
            {/* VAD Active Indicator Dot */}
            {isLive && isSpeechDetected && (
              <motion.div 
                className="absolute top-4 right-4 w-3 h-3 bg-emerald-500 rounded-none border-2 border-white shadow-[0_0_10px_#10b981]"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              />
            )}

            {isLive && (
              <motion.div 
                className="absolute -inset-4 rounded-none border-2 border-rose-500/50"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </button>

          <div className="flex flex-col items-center gap-2 opacity-30">
            <Zap size={20} className="text-primary" />
            <span className="text-[9px] font-black tracking-widest uppercase">REAL-TIME</span>
          </div>
        </div>

        {/* Neural Activity Ribbons */}
        <div className="flex gap-1 items-end h-8">
           {Array.from({ length: 20 }).map((_, i) => (
             <motion.div
               key={i}
               className="w-1 bg-primary/40 rounded-full"
               animate={{ 
                 height: isLive ? (8 + freqData[i % 32] / 10) : 4,
                 opacity: isLive ? (0.2 + freqData[i % 32] / 255) : 0.1
               }}
             />
           ))}
        </div>

        {/* Functional Footer */}
        <div className="flex items-center gap-8 py-2 px-6 rounded-none bg-white/5 border border-white/10 backdrop-blur-md">
           <div className="flex items-center gap-2">
             <Cpu size={12} className="text-primary" />
             <span className="text-[10px] font-black tracking-widest uppercase opacity-40">Matrix Core v3.1</span>
           </div>
           <div className="h-4 w-[1px] bg-white/10" />
           <div className="flex items-center gap-2">
             <Activity size={12} className={cn(isSpeechDetected ? "text-emerald-500" : "text-white/20")} />
             <span className="text-[10px] font-black tracking-widest uppercase opacity-40">Signal Node: Active</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceEngine;
