/**
 * Shared types for the Orders page components.
 */

export interface ModificationHistoryEntry {
  modifiedAt: string;
  modifiedBy?: string;
  reason?: string;
  previous?: Record<string, unknown>;
  updated?: Record<string, unknown>;
}

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
  modificationHistory?: ModificationHistoryEntry[] | null;
  changeRequests?: unknown[] | null;
  codCollected?: boolean;
  codCollectedAt?: string | null;
  cancellationReason?: string | null;
  returnReason?: string | null;
  damageNote?: string | null;
  createdAt: string;
  updatedAt: string;
}
