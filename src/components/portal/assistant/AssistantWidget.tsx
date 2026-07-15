"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  Bot,
  History,
  LifeBuoy,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  SquarePen,
  Volume2,
  X,
} from "lucide-react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { renderMarkdown } from "./markdown";

type AssistantStatus = {
  available: boolean;
  assistantName: string;
  message?: string;
  historyEnabled: boolean;
  maxMessageLength: number;
  supportContact: string | null;
  voiceEnabled?: boolean;
  sttEnabled?: boolean;
  escalationEnabled?: boolean;
  welcomeMessage?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
};

type ConversationSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};

type View = "chat" | "history";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `local-${Date.now()}-${idCounter}`;
}

export function AssistantWidget({ studentName }: { studentName: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null
  );
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const statusFetched = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = messagesRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!open || statusFetched.current) return;
    statusFetched.current = true;
    setStatusLoading(true);

    fetch("/api/portal/ai/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("status");
        return (await res.json()) as AssistantStatus;
      })
      .then(setStatus)
      .catch(() => {
        setStatus({
          available: false,
          assistantName: "AI Assistant",
          message:
            "The AI Assistant is not available right now. Please try again later.",
          historyEnabled: false,
          maxMessageLength: 0,
          supportContact: null,
        });
      })
      .finally(() => setStatusLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    composerRef.current?.focus();

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, view]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const supabase = createSupabaseAuthClient();
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, title, updated_at")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(15);
      setConversations((data ?? []) as ConversationSummary[]);
    } catch {
      setConversations([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      setView("chat");
      setConversationId(id);
      setMessages([]);
      setError(null);
      try {
        const supabase = createSupabaseAuthClient();
        const { data } = await supabase
          .from("ai_messages")
          .select("id, role, content")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true })
          .limit(60);
        setMessages(
          (
            (data ?? []) as {
              id: string;
              role: "user" | "assistant";
              content: string;
            }[]
          ).map((m) => ({ id: m.id, role: m.role, content: m.content }))
        );
        scrollToEnd();
      } catch {
        setError("We couldn't load this conversation.");
      }
    },
    [scrollToEnd]
  );

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLastFailedMessage(null);
    setView("chat");
    composerRef.current?.focus();
  }

  const speakText = useCallback(
    async (messageId: string, text: string) => {
      if (!status?.voiceEnabled || voiceBusy) return;
      setVoiceBusy(true);
      setSpeakingId(messageId);
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const res = await fetch("/api/portal/ai/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          setError("Voice playback is temporarily unavailable.");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setSpeakingId(null);
          setVoiceBusy(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setSpeakingId(null);
          setVoiceBusy(false);
        };
        await audio.play();
      } catch {
        setError("Voice playback failed.");
        setSpeakingId(null);
        setVoiceBusy(false);
      }
    },
    [status?.voiceEnabled, voiceBusy]
  );

  const sendMessage = useCallback(
    async (text: string, opts?: { escalate?: boolean }) => {
      const message = text.trim();
      if ((!message && !opts?.escalate) || sending || !status?.available) return;

      setSending(true);
      setError(null);
      setLastFailedMessage(null);
      if (!opts?.escalate) setDraft("");
      if (message) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "user", content: message },
        ]);
      }
      scrollToEnd();

      try {
        const res = await fetch("/api/portal/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: message || "I need help from a human support agent.",
            escalate: opts?.escalate === true,
          }),
        });
        const data = (await res.json()) as
          | {
              ok: true;
              conversationId: string | null;
              reply: string;
              voiceAvailable?: boolean;
              escalated?: boolean;
              referenceCode?: string;
            }
          | { ok: false; code: string; message: string };

        if (!data.ok) {
          setError(data.message);
          setLastFailedMessage(message || null);
          if (message) setMessages((prev) => prev.slice(0, -1));
          if (message) setDraft(message);
          return;
        }

        setConversationId(data.conversationId);
        const assistantId = nextId();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: data.reply },
        ]);
        scrollToEnd();

        if (status.voiceEnabled && data.voiceAvailable !== false && !data.escalated) {
          void speakText(assistantId, data.reply);
        }
      } catch {
        setError("We couldn't get an answer right now. Please try again.");
        setLastFailedMessage(message || null);
        if (message) {
          setMessages((prev) => prev.slice(0, -1));
          setDraft(message);
        }
      } finally {
        setSending(false);
      }
    },
    [conversationId, scrollToEnd, sending, speakText, status]
  );

  function toggleListening() {
    if (!status?.sttEnabled) return;

    const SpeechRecognitionCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError(
        "Voice input is not supported in this browser. Please type your message."
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionLike;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-PH";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setDraft(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Could not capture voice input. Please try again or type.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("Could not start voice input.");
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  const assistantName = status?.assistantName ?? "AI Assistant";
  const maxLength =
    status?.available && status.maxMessageLength > 0
      ? status.maxMessageLength
      : 4000;
  const welcome =
    status?.welcomeMessage?.trim() ||
    `Hi ${studentName.split(" ")[0]}! Ask me about your courses, lessons, schedules, announcements, or anything you're learning.`;

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          className="pt-chat-panel"
          role="dialog"
          aria-label={assistantName}
        >
          <div className="pt-chat-header">
            <span className="pt-chat-avatar" aria-hidden="true">
              <Bot size={18} />
            </span>
            <div className="pt-chat-title">
              <strong>{assistantName}</strong>
              <span>
                {statusLoading
                  ? "Checking availability…"
                  : status?.available
                    ? status.voiceEnabled
                      ? "Online · text & voice"
                      : "Online · answers about your courses"
                    : "Unavailable"}
              </span>
            </div>
            <div className="pt-chat-actions">
              {status?.available && status.historyEnabled ? (
                <>
                  <button
                    type="button"
                    className="pt-icon-btn"
                    aria-label="Conversation history"
                    onClick={() => {
                      if (view === "history") {
                        setView("chat");
                      } else {
                        setView("history");
                        void loadConversations();
                      }
                    }}
                  >
                    <History size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="pt-icon-btn"
                    aria-label="New conversation"
                    onClick={startNewConversation}
                  >
                    <SquarePen size={16} aria-hidden="true" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="pt-icon-btn"
                aria-label="Close assistant"
                onClick={() => {
                  setOpen(false);
                  launcherRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {statusLoading ? (
            <div className="pt-chat-body pt-chat-center">
              <p className="pt-chat-note">Connecting…</p>
            </div>
          ) : !status?.available ? (
            <div className="pt-chat-body pt-chat-center">
              <Bot size={26} aria-hidden="true" />
              <p className="pt-chat-note">{status?.message}</p>
              <Link
                href="/portal/support"
                className="pt-btn pt-btn-ghost pt-btn-sm"
                onClick={() => setOpen(false)}
              >
                <LifeBuoy size={14} aria-hidden="true" />
                Contact support
              </Link>
            </div>
          ) : view === "history" ? (
            <div className="pt-chat-body">
              <h3 className="pt-chat-subhead">Recent conversations</h3>
              {historyLoading ? (
                <p className="pt-chat-note">Loading…</p>
              ) : conversations.length === 0 ? (
                <p className="pt-chat-note">
                  Start a conversation with your AIvanza Academy Assistant.
                </p>
              ) : (
                <ul className="pt-chat-history">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => void openConversation(c.id)}
                        data-active={c.id === conversationId ? "true" : "false"}
                      >
                        {c.title?.trim() || "Untitled conversation"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div
              className="pt-chat-body pt-chat-messages"
              ref={messagesRef}
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="pt-chat-welcome">
                  <Bot size={24} aria-hidden="true" />
                  <p>{welcome}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="pt-chat-bubble"
                    data-role={m.role}
                  >
                    {m.role === "assistant" ? (
                      <>
                        <div className="pt-chat-md">
                          {renderMarkdown(m.content)}
                        </div>
                        {status.voiceEnabled ? (
                          <button
                            type="button"
                            className="pt-icon-btn pt-chat-speak"
                            aria-label={
                              speakingId === m.id
                                ? "Speaking"
                                : "Play voice response"
                            }
                            disabled={voiceBusy && speakingId !== m.id}
                            onClick={() => void speakText(m.id, m.content)}
                          >
                            <Volume2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </>
                    ) : (
                      m.content
                    )}
                  </div>
                ))
              )}
              {sending ? (
                <div
                  className="pt-chat-bubble pt-chat-thinking"
                  data-role="assistant"
                >
                  <span className="pt-typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="pt-visually-hidden">
                    The assistant is thinking
                  </span>
                </div>
              ) : null}
              {error ? (
                <div className="pt-chat-error" role="alert">
                  <p>{error}</p>
                  {lastFailedMessage ? (
                    <button
                      type="button"
                      className="pt-btn pt-btn-ghost pt-btn-xs"
                      onClick={() => void sendMessage(lastFailedMessage)}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {status?.available && view === "chat" ? (
            <>
              {status.escalationEnabled ? (
                <div className="pt-chat-escalate">
                  <button
                    type="button"
                    className="pt-btn pt-btn-ghost pt-btn-xs"
                    disabled={sending}
                    onClick={() =>
                      void sendMessage(draft || "", { escalate: true })
                    }
                  >
                    <LifeBuoy size={13} aria-hidden="true" />
                    Talk to human support
                  </button>
                </div>
              ) : null}
              <form
                className="pt-chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage(draft);
                }}
              >
                {status.sttEnabled ? (
                  <button
                    type="button"
                    className="pt-icon-btn"
                    aria-label={listening ? "Stop listening" : "Voice input"}
                    aria-pressed={listening}
                    onClick={toggleListening}
                    disabled={sending}
                  >
                    {listening ? (
                      <MicOff size={16} aria-hidden="true" />
                    ) : (
                      <Mic size={16} aria-hidden="true" />
                    )}
                  </button>
                ) : null}
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={
                    listening
                      ? "Listening…"
                      : "Ask about your courses, schedule, or lessons…"
                  }
                  aria-label="Message the assistant"
                  rows={1}
                  maxLength={maxLength}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="pt-chat-send"
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  <Send size={16} aria-hidden="true" />
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        className="pt-chat-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
      >
        <Bot size={19} aria-hidden="true" />
        <span className="pt-chat-launcher-label">AI Assistant</span>
      </button>
    </>
  );
}
