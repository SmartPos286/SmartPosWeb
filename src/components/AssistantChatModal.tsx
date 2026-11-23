import React, { useEffect, useRef, useState } from 'react';
import { Bot, Camera, CheckCircle2, Loader2, Mic, MicOff, Send, Trash2, Volume2, X } from 'lucide-react';
import { usePos } from '../context/PosContext';

const QUICK_CHIPS = [
  '¿Cómo van las ventas hoy?',
  '¿Qué productos tienen stock bajo?',
  'Resumen de cuentas por cobrar',
  'Cambia tasa BCV a 55.20',
];

export const AssistantChatModal: React.FC = () => {
  const {
    isAssistantOpen,
    setIsAssistantOpen,
    setIsOcrModalOpen,
    assistantMessages,
    isAssistantLoading,
    sendAssistantMessage,
    executeAssistantAction,
    clearAssistantMessages,
  } = usePos();

  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages, isAssistantLoading]);

  useEffect(() => {
    if (!voiceOutput || assistantMessages.length === 0) return;
    const last = assistantMessages[assistantMessages.length - 1];
    if (last.role === 'assistant' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(last.text.replace(/\*\*/g, ''));
      utter.lang = 'es-VE';
      window.speechSynthesis.speak(utter);
    }
  }, [assistantMessages, voiceOutput]);

  if (!isAssistantOpen) return null;

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isAssistantLoading) return;
    if (!textOverride) setInput('');
    await sendAssistantMessage(text);
  };

  const toggleDictation = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = 'es-VE';
    rec.interimResults = false;
    setIsListening(true);
    rec.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput(transcript);
      }
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-indigo-500/40 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 px-5 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Asistente Oli • SmartPOS286</h3>
              <p className="text-xs text-white/80">Inteligencia comercial en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVoiceOutput((v) => !v)}
              title="Lectura por voz"
              className={`rounded-xl p-2 ${voiceOutput ? 'bg-emerald-500 text-white' : 'bg-white/15 hover:bg-white/25'}`}
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAssistantOpen(false);
                setIsOcrModalOpen(true);
              }}
              title="Escanear Factura Compra OCR"
              className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={clearAssistantMessages}
              title="Limpiar chat"
              className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsAssistantOpen(false)}
              className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-[#17284A]/60">
          {assistantMessages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                    isUser
                      ? 'rounded-br-sm bg-indigo-600 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-[#283A5A] dark:text-slate-100'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.webSources && msg.webSources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">Fuentes web:</span>
                    {msg.webSources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-600 hover:underline dark:text-sky-300"
                      >
                        {src.title}
                      </a>
                    ))}
                  </div>
                )}
                {msg.pendingAction && (
                  <button
                    type="button"
                    onClick={() => executeAssistantAction(msg.id, msg.pendingAction!)}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {msg.pendingAction.label}
                  </button>
                )}
              </div>
            );
          })}
          {isAssistantLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>Oli está analizando tu comercio...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick suggestions */}
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-[#1E2D48]">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              className="shrink-0 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/20 dark:text-sky-300"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#1E2D48]"
        >
          <button
            type="button"
            onClick={toggleDictation}
            title="Dictar por voz"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              isListening
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a Oli sobre ventas, inventario o tasas..."
            className="h-10 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAssistantLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
