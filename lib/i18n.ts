"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  en: {
    translation: {
      brand: "Driplare",
      nav: { features: "Features", pricing: "Pricing", tutorial: "Tutorial", login: "Sign in", cta: "Get Started Free" },
      hero: {
        eyebrow: "AI Customer Support, on every channel",
        title: "Build chatbots that actually answer.",
        subtitle: "Train an AI agent on your data and deploy it to Facebook, WhatsApp, Instagram, your website and more — in minutes, not months.",
        cta: "Start free — no card",
        secondary: "Watch 90s tour",
      },
      features: {
        title: "Everything to ship a great agent",
        subtitle: "From training to multichannel deployment, Driplare handles it.",
        items: {
          train: { t: "Train on anything", d: "Files (PDF, DOCX, TXT), websites, raw text and Q&A pairs." },
          channels: { t: "Multi-channel", d: "Facebook, WhatsApp, Instagram, Telegram, Slack, your site." },
          models: { t: "Pick your model", d: "GPT-5.2, Claude Sonnet 4.5, Gemini 3 Flash. Compare side by side." },
          analytics: { t: "Live analytics", d: "Track conversations, sessions, satisfaction in real time." },
          live: { t: "Human handoff", d: "Live chat takeover when your agent needs backup." },
          api: { t: "Custom API", d: "REST endpoints + webhooks for any custom integration." },
        },
      },
      sidebar: { chatbot: "ChatBot", usage: "Usage", settings: "Settings", payment: "Payment", referEarn: "Refer & Earn" },
      bot: { chat: "Chat", activity: "Activity", analytics: "Analytics", sources: "Sources", integrations: "Integrations", settings: "Settings", compare: "Compare", edit: "Edit", liveChat: "Live Chat" },
      common: { newChatbot: "New Chatbot", create: "Create", cancel: "Cancel", save: "Save", saved: "Saved", saving: "Saving…", delete: "Delete", edit: "Edit", connect: "Connect", disconnect: "Disconnect", connected: "Connected", active: "Active", trained: "Trained", upgrade: "Upgrade Plan", upgradeFree: "Upgrade Free", points: "Points", reset: "Reset", showSourceFiles: "Show Source Files", model: "Model", temperature: "Temperature", maxTokens: "Max tokens", instructions: "Instructions for this Chatbot", agentStatus: "Agent Status", message: "Message", aiAgents: "AI Agents", botName: "Bot Name", lastModified: "Last Modified", connectedCol: "Connected", status: "Status", action: "Action" },
      pricing: {
        title: "Simple, transparent pricing", subtitle: "Start free. Upgrade when you ship.", monthly: "Monthly", yearly: "Yearly (save 20%)",
        cta: "Choose plan", featured: "Most popular",
        free: { name: "Free", price: "$0", desc: "For exploring Driplare", features: ["1 chatbot", "100 messages / mo", "1 channel", "Community support"] },
        pro: { name: "Pro", price: "$29", desc: "For growing teams", features: ["10 chatbots", "10,000 messages / mo", "All channels", "Analytics + Compare", "Priority support"] },
        ent: { name: "Enterprise", price: "Custom", desc: "Custom workloads", features: ["Unlimited chatbots", "Unlimited messages", "SSO + audit logs", "SLA & dedicated CSM"] },
      },
      tutorial: { title: "Tutorials & Docs", subtitle: "Get up and running in minutes." },
    },
  },
  bn: {
    translation: {
      brand: "Driplare",
      nav: { features: "ফিচার", pricing: "প্রাইসিং", tutorial: "টিউটোরিয়াল", login: "সাইন ইন", cta: "ফ্রি শুরু করুন" },
      hero: {
        eyebrow: "প্রতিটি চ্যানেলে এআই কাস্টমার সাপোর্ট",
        title: "এমন চ্যাটবট বানান যা আসলেই উত্তর দেয়।",
        subtitle: "আপনার ডেটা দিয়ে এআই এজেন্ট ট্রেইন করুন এবং Facebook, WhatsApp, Instagram, ওয়েবসাইটে কয়েক মিনিটেই ডিপ্লয় করুন।",
        cta: "ফ্রি শুরু — কার্ড লাগবে না",
        secondary: "৯০ সেকেন্ডের ট্যুর",
      },
      features: {
        title: "চমৎকার এজেন্ট লঞ্চ করতে যা যা দরকার",
        subtitle: "ট্রেনিং থেকে মাল্টি-চ্যানেল ডিপ্লয়মেন্ট — সব BokBok-এ।",
        items: {
          train: { t: "যেকোনো ডেটা দিয়ে ট্রেইন", d: "ফাইল (PDF, DOCX, TXT), ওয়েবসাইট, টেক্সট এবং Q&A।" },
          channels: { t: "মাল্টি-চ্যানেল", d: "Facebook, WhatsApp, Instagram, Telegram, Slack — Driplare-এ সব।" },
          models: { t: "মডেল বাছুন", d: "GPT-5.2, Claude Sonnet 4.5, Gemini 3 Flash — সাইড বাই সাইড তুলনা।" },
          analytics: { t: "লাইভ অ্যানালিটিক্স", d: "কথোপকথন, সেশন, সন্তুষ্টি রিয়েল-টাইমে দেখুন।" },
          live: { t: "হিউম্যান হ্যান্ডঅফ", d: "প্রয়োজন হলে লাইভ চ্যাটে নিয়ে নিন।" },
          api: { t: "কাস্টম API", d: "যেকোনো ইন্টিগ্রেশনের জন্য REST + webhooks।" },
        },
      },
      sidebar: { chatbot: "চ্যাটবট", usage: "ব্যবহার", settings: "সেটিংস", payment: "পেমেন্ট", referEarn: "রেফার ও আয়" },
      bot: { chat: "চ্যাট", activity: "অ্যাক্টিভিটি", analytics: "অ্যানালিটিক্স", sources: "সোর্স", integrations: "ইন্টিগ্রেশন", settings: "সেটিংস", compare: "তুলনা", edit: "এডিট", liveChat: "লাইভ চ্যাট" },
      common: { newChatbot: "নতুন চ্যাটবট", create: "তৈরি করুন", cancel: "বাতিল", save: "সেভ", saved: "সেভ হয়েছে", saving: "সেভ হচ্ছে…", delete: "ডিলিট", edit: "এডিট", connect: "কানেক্ট", disconnect: "ডিসকানেক্ট", connected: "কানেক্টেড", active: "অ্যাক্টিভ", trained: "ট্রেইনড", upgrade: "প্ল্যান আপগ্রেড", upgradeFree: "ফ্রি আপগ্রেড", points: "পয়েন্ট", reset: "রিসেট", showSourceFiles: "সোর্স ফাইল দেখান", model: "মডেল", temperature: "টেম্পারেচার", maxTokens: "ম্যাক্স টোকেন", instructions: "এই চ্যাটবটের জন্য নির্দেশনা", agentStatus: "এজেন্ট স্ট্যাটাস", message: "মেসেজ", aiAgents: "এআই এজেন্ট", botName: "বট নাম", lastModified: "শেষ আপডেট", connectedCol: "কানেক্টেড", status: "স্ট্যাটাস", action: "অ্যাকশন" },
      pricing: {
        title: "সহজ, স্বচ্ছ প্রাইসিং", subtitle: "ফ্রিতে শুরু করুন। লঞ্চ করার সময় আপগ্রেড করুন।", monthly: "মাসিক", yearly: "বার্ষিক (২০% সাশ্রয়)",
        cta: "প্ল্যান বাছুন", featured: "সবচেয়ে জনপ্রিয়",
        free: { name: "ফ্রি", price: "৳০", desc: "Driplare এক্সপ্লোর করতে", features: ["১টি চ্যাটবট", "১০০ মেসেজ / মাস", "১টি চ্যানেল", "কমিউনিটি সাপোর্ট"] },
        pro: { name: "প্রো", price: "৳২৯০০", desc: "বাড়ন্ত টিমের জন্য", features: ["১০টি চ্যাটবট", "১০,০০০ মেসেজ / মাস", "সব চ্যানেল", "অ্যানালিটিক্স + কম্পেয়ার", "প্রায়োরিটি সাপোর্ট"] },
        ent: { name: "এন্টারপ্রাইজ", price: "কাস্টম", desc: "কাস্টম ওয়ার্কলোড", features: ["আনলিমিটেড চ্যাটবট", "আনলিমিটেড মেসেজ", "SSO + অডিট", "SLA + ডেডিকেটেড CSM"] },
      },
      tutorial: { title: "টিউটোরিয়াল ও ডকস", subtitle: "কয়েক মিনিটেই শুরু করুন।" },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: "bn", // Default language per user request
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
