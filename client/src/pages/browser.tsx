import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/ThemeProvider";
import { NovaBrowserLogo } from "@/components/NovaBrowserLogo";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Globe,
  MessageSquare,
  Sun,
  Moon,
  Plus,
  Trash2,
  Send,
  Loader2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Wifi,
  WifiOff,
  PanelLeftOpen,
  PanelLeftClose,
  X,
} from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

type InputMode = "chat" | "search" | "url";

interface StreamingMessage {
  content: string;
  done: boolean;
}

export default function BrowserPage() {
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("chat");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Fetch messages for active conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConvId, "messages"],
    queryFn: () => apiRequest("GET", `/api/conversations/${activeConvId}/messages`).then(r => r.json()),
    enabled: !!activeConvId,
  });

  // Ollama status
  const { data: ollamaStatus } = useQuery<{ connected: boolean; models: string[] }>({
    queryKey: ["/api/ollama/status"],
    refetchInterval: 30000,
  });

  // Create conversation
  const createConv = useMutation({
    mutationFn: () => apiRequest("POST", "/api/conversations", { title: "New Chat" }).then(r => r.json()),
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConvId(conv.id);
    },
  });

  // Delete conversation
  const deleteConv = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (conversations.length <= 1) {
        setActiveConvId(null);
      } else {
        const remaining = conversations.filter(c => c.id !== activeConvId);
        setActiveConvId(remaining[0]?.id || null);
      }
    },
  });

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  // Send message with streaming
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    let convId = activeConvId;

    // Create conversation if needed
    if (!convId) {
      const resp = await apiRequest("POST", "/api/conversations", {
        title: inputValue.slice(0, 50),
      });
      const conv: Conversation = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      convId = conv.id;
      setActiveConvId(conv.id);

      // Also update title
      await apiRequest("PATCH", `/api/conversations/${conv.id}`, {
        title: inputValue.slice(0, 50) + (inputValue.length > 50 ? "..." : ""),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: userMessage,
          mode: inputMode,
          model: "qwen2.5-coder:7b",
        }),
      });

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: StreamingMessage = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setStreamingContent("An error occurred. Please check that Ollama is running and try again.");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", convId, "messages"] });
    }
  }, [inputValue, isStreaming, activeConvId, inputMode, queryClient]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModePlaceholder = () => {
    switch (inputMode) {
      case "search": return "Search the web...";
      case "url": return "Enter a URL to analyze...";
      default: return "Ask NovaBrowser anything...";
    }
  };

  const getModeIcon = () => {
    switch (inputMode) {
      case "search": return <Search className="w-4 h-4" />;
      case "url": return <Globe className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden" data-testid="browser-main">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? "w-64" : "w-0"} 
          flex-shrink-0 border-r border-border bg-sidebar 
          transition-all duration-200 ease-out overflow-hidden
        `}
        data-testid="sidebar"
      >
        <div className="w-64 h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="h-12 flex items-center px-3 gap-2 border-b border-border flex-shrink-0">
            <NovaBrowserLogo size={22} />
            <span className="font-semibold text-sm tracking-tight">NovaBrowser</span>
          </div>

          {/* New Chat Button */}
          <div className="p-2">
            <button
              onClick={() => {
                setActiveConvId(null);
                setInputValue("");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              data-testid="button-new-chat"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`
                  group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer
                  transition-colors duration-100
                  ${activeConvId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                  }
                `}
                onClick={() => setActiveConvId(conv.id)}
                data-testid={`conv-item-${conv.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv.mutate(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5"
                  data-testid={`button-delete-conv-${conv.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Footer - Ollama Status */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {ollamaStatus?.connected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
                  <Wifi className="w-3 h-3" />
                  <span>Ollama connected</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500 pulse-dot" />
                  <WifiOff className="w-3 h-3" />
                  <span>Demo mode</span>
                </>
              )}
            </div>
          </div>

          <PerplexityAttribution />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Browser-like toolbar */}
        <header className="h-12 flex items-center px-2 gap-1 border-b border-border bg-card flex-shrink-0">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Navigation Buttons */}
          <button className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground" data-testid="button-forward">
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Address Bar / Mode Indicator */}
          <div className="flex-1 mx-2">
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm">
              <div className="flex items-center gap-1 text-primary">
                {getModeIcon()}
              </div>
              <span className="text-muted-foreground truncate">
                {inputMode === "search" ? "nova://search" : inputMode === "url" ? "nova://browse" : "nova://chat"}
                {activeConvId ? ` — ${conversations.find(c => c.id === activeConvId)?.title || ""}` : ""}
              </span>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {!activeConvId && messages.length === 0 && !isStreaming ? (
            <WelcomeScreen inputMode={inputMode} setInputMode={setInputMode} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && streamingContent && (
                <div className="message-appear">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-muted-foreground mb-1">NovaBrowser AI</div>
                      <div className="prose-nova text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingContent}
                        </ReactMarkdown>
                        <span className="typing-cursor" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isStreaming && !streamingContent && (
                <div className="message-appear flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {inputMode === "search" ? "Searching the web..." : inputMode === "url" ? "Analyzing page..." : "Thinking..."}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 mb-2">
              {(["chat", "search", "url"] as InputMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                    transition-colors duration-100
                    ${inputMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }
                  `}
                  data-testid={`button-mode-${mode}`}
                >
                  {mode === "chat" && <MessageSquare className="w-3 h-3" />}
                  {mode === "search" && <Search className="w-3 h-3" />}
                  {mode === "url" && <Globe className="w-3 h-3" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="relative flex items-end gap-2 bg-background border border-border rounded-xl px-4 py-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={getModePlaceholder()}
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-40"
                data-testid="input-message"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                className={`
                  p-2 rounded-lg transition-all flex-shrink-0
                  ${inputValue.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "text-muted-foreground opacity-40 cursor-not-allowed"
                  }
                `}
                data-testid="button-send"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              NovaBrowser uses Ollama (qwen2.5-coder:7b) for AI responses. Results may not always be accurate.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============ Sub-components ============

function WelcomeScreen({
  inputMode,
  setInputMode,
}: {
  inputMode: InputMode;
  setInputMode: (m: InputMode) => void;
}) {
  const suggestions = [
    { mode: "chat" as InputMode, icon: <MessageSquare className="w-5 h-5" />, title: "Chat with AI", desc: "Ask questions, get explanations, brainstorm ideas", example: "Explain quantum computing simply" },
    { mode: "search" as InputMode, icon: <Search className="w-5 h-5" />, title: "Search the Web", desc: "Search and get AI-summarized results", example: "Latest developments in AI 2026" },
    { mode: "url" as InputMode, icon: <Globe className="w-5 h-5" />, title: "Analyze a URL", desc: "Paste a URL to get an AI summary of the page", example: "github.com/ollama/ollama" },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <NovaBrowserLogo size={48} />
        </div>
        <h1 className="text-xl font-semibold mb-1">Welcome to NovaBrowser</h1>
        <p className="text-sm text-muted-foreground">AI-powered browsing with Ollama</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {suggestions.map((s) => (
          <button
            key={s.mode}
            onClick={() => setInputMode(s.mode)}
            className={`
              text-left p-4 rounded-xl border transition-all duration-150
              ${inputMode === s.mode
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-primary/20 hover:bg-accent/50"
              }
            `}
            data-testid={`welcome-card-${s.mode}`}
          >
            <div className={`mb-2 ${inputMode === s.mode ? "text-primary" : "text-muted-foreground"}`}>
              {s.icon}
            </div>
            <div className="font-medium text-sm mb-1">{s.title}</div>
            <div className="text-xs text-muted-foreground mb-2">{s.desc}</div>
            <div className="flex items-center gap-1 text-xs text-primary/70">
              <ChevronRight className="w-3 h-3" />
              <span className="italic truncate">{s.example}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className="message-appear">
      <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <div className={`
          w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
          ${isUser ? "bg-primary text-primary-foreground" : "bg-primary/10"}
        `}>
          {isUser ? (
            <span className="text-xs font-bold">U</span>
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {isUser ? "You" : "NovaBrowser AI"}
          </div>

          {isUser ? (
            <div className="inline-block text-left bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[85%]">
              {message.content}
            </div>
          ) : (
            <div className="prose-nova text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Sources */}
          {message.sources && (message.sources as any[]).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(message.sources as { title: string; url: string }[]).map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground rounded-md px-2 py-1 transition-colors"
                  data-testid={`source-link-${i}`}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">{source.title || source.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
