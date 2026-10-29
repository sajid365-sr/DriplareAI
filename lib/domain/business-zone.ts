import { db } from "@/lib/core/db";
import { syncChatbotCustomPrompt } from "@/lib/ai/prompt-assembler";

export type BusinessTableTemplate = {
  name: string;
  slug: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    labelBn: string;
    type: "text" | "number" | "date" | "phone" | "select" | "boolean";
    required: boolean;
  }>;
};

const field = (key: string, label: string, labelBn: string, type: BusinessTableTemplate["fields"][number]["type"] = "text", required = false) => ({ key, label, labelBn, type, required });

export const BUSINESS_TABLE_TEMPLATES: Record<string, BusinessTableTemplate[]> = {
  ecommerce: [
    {
      name: "Customer Inquiries",
      slug: "customer_inquiries",
      description: "Product questions and customer contact requests.",
      fields: [field("customer_name", "Customer Name", "কাস্টমারের নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("product", "Product", "প্রোডাক্ট", "text", true), field("question", "Question", "প্রশ্ন")],
    },
    {
      name: "Returns & Exchanges",
      slug: "returns_exchanges",
      description: "Return, exchange, and refund requests for orders.",
      fields: [field("customer_name", "Customer Name", "কাস্টমারের নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("order_number", "Order Number", "অর্ডার নম্বর", "text", true), field("request_type", "Request Type", "অনুরোধের ধরন", "select", true)],
    },
  ],
  healthcare: [
    {
      name: "Doctor Serial",
      slug: "doctor_serial",
      description: "Appointment and doctor serial requests from patients.",
      fields: [field("doctor_name", "Doctor", "ডাক্তার", "text", true), field("patient_name", "Patient", "রোগী", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("appointment_date", "Appointment Date", "অ্যাপয়েন্টমেন্টের তারিখ", "date", true), field("preferred_time", "Preferred Time", "পছন্দের সময়")],
    },
    {
      name: "Patient Records",
      slug: "patient_records",
      description: "Patient intake and follow-up information.",
      fields: [field("patient_name", "Patient Name", "রোগীর নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("reason", "Visit Reason", "দেখানোর কারণ", "text", true), field("notes", "Notes", "নোট")],
    },
    {
      name: "Lab Test Booking",
      slug: "lab_test_booking",
      description: "Patient details, requested tests, and preferred booking time.",
      fields: [field("patient_name", "Patient Name", "রোগীর নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("test_name", "Test Name", "টেস্টের নাম", "text", true), field("booking_date", "Preferred Date", "পছন্দের তারিখ", "date")],
    },
  ],
  travel: [
    {
      name: "Traveler Data",
      slug: "traveler_data",
      description: "Traveler details and trip preferences.",
      fields: [field("traveler_name", "Traveler Name", "ভ্রমণকারীর নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("destination", "Destination", "গন্তব্য", "text", true), field("travelers_count", "Travelers", "ভ্রমণকারীর সংখ্যা", "number", true)],
    },
    {
      name: "Tour Bookings",
      slug: "tour_bookings",
      description: "Tour dates, destinations, and booking requests.",
      fields: [field("destination", "Destination", "গন্তব্য", "text", true), field("travel_date", "Travel Date", "ভ্রমণের তারিখ", "date", true), field("travelers_count", "Travelers", "ভ্রমণকারীর সংখ্যা", "number", true), field("phone", "Phone", "ফোন", "phone", true)],
    },
    {
      name: "Hotel Inquiries",
      slug: "hotel_inquiries",
      description: "Hotel stay dates, guest count, and accommodation preferences.",
      fields: [field("guest_name", "Guest Name", "অতিথির নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("destination", "Destination", "গন্তব্য", "text", true), field("check_in", "Check-in Date", "চেক-ইন তারিখ", "date", true), field("guests", "Guests", "অতিথি সংখ্যা", "number")],
    },
  ],
  restaurant: [
    {
      name: "Table Reservations",
      slug: "table_reservations",
      description: "Restaurant table bookings and guest details.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("reservation_date", "Date", "তারিখ", "date", true), field("guest_count", "Guests", "অতিথি সংখ্যা", "number", true)],
    },
    {
      name: "Food Orders",
      slug: "food_orders",
      description: "Food orders and delivery preferences.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("items", "Order Items", "অর্ডারের আইটেম", "text", true), field("delivery_address", "Delivery Address", "ডেলিভারি ঠিকানা")],
    },
    {
      name: "Takeaway Orders",
      slug: "takeaway_orders",
      description: "Pickup orders, requested time, and customer contact details.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("items", "Order Items", "অর্ডারের আইটেম", "text", true), field("pickup_time", "Pickup Time", "পিকআপের সময়")],
    },
  ],
  real_estate: [
    {
      name: "Property Inquiries",
      slug: "property_inquiries",
      description: "Property inquiries and buyer or renter preferences.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("property_type", "Property Type", "প্রপার্টির ধরন"), field("budget", "Budget", "বাজেট", "number")],
    },
    {
      name: "Viewing Requests",
      slug: "viewing_requests",
      description: "Requests to view a property.",
      fields: [field("property_name", "Property", "প্রপার্টি", "text", true), field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("viewing_date", "Viewing Date", "দেখার তারিখ", "date")],
    },
    {
      name: "Rental Applications",
      slug: "rental_applications",
      description: "Tenant details, preferred property, and move-in date.",
      fields: [field("applicant_name", "Applicant Name", "আবেদনকারীর নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("property_name", "Property", "প্রপার্টি", "text", true), field("move_in_date", "Move-in Date", "উঠে যাওয়ার তারিখ", "date")],
    },
  ],
  education: [
    {
      name: "Student Inquiries",
      slug: "student_inquiries",
      description: "Course and admission inquiries from students.",
      fields: [field("student_name", "Student", "শিক্ষার্থী", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("course", "Course", "কোর্স", "text", true), field("preferred_start", "Preferred Start", "শুরুর সময়", "date")],
    },
    {
      name: "Course Registrations",
      slug: "course_registrations",
      description: "Student registrations and selected courses.",
      fields: [field("student_name", "Student", "শিক্ষার্থী", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("course", "Course", "কোর্স", "text", true), field("notes", "Notes", "নোট")],
    },
    {
      name: "Class Inquiries",
      slug: "class_inquiries",
      description: "Prospective student questions and preferred class schedules.",
      fields: [field("student_name", "Student", "শিক্ষার্থীর নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("course", "Course", "কোর্স", "text", true), field("preferred_schedule", "Preferred Schedule", "পছন্দের সময়সূচি")],
    },
  ],
  lead_gen: [
    {
      name: "Lead Records",
      slug: "lead_records",
      description: "Prospect details and qualification notes.",
      fields: [field("lead_name", "Lead Name", "লিডের নাম", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("interest", "Interest", "আগ্রহ", "text", true), field("budget", "Budget", "বাজেট", "number")],
    },
    {
      name: "Booking Requests",
      slug: "booking_requests",
      description: "Appointments and service booking requests.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("service", "Service", "সেবা", "text", true), field("requested_date", "Requested Date", "প্রস্তাবিত তারিখ", "date")],
    },
    {
      name: "Quote Requests",
      slug: "quote_requests",
      description: "Customer contact details and requested service estimates.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("service", "Service", "সেবা", "text", true), field("budget", "Estimated Budget", "সম্ভাব্য বাজেট", "number")],
    },
  ],
  custom: [
    {
      name: "Customer Records",
      slug: "customer_records",
      description: "Customer inquiries and follow-up details.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("request", "Request", "অনুরোধ", "text", true)],
    },
    {
      name: "Service Requests",
      slug: "service_requests",
      description: "Service inquiries, contact information, and preferred dates.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("service", "Service", "সেবা", "text", true), field("preferred_date", "Preferred Date", "পছন্দের তারিখ", "date")],
    },
  ],
  support: [
    {
      name: "Support Tickets",
      slug: "support_tickets",
      description: "Customer issues, priority, and resolution status.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("issue", "Issue", "সমস্যা", "text", true), field("priority", "Priority", "অগ্রাধিকার", "select")],
    },
    {
      name: "Callback Requests",
      slug: "callback_requests",
      description: "Customers requesting a follow-up call from the support team.",
      fields: [field("customer_name", "Customer", "কাস্টমার", "text", true), field("phone", "Phone", "ফোন", "phone", true), field("topic", "Topic", "বিষয়", "text", true), field("callback_time", "Preferred Callback Time", "কলের পছন্দের সময়")],
    },
  ],
};

export function getBusinessTableTemplates(category?: string | null): BusinessTableTemplate[] {
  const normalized = category === "clinic" ? "healthcare" : category;
  return BUSINESS_TABLE_TEMPLATES[normalized ?? "custom"] ?? BUSINESS_TABLE_TEMPLATES.custom;
}

/** Provision category tables once per agent so sidebar links open a real table. */
export async function ensureBusinessTableSchemas(chatbotId: string, workspaceId: string | null, category?: string | null) {
  const seedState = workspaceId
    ? await db.workspace.findUnique({ where: { workspaceId }, select: { businessFormsSeedVersion: true } })
    : await db.chatbot.findUnique({ where: { chatbotId }, select: { businessFormsSeedVersion: true } });
  if (!seedState || seedState.businessFormsSeedVersion >= 1) return;

  const templates = getBusinessTableTemplates(category);
  const result = await db.customTableSchema.createMany({
    data: templates.map((template) => ({
      chatbotId,
      workspaceId,
      name: template.name,
      slug: template.slug,
      description: template.description,
      fields: JSON.parse(JSON.stringify(template.fields)),
    })),
    skipDuplicates: true,
  });
  if (workspaceId) {
    await db.workspace.update({ where: { workspaceId }, data: { businessFormsSeedVersion: 1 } });
  } else {
    await db.chatbot.update({ where: { chatbotId }, data: { businessFormsSeedVersion: 1 } });
  }
  if (result.count > 0) await syncChatbotCustomPrompt(chatbotId);
}
