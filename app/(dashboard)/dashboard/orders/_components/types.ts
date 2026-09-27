/**
 * Shared types for the Orders page components.
 */

export interface OrderRow {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  district?: string | null;
  items: { name: string; qty: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  courierName?: string | null;
  courierTrackingId?: string | null;
  status: string;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}
