# Task 02: Low-Friction E-Commerce & Inventory Management

## Visual & Design References 🖼️
- **Navigation & Store Layout**: `docs/ui-references/RepliBee 2.png`
- **Store & Product Menu Context**: `docs/ui-references/RepliBee 3.png`
- **Automation & Settings UI**: `docs/ui-references/RepliBee 4.png`

## Key Requirements
1. **Multi-Mode Inventory Input (Low Friction)**:
   - **Mode A (Facebook Post Sync)**: Fetch latest FB page posts using Graph API via n8n. Parse caption with AI to extract Product Title, Price, Variants (Size/Color) into Neon DB automatically.
   - **Mode B (Unstructured Text Prompt)**: Provide a single text box for merchants to paste general product/delivery notes without forcing strict tabular data input.
   - **Mode C (Google Sheet / CSV Import)**: Keep existing batch import option.

2. **In-Chat Order Engine**:
   - Embed order creation directly within the Live Inbox (Right Sidebar).
   - Automatically insert confirmed orders into Neon DB `orders` table.
   - Integrate Courier API hooks (Steadfast / Pathao) to automatically fetch tracking numbers upon order submit.