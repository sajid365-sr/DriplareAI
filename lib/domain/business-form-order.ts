const BUSINESS_FORM_ORDER: Record<string, string[]> = {
  ecommerce: ["customer_inquiries", "returns_exchanges"],
  healthcare: ["doctor_serial", "patient_records", "lab_test_booking"],
  travel: ["traveler_data", "tour_bookings", "hotel_inquiries"],
  restaurant: ["table_reservations", "food_orders", "takeaway_orders"],
  real_estate: ["property_inquiries", "viewing_requests", "rental_applications"],
  education: ["student_inquiries", "course_registrations", "class_inquiries"],
  lead_gen: ["lead_records", "booking_requests", "quote_requests"],
  custom: ["customer_records", "service_requests"],
  support: ["support_tickets", "callback_requests"],
};

export function sortBusinessForms<T extends { slug: string }>(forms: T[], category?: string | null): T[] {
  const order = BUSINESS_FORM_ORDER[category === "clinic" ? "healthcare" : category ?? "custom"] ?? [];
  const rank = new Map(order.map((slug, index) => [slug, index]));

  return forms
    .map((form, index) => ({ form, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.form.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.form.slug) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ form }) => form);
}
