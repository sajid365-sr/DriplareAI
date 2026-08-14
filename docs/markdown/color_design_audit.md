# 🎨 DriplareAI — Color & Design System Audit Report

> **Audit Date:** 2026-08-14 | **Project:** DriplareAI (Next.js App Router, Tailwind CSS v4)

---

## 1. 📊 Defined Color Palette & Design Tokens

The project uses a **Tailwind CSS v4 `@theme` + shadcn/ui CSS Variable** architecture. All semantic tokens are declared in `app/globals.css`.

### 1.1 Light Mode (`:root`) Token Table

| Semantic Role | CSS Variable | HSL Value | Equivalent Hex (approx.) | Tailwind Utility |
|---|---|---|---|---|
| **Background** | `--background` | `0 0% 100%` | `#FFFFFF` | `bg-background` |
| **Foreground / Text** | `--foreground` | `260 50% 10%` | `#150C26` | `text-foreground` |
| **Primary** | `--primary` | `262 83% 58%` | `#6D28D9` (violet-600) | `bg-primary`, `text-primary` |
| **Primary Foreground** | `--primary-foreground` | `210 40% 98%` | `#F8FAFC` | `text-primary-foreground` |
| **Secondary** | `--secondary` | `262 30% 96%` | `#F2EFFD` | `bg-secondary` |
| **Secondary Foreground** | `--secondary-foreground` | `262 50% 15%` | `#1E0F3D` | `text-secondary-foreground` |
| **Muted** | `--muted` | `262 20% 96%` | `#F3F2F7` | `bg-muted` |
| **Muted Foreground** | `--muted-foreground` | `262 20% 45%` | `#6B6580` | `text-muted-foreground` |
| **Accent** | `--accent` | `262 30% 96%` | `#F2EFFD` | `bg-accent` |
| **Accent Foreground** | `--accent-foreground` | `262 50% 15%` | `#1E0F3D` | `text-accent-foreground` |
| **Destructive / Error** | `--destructive` | `0 84.2% 60.2%` | `#F25252` | `bg-destructive`, `text-destructive` |
| **Destructive Foreground** | `--destructive-foreground` | `210 40% 98%` | `#F8FAFC` | `text-destructive-foreground` |
| **Card** | `--card` | `0 0% 100%` | `#FFFFFF` | `bg-card` |
| **Card Foreground** | `--card-foreground` | `260 50% 10%` | `#150C26` | `text-card-foreground` |
| **Popover** | `--popover` | `0 0% 100%` | `#FFFFFF` | `bg-popover` |
| **Popover Foreground** | `--popover-foreground` | `260 50% 10%` | `#150C26` | `text-popover-foreground` |
| **Border** | `--border` | `262 20% 90%` | `#DDD9ED` | `border-border` |
| **Input** | `--input` | `262 20% 90%` | `#DDD9ED` | `border-input` |
| **Ring** | `--ring` | `262 83% 58%` | `#6D28D9` | `ring-ring` |
| **Radius** | `--radius` | `0.75rem` | — | `rounded-lg` |

### 1.2 Dark Mode (`.dark`) Token Table

| Semantic Role | CSS Variable | HSL Value | Equivalent Hex (approx.) |
|---|---|---|---|
| **Background** | `--background` | `260 50% 4%` | `#07030F` (very dark violet) |
| **Foreground** | `--foreground` | `210 40% 98%` | `#F8FAFC` |
| **Primary** | `--primary` | `262 83% 65%` | `#8B5CF6` (lighter violet) |
| **Card** | `--card` | `260 40% 6%` | `#0E0719` |
| **Secondary** | `--secondary` | `260 30% 12%` | `#1B1329` |
| **Muted** | `--muted` | `260 30% 12%` | `#1B1329` |
| **Muted Foreground** | `--muted-foreground` | `260 20% 65%` | `#9B94B3` |
| **Accent** | `--accent` | `260 30% 12%` | `#1B1329` |
| **Destructive** | `--destructive` | `0 62.8% 30.6%` | `#7D1A1A` |
| **Border** | `--border` | `260 30% 15%` | `#231833` |
| **Input** | `--input` | `260 30% 15%` | `#231833` |
| **Ring** | `--ring` | `262 83% 65%` | `#8B5CF6` |

### 1.3 `@theme` Bridge Tokens

The `@theme` block in `globals.css` bridges the shadcn CSS variables to Tailwind v4 utility classes:

| `@theme` Token | Points To | Generated Classes |
|---|---|---|
| `--color-primary` | `hsl(var(--primary))` | `bg-primary`, `text-primary`, `border-primary` |
| `--color-secondary` | `hsl(var(--secondary))` | `bg-secondary`, `text-secondary`, etc. |
| `--color-background` | `hsl(var(--background))` | `bg-background` |
| `--color-foreground` | `hsl(var(--foreground))` | `text-foreground` |
| `--color-muted` | `hsl(var(--muted))` | `bg-muted` |
| `--color-muted-foreground` | `hsl(var(--muted-foreground))` | `text-muted-foreground` |
| `--color-destructive` | `hsl(var(--destructive))` | `bg-destructive`, `text-destructive` |
| `--color-accent` | `hsl(var(--accent))` | `bg-accent` |
| `--color-card` | `hsl(var(--card))` | `bg-card` |
| `--color-border` | `hsl(var(--border))` | `border-border` |
| `--color-ring` | `hsl(var(--ring))` | `ring-ring` |
| `--font-sans` | `"Geist", "Inter", ...` | `font-sans` |
| `--font-mono` | `"Geist Mono", ...` | `font-mono` |
| `--radius-lg` | `var(--radius)` = `0.75rem` | `rounded-lg` |

---

## 2. ⚙️ Current Architecture Setup

### 2.1 Stack Overview

```
Tailwind CSS v4
  └── @theme { ... }         ← bridges CSS vars → Tailwind utilities
  └── @layer base { :root }  ← Light mode token values (HSL)
  └── @layer base { .dark }  ← Dark mode token overrides
  └── @layer base { * }      ← Global border-border, bg-background
```

- **Framework**: Tailwind CSS **v4** — CSS-first config via `@theme` directive (no `tailwind.config.js`)
- **Config file**: `components.json` → shadcn/ui style `base-nova`, `cssVariables: true`
- **Main CSS**: `app/globals.css` — single source of truth for all tokens
- **Component Library**: **shadcn/ui** is active (`components.json` confirms this)
- **Theme Toggle**: `next-themes` via `components/theme-provider.tsx`
- **Font**: Geist + Inter (via `@theme --font-sans`)

### 2.2 shadcn/ui Integration

shadcn/ui is fully configured with:
- **Style**: `base-nova`
- **CSS Variables**: `cssVariables: true` (correct — uses CSS vars not Tailwind config)
- **Base Color**: `neutral` (but theme has been customized to violet/blue)

> [!NOTE]
> The architecture is **correctly set up** at the foundation level. `globals.css` correctly defines both `:root` and `.dark` token sets. The `@theme` block correctly maps these to Tailwind utility classes.

---

## 3. 🚨 Hardcoded Color Usage Scan

This is the most critical finding. Despite having a complete semantic token system, **many components use raw Tailwind color utilities** (e.g., `violet-600`, `blue-500`) instead of semantic tokens.

### 3.1 Severity Summary

| Color Family | Approx. Occurrences | Severity |
|---|---|---|
| `violet-*` | **50+** | 🔴 Critical |
| `blue-*` / `indigo-*` | **40+** | 🔴 Critical |
| `purple-*` | **20+** | 🟠 High |
| `emerald-*` / `green-*` | **25+** | 🟡 Medium |
| `slate-*` / `gray-*` | **15+** | 🟡 Medium |
| `amber-*` / `orange-*` | **10+** | 🟡 Medium |
| `fuchsia-*` / `pink-*` | **10+** | 🟡 Medium |
| `red-*` | **8+** | 🟢 Low (used for destructive — contextually ok) |
| `cyan-*` / `teal-*` | **5+** | 🟢 Low |

### 3.2 Top Offending Files

| File | Primary Violations | Notes |
|---|---|---|
| `components/chatbots/chat-settings.tsx` | `violet-600`, `violet-500`, `violet-100`, `blue-500`, `emerald-500`, `slate-900` | Quality tier cards use raw colors for each tier |
| `components/chatbots/InlineWizard.tsx` | `violet-600`, `violet-500`, `violet-950`, `indigo-500` | Progress bar, CTA buttons, hover states |
| `components/chatbots/SystemPromptGuide.tsx` | `purple-200`, `purple-800`, `purple-950`, `purple-100`, `slate-800` | Entire guide uses raw `purple-*` family |
| `components/chatbots/WizardModal.tsx` | `violet-500`, `indigo-500` | Gradient CTA buttons |
| `components/chatbots/ModeSwitcher.tsx` | `violet-500`, `indigo-500` | Active tab indicator gradient |
| `app/(dashboard)/dashboard/products/_components/SyncConfigPicker.tsx` | `violet-600`, `blue-500` | Gradient CTA buttons |
| `app/(dashboard)/dashboard/products/_components/SyncProgress.tsx` | `violet-600`, `blue-500` | Progress bar gradient |
| `app/(dashboard)/dashboard/products/_components/ProductReviewTable.tsx` | `violet-600`, `blue-500` | Submit button gradient |
| `app/(dashboard)/dashboard/orders/_components/OrderSheet.tsx` | `violet-600`, `blue-600` | CTA button gradient |
| `app/(dashboard)/dashboard/orders/_components/OrdersHeader.tsx` | `violet-600`, `blue-500` | Header action button |
| `app/(dashboard)/dashboard/orders/_components/FloatingBulkActionBar.tsx` | `violet-600`, `blue-600`, `gray-900`, `gray-700` | Entire bar uses raw colors |
| `app/(dashboard)/dashboard/settings/couriers/page.tsx` | `violet-600`, `blue-600` | CTA buttons |
| `components/dashboard/WorkspaceSwitcher.tsx` | `purple-600` | Workspace avatar background |
| `components/landing/FeaturesSection.tsx` | `blue-500`, `emerald-500`, `violet-500`, `amber-500`, `rose-500`, `cyan-500` | All 6 feature icon colors |
| `components/layout/NotificationBell.tsx` | `emerald-500`, `amber-500`, `fuchsia-500` | Notification type colors |

### 3.3 Key Patterns Found

#### Pattern 1: The Gradient CTA Button (Most Common)
This exact pattern appears in **10+ files**:
```tsx
// ❌ Hardcoded — found in: OrdersHeader, SyncConfigPicker, ProductReviewTable, couriers/page, etc.
className="bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-700 hover:to-blue-700 text-white"
```

#### Pattern 2: Primary/Secondary Gradient (Decorative)
```tsx
// ❌ Hardcoded — InlineWizard, WizardModal, ModeSwitcher, chat-settings
className="bg-gradient-to-r from-primary via-violet-500 to-indigo-500"
```

#### Pattern 3: Status Badge Colors (No Token)
```tsx
// ❌ Raw colors for success/warning/info states — NotificationBell, ReferralStats, etc.
"bg-emerald-500/10 text-emerald-500"
"bg-amber-500/10 text-amber-500"
"bg-blue-500/10 text-blue-600"
```

#### Pattern 4: Slate for Text (Should be foreground tokens)
```tsx
// ❌ Should use text-foreground / text-muted-foreground
"text-slate-900 dark:text-slate-100"
"text-slate-500 dark:text-slate-400"
"text-slate-800 dark:text-slate-200"
```

#### Pattern 5: Purple Family in SystemPromptGuide
```tsx
// ❌ Entire component uses raw purple-* instead of primary/*
"border-purple-200 dark:border-purple-800/60"
"bg-purple-50 dark:bg-purple-950/40"
"text-purple-950 dark:text-purple-100"
```

---

## 4. 🚀 Standardization & Refactoring Roadmap

### 4.1 Missing Tokens in `globals.css`

The current token set is missing **semantic tokens for status colors** and **brand gradient**. Add these to `globals.css`:

```css
@layer base {
  :root {
    /* ─── Existing tokens (keep) ─── */
    /* ... */

    /* ─── [NEW] Status / Feedback Tokens ─── */
    --success: 145 63% 42%;           /* emerald-500 equiv */
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;            /* amber-500 equiv */
    --warning-foreground: 0 0% 100%;
    --info: 221 83% 53%;              /* blue-500 equiv */
    --info-foreground: 0 0% 100%;

    /* ─── [NEW] Brand Gradient Stops ─── */
    --gradient-start: 262 83% 58%;   /* same as --primary */
    --gradient-mid: 262 83% 58%;     /* violet-500 */
    --gradient-end: 232 83% 55%;     /* indigo-500 */
  }

  .dark {
    /* ─── [NEW] Status Tokens (dark) ─── */
    --success: 145 63% 42%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --info: 221 83% 63%;
    --info-foreground: 0 0% 100%;

    --gradient-start: 262 83% 65%;
    --gradient-mid: 262 73% 65%;
    --gradient-end: 232 83% 65%;
  }
}
```

Then in `@theme`:
```css
@theme {
  /* ─── Add these to the existing @theme block ─── */
  --color-success: hsl(var(--success));
  --color-success-foreground: hsl(var(--success-foreground));
  --color-warning: hsl(var(--warning));
  --color-warning-foreground: hsl(var(--warning-foreground));
  --color-info: hsl(var(--info));
  --color-info-foreground: hsl(var(--info-foreground));
}
```

### 4.2 Add a Reusable Brand Gradient CSS Utility

```css
/* In globals.css — add after @theme block */
@layer utilities {
  .bg-brand-gradient {
    background: linear-gradient(
      135deg,
      hsl(var(--gradient-start)),
      hsl(var(--gradient-mid) / 0.85),
      hsl(var(--gradient-end))
    );
  }
  .text-brand-gradient {
    background: linear-gradient(
      135deg,
      hsl(var(--gradient-start)),
      hsl(var(--gradient-end))
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}
```

### 4.3 Before vs After — Migration Examples

---

#### Example 1: CTA Button Gradient (High Priority — 10+ files affected)

```tsx
// ❌ BEFORE — hardcoded in OrdersHeader, SyncConfigPicker, couriers/page, etc.
<Button
  className="bg-gradient-to-r from-violet-600 to-blue-500 
             hover:from-violet-700 hover:to-blue-700 
             text-white border-none shadow-md"
>
  Create Order
</Button>

// ✅ AFTER — uses semantic utility
<Button
  className="bg-brand-gradient 
             hover:opacity-90 
             text-white border-none shadow-md"
>
  Create Order
</Button>
```

---

#### Example 2: Status Badges (NotificationBell, ReferralStats, etc.)

```tsx
// ❌ BEFORE — hardcoded status colors
const typeConfig = {
  payment: { bg: "bg-emerald-500/10", color: "text-emerald-500" },
  usage:   { bg: "bg-amber-500/10",   color: "text-amber-500"   },
  alert:   { bg: "bg-red-500/10",     color: "text-red-500"     },
};

// ✅ AFTER — semantic tokens
const typeConfig = {
  payment: { bg: "bg-success/10",     color: "text-success"     },
  usage:   { bg: "bg-warning/10",     color: "text-warning"     },
  alert:   { bg: "bg-destructive/10", color: "text-destructive" },
};
```

---

#### Example 3: Inline Text Colors (chat-settings, SystemPromptGuide)

```tsx
// ❌ BEFORE — raw slate colors
<span className="text-slate-900 dark:text-slate-100">
  Model Label
</span>
<span className="text-slate-500 dark:text-slate-400">
  Model note/description
</span>

// ✅ AFTER — semantic tokens
<span className="text-foreground">
  Model Label
</span>
<span className="text-muted-foreground">
  Model note/description
</span>
```

---

#### Example 4: Primary-tinted backgrounds (SystemPromptGuide purple-* → primary/*)

```tsx
// ❌ BEFORE — raw purple family
<div className="rounded-2xl border border-purple-200 dark:border-purple-800/60 
                bg-purple-50 dark:bg-purple-950/40">
  <p className="text-purple-950 dark:text-purple-100 font-bold">Title</p>
  <span className="bg-purple-200/80 dark:bg-purple-900/80 
                   text-purple-800 dark:text-purple-200">Badge</span>
</div>

// ✅ AFTER — semantic tokens
<div className="rounded-2xl border border-primary/20 bg-primary/5">
  <p className="text-foreground font-bold">Title</p>
  <span className="bg-primary/15 text-primary">Badge</span>
</div>
```

---

#### Example 5: Quality Tier Cards (chat-settings.tsx)

```tsx
// ❌ BEFORE — each tier has its own raw color
const QUALITY_LEVELS = [
  { bgColor: "bg-emerald-500/10 border-emerald-500/30", activeColor: "bg-emerald-500/20 border-emerald-500" },
  { bgColor: "bg-blue-500/10 border-blue-500/30",       activeColor: "bg-blue-500/20 border-blue-500"       },
  { bgColor: "bg-violet-500/10 border-violet-500/30",   activeColor: "bg-violet-500/20 border-violet-500"   },
];

// ✅ AFTER — use semantic tokens; differentiate tiers with opacity only
const QUALITY_LEVELS = [
  { 
    key: "fast",   
    bgColor: "bg-success/10 border-success/30 hover:border-success/60",   
    activeColor: "bg-success/20 border-success shadow-success/20"   
  },
  { 
    key: "smart",  
    bgColor: "bg-info/10 border-info/30 hover:border-info/60",      
    activeColor: "bg-info/20 border-info shadow-info/20"            
  },
  { 
    key: "genius", 
    bgColor: "bg-primary/10 border-primary/30 hover:border-primary/60", 
    activeColor: "bg-primary/20 border-primary shadow-primary/20"   
  },
];
```

---

### 4.4 Refactoring Priority Roadmap

| Priority | Action | Files |
|---|---|---|
| 🔴 **P1 — Immediate** | Add `--success`, `--warning`, `--info` tokens to `globals.css` and `@theme` | `globals.css` |
| 🔴 **P1 — Immediate** | Add `.bg-brand-gradient` utility | `globals.css` |
| 🔴 **P1 — Immediate** | Replace `from-violet-600 to-blue-*` with `bg-brand-gradient` | `OrdersHeader`, `SyncConfigPicker`, `ProductReviewTable`, `OrderSheet`, `couriers/page`, `FloatingBulkActionBar`, `CreateOrderModal` (7 files) |
| 🟠 **P2 — High** | Replace `text-slate-*` with `text-foreground` / `text-muted-foreground` | `chat-settings.tsx`, `SystemPromptGuide.tsx`, `HybridSelect.tsx` |
| 🟠 **P2 — High** | Replace `purple-*` with `primary/*` | `SystemPromptGuide.tsx` |
| 🟠 **P2 — High** | Replace status badge raw colors with `success/warning/info` tokens | `NotificationBell`, `ReferralStats`, `ReferralHistory`, `InfoTab` |
| 🟡 **P3 — Medium** | Replace Quality Tier raw colors with semantic tokens | `chat-settings.tsx` |
| 🟡 **P3 — Medium** | Replace `bg-violet-*` with `bg-primary/*` in chatbot wizard components | `InlineWizard.tsx`, `WizardModal.tsx`, `ModeSwitcher.tsx`, `wizard-field-control.tsx` |
| 🟡 **P3 — Medium** | Feature card gradients (intentional multi-color design) | `FeaturesSection.tsx` *(acceptable as-is for visual variety)* |
| 🟢 **P4 — Low** | `purple-600` workspace avatar — replace with `bg-primary` | `WorkspaceSwitcher.tsx` |

---

## 5. ✅ What's Working Well

- ✅ **`globals.css` foundation is solid** — `:root` and `.dark` are properly defined
- ✅ **`@theme` bridge is correct** — all tokens generate proper Tailwind utilities
- ✅ **Base styles applied globally** — `border-border`, `bg-background`, `text-foreground` on body
- ✅ **Dark mode support** — `.dark` class token overrides are comprehensive
- ✅ **shadcn/ui correctly integrated** — `cssVariables: true` in `components.json`
- ✅ **Semantic token usage in layout/navigation** — `sidebar.tsx` and `layout.tsx` use tokens correctly
- ✅ **Font system** — Geist/Inter properly defined in `@theme`
- ✅ **Radius system** — `--radius-lg`, `--radius-md`, `--radius-sm` defined

---

> **Total Estimated Refactoring Effort:** ~6–8 hours for full standardization | ~1 hour for P1 quick wins
