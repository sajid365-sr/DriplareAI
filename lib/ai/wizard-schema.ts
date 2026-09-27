/**
 * lib/ai/wizard-schema.ts
 *
 * Category Wizard Schema — multi-step, structured wizard definitions for every
 * supported business category. Each category is split into ordered steps; each
 * step holds the fields a merchant fills during onboarding. Fields support
 * predefined dropdown options with an inline "custom / manual" escape hatch
 * (rendered by `@components/ui/HybridSelect.tsx`), boolean toggles with optional
 * dependent fields, quick-pick pills, and free text.
 *
 * `generateRawPromptFromWizard()` walks those structured answers dynamically and
 * compiles them into a human-readable, beautifully formatted Bengali prompt that
 * can be fed into `compilePrompt()` from `./prompt-assembler`.
 */

/* ──────────────────────────── Types ──────────────────────────── */

export type WizardFieldType =
  | "text"
  | "number"
  | "boolean"
  | "textarea"
  /** Hybrid dropdown: predefined options + manual custom input. */
  | "select"
  /** Quick-pick single-choice pills. */
  | "pills";

/**
 * Which section of the compiled prompt a field feeds into.
 *   - `identity` → used to build the "Role & Identity" line (e.g. store name).
 *   - `tone`     → routed to the "Tone & Style" section (bot personality).
 *   - `rule`     → listed under "Business Rules & Policies" (the default).
 */
export type WizardPromptSection = "identity" | "tone" | "rule";

export interface WizardField {
  /** Unique field key — also used as the key inside `wizardData`. */
  key: string;
  /** English label shown in the UI. */
  label: string;
  /** Bengali label shown in the UI. */
  labelBn: string;
  /** Input control type. */
  type: WizardFieldType;
  /** Placeholder / example text (text / textarea / select). */
  placeholder?: string;
  /** Marks the field as mandatory in the wizard. */
  required?: boolean;
  /** Predefined choices for `select` / `pills` fields. */
  options?: string[];
  /**
   * For `select` fields: whether to append the manual custom-input option.
   * Defaults to `true` for selects (the "Dropdown + Custom" pattern).
   */
  allowCustom?: boolean;
  /**
   * Only used when `type === "boolean"`. Rendered as the positive value text,
   * e.g. "100 BDT advance for outside city" or "Delivery fee: 40 BDT".
   */
  conditionText?: string;
  /**
   * Gates this field behind another field's answer. The field only applies (in
   * the UI and the compiled prompt) when `formData[fieldKey]` matches `value` —
   * e.g. a "Delivery Fee" field that depends on `{ fieldKey: "offersDelivery",
   * value: true }`. When `value` is omitted, any truthy answer satisfies it.
   */
  dependsOn?: {
    /** Key of the field this field depends on. */
    fieldKey: string;
    /** Required value; when omitted, any truthy value matches. */
    value?: string | number | boolean;
  };
  /** Which compiled-prompt section this answer feeds into. Defaults to `rule`. */
  promptSection?: WizardPromptSection;
  /** Optional helper / hint text. */
  hint?: string;
}

export interface WizardStep {
  /** Stable step id. */
  id: string;
  /** English step title. */
  title: string;
  /** Bengali step title. */
  titleBn: string;
  /** Fields collected in this step. */
  fields: WizardField[];
}

export interface WizardCategoryConfig {
  category: string;
  title: string;
  titleBn: string;
  /** Ordered multi-step definition. */
  steps: WizardStep[];
  /**
   * Flattened list of every field across all steps — derived from `steps` so
   * consumers that don't care about step grouping (and the prompt transformer)
   * can iterate a single array.
   */
  fields: WizardField[];
}

/** Loose shape of the answers collected from the wizard form. */
export type WizardData = Record<string, string | number | boolean | undefined>;

/* ───────────────────── Category Builder ──────────────────────── */

/**
 * Builds a `WizardCategoryConfig`, deriving the flattened `fields` array from
 * `steps` so the two never drift out of sync.
 */
function defineCategory(
  category: string,
  title: string,
  titleBn: string,
  steps: WizardStep[]
): WizardCategoryConfig {
  return {
    category,
    title,
    titleBn,
    steps,
    fields: steps.flatMap((step) => step.fields),
  };
}

/* ─────────────────── Shared Option Presets ───────────────────── */

const GREETING_OPTIONS = [
  "আসসালামু আলাইকুম! কীভাবে সাহায্য করতে পারি?",
  "হ্যালো! স্বাগতম, বলুন কী লাগবে 🙂",
  "Warm & Friendly",
  "Professional & Formal",
  "Short & Simple",
];

const BOT_TONE_OPTIONS = ["Friendly", "Professional", "Playful", "Concise"];

/* ─────────────────────── Category Schemas ─────────────────────── */

export const WIZARD_CATEGORIES: Record<string, WizardCategoryConfig> = {
  ecommerce: defineCategory(
    "ecommerce",
    "E-Commerce / Online Shop",
    "ই-কমার্স / অনলাইন শপ",
    [
      {
        id: "basics",
        title: "Store Basics",
        titleBn: "স্টোরের তথ্য",
        fields: [
          {
            key: "storeName",
            label: "Store Name",
            labelBn: "স্টোরের নাম",
            type: "text",
            placeholder: "e.g. Driplare Fashion",
            required: true,
            promptSection: "identity",
          },
          {
            key: "businessNiche",
            label: "Business Niche",
            labelBn: "ব্যবসার ধরন",
            type: "select",
            allowCustom: true,
            options: [
              "Fashion & Clothing",
              "Electronics & Gadgets",
              "Beauty & Cosmetics",
              "Grocery & Food",
              "Home & Living",
              "Baby & Kids",
              "Jewelry & Accessories",
              "Books & Stationery",
            ],
          },
          {
            key: "greetingStyle",
            label: "Greeting Style",
            labelBn: "গ্রিটিং স্টাইল",
            type: "select",
            allowCustom: true,
            options: GREETING_OPTIONS,
          },
        ],
      },
      {
        id: "delivery",
        title: "Delivery",
        titleBn: "ডেলিভারি",
        fields: [
          {
            key: "insideCityDelivery",
            label: "Inside City Delivery Charge",
            labelBn: "শহরের ভেতরে ডেলিভারি চার্জ",
            type: "select",
            allowCustom: true,
            options: ["Free (ফ্রি)", "50 BDT", "60 BDT", "70 BDT", "80 BDT"],
          },
          {
            key: "outsideCityDelivery",
            label: "Outside City Delivery Charge",
            labelBn: "শহরের বাইরে ডেলিভারি চার্জ",
            type: "select",
            allowCustom: true,
            options: ["100 BDT", "120 BDT", "130 BDT", "150 BDT"],
          },
          {
            key: "deliveryTimeframe",
            label: "Delivery Timeframe",
            labelBn: "ডেলিভারির সময়সীমা",
            type: "select",
            allowCustom: true,
            options: [
              "Same day delivery",
              "1-2 days",
              "2-3 days",
              "3-5 days",
              "Inside city: 24h, Outside: 2-3 days",
            ],
          },
        ],
      },
      {
        id: "payment",
        title: "Payment & Returns",
        titleBn: "পেমেন্ট ও রিটার্ন",
        fields: [
          {
            key: "advancePaymentPolicy",
            label: "Advance Payment Policy",
            labelBn: "অগ্রিম পেমেন্ট পলিসি",
            type: "select",
            allowCustom: true,
            options: [
              "No advance — Cash on Delivery",
              "100 BDT advance for outside city",
              "Full advance for outside city",
              "50% advance for all orders",
              "Advance required above 2000 BDT",
            ],
          },
          {
            key: "returnPolicy",
            label: "Return & Exchange Policy",
            labelBn: "রিটার্ন ও এক্সচেঞ্জ পলিসি",
            type: "select",
            allowCustom: true,
            options: [
              "7 days return with original packaging",
              "3 days return / exchange",
              "Exchange only, no return",
              "No return or exchange",
              "Exchange within 24h for size issues",
            ],
          },
        ],
      },
      {
        id: "personality",
        title: "Personality",
        titleBn: "পার্সোনালিটি",
        fields: [
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
          {
            key: "orderConfirmationMode",
            label: "Order Confirmation Mode",
            labelBn: "অর্ডার কনফার্মেশন মোড",
            type: "pills",
            options: [
              "Auto-confirm on message",
              "Manual confirm by agent",
              "Confirm via phone call",
              "Confirm via form",
            ],
          },
        ],
      },
    ]
  ),

  restaurant: defineCategory(
    "restaurant",
    "Restaurant / Food Delivery",
    "রেস্টুরেন্ট / ফুড ডেলিভারি",
    [
      {
        id: "basics",
        title: "Restaurant Basics",
        titleBn: "রেস্টুরেন্টের তথ্য",
        fields: [
          {
            key: "restaurantName",
            label: "Restaurant Name",
            labelBn: "রেস্টুরেন্টের নাম",
            type: "text",
            placeholder: "e.g. Dhaka Bites",
            required: true,
            promptSection: "identity",
          },
          {
            key: "cuisineType",
            label: "Cuisine Type",
            labelBn: "খাবারের ধরন",
            type: "select",
            allowCustom: true,
            options: [
              "Bengali (বাঙালি)",
              "Chinese",
              "Fast Food",
              "Indian",
              "Thai",
              "Continental",
              "Biryani & Kacchi",
              "Cafe & Bakery",
            ],
          },
          {
            key: "greeting",
            label: "Greeting",
            labelBn: "গ্রিটিং",
            type: "select",
            allowCustom: true,
            options: GREETING_OPTIONS,
          },
        ],
      },
      {
        id: "services",
        title: "Delivery & Booking",
        titleBn: "ডেলিভারি ও বুকিং",
        fields: [
          {
            key: "offersDelivery",
            label: "Offers Delivery",
            labelBn: "ডেলিভারি সুবিধা আছে",
            type: "boolean",
            conditionText: "হ্যাঁ, ডেলিভারি সুবিধা আছে",
            hint: "Turn on if the restaurant delivers food to customers.",
          },
          {
            key: "deliveryFee",
            label: "Delivery Fee",
            labelBn: "ডেলিভারি ফি",
            type: "select",
            allowCustom: true,
            dependsOn: { fieldKey: "offersDelivery", value: true },
            options: [
              "Free above 500 BDT",
              "40 BDT",
              "50 BDT",
              "60 BDT",
              "Depends on distance",
            ],
          },
          {
            key: "acceptsTableBooking",
            label: "Accepts Table Booking",
            labelBn: "টেবিল বুকিং নেওয়া হয়",
            type: "boolean",
            conditionText: "হ্যাঁ, টেবিল বুকিং নেওয়া হয়",
          },
          {
            key: "tableBookingRules",
            label: "Table Booking Rules",
            labelBn: "টেবিল বুকিং নিয়ম",
            type: "textarea",
            dependsOn: { fieldKey: "acceptsTableBooking", value: true },
            placeholder: "e.g. Book at least 2 hours ahead via phone call.",
          },
        ],
      },
      {
        id: "menu",
        title: "Hours & Menu",
        titleBn: "সময় ও মেন্যু",
        fields: [
          {
            key: "operatingHours",
            label: "Opening Hours",
            labelBn: "খোলার সময়",
            type: "select",
            allowCustom: true,
            options: [
              "10 AM - 10 PM",
              "11 AM - 11 PM",
              "24 Hours",
              "9 AM - 12 AM (midnight)",
              "12 PM - 3 PM & 6 PM - 11 PM",
            ],
          },
          {
            key: "specialItems",
            label: "Popular Special Items",
            labelBn: "জনপ্রিয় স্পেশাল আইটেম",
            type: "textarea",
            placeholder: "e.g. Kacchi Biryani, Beef Tehari, Chicken Roast",
          },
        ],
      },
      {
        id: "personality",
        title: "Personality",
        titleBn: "পার্সোনালিটি",
        fields: [
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
          {
            key: "orderBookingMode",
            label: "Order / Booking Mode",
            labelBn: "অর্ডার / বুকিং মোড",
            type: "pills",
            options: [
              "Auto-confirm orders",
              "Manual confirm by staff",
              "Confirm via phone",
              "Booking via form / link",
            ],
          },
        ],
      },
    ]
  ),

  lead_gen: defineCategory("lead_gen", "Lead Generation", "লিড জেনারেশন", [
    {
      id: "basics",
      title: "Business & Services",
      titleBn: "ব্যবসা ও সেবা",
      fields: [
        {
          key: "businessName",
          label: "Business / Agency Name",
          labelBn: "ব্যবসা / এজেন্সির নাম",
          type: "text",
          placeholder: "e.g. Driplare Marketing",
          required: true,
          promptSection: "identity",
        },
        {
          key: "offeredServices",
          label: "Offered Services",
          labelBn: "প্রদত্ত সেবাসমূহ",
          type: "select",
          allowCustom: true,
          options: [
            "Digital Marketing",
            "Web Design & Development",
            "SEO Services",
            "Social Media Management",
            "Branding & Graphic Design",
            "Video Production",
            "Business Consultancy",
          ],
        },
        {
          key: "targetAudience",
          label: "Target Audience",
          labelBn: "টার্গেট অডিয়েন্স",
          type: "textarea",
          placeholder: "e.g. Small business owners in Dhaka",
        },
      ],
    },
    {
      id: "contact",
      title: "Booking & Contact",
      titleBn: "বুকিং ও যোগাযোগ",
      fields: [
        {
          key: "bookingUrl",
          label: "Booking / Calendly URL",
          labelBn: "বুকিং / Calendly লিংক",
          type: "text",
          placeholder: "e.g. https://calendly.com/your-name",
        },
        {
          key: "contactInfo",
          label: "Primary Contact Phone / Email",
          labelBn: "প্রধান যোগাযোগ ফোন / ইমেইল",
          type: "text",
          placeholder: "e.g. +8801XXXXXXXXX / hello@agency.com",
        },
      ],
    },
    {
      id: "qualification",
      title: "Qualification & Tone",
      titleBn: "কোয়ালিফিকেশন ও টোন",
      fields: [
        {
          key: "qualificationQuestions",
          label: "Qualification Questions",
          labelBn: "কোয়ালিফিকেশন প্রশ্ন",
          type: "textarea",
          placeholder:
            "e.g. What is your budget? What is your timeline? Which service do you need?",
        },
        {
          key: "botTone",
          label: "Bot Tone",
          labelBn: "বটের টোন",
          type: "pills",
          options: BOT_TONE_OPTIONS,
          promptSection: "tone",
        },
      ],
    },
  ]),

  healthcare: defineCategory(
    "healthcare",
    "Healthcare / Clinic",
    "হেলথকেয়ার / ক্লিনিক",
    [
      {
        id: "basics",
        title: "Clinic Basics",
        titleBn: "ক্লিনিকের তথ্য",
        fields: [
          {
            key: "clinicName",
            label: "Clinic / Hospital Name",
            labelBn: "ক্লিনিক / হাসপাতালের নাম",
            type: "text",
            placeholder: "e.g. Driplare Care Clinic",
            required: true,
            promptSection: "identity",
          },
          {
            key: "specialty",
            label: "Specialty",
            labelBn: "বিশেষায়িত সেবা",
            type: "select",
            allowCustom: true,
            options: [
              "General Medicine",
              "Cardiology",
              "Dermatology",
              "Gynecology & Obstetrics",
              "Pediatrics",
              "Orthopedics",
              "ENT",
              "Dental",
              "Eye (Ophthalmology)",
            ],
          },
          {
            key: "doctorList",
            label: "Doctor List / Departments",
            labelBn: "ডাক্তার তালিকা / বিভাগসমূহ",
            type: "textarea",
            placeholder:
              "e.g. Dr. Rahim (Medicine, Sun-Tue), Dr. Karim (Cardiology, Wed-Thu)",
          },
        ],
      },
      {
        id: "appointments",
        title: "Appointments",
        titleBn: "অ্যাপয়েন্টমেন্ট",
        fields: [
          {
            key: "appointmentProcess",
            label: "Appointment Process",
            labelBn: "অ্যাপয়েন্টমেন্ট প্রক্রিয়া",
            type: "select",
            allowCustom: true,
            options: [
              "Book via phone call",
              "Book online / via link",
              "Walk-in with serial",
              "WhatsApp booking",
              "First come, first served",
            ],
          },
          {
            key: "visitingHours",
            label: "Chamber / Visiting Hours",
            labelBn: "চেম্বার / ভিজিটিং আওয়ার",
            type: "select",
            allowCustom: true,
            options: [
              "9 AM - 9 PM",
              "10 AM - 1 PM & 5 PM - 9 PM",
              "24 Hours (Emergency)",
              "By appointment only",
            ],
          },
          {
            key: "emergencyHelpline",
            label: "Emergency Helpline",
            labelBn: "জরুরি হেল্পলাইন",
            type: "text",
            placeholder: "e.g. +8801XXXXXXXXX",
          },
        ],
      },
    ]
  ),

  real_estate: defineCategory(
    "real_estate",
    "Real Estate / Property",
    "রিয়েল এস্টেট / প্রপার্টি",
    [
      {
        id: "basics",
        title: "Agency & Properties",
        titleBn: "এজেন্সি ও প্রপার্টি",
        fields: [
          {
            key: "agencyName",
            label: "Agency Name",
            labelBn: "এজেন্সির নাম",
            type: "text",
            placeholder: "e.g. Driplare Properties",
            required: true,
            promptSection: "identity",
          },
          {
            key: "propertyTypes",
            label: "Property Types",
            labelBn: "প্রপার্টির ধরন",
            type: "select",
            allowCustom: true,
            options: [
              "Apartment / Flat",
              "Land / Plot",
              "Commercial Space",
              "Office Space",
              "Duplex / Building",
              "Rental Property",
              "Ready Flat",
            ],
          },
          {
            key: "coveredLocations",
            label: "Covered Locations",
            labelBn: "কভারেজ এরিয়া / লোকেশন",
            type: "textarea",
            placeholder: "e.g. Dhaka, Chattogram, Sylhet",
          },
        ],
      },
      {
        id: "visits",
        title: "Visits & Contact",
        titleBn: "ভিজিট ও যোগাযোগ",
        fields: [
          {
            key: "visitBookingProcess",
            label: "Property Visit Booking Process",
            labelBn: "প্রপার্টি ভিজিট বুকিং প্রক্রিয়া",
            type: "select",
            allowCustom: true,
            options: [
              "Book via phone call",
              "Schedule via link",
              "Visit our office",
              "WhatsApp to schedule",
            ],
          },
          {
            key: "contactInfo",
            label: "Contact Info",
            labelBn: "যোগাযোগের তথ্য",
            type: "text",
            placeholder: "e.g. +8801XXXXXXXXX / info@properties.com",
          },
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
        ],
      },
    ]
  ),

  education: defineCategory(
    "education",
    "Education / Coaching",
    "এডুকেশন / কোচিং",
    [
      {
        id: "basics",
        title: "Institution & Courses",
        titleBn: "প্রতিষ্ঠান ও কোর্স",
        fields: [
          {
            key: "institutionName",
            label: "Institution / Coaching Name",
            labelBn: "প্রতিষ্ঠান / কোচিং সেন্টারের নাম",
            type: "text",
            placeholder: "e.g. Driplare Academy",
            required: true,
            promptSection: "identity",
          },
          {
            key: "coursesOffered",
            label: "Courses Offered",
            labelBn: "প্রদত্ত কোর্সসমূহ",
            type: "select",
            allowCustom: true,
            options: [
              "Academic (School / College)",
              "Admission Coaching",
              "IELTS / Language",
              "Skill Development / IT",
              "Professional Certification",
              "Online Courses",
            ],
          },
          {
            key: "admissionStatus",
            label: "Admission Status",
            labelBn: "ভর্তির অবস্থা",
            type: "select",
            allowCustom: true,
            options: [
              "Admission Open",
              "Admission Closed",
              "Opening Soon",
              "Rolling Admission",
            ],
          },
        ],
      },
      {
        id: "details",
        title: "Fees & Contact",
        titleBn: "ফি ও যোগাযোগ",
        fields: [
          {
            key: "courseFeeRange",
            label: "Course Fee Range",
            labelBn: "কোর্স ফি রেঞ্জ",
            type: "select",
            allowCustom: true,
            options: [
              "Under 5,000 BDT",
              "5,000 - 10,000 BDT",
              "10,000 - 25,000 BDT",
              "25,000+ BDT",
              "Varies by course",
            ],
          },
          {
            key: "officeHours",
            label: "Contact / Admission Office Hours",
            labelBn: "যোগাযোগ / ভর্তি অফিসের সময়",
            type: "select",
            allowCustom: true,
            options: [
              "9 AM - 5 PM",
              "10 AM - 6 PM",
              "Sat-Thu 10 AM - 8 PM",
              "24/7 Online Support",
            ],
          },
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
        ],
      },
    ]
  ),

  support: defineCategory(
    "support",
    "Customer Support / FAQ",
    "কাস্টমার সাপোর্ট / FAQ",
    [
      {
        id: "company",
        title: "Company",
        titleBn: "কোম্পানি",
        fields: [
          {
            key: "companyName",
            label: "Company Name",
            labelBn: "কোম্পানির নাম",
            type: "text",
            placeholder: "e.g. Driplare Ltd.",
            required: true,
            promptSection: "identity",
          },
          {
            key: "primaryServices",
            label: "Primary Services / Topics",
            labelBn: "প্রধান সেবা / বিষয়সমূহ",
            type: "textarea",
            placeholder: "e.g. Product support, Billing, Refunds",
          },
        ],
      },
      {
        id: "handling",
        title: "Support Handling",
        titleBn: "সাপোর্ট হ্যান্ডলিং",
        fields: [
          {
            key: "supportEmailOrPhone",
            label: "Support Email / Phone",
            labelBn: "সাপোর্ট ইমেইল / ফোন",
            type: "text",
            placeholder: "e.g. support@driplare.com / +8801XXXXXXXXX",
          },
          {
            key: "escalationPolicy",
            label: "Escalation Policy",
            labelBn: "এস্কেলেশন পলিসি",
            type: "select",
            allowCustom: true,
            options: [
              "Escalate to a human agent if unresolved",
              "Escalate after 2 failed attempts",
              "Share contact for complex issues",
              "No escalation — FAQ only",
            ],
          },
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
        ],
      },
    ]
  ),

  general: defineCategory(
    "general",
    "General Assistant",
    "সাধারণ অ্যাসিস্ট্যান্ট",
    [
      {
        id: "identity",
        title: "Assistant Identity",
        titleBn: "অ্যাসিস্ট্যান্ট পরিচিতি",
        fields: [
          {
            key: "assistantName",
            label: "Assistant Name",
            labelBn: "অ্যাসিস্ট্যান্টের নাম",
            type: "text",
            placeholder: "e.g. Driplare Assistant",
            promptSection: "identity",
          },
          {
            key: "purpose",
            label: "Purpose / Scope",
            labelBn: "উদ্দেশ্য / কাজের পরিধি",
            type: "textarea",
            placeholder: "e.g. Answer questions about our services",
          },
        ],
      },
      {
        id: "context",
        title: "Context & Tone",
        titleBn: "প্রসঙ্গ ও টোন",
        fields: [
          {
            key: "location",
            label: "Location / Region",
            labelBn: "লোকেশন / অঞ্চল",
            type: "text",
            placeholder: "e.g. Bangladesh",
          },
          {
            key: "contactLink",
            label: "Booking / Contact Link",
            labelBn: "বুকিং / কন্টাক্ট লিংক",
            type: "text",
            placeholder: "e.g. https://calendly.com/your-name",
          },
          {
            key: "botTone",
            label: "Bot Tone",
            labelBn: "বটের টোন",
            type: "pills",
            options: BOT_TONE_OPTIONS,
            promptSection: "tone",
          },
        ],
      },
    ]
  ),
};

/** Ordered list of supported wizard categories (for dropdowns / iteration). */
export const WIZARD_CATEGORY_KEYS = Object.keys(WIZARD_CATEGORIES);

/** Returns the category config, or `null` when the category is unknown. */
export function getWizardCategory(category: string): WizardCategoryConfig | null {
  return WIZARD_CATEGORIES[category] ?? null;
}

/* ─────────────────── Raw Prompt Transformer ─────────────────── */

/**
 * Per-category "Role & Identity" templates keyed by category. `name` is the
 * value of the field flagged `promptSection: "identity"`.
 */
const ROLE_TEMPLATES: Record<string, (name: string) => string> = {
  ecommerce: (n) => `তুমি হলো ${n} এর অফিশিয়াল AI কাস্টমার সাপোর্ট অ্যাসিস্ট্যান্ট।`,
  restaurant: (n) => `তুমি হলো ${n} এর ডিজিটাল ওয়েটার।`,
  support: (n) => `তুমি হলো ${n} এর AI কাস্টমার সাপোর্ট এজেন্ট।`,
  lead_gen: (n) => `তুমি হলো ${n} এর লিড জেনারেশন স্পেশালিস্ট।`,
  real_estate: (n) => `তুমি হলো ${n} এর ভার্চুয়াল প্রপার্টি কনসালটেন্ট।`,
  healthcare: (n) => `তুমি হলো ${n} এর পেশেন্ট কেয়ার কো-অর্ডিনেটর।`,
  education: (n) => `তুমি হলো ${n} এর অ্যাডমিশন ও কোর্স অ্যাডভাইজর।`,
  general: (n) => `তুমি হলো ${n} — একটি সহায়ক AI অ্যাসিস্ট্যান্ট।`,
};

/** Fallback identity name per category when the merchant leaves it blank. */
const FALLBACK_NAMES: Record<string, string> = {
  ecommerce: "আপনার স্টোর",
  restaurant: "আপনার রেস্টুরেন্ট",
  support: "আপনার কোম্পানি",
  lead_gen: "আপনার ব্যবসা",
  real_estate: "আপনার এজেন্সি",
  healthcare: "আপনার ক্লিনিক",
  education: "আপনার প্রতিষ্ঠান",
  general: "আপনার",
};

/** Reads a value from wizard data and trims it to a clean string. */
function readValue(data: WizardData, key: string): string {
  const value = data?.[key];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Whether a raw wizard value should be treated as a truthy boolean answer. */
function isTruthy(value: unknown): boolean {
  return (
    value === true ||
    value === "true" ||
    value === "yes" ||
    value === "হ্যাঁ" ||
    value === "1"
  );
}

/**
 * Whether a field is currently active given the collected answers — i.e. its
 * `dependsOn` condition (if any) is satisfied. Shared by the wizard UI (to
 * decide what to render) and the prompt transformer (to decide what to compile),
 * so both always agree on which fields count.
 */
export function isFieldActive(field: WizardField, data: WizardData): boolean {
  if (!field.dependsOn) return true;
  const current = data?.[field.dependsOn.fieldKey];
  const expected = field.dependsOn.value;
  if (expected === undefined) return isTruthy(current);
  if (typeof expected === "boolean") return isTruthy(current) === expected;
  return current === expected;
}

/**
 * Renders a boolean answer as human-readable Bengali text. Truthy values render
 * the `conditionText` (e.g. "Delivery fee: 40 BDT") when provided, otherwise a
 * generic "হ্যাঁ". Falsy values render "না" (no).
 */
function readBoolean(data: WizardData, key: string, conditionText?: string): string {
  if (isTruthy(data?.[key])) return conditionText?.trim() || "হ্যাঁ";
  return "না";
}

/** Builds the "Role & Identity" line for a category. */
function buildRoleLine(config: WizardCategoryConfig, data: WizardData): string {
  const identityField = config.fields.find(
    (f) => f.promptSection === "identity"
  );
  const name =
    (identityField ? readValue(data, identityField.key) : "") ||
    FALLBACK_NAMES[config.category] ||
    "আপনার ব্যবসা";
  const template =
    ROLE_TEMPLATES[config.category] ??
    ((n: string) => `তুমি হলো ${n} — একটি সহায়ক AI অ্যাসিস্ট্যান্ট।`);
  return template(name);
}

/**
 * Builds the "Business Rules & Policies" bullet list by walking every field
 * across all steps — skipping identity / tone fields and fields gated behind an
 * unchecked boolean (`dependsOn`).
 */
function buildRules(config: WizardCategoryConfig, data: WizardData): string[] {
  const rules: string[] = [];

  for (const field of config.fields) {
    if (field.promptSection === "identity" || field.promptSection === "tone") {
      continue;
    }
    // Skip fields gated behind an unmet `dependsOn` condition.
    if (!isFieldActive(field, data)) continue;

    if (field.type === "boolean") {
      rules.push(`${field.labelBn}: ${readBoolean(data, field.key, field.conditionText)}`);
      continue;
    }

    const value = readValue(data, field.key);
    if (value) rules.push(`${field.labelBn}: ${value}`);
  }

  return rules;
}

/** Collects the "Tone & Style" answers (fields flagged `promptSection: "tone"`). */
function buildToneLines(config: WizardCategoryConfig, data: WizardData): string[] {
  const lines: string[] = [];
  for (const field of config.fields) {
    if (field.promptSection !== "tone") continue;
    const value = readValue(data, field.key);
    if (value) lines.push(`${field.labelBn}: ${value}`);
  }
  return lines;
}

/**
 * Converts structured wizard answers into a human-readable, beautifully
 * formatted Bengali prompt. Walks the category's fields dynamically across all
 * steps, so every category (and any future field) is compiled automatically:
 *
 *   Role & Identity:
 *   তুমি হলো <name> এর অফিশিয়াল AI কাস্টমার সাপোর্ট অ্যাসিস্ট্যান্ট।
 *
 *   Business Rules & Policies:
 *   • ব্যবসার ধরন: <businessNiche>
 *   • শহরের ভেতরে ডেলিভারি চার্জ: <insideCityDelivery>
 *   • রিটার্ন ও এক্সচেঞ্জ পলিসি: <returnPolicy>
 *
 *   Tone & Style:
 *   • বটের টোন: <botTone>
 *   খুবই বিনয়ী, প্রফেশনাল এবং বন্ধুভাবাপন্ন। ...
 *
 * @param category - One of the `WIZARD_CATEGORIES` keys.
 * @param data - Structured form answers keyed by `WizardField.key`.
 * @returns The formatted raw prompt (Bengali) ready for `compilePrompt()`.
 * @throws When the category is unknown.
 */
export function generateRawPromptFromWizard(
  category: string,
  data: WizardData
): string {
  const config = getWizardCategory(category);
  if (!config) {
    throw new Error(`generateRawPromptFromWizard: unknown category "${category}"`);
  }

  const sections: string[] = [];

  // Role & Identity
  sections.push("Role & Identity:");
  sections.push(buildRoleLine(config, data));

  // Business Rules & Policies
  const rules = buildRules(config, data);
  if (rules.length > 0) {
    sections.push("");
    sections.push("Business Rules & Policies:");
    rules.forEach((rule) => sections.push(`• ${rule}`));
  }

  // Tone & Style
  sections.push("");
  sections.push("Tone & Style:");
  buildToneLines(config, data).forEach((line) => sections.push(`• ${line}`));
  sections.push(
    "খুবই বিনয়ী, প্রফেশনাল এবং বন্ধুভাবাপন্ন। কাস্টমার যে ভাষায় কথা বলবে, সেই ভাষাতেই উত্তর দেবে।"
  );

  return sections.join("\n").trim();
}
