import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";

// Simple web search using DuckDuckGo HTML (no API key needed)
async function webSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await resp.text();

    const results: { title: string; url: string; snippet: string }[] = [];
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

    const links = [...html.matchAll(linkRegex)];
    const snippets = [...html.matchAll(snippetRegex)];

    for (let i = 0; i < Math.min(links.length, 5); i++) {
      let url = links[i][1];
      // DuckDuckGo redirects URLs
      const uddg = url.match(/uddg=([^&]*)/);
      if (uddg) url = decodeURIComponent(uddg[1]);

      results.push({
        title: links[i][2].replace(/<[^>]*>/g, "").trim(),
        url: url,
        snippet: snippets[i] ? snippets[i][1].replace(/<[^>]*>/g, "").trim() : "",
      });
    }
    return results;
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

// Fetch page content for URL navigation
async function fetchPageContent(url: string): Promise<string> {
  try {
    if (!url.startsWith("http")) url = "https://" + url;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await resp.text();

    // Basic HTML to text extraction
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    return text;
  } catch (e) {
    return `Failed to fetch page: ${(e as Error).message}`;
  }
}

// Stream chat response from Ollama
async function streamOllamaChat(
  messages: { role: string; content: string }[],
  res: Response,
  model: string = "llama3"
) {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullContent += data.message.content;
            res.write(`data: ${JSON.stringify({ content: data.message.content, done: false })}\n\n`);
          }
          if (data.done) {
            res.write(`data: ${JSON.stringify({ content: "", done: true, fullContent })}\n\n`);
          }
        } catch {}
      }
    }

    res.end();
    return fullContent;
  } catch (error) {
    // If Ollama is not available, provide a simulated response
    const lastMessage = messages[messages.length - 1]?.content || "";
    const simulatedResponse = generateSimulatedResponse(lastMessage);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream word by word for realistic effect
    const words = simulatedResponse.split(" ");
    for (let i = 0; i < words.length; i++) {
      const word = (i > 0 ? " " : "") + words[i];
      res.write(`data: ${JSON.stringify({ content: word, done: false })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ content: "", done: true, fullContent: simulatedResponse })}\n\n`);
    res.end();
    return simulatedResponse;
  }
}

function generateSimulatedResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
    return "Hello! I'm NovaBrowser's AI assistant. I can help you search the web, analyze web pages, or chat about any topic. What would you like to explore today?";
  }

  if (q.includes("search") || q.includes("find") || q.includes("look up")) {
    return "I'd be happy to help you search! You can use the search mode by clicking the search icon in the input area or typing your query directly. I'll find relevant results and summarize them for you.\n\n**Tip:** For best results, use specific keywords in your search queries.";
  }

  if (q.includes("what can you do") || q.includes("help") || q.includes("features")) {
    return `## What I Can Do\n\nI'm NovaBrowser's AI assistant powered by Ollama (llama3). Here are my capabilities:\n\n- **Chat**: Ask me anything and I'll do my best to help\n- **Web Search**: I can search the web and summarize results for you\n- **URL Analysis**: Paste a URL and I'll read and analyze the page content\n- **Dark/Light Mode**: Toggle the theme using the button in the top bar\n\n### How to Use\n1. **Chat mode** (default): Just type your question\n2. **Search mode**: Click the 🔍 icon to search the web\n3. **URL mode**: Click the 🌐 icon and paste a URL to analyze\n\n*Note: For full AI capabilities, make sure Ollama is running locally with the llama3 model.*`;
  }

  return `I've received your message: "${query.slice(0, 100)}"\n\n**Note:** I'm running in demo mode because Ollama isn't connected yet. To enable full AI capabilities:\n\n1. Install Ollama from [ollama.com](https://ollama.com)\n2. Run \`ollama pull llama3\` to download the model\n3. Start Ollama with \`ollama serve\`\n4. Set the \`OLLAMA_URL\` environment variable if not using the default port\n\nOnce connected, I'll be able to provide intelligent responses, web search summaries, and page analysis!`;
}

export function registerRoutes(server: Server, app: Express) {
  // === Conversations ===
  app.get("/api/conversations", async (_req, res) => {
    const convs = await storage.getConversations();
    res.json(convs);
  });

  app.post("/api/conversations", async (req, res) => {
    const conv = await storage.createConversation(req.body);
    res.json(conv);
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    await storage.deleteConversation(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    const conv = await storage.updateConversationTitle(parseInt(req.params.id), req.body.title);
    res.json(conv);
  });

  // === Messages ===
  app.get("/api/conversations/:id/messages", async (req, res) => {
    const msgs = await storage.getMessages(parseInt(req.params.id));
    res.json(msgs);
  });

  // === Chat (with Ollama streaming) ===
  app.post("/api/chat", async (req, res) => {
    const { conversationId, message, mode, model } = req.body;

    // Save user message
    await storage.createMessage({
      conversationId,
      role: "user",
      content: message,
      sources: null,
    });

    let systemPrompt = "You are NovaBrowser AI, a helpful assistant that provides clear, well-formatted responses using Markdown.";
    let userContent = message;
    let sources: { title: string; url: string }[] | null = null;

    if (mode === "search") {
      // Web search mode
      const results = await webSearch(message);
      sources = results.map((r) => ({ title: r.title, url: r.url }));

      systemPrompt =
        "You are NovaBrowser AI. The user searched the web. Summarize the search results below in a helpful, organized way. Cite sources by number.";
      userContent = `Search query: "${message}"\n\nSearch results:\n${results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
        .join("\n\n")}`;
    } else if (mode === "url") {
      // URL analysis mode
      const pageContent = await fetchPageContent(message);
      sources = [{ title: message, url: message.startsWith("http") ? message : `https://${message}` }];

      systemPrompt =
        "You are NovaBrowser AI. The user navigated to a URL. Analyze the page content and provide a clear summary of what the page contains, its key information, and any notable details.";
      userContent = `URL: ${message}\n\nPage content:\n${pageContent}`;
    }

    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    const fullContent = await streamOllamaChat(ollamaMessages, res, model || "llama3");

    // Save assistant message after streaming
    await storage.createMessage({
      conversationId,
      role: "assistant",
      content: fullContent,
      sources,
    });
  });

  // === Ollama status check ===
  app.get("/api/ollama/status", async (_req, res) => {
    try {
      const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
      const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      const data = await resp.json() as { models: { name: string }[] };
      res.json({ connected: true, models: data.models?.map((m: { name: string }) => m.name) || [] });
    } catch {
      res.json({ connected: false, models: [] });
    }
  });

  // === Web Search API ===
  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.json([]);
    const results = await webSearch(query);
    res.json(results);
  });
}
