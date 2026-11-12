import { translateToEnglish, type TranslationMeta } from "./translation";
import { db } from "@/lib/core/db";
import { listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";

export interface CustomSchemaSummary {
  name: string;
  slug: string;
  description?: string | null;
  fields: Array<{
    key: string;
    label: string;
    type?: string;
    required?: boolean;
  }>;
}

/**
 * Category-specific Safety & Directive Headers
 */
export const CATEGORY_HEADERS: Record<string, string> = {
  ecommerce: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ZERO GUESSING POLICY: Never fabricate prices, stock status, delivery charges, or product specifications.
2. MANDATORY TOOL CALLING: Before answering any product, pricing, or order inquiry, you MUST execute the appropriate search tool (\`search_products\` / \`get_knowledge\`).
3. FALLBACK PROTOCOL: If information is missing from tool responses, politely state: "I don't have this exact information right now. Let me connect you with a human representative." and flag the session.`,

  travel: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ZERO GUESSING POLICY: Never fabricate tour package prices, departure dates, hotel ratings, or visa requirements.
2. KNOWLEDGE BASE CONSULTATION: Always reference verified package details and seasonal rates from the knowledge base before quoting prices.
3. CLEAR CANCELLATION & ADVANCE DISCLOSURE: Explicitly state booking advance requirements and cancellation policies when discussing bookings.
4. FALLBACK PROTOCOL: If a specific customized itinerary or unlisted destination is requested, collect traveler requirements and offer to connect them with a human travel advisor.`,

  healthcare: `[CRITICAL MEDICAL SAFETY DIRECTIVE - STRICT ENFORCEMENT]
1. MEDICAL DISCLAIMER: You are an AI assistant for clinic/doctor appointments and general clinic information. You are NOT a doctor.
2. STRICT PROHIBITION: NEVER diagnose conditions, recommend medications, suggest dosages, or interpret lab results.
3. EMERGENCY PROTOCOL: If the user describes emergency symptoms (severe chest pain, difficulty breathing, heavy bleeding, stroke symptoms), IMMEDIATELY advise them to call emergency services or go to the nearest emergency room.
4. APPOINTMENT FOCUS: Guide users gently to schedule an in-person or telemedicine consultation with a qualified physician.`,

  education: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ACCURATE COURSE DETAILS: Provide verified course fees, batch schedules, duration, and prerequisites. Never invent discounts or fee waivers.
2. DELIVERY MODE CLARITY: Always specify whether classes are Online (live/recorded) or Offline (campus location).
3. ENROLLMENT GUIDANCE: Guide prospective students through admission deadlines and counseling options.`,

  real_estate: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ACCURATE PROPERTY SPECS: Provide verified square footage, room counts, amenities, and project completion status.
2. NO BINDING PRICE COMMITMENT: State that quoted prices are indicative starting rates; invite clients for an on-site visit or office meeting for final negotiations.
3. SITE VISIT FOCUS: Guide serious inquiries toward scheduling a physical property inspection visit.`,

  restaurant: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. MENU & ALLERGEN AWARENESS: Provide accurate menu items and prices. Always advise customers to mention food allergies or dietary restrictions.
2. SERVICE BOUNDARY: Clearly distinguish between Dine-in table reservations and Home Delivery orders.
3. DELIVERY ZONE CHECK: Inform customers about delivery radius and minimum order requirements.`,

  support: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ACCURATE GROUNDING: Answer strictly from verified knowledge base articles and company policies.
2. EMPATHETIC TONE: Acknowledge customer frustration politely and prioritize swift resolution.
3. HUMAN ESCALATION: When an issue cannot be resolved via FAQ, collect contact details and escalate to a support specialist.`,

  lead_gen: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. VALUE FIRST: Address the customer's specific inquiry before requesting contact information.
2. LOW FRICTION: Ask for contact details naturally as part of sending a brochure, quote, or scheduling a consultation.`,

  custom: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ZERO GUESSING POLICY: Never fabricate company policies, rates, or guarantees not provided in the knowledge base.
2. PURPOSE ORIENTED: Stick strictly to the business identity and scope outlined in the instructions.
3. HUMAN FALLBACK: If an inquiry exceeds your instructions, politely offer to connect with human staff.`,

  general: `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ZERO GUESSING POLICY: Never invent unverified facts, prices, or operational rules.
2. HELPFUL & CONCISE: Provide clear, structured responses and assist customers courteously.`,
};

/** Default backward-compatible SYSTEM_HEADER */
export const SYSTEM_HEADER = CATEGORY_HEADERS.ecommerce;

/**
 * Category-specific Footers (Slot-filling & Workflow State Machines)
 */
export const CATEGORY_FOOTERS: Record<string, string> = {
  ecommerce: `[SLOT FILLING & ORDER PROTOCOL]
Follow a strict step-by-step sequence when taking orders:
Step 1: Confirm product name, variant/size, and quantity.
Step 2: Collect customer Full Name and valid 10-11 digit Phone Number.
Step 3: Collect full Delivery Address (District, Thana, Road/Area).
Step 4: Present order summary (Item total + Delivery charge) and explicitly ask: "Would you like me to confirm this order?"
Step 5: Execute \`create_order\` tool ONLY after receiving explicit customer confirmation ("Yes", "Confirm", "হ্যাঁ").`,

  travel: `[TOUR BOOKING & INQUIRY PROTOCOL]
Follow a structured sequence when assisting travelers:
Step 1: Clarify target destination and preferred travel month or dates.
Step 2: Confirm number of travelers (adults and children).
Step 3: Collect customer Full Name and valid Phone Number.
Step 4: Present package summary (destination, duration, traveler count) and confirm details.
Step 5: Record the booking inquiry / intake record upon customer confirmation.`,

  healthcare: `[APPOINTMENT SCHEDULING PROTOCOL]
Follow a gentle, privacy-conscious sequence when booking appointments:
Step 1: Identify the department or doctor requested, or summarize the general health inquiry.
Step 2: Collect patient Full Name, Age, and valid Phone Number.
Step 3: Ask for preferred Consultation Date and Time slot (Morning/Evening).
Step 4: Remind the patient: "Please bring any previous medical reports with you."
Step 5: Confirm appointment details with the patient and record the booking request.`,

  education: `[STUDENT COUNSELING & ADMISSION PROTOCOL]
Follow a helpful guidance sequence for prospective students:
Step 1: Confirm the course/program of interest.
Step 2: Ask for student's current educational background or qualification.
Step 3: Collect student/parent Full Name and Phone Number.
Step 4: Share batch timing options and offer a free counseling session or demo class.
Step 5: Record the admission lead upon confirmation.`,

  real_estate: `[PROPERTY INQUIRY & SITE VISIT PROTOCOL]
Follow a professional consultant sequence:
Step 1: Understand client's requirement: Property Type (Apartment/Plot/Commercial), Budget range, and Preferred Location.
Step 2: Collect client Full Name and valid Phone Number.
Step 3: Propose available inspection dates for a site visit.
Step 4: Confirm visit details and schedule the property consultation.`,

  restaurant: `[ORDER & TABLE RESERVATION PROTOCOL]
Follow an efficient service sequence:
- For Table Reservations: Confirm number of guests, date, time, and customer phone number.
- For Delivery Orders: Confirm selected items, quantity, full delivery address, and phone number.
- Always confirm final summary with estimated delivery/reservation time before completing.`,

  support: `[SUPPORT ESCALATION PROTOCOL]
Step 1: Understand customer issue and provide solutions from knowledge base.
Step 2: If unresolved, collect customer Name, Phone, and Order/Ticket Reference if applicable.
Step 3: Assure customer of swift human follow-up.`,

  lead_gen: `[LEAD QUALIFICATION PROTOCOL]
Step 1: Understand customer's primary need or pain point.
Step 2: Briefly explain how the service solves it.
Step 3: Request Full Name, Phone Number, or Email to share detailed pricing and proposal.
Step 4: Thank them warmly and confirm that our team will contact them shortly.`,

  custom: `[GENERAL INTAKE PROTOCOL]
Step 1: Answer questions accurately based on business rules and knowledge base.
Step 2: When the user wants to book, purchase, or inquire further, collect their Name, Phone, and specific requirements.
Step 3: Confirm the information with the customer.`,

  general: `[STANDARD ASSISTANT PROTOCOL]
Assist customers politely. When customer requests follow-up or bookings, collect their contact details accurately.`,
};

/** Default backward-compatible SYSTEM_FOOTER */
export const SYSTEM_FOOTER = CATEGORY_FOOTERS.ecommerce;

/**
 * Category-specific Instruction Blocks injected between prompt and footer.
 */
export const CATEGORY_INSTRUCTIONS: Record<string, string> = {
  ecommerce:
    "You are operating as an e-commerce sales assistant. Always prioritize product discovery, accurate pricing, and smooth order collection.",
  travel:
    "You are operating as a tour & travel consultant. Help travelers discover destination packages, understand itineraries, and book tours.",
  healthcare:
    "You are operating as a patient care coordinator. Provide accurate clinic information, doctor schedules, and assist with appointments with empathy.",
  education:
    "You are operating as an educational counselor. Help students explore courses, curriculum benefits, admission requirements, and class schedules.",
  real_estate:
    "You are operating as a real estate property consultant. Help buyers/renters find properties matching their preferences and schedule site visits.",
  restaurant:
    "You are operating as a digital waiter. Help customers explore the menu, take food orders, and manage table reservations smoothly.",
  support:
    "You are operating as a customer support agent. Prioritize accurate, empathetic answers grounded in the knowledge base.",
  lead_gen:
    "You are operating as a lead generation specialist. Guide conversations toward understanding needs and collecting qualified contact information.",
  custom:
    "You are operating as an AI assistant for this business. Follow the business rules strictly and assist clients professionally.",
  general: "",
};

export function getCategoryHeader(category?: string): string {
  if (!category) return CATEGORY_HEADERS.general;
  return CATEGORY_HEADERS[category] ?? CATEGORY_HEADERS.general;
}

export function getCategoryFooter(
  category?: string,
  customSchemas?: CustomSchemaSummary[]
): string {
  const baseFooter =
    (category && CATEGORY_FOOTERS[category]) || CATEGORY_FOOTERS.general;

  if (!customSchemas || customSchemas.length === 0) {
    return baseFooter;
  }

  // If custom schemas exist for this bot, append dynamic intake form directives
  const schemaDirectives = customSchemas
    .map((s) => {
      const fieldList = s.fields
        .map((f) => `${f.label} (\`${f.key}\`${f.required ? ", required" : ""})`)
        .join(", ");
      return `Form "${s.name}" (Slug: "${s.slug}"):\n  Required Fields: ${fieldList}`;
    })
    .join("\n\n");

  const customBlock = `[CUSTOM DATA INTAKE FORMS AVAILABLE]
The merchant has configured the following intake forms for this assistant:
${schemaDirectives}

PROTOCOL FOR CUSTOM FORMS:
1. When the customer wants to book, register, or submit info matching any form above, collect all required fields one by one.
2. Present a clear summary of all collected fields to the customer and ask: "Would you like me to confirm and save this information?"
3. Upon explicit customer confirmation ("Yes", "Confirm", "হ্যাঁ"), execute the \`save_custom_data\` tool with \`schemaSlug\` and the collected key-value pairs.`;

  return `${baseFooter}\n\n${customBlock}`;
}

export function getCategoryInstructions(category?: string): string {
  if (!category) return "";
  return CATEGORY_INSTRUCTIONS[category] ?? "";
}

/**
 * Lightweight language detection — returns "bn" when the text contains Bengali
 * Unicode characters, otherwise "en".
 */
export function detectLanguage(text: string): "bn" | "en" {
  return /[\u0980-\u09FF]/.test(text) ? "bn" : "en";
}

/**
 * Compiles a raw (Bengali/Banglish/English) user prompt into the full
 * production system prompt with dynamic category headers and footers.
 */
export async function compilePrompt(
  rawPrompt: string,
  templateCategory?: string,
  meta?: TranslationMeta,
  customSchemas?: CustomSchemaSummary[]
): Promise<string> {
  const trimmed = (rawPrompt ?? "").trim();
  if (!trimmed) {
    throw new Error("compilePrompt: rawPrompt is required");
  }

  // Translate Bengali/Banglish input to professional English instructions.
  const translated = await translateToEnglish(trimmed, meta);

  const header = getCategoryHeader(templateCategory);
  const categoryBlock = getCategoryInstructions(templateCategory);
  const footer = getCategoryFooter(templateCategory, customSchemas);

  const parts = [header, translated];
  if (categoryBlock) parts.push(categoryBlock);
  parts.push(footer);

  return parts.join("\n\n");
}

/**
 * Automatically synchronizes and updates the chatbot's compiledPrompt and systemPrompt
 * whenever custom schemas/forms are created, modified, or deleted.
 */
export async function syncChatbotCustomPrompt(chatbotId: string): Promise<string | null> {
  try {
    const bot = await db.chatbot.findUnique({
      where: { chatbotId },
      select: {
        chatbotId: true,
        userId: true,
        workspaceId: true,
        chatbotMode: true,
        rawPrompt: true,
        systemPrompt: true,
        compiledPrompt: true,
      },
    });

    if (!bot) return null;

    const workspaceBots = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId }];
    const schemas = await listWorkspaceBusinessForms(bot.workspaceId, workspaceBots.map((workspaceBot) => workspaceBot.chatbotId));

    const customSchemas: CustomSchemaSummary[] = schemas.map((s) => ({
      name: s.name,
      slug: s.slug,
      description: s.description,
      fields: Array.isArray(s.fields) ? (s.fields as unknown as CustomSchemaSummary["fields"]) : [],
    }));

    let updatedPrompt: string;

    if (bot.rawPrompt) {
      updatedPrompt = await compilePrompt(
        bot.rawPrompt,
        bot.chatbotMode,
        { userId: bot.userId },
        customSchemas
      );
    } else {
      const basePrompt = bot.compiledPrompt || bot.systemPrompt || "";
      // Strip any previously appended custom forms block
      const cleanBase = basePrompt.replace(/\n\n\[CUSTOM DATA INTAKE FORMS AVAILABLE\][\s\S]*$/, "").trim();
      if (customSchemas.length > 0) {
        const footerWithCustom = getCategoryFooter(bot.chatbotMode, customSchemas);
        const match = footerWithCustom.match(/\[CUSTOM DATA INTAKE FORMS AVAILABLE\][\s\S]*$/);
        updatedPrompt = match ? `${cleanBase}\n\n${match[0]}` : cleanBase;
      } else {
        updatedPrompt = cleanBase;
      }
    }

    await db.chatbot.update({
      where: { chatbotId },
      data: {
        compiledPrompt: updatedPrompt,
        systemPrompt: updatedPrompt,
      },
    });

    return updatedPrompt;
  } catch (err) {
    console.error("[SYNC_CHATBOT_CUSTOM_PROMPT_ERROR]", err);
    return null;
  }
}
