# NovaBrowser

An AI-powered browser application with Ollama integration for local AI-driven search, chat, and web page analysis.

![NovaBrowser](https://img.shields.io/badge/AI-Browser-blue) ![Ollama](https://img.shields.io/badge/Ollama-llama3-green) ![React](https://img.shields.io/badge/React-Vite-purple)

## Features

- **AI Chat** — Conversational AI interface with markdown rendering, powered by Ollama (qwen2.5-coder:7b)
- **Web Search** — Search the web and get AI-summarized results with source citations
- **URL Analysis** — Paste any URL to get an AI-generated summary of the page content
- **Dark/Light Theme** — Toggle between dark and light modes
- **Conversation History** — Persistent chat history with sidebar navigation
- **Streaming Responses** — Real-time streaming AI responses with typing animation
- **Browser-style UI** — Toolbar with navigation buttons, address bar, and mode indicators
- **Demo Mode** — Works without Ollama with simulated responses for testing

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui, TypeScript
- **Backend:** Express.js, Node.js
- **AI Engine:** Ollama (qwen2.5-coder:7b model)
- **Search:** DuckDuckGo HTML search (no API key required)

## Getting Started

### Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) installed and running (optional — app works in demo mode without it)

### Install Ollama (for full AI capabilities)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the qwen2.5-coder model
ollama pull qwen2.5-coder:7b

# Start Ollama server (if not already running)
ollama serve
```

### Run the App

```bash
# Clone the repo
git clone https://github.com/MOHAMEDPARVEZMAHAROOF/NovaBrowser.git
cd NovaBrowser

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |

## Usage

### Chat Mode (Default)
Type any question and NovaBrowser AI will respond with a well-formatted answer.

### Search Mode
Click the **Search** tab, enter a query, and the AI will search the web, then summarize the results with source citations.

### URL Mode
Click the **Url** tab, paste a URL, and the AI will fetch the page content and provide an analysis.

## Project Structure

```
NovaBrowser/
├── client/
│   └── src/
│       ├── components/     # React components (ThemeProvider, Logo)
│       ├── pages/          # Page components (browser.tsx)
│       ├── lib/            # Utilities (queryClient)
│       └── index.css       # Tailwind + custom styles
├── server/
│   ├── routes.ts           # API routes (chat, search, URL analysis)
│   ├── storage.ts          # In-memory data storage
│   └── index.ts            # Express server entry point
├── shared/
│   └── schema.ts           # Shared TypeScript types
└── package.json
```

## GitHub Codespaces

This project is configured to work with GitHub Codespaces. Click the green **Code** button on the GitHub repo page, then select **Create codespace on main** to start developing in the cloud.

## License

MIT

## Educational Purpose

This project was built for educational purposes to demonstrate:
- Full-stack web application architecture with React + Express
- Integration with local AI models via Ollama
- Real-time streaming responses with Server-Sent Events
- Modern UI/UX patterns for AI-powered applications
- Web search integration and content summarization
