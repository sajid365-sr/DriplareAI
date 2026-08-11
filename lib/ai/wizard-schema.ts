/**
 * lib/ai/wizard-schema.ts
 *
 * Category Wizard Schema — structured wizard steps & input schemas for major
 * business categories. Each category defines the exact fields a merchant fills
 * in the onboarding wizard. `generateRawPromptFromWizard()` converts those
 * structured answers into a human-readable, beautifully formatted Bengali
 * prompt that can be fed into `compilePrompt()` from `./prompt-assembler`.
 */

/* ──────────────────────────── Types ──────────────────────────── */

export type WizardFieldType = "text" | "number" | "boolean" | "textarea";

export interface WizardField {
  /** Unique field key — also used as the key inside `wizardData`. */
  key: string;
  /** English label shown in the UI. */
  label: string;
  /** Bengali label shown in the UI. */
  labelBn: string;
  /** Input control type. */
  type: WizardFieldType;
  /** Placeholder / example text. */
  placeholder?: string;
  /** Marks the field as mandatory in the wizard. */
  required?: boolean;
  /**
   * Only used when `type === "boolean"`. Rendered as the positive value text,
   * e.g. "100 BDT advance for outside city" or "Delivery fee: 40 BDT".
   */
  conditionText?: string;
  /** Optional helper / hint text. */
  hint?: string;
}

export interface WizardCategoryConfig {
  category: string;
  title: string;
  titleBn: string;
  fields: WizardField[];
}

/** Loose shape of the answers collected from the wizard form. */
export type WizardData = Record<string, string | number | boolean | undefined>;

/* ─────────────────────── Category Schemas ─────────────────────── */

export const WIZARD_CATEGORIES: Record<string, WizardCategoryConfig> = {
  ecommerce: {
    category: "ecommerce",
    title: "E-Commerce / Online Shop",
    titleBn: "ই-কমার্স / অনলাইন শপ",
    fields: [
      {
        key: "storeName",
        label: "Store Name",
        labelBn: "স্টোরের নাম",
        type: "text",
        placeholder: "e.g. Driplare Fashion",
        required: true,
      },
      {
        key: "productTypes",
        label: "Product Types",
        labelBn: "প্রোডাক্টের ধরন",
        type: "textarea",
        placeholder: "e.g. Fashion, Electronics, Grocery",
      },
      {
        key: "insideCityDelivery",
        label: "Inside City Delivery Charge",
        labelBn: "শহরের ভেতরে ডেলিভারি চার্জ",
        type: "text",
        placeholder: "e.g. 70 BDT",
      },
      {
        key: "outsideCityDelivery",
        label: "Outside City Delivery Charge",
        labelBn: "শহরের বাইরে ডেলিভারি চার্জ",
        type: "text",
        placeholder: "e.g. 130 BDT",
      },
      {
        key: "advancePaymentRequired",
        label: "Advance Payment Required",
        labelBn: "অগ্রিম পেমেন্ট প্রয়োজন",
        type: "boolean",
        conditionText: "100 BDT advance for outside city",
        hint: "Turn on if customers must pay an advance before delivery.",
      },
      {
        key: "returnPolicy",
        label: "Return Policy",
        labelBn: "রিটার্ন পলিসি",
        type: "textarea",
        placeholder: "e.g. 7 days return with original packaging",
      },
    ],
  },

  restaurant: {
    category: "restaurant",
    title: "Restaurant / Food Delivery",
    titleBn: "রেস্টুরেন্ট / ফুড ডেলিভারি",
    fields: [
      {
        key: "restaurantName",
        label: "Restaurant Name",
        labelBn: "রেস্টুরেন্টের নাম",
        type: "text",
        placeholder: "e.g. Dhaka Bites",
        required: true,
      },
      {
        key: "cuisineType",
        label: "Cuisine Type",
        labelBn: "খাবারের ধরন",
        type: "text",
        placeholder: "e.g. Bengali, Chinese, Fast Food",
      },
      {
        key: "offersDelivery",
        label: "Offers Delivery",
        labelBn: "ডেলিভারি সুবিধা আছে",
        type: "boolean",
        conditionText: "Delivery fee: 40 BDT",
        hint: "Turn on if the restaurant delivers food to customers.",
      },
      {
        key: "acceptsTableBooking",
        label: "Accepts Table Booking",
        labelBn: "টেবিল বুকিং নেওয়া হয়",
        type: "boolean",
      },
      {
        key: "operatingHours",
        label: "Operating Hours",
        labelBn: "খোলার সময়",
        type: "text",
        placeholder: "e.g. 10 AM - 10 PM",
      },
    ],
  },

  support: {
    category: "support",
    title: "Customer Support / FAQ",
    titleBn: "কাস্টমার সাপোর্ট / FAQ",
    fields: [
      {
        key: "companyName",
        label: "Company Name",
        labelBn: "কোম্পানির নাম",
        type: "text",
        placeholder: "e.g. Driplare Ltd.",
        required: true,
      },
      {
        key: "primaryServices",
        label: "Primary Services",
        labelBn: "প্রধান সেবাসমূহ",
        type: "textarea",
        placeholder: "e.g. Product support, Billing, Refunds",
      },
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
        type: "textarea",
        placeholder: "e.g. Escalate to a human agent if unresolved",
      },
    ],
  },

  lead_gen: {
    category: "lead_gen",
    title: "Lead Generation",
    titleBn: "লিড জেনারেশন",
    fields: [
      {
        key: "businessName",
        label: "Business Name",
        labelBn: "ব্যবসার নাম",
        type: "text",
        placeholder: "e.g. Driplare Marketing",
        required: true,
      },
      {
        key: "offeredServices",
        label: "Offered Services",
        labelBn: "প্রদত্ত সেবাসমূহ",
        type: "textarea",
        placeholder: "e.g. Web design, SEO, Social media marketing",
      },
      {
        key: "targetAudience",
        label: "Target Audience",
        labelBn: "টার্গেট অডিয়েন্স",
        type: "textarea",
        placeholder: "e.g. Small business owners in Dhaka",
      },
      {
        key: "bookingLink",
        label: "Booking Link",
        labelBn: "বুকিং লিংক",
        type: "text",
        placeholder: "e.g. https://calendly.com/your-name",
      },
    ],
  },

  real_estate: {
    category: "real_estate",
    title: "Real Estate / Property",
    titleBn: "রিয়েল এস্টেট / প্রপার্টি",
    fields: [
      {
        key: "agencyName",
        label: "Agency Name",
        labelBn: "এজেন্সির নাম",
        type: "text",
        placeholder: "e.g. Driplare Properties",
        required: true,
      },
      {
        key: "propertyTypes",
        label: "Property Types",
        labelBn: "প্রপার্টির ধরন",
        type: "textarea",
        placeholder: "e.g. Apartment, Land, Office Space",
      },
      {
        key: "serviceAreas",
        label: "Service Areas / Locations",
        labelBn: "সার্ভিস এরিয়া / লোকেশন",
        type: "textarea",
        placeholder: "e.g. Dhaka, Chattogram, Sylhet",
      },
      {
        key: "bookingLink",
        label: "Visit Booking Link",
        labelBn: "ভিজিট বুকিং লিংক",
        type: "text",
        placeholder: "e.g. https://calendly.com/your-name",
      },
    ],
  },

  healthcare: {
    category: "healthcare",
    title: "Healthcare / Clinic",
    titleBn: "হেলথকেয়ার / ক্লিনিক",
    fields: [
      {
        key: "clinicName",
        label: "Clinic / Hospital Name",
        labelBn: "ক্লিনিক / হাসপাতালের নাম",
        type: "text",
        placeholder: "e.g. Driplare Care Clinic",
        required: true,
      },
      {
        key: "specialties",
        label: "Specialties / Services",
        labelBn: "বিশেষায়িত সেবাসমূহ",
        type: "textarea",
        placeholder: "e.g. General Medicine, Cardiology, Dermatology",
      },
      {
        key: "operatingHours",
        label: "Operating Hours",
        labelBn: "খোলার সময়",
        type: "text",
        placeholder: "e.g. 9 AM - 9 PM",
      },
      {
        key: "bookingLink",
        label: "Appointment Booking Link",
        labelBn: "অ্যাপয়েন্টমেন্ট বুকিং লিংক",
        type: "text",
        placeholder: "e.g. https://calendly.com/your-name",
      },
    ],
  },

  general: {
    category: "general",
    title: "General Assistant",
    titleBn: "সাধারণ অ্যাসিস্ট্যান্ট",
    fields: [
      {
        key: "assistantName",
        label: "Assistant Name",
        labelBn: "অ্যাসিস্ট্যান্টের নাম",
        type: "text",
        placeholder: "e.g. Driplare Assistant",
      },
      {
        key: "purpose",
        label: "Purpose / Scope",
        labelBn: "উদ্দেশ্য / কাজের পরিধি",
        type: "textarea",
        placeholder: "e.g. Answer questions about our services",
      },
      {
        key: "location",
        label: "Location / Region",
        labelBn: "লোকেশন / অঞ্চল",
        type: "text",
        placeholder: "e.g. Bangladesh",
      },
      {
        key: "bookingLink",
        label: "Booking / Contact Link",
        labelBn: "বুকিং / কন্টাক্ট লিংক",
        type: "text",
        placeholder: "e.g. https://calendly.com/your-name",
      },
    ],
  },
};

/** Ordered list of supported wizard categories (for dropdowns / iteration). */
export const WIZARD_CATEGORY_KEYS = Object.keys(WIZARD_CATEGORIES);

/** Returns the category config, or `null` when the category is unknown. */
export function getWizardCategory(category: string): WizardCategoryConfig | null {
  return WIZARD_CATEGORIES[category] ?? null;
}

/* ─────────────────── Raw Prompt Transformer ─────────────────── */

/** Reads a value from wizard data and trims it to a clean string. */
function readValue(data: WizardData, key: string): string {
  const value = data?.[key];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/**
 * Renders a boolean answer as human-readable Bengali text.
 * Truthy values (true / "true" / "yes" / "হ্যাঁ" / "1") render the
 * `conditionText` (e.g. "100 BDT advance for outside city") when provided,
 * otherwise a generic "হ্যাঁ". Falsy values render "না" (no).
 */
function readBoolean(data: WizardData, key: string, conditionText?: string): string {
  const value = data?.[key];
  const truthy =
    value === true ||
    value === "true" ||
    value === "yes" ||
    value === "হ্যাঁ" ||
    value === "1";
  if (truthy) return conditionText?.trim() || "হ্যাঁ";
  return "না";
}

/** Builds the "Role & Identity" line for a category. */
function buildRoleLine(category: string, data: WizardData): string {
  switch (category) {
    case "ecommerce": {
      const name = readValue(data, "storeName") || "আপনার স্টোর";
      return `তুমি হলো ${name} এর অফিশিয়াল AI কাস্টমার সাপোর্ট অ্যাসিস্ট্যান্ট।`;
    }
    case "restaurant": {
      const name = readValue(data, "restaurantName") || "আপনার রেস্টুরেন্ট";
      return `তুমি হলো ${name} এর ডিজিটাল ওয়েটার।`;
    }
    case "support": {
      const name = readValue(data, "companyName") || "আপনার কোম্পানি";
      return `তুমি হলো ${name} এর AI কাস্টমার সাপোর্ট এজেন্ট।`;
    }
    case "lead_gen": {
      const name = readValue(data, "businessName") || "আপনার ব্যবসা";
      return `তুমি হলো ${name} এর লিড জেনারেশন স্পেশালিস্ট।`;
    }
    case "real_estate": {
      const name = readValue(data, "agencyName") || "আপনার এজেন্সি";
      return `তুমি হলো ${name} এর ভার্চুয়াল প্রপার্টি কনসালটেন্ট।`;
    }
    case "healthcare": {
      const name = readValue(data, "clinicName") || "আপনার ক্লিনিক";
      return `তুমি হলো ${name} এর পেশেন্ট কেয়ার কো-অর্ডিনেটর।`;
    }
    default: {
      const name = readValue(data, "assistantName") || "একটি";
      return `তুমি হলো ${name} সহায়ক AI অ্যাসিস্ট্যান্ট।`;
    }
  }
}

/** Builds the "Business Rules & Policies" bullet list for a category. */
function buildRules(category: string, data: WizardData): string[] {
  const rules: string[] = [];

  switch (category) {
    case "ecommerce": {
      const productTypes = readValue(data, "productTypes");
      if (productTypes) rules.push(`প্রোডাক্ট: ${productTypes}`);

      const inside = readValue(data, "insideCityDelivery");
      const outside = readValue(data, "outsideCityDelivery");
      if (inside || outside) {
        rules.push(
          `ডেলিভারি চার্জ: শহরের ভেতরে ${inside || "নির্ধারিত নয়"}, শহরের বাইরে ${outside || "নির্ধারিত নয়"}।`
        );
      }

      const advance = readBoolean(
        data,
        "advancePaymentRequired",
        WIZARD_CATEGORIES.ecommerce.fields.find((f) => f.key === "advancePaymentRequired")
          ?.conditionText
      );
      if (advance !== "না") rules.push(`অগ্রিম পেমেন্ট: ${advance}`);

      const returnPolicy = readValue(data, "returnPolicy");
      if (returnPolicy) rules.push(`রিটার্ন পলিসি: ${returnPolicy}`);
      break;
    }

    case "restaurant": {
      const cuisine = readValue(data, "cuisineType");
      if (cuisine) rules.push(`খাবারের ধরন: ${cuisine}`);

      const delivery = readBoolean(
        data,
        "offersDelivery",
        WIZARD_CATEGORIES.restaurant.fields.find((f) => f.key === "offersDelivery")
          ?.conditionText
      );
      if (delivery !== "না") rules.push(`ডেলিভারি সুবিধা: ${delivery}`);

      const tableBooking = readBoolean(data, "acceptsTableBooking");
      rules.push(`টেবিল বুকিং: ${tableBooking}`);

      const hours = readValue(data, "operatingHours");
      if (hours) rules.push(`খোলার সময়: ${hours}`);
      break;
    }

    case "support": {
      const services = readValue(data, "primaryServices");
      if (services) rules.push(`প্রধান সেবাসমূহ: ${services}`);

      const contact = readValue(data, "supportEmailOrPhone");
      if (contact) rules.push(`সাপোর্ট যোগাযোগ: ${contact}`);

      const escalation = readValue(data, "escalationPolicy");
      if (escalation) rules.push(`এস্কেলেশন পলিসি: ${escalation}`);
      break;
    }

    case "lead_gen": {
      const services = readValue(data, "offeredServices");
      if (services) rules.push(`প্রদত্ত সেবাসমূহ: ${services}`);

      const audience = readValue(data, "targetAudience");
      if (audience) rules.push(`টার্গেট অডিয়েন্স: ${audience}`);

      const booking = readValue(data, "bookingLink");
      if (booking) rules.push(`বুকিং লিংক: ${booking}`);
      break;
    }

    case "real_estate": {
      const types = readValue(data, "propertyTypes");
      if (types) rules.push(`প্রপার্টির ধরন: ${types}`);

      const areas = readValue(data, "serviceAreas");
      if (areas) rules.push(`সার্ভিস এরিয়া: ${areas}`);

      const booking = readValue(data, "bookingLink");
      if (booking) rules.push(`ভিজিট বুকিং লিংক: ${booking}`);
      break;
    }

    case "healthcare": {
      const specialties = readValue(data, "specialties");
      if (specialties) rules.push(`বিশেষায়িত সেবাসমূহ: ${specialties}`);

      const hours = readValue(data, "operatingHours");
      if (hours) rules.push(`খোলার সময়: ${hours}`);

      const booking = readValue(data, "bookingLink");
      if (booking) rules.push(`অ্যাপয়েন্টমেন্ট বুকিং লিংক: ${booking}`);
      break;
    }

    default: {
      const purpose = readValue(data, "purpose");
      if (purpose) rules.push(`উদ্দেশ্য: ${purpose}`);

      const location = readValue(data, "location");
      if (location) rules.push(`লোকেশন: ${location}`);

      const booking = readValue(data, "bookingLink");
      if (booking) rules.push(`বুকিং / কন্টাক্ট লিংক: ${booking}`);
      break;
    }
  }

  return rules;
}

/**
 * Converts structured wizard answers into a human-readable, beautifully
 * formatted Bengali prompt:
 *
 *   Role & Identity:
 *   তুমি হলো <businessName> এর অফিশিয়াল AI কাস্টমার সাপোর্ট অ্যাসিস্ট্যান্ট।
 *
 *   Business Rules & Policies:
 *   • ডেলিভারি চার্জ: শহরের ভেতরে <insideCityDelivery>, শহরের বাইরে <outsideCityDelivery>।
 *   • অগ্রিম পেমেন্ট: <advancePaymentRequired>
 *   • রিটার্ন পলিসি: <returnPolicy>
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
  if (!getWizardCategory(category)) {
    throw new Error(`generateRawPromptFromWizard: unknown category "${category}"`);
  }

  const sections: string[] = [];

  // Role & Identity
  sections.push("Role & Identity:");
  sections.push(buildRoleLine(category, data));

  // Business Rules & Policies
  const rules = buildRules(category, data);
  if (rules.length > 0) {
    sections.push("");
    sections.push("Business Rules & Policies:");
    rules.forEach((rule) => sections.push(`• ${rule}`));
  }

  // Tone & Style
  sections.push("");
  sections.push("Tone & Style:");
  sections.push(
    "খুবই বিনয়ী, প্রফেশনাল এবং বন্ধুভাবাপন্ন। কাস্টমার যে ভাষায় কথা বলবে, সেই ভাষাতেই উত্তর দেবে।"
  );

  return sections.join("\n").trim();
}