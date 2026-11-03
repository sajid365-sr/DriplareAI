import { z } from "zod";

const couponCode = z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9_-]+$/));
const couponType = z.enum(["percentage", "fixed", "free_shipping"]);
const optionalDate = z.union([
  z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  z.date(),
]).nullable().optional();

export const MerchantCouponPayloadSchema = z.object({
  code: couponCode,
  title: z.string().trim().max(100).nullable().optional(),
  type: couponType,
  value: z.number().finite().min(0),
  minOrder: z.number().finite().min(0),
  startsAt: optionalDate,
  expiresAt: optionalDate,
  active: z.boolean().default(true),
}).superRefine((coupon, context) => {
  if (coupon.type === "percentage" && coupon.value > 100) {
    context.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100" });
  }
  if (coupon.type === "free_shipping" && coupon.value !== 0) {
    context.addIssue({ code: "custom", path: ["value"], message: "Free shipping does not use a discount value" });
  }
  if (coupon.startsAt && coupon.expiresAt && coupon.expiresAt < coupon.startsAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "End date must be after the start date" });
  }
});

export const MerchantCouponPatchSchema = z.object({
  code: couponCode.optional(),
  title: z.string().trim().max(100).nullable().optional(),
  type: couponType.optional(),
  value: z.number().finite().min(0).optional(),
  minOrder: z.number().finite().min(0).optional(),
  startsAt: optionalDate,
  expiresAt: optionalDate,
  active: z.boolean().optional(),
}).superRefine((coupon, context) => {
  if (Object.keys(coupon).length === 0) {
    context.addIssue({ code: "custom", message: "At least one field is required" });
  }
  if (coupon.type === "percentage" && coupon.value !== undefined && coupon.value > 100) {
    context.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100" });
  }
  if (coupon.type === "free_shipping" && coupon.value !== undefined && coupon.value !== 0) {
    context.addIssue({ code: "custom", path: ["value"], message: "Free shipping does not use a discount value" });
  }
  if (coupon.startsAt && coupon.expiresAt && coupon.expiresAt < coupon.startsAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "End date must be after the start date" });
  }
});
