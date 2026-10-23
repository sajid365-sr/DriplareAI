import type { OrderItem } from "@/lib/domain/order-schema";

export type OrderReceiptDetails = {
  brandName: string;
  orderId: string;
  recordId: string;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  district: string | null;
  items: OrderItem[];
  itemsSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  createdAt: Date;
};

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character] ?? character;
  });

function splitLines(value: string, maxLength: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (Array.from(next).length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function renderLines(value: string, x: number, y: number, maxLength: number, lineHeight = 34) {
  return splitLines(value, maxLength)
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
}

function formatMoney(value: number): string {
  return `৳${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(value)}`;
}

/** Creates a compact, branded receipt image after an order has been saved. */
export function createOrderReceiptSvg(details: OrderReceiptDetails): string {
  let itemY = 620;
  const itemRows = details.items.map((item) => {
    const nameLines = splitLines(item.name, 42);
    const rowHeight = Math.max(88, 44 + nameLines.length * 30);
    const row = `<g>
      <text x="84" y="${itemY + 8}" class="item-name">${renderLines(item.name, 84, itemY + 8, 42, 30)}</text>
      <text x="84" y="${itemY + 42 + nameLines.length * 30}" class="muted small">${item.qty} × ${formatMoney(item.price)} each</text>
      <text x="1116" y="${itemY + 26}" text-anchor="end" class="item-total">${formatMoney(item.qty * item.price)}</text>
      <line x1="84" y1="${itemY + rowHeight}" x2="1116" y2="${itemY + rowHeight}" class="rule" />
    </g>`;
    itemY += rowHeight;
    return row;
  }).join("");

  const address = [details.deliveryAddress, details.district].filter(Boolean).join(", ");
  const addressLines = splitLines(address || "—", 58);
  const customerTop = itemY + 92;
  const addressTop = customerTop + 116;
  const totalsTop = addressTop + addressLines.length * 36 + 54;
  const height = totalsTop + 360;
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(details.createdAt);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
  <defs>
    <linearGradient id="header" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171923"/><stop offset="1" stop-color="#29254a"/></linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#111827" flood-opacity=".14"/></filter>
    <style>
      text { font-family: "Noto Sans Bengali", "Nirmala UI", Arial, sans-serif; fill: #191827; }
      .muted { fill: #77758a; } .small { font-size: 25px; }
      text.white { fill: #fff; } text.accent { fill: #c8bbff; } text.good { fill: #18784f; }
      .rule { stroke: #e8e6ef; stroke-width: 2; }
      .item-name { font-size: 32px; font-weight: 700; }
      .item-total { font-size: 31px; font-weight: 700; }
    </style>
  </defs>
  <rect width="1200" height="${height}" fill="#f2f0f7"/>
  <rect x="42" y="36" width="1116" height="${height - 72}" rx="40" fill="#fff" filter="url(#shadow)"/>
  <path d="M82 36 H1118 Q1158 36 1158 76 V232 H42 V76 Q42 36 82 36Z" fill="url(#header)"/>
  <rect x="42" y="226" width="1116" height="8" fill="#9b73ff"/>
  <circle cx="112" cy="112" r="42" fill="#9b73ff"/>
  <text x="112" y="125" text-anchor="middle" font-size="38" font-weight="700" class="white">${escapeXml(details.brandName.slice(0, 1).toUpperCase())}</text>
  <text x="180" y="106" font-size="38" font-weight="700" class="white">${escapeXml(details.brandName.slice(0, 34))}</text>
  <text x="180" y="150" font-size="21" letter-spacing="3" class="accent">ORDER RECEIPT</text>
  <text x="84" y="300" font-size="42" font-weight="700">Order #${escapeXml(details.orderId)}</text>
  <rect x="904" y="262" width="210" height="52" rx="26" fill="#e6f7ef"/>
  <circle cx="934" cy="288" r="7" fill="#1ca76a"/>
  <text x="956" y="297" font-size="22" font-weight="700" class="good">CONFIRMED</text>
  <text x="84" y="346" font-size="23" class="muted">Placed on ${escapeXml(dateLabel)}</text>
  <rect x="72" y="388" width="1056" height="140" rx="24" fill="#f7f6fa"/>
  <text x="100" y="430" font-size="19" letter-spacing="2" class="muted">DELIVER TO</text>
  <text x="100" y="472" font-size="29" font-weight="700">${escapeXml(details.customerName)}</text>
  <text x="100" y="508" font-size="23" class="muted">${escapeXml(details.customerPhone || "")}</text>
  <text x="84" y="580" font-size="20" letter-spacing="2" class="muted">ITEMS</text>
  ${itemRows}
  <text x="84" y="${customerTop}" font-size="21" letter-spacing="2" class="muted">DELIVERY ADDRESS</text>
  <text x="84" y="${customerTop + 42}" font-size="25">${renderLines(address || "—", 84, customerTop + 42, 58, 36)}</text>
  <text x="84" y="${addressTop + addressLines.length * 36 + 18}" font-size="21" class="muted">Order ID: ${escapeXml(details.recordId)}</text>
  <line x1="84" y1="${totalsTop}" x2="1116" y2="${totalsTop}" class="rule"/>
  <text x="84" y="${totalsTop + 48}" font-size="25" class="muted">Subtotal</text>
  <text x="1116" y="${totalsTop + 48}" text-anchor="end" font-size="25">${formatMoney(details.itemsSubtotal)}</text>
  <text x="84" y="${totalsTop + 84}" font-size="25" class="muted">Delivery</text>
  <text x="1116" y="${totalsTop + 84}" text-anchor="end" font-size="25">${formatMoney(details.deliveryFee)}</text>
  <rect x="72" y="${totalsTop + 112}" width="1056" height="100" rx="22" fill="#191923"/>
  <text x="108" y="${totalsTop + 154}" font-size="24" font-weight="700" class="white">TOTAL · CASH ON DELIVERY</text>
  <text x="108" y="${totalsTop + 188}" font-size="20" class="accent">Order ${escapeXml(details.orderId)}</text>
  <text x="1090" y="${totalsTop + 178}" text-anchor="end" font-size="43" font-weight="700" class="white">${formatMoney(details.totalAmount)}</text>
  <text x="600" y="${totalsTop + 278}" text-anchor="middle" font-size="27" font-weight="700">Thank you for your order</text>
  <text x="600" y="${totalsTop + 316}" text-anchor="middle" font-size="20" class="muted">${escapeXml(details.brandName)}</text>
</svg>`;
}
