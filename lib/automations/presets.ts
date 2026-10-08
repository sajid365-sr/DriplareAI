/**
 * Automation presets — the starter gallery.
 *
 * A blank "Create Rule" screen asks a merchant to design a rules engine from
 * scratch, and most never do. Every comparable product ships a gallery of
 * ready-made automations instead, because the merchant's real question is
 * "what should I automate?" and not "how do I fill in this form?".
 *
 * These are *drafts*: choosing one opens the rule builder pre-filled, and the
 * merchant edits before saving. Nothing here is seeded into the database — a
 * preset the merchant never picked should not appear in their rule list.
 *
 * Names and descriptions are deliberately absent. They are UI copy, so they
 * live in `public/locales/{en,bn}/automations.json` under `presets.<id>.*` and
 * are resolved by the gallery. Storing English strings here would ship an
 * untranslatable Bengali product.
 */

import type { AutomationWriteInput } from "./schema";

/** The four families approved for V1 — mirrors the gallery's tab strip. */
export const PRESET_FAMILIES = [
  "conversation_starters",
  "social_engagement",
  "ecommerce",
  "inbox_ops",
] as const;

export type PresetFamily = (typeof PRESET_FAMILIES)[number];

export interface AutomationPreset {
  /** Stable id, also the i18n key suffix under `presets.`. */
  id: string;
  family: PresetFamily;
  /** Lucide icon name, resolved by the gallery component. */
  icon: string;
  /**
   * Channels this preset needs (e.g. comment-to-DM is meaningless without a
   * Facebook page). The gallery hides a preset when the agent has none of
   * these connected, rather than offering a rule that can never fire.
   */
  requiresChannel?: string[];
  /**
   * The rule body, minus `name`/`description` — the merchant's chosen locale
   * supplies those at save time.
   */
  rule: Omit<AutomationWriteInput, "name" | "description">;
}

/** Everything except the two fields the locale fills in. */
type PresetDraft = AutomationPreset["rule"];

const preset = (
  id: string,
  family: PresetFamily,
  icon: string,
  rule: PresetDraft,
  requiresChannel?: string[]
): AutomationPreset => ({ id, family, icon, rule, requiresChannel });

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  // ── Conversation starters ─────────────────────────────────────────────────
  preset("welcome_first_message", "conversation_starters", "Hand", {
    status: "active",
    priority: 10,
    trigger: { type: "conversation.first_message" },
    actions: [
      {
        type: "send_text",
        body:
          "আসসালামু আলাইকুম {{name}}! Driplare-এ স্বাগতম। " +
          "আপনি কীভাবে সাহায্য করতে পারি? 😊",
      },
    ],
  }),

  preset("keyword_price", "conversation_starters", "Tags", {
    status: "active",
    priority: 20,
    trigger: {
      type: "keyword.match",
      // Bengali and Banglish sit alongside English — customers type whichever
      // is fastest, and a keyword list that only speaks one of the three is
      // the most common reason a working rule looks broken.
      keywords: ["price", "দাম", "dam", "কত টাকা", "koto", "rate"],
      matchMode: "contains",
    },
    actions: [
      {
        type: "send_text",
        body: "অবশ্যই {{name}}! আমাদের প্রোডাক্টের দাম জানতে চাইলে অল্প একটু অপেক্ষা করুন 🙏",
      },
      { type: "ai_reply" },
    ],
  }),

  preset("away_message", "conversation_starters", "MoonStar", {
    status: "active",
    priority: 5,
    trigger: { type: "schedule.outside_business_hours", timezone: "Asia/Dhaka" },
    quietHours: { enabled: false, from: "22:00", to: "08:00", timezone: "Asia/Dhaka" },
    actions: [
      {
        type: "send_text",
        body:
          "ধন্যবাদ মেসেজ করার জন্য! আমাদের অফিস আওয়ার শেষ হয়ে গেছে। " +
          "সকাল ১০টায় আমরা আবার শুরু করব — আপনার মেসেজটি আমরা দেখে নেব ইনশাআল্লাহ।",
      },
    ],
  }),

  preset("idle_follow_up", "conversation_starters", "Clock", {
    status: "draft",
    priority: 200,
    trigger: { type: "session.idle", idleMinutes: 60, onlyActive: true },
    // One nudge, not a stream of them. A merchant who leaves this uncapped
    // learns to distrust the whole Automations tab.
    frequencyCap: { enabled: true, perContact: 1, perWindowHours: 24 },
    actions: [
      {
        type: "send_text",
        body: "আপনার কোনো প্রশ্ন কি বাকি আছে {{name}}? আমরা সাহায্য করতে প্রস্তুত 🙂",
      },
    ],
  }),

  // ── Social engagement ─────────────────────────────────────────────────────
  preset(
    "comment_to_dm",
    "social_engagement",
    "MessageCircle",
    {
      status: "active",
      priority: 10,
      trigger: {
        type: "comment.created",
        keywords: ["price", "দাম", "কত", "how much"],
        sendPrivateDM: true,
      },
      actions: [
        {
          type: "send_text",
          body:
            "ধন্যবাদ কমেন্ট করার জন্য {{name}}! দাম ও স্টকের বিস্তারিত " +
            "ইনবক্সে পাঠিয়ে দিচ্ছি 📩",
        },
      ],
    },
    ["facebook", "instagram"]
  ),

  preset(
    "comment_thanks",
    "social_engagement",
    "Heart",
    {
      status: "draft",
      priority: 300,
      trigger: { type: "comment.created", keywords: [], sendPrivateDM: false },
      frequencyCap: { enabled: true, perContact: 1, perWindowHours: 1 },
      actions: [
        {
          type: "send_text",
          body: "ধন্যবাদ আপনার কমেন্টের জন্য {{name}}! 🙏 ইনবক্সে নক করুন, দ্রুত রিপ্লাই পাবেন।",
        },
      ],
    },
    ["facebook", "instagram"]
  ),

  // ── E-commerce & orders ───────────────────────────────────────────────────
  preset("order_confirmation", "ecommerce", "ShoppingBag", {
    status: "active",
    priority: 10,
    trigger: { type: "order.created" },
    actions: [
      {
        type: "send_text",
        body:
          "✅ অর্ডার কনফার্ম হয়েছে!\n\n" +
          "অর্ডার নাম্বার: {{order_id}}\n" +
          "মোট: ৳{{order_total}}\n\n" +
          "আমরা শীঘ্রই ডেলিভারির জন্য প্রস্তুত করব। ধন্যবাদ {{name}}!",
      },
    ],
  }),

  preset("cod_confirm", "ecommerce", "BadgeCheck", {
    status: "active",
    priority: 20,
    trigger: { type: "order.created" },
    conditions: [{ field: "channel", op: "eq", value: "whatsapp" }],
    actions: [
      {
        type: "send_quick_replies",
        body:
          "আপনার অর্ডারটি কনফার্ম করতে চাই {{name}}।\n" +
          "অর্ডার: {{order_id}} · টাকা: ৳{{order_total}} (ক্যাশ অন ডেলিভারি)",
        buttons: [
          { label: "কনফার্ম করুন", payload: "confirm_order" },
          { label: "বাতিল করুন", payload: "cancel_order" },
        ],
      },
      { type: "add_note", text: "COD confirmation sent — awaiting customer reply." },
    ],
  }),

  preset("order_shipped", "ecommerce", "Truck", {
    status: "active",
    priority: 30,
    trigger: { type: "order.status_changed", statuses: ["Shipped"] },
    actions: [
      {
        type: "send_text",
        body:
          "🚚 আপনার অর্ডারটি পাঠিয়ে দেওয়া হয়েছে!\n\n" +
          "{{name}}, আগামী ১–৩ দিনের মধ্যে ডেলিভারি পেয়ে যাবেন ইনশাআল্লাহ।",
      },
    ],
  }),

  preset("order_delivered", "ecommerce", "PackageCheck", {
    status: "active",
    priority: 30,
    trigger: { type: "order.status_changed", statuses: ["Delivered"] },
    actions: [
      {
        type: "send_text",
        body:
          "আপনার অর্ডারটি ডেলিভারি হয়েছে ✅\n\n" +
          "পণ্য নিয়ে কোনো সমস্যা থাকলে জানাবেন {{name}} — আমরা সাথে সাথে সমাধান করব।",
      },
      { type: "set_lead_status", value: "successful" },
    ],
  }),

  preset("cart_abandoned", "ecommerce", "ShoppingCart", {
    status: "draft",
    priority: 150,
    trigger: { type: "cart.abandoned", afterMinutes: 120 },
    frequencyCap: { enabled: true, perContact: 1, perWindowHours: 48 },
    actions: [
      {
        type: "send_text",
        body:
          "{{name}}, আপনার কার্টে রাখা পণ্যটি এখনো আপনার অপেক্ষায় আছে 🛒\n\n" +
          "অর্ডার কনফার্ম করতে শুধু উত্তর দিন — আমরা সাথে সাথে প্রসেস করব।",
      },
    ],
  }),

  // ── Inbox operations ──────────────────────────────────────────────────────
  preset("human_handover", "inbox_ops", "UserRound", {
    status: "active",
    priority: 10,
    trigger: { type: "handover.requested" },
    actions: [
      { type: "pause_ai" },
      {
        type: "handoff_to_human",
        muteAi: true,
        note: "Customer asked for a human agent.",
      },
      {
        type: "notify_merchant",
        title: "Human handover requested",
        message: "{{name}} is waiting for a human agent.",
      },
    ],
  }),

  preset("negative_sentiment", "inbox_ops", "TriangleAlert", {
    status: "active",
    priority: 5,
    trigger: { type: "sentiment.changed", values: ["negative"] },
    actions: [
      { type: "add_tag", tagId: "needs_attention" },
      { type: "set_lead_status", value: "risky" },
      {
        type: "notify_merchant",
        title: "Unhappy customer",
        message: "{{name}} seems frustrated — a human should step in.",
      },
    ],
  }),

  preset("vip_prospect", "inbox_ops", "Star", {
    status: "active",
    priority: 40,
    trigger: { type: "lead.status_changed", statuses: ["high_prospect"] },
    actions: [
      { type: "add_tag", tagId: "vip" },
      {
        type: "notify_merchant",
        title: "High-value prospect",
        message: "{{name}} looks like a high prospect — follow up today.",
      },
    ],
  }),

  preset("order_high_value_alert", "ecommerce", "Bell", {
    status: "draft",
    priority: 15,
    trigger: { type: "order.created" },
    conditions: [{ field: "orderValue", op: "gt", value: 5000 }],
    actions: [
      { type: "add_tag", tagId: "vip" },
      {
        type: "notify_merchant",
        title: "High-value order",
        message: "{{name}} placed an order worth ৳{{order_total}}.",
      },
    ],
  }),
];

/** All presets in one family, in display order. */
export function presetsByFamily(family: PresetFamily): AutomationPreset[] {
  return AUTOMATION_PRESETS.filter((item) => item.family === family);
}

/**
 * Presets the given channels can actually run. A preset with no
 * `requiresChannel` is universal and always offered.
 */
export function presetsForChannels(channels: string[]): AutomationPreset[] {
  const available = new Set(channels.map((channel) => channel.toLowerCase()));
  return AUTOMATION_PRESETS.filter(
    (item) => !item.requiresChannel || item.requiresChannel.some((c) => available.has(c))
  );
}
