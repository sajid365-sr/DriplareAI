# 🤖 REMOVEDAI — Your All-in-One AI Customer Support Agent

REMOVEDAI is a powerful SaaS platform designed to automate customer interactions across multiple channels (Facebook, WhatsApp, and Web) using state-of-the-art LLMs and RAG (Retrieval-Augmented Generation).

![REMOVEDAI Dashboard](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/public/og.png) <!-- Replace with real screenshot if available -->

## 🚀 Key Features

- **🧠 Advanced RAG Engine**: Upload PDFs, DOCX, or crawl websites to train your AI on your own data.
- **💬 Omni-channel Integration**: Connect with Facebook Messenger (Fully Implemented) and manage all chats from one dashboard.
- **⚡ Real-time Activity Tracking**: Monitor AI vs. Human handoff conversations with a modern two-pane interface.
- **💳 Global Payments**: Seamlessly upgrade using Stripe (USD) or UddoktaPay (BDT).
- **🌍 Multilingual**: Built-in support for multiple languages including English and Bengali.
- **🎨 Modern UI/UX**: Premium violet-themed design with support for Dark and Light modes.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **Auth**: [Clerk](https://clerk.com)
- **Database**: [PostgreSQL (Neon)](https://neon.tech) + [Prisma](https://prisma.io)
- **Vector Search**: `pgvector` for semantic data retrieval
- **LLM Gateway**: [OpenRouter](https://openrouter.ai) (Access to Gemini, GPT, and more)
- **Styling**: Tailwind CSS v4 + Framer Motion
- **Toasts**: [Sonner](https://sonner.stevenly.me)

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon recommended)
- API Keys for Clerk, OpenRouter, and Stripe

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/driplare-ai.git
   cd driplare-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory and add the keys listed in `project_analysis.md`.

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🛡️ Health & Reliability
REMOVEDAI includes a proactive health monitoring system for Meta integrations. If a Page Access Token expires, the system automatically flags the integration and notifies the user to reconnect, ensuring no messages are missed.

## 📜 License
This project is private and owned by Sajid Sorker.

---
Built with ❤️ by [Sajid Sorker](https://github.com/SajidSorker)
