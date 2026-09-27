# Task 03: Neon DB Schema Migration (Postgres + pgvector)

## Objective
Update existing Prisma schema to support real-time omnichannel conversations, inventory management, AI embeddings, and orders.

## Required Schema Elements
1. **Prisma Extensions**: Ensure `pgvector` extension is active for RAG search.
2. **`Conversation` Model**:
   - `id`, `botId`, `customerId`, `customerName`, `platform` (FB/IG/WA), `isAiActive` (Boolean, default `true`), `leadTag`, `assignedAgentId`, `updatedAt`.
3. **`Product` Model**:
   - `id`, `botId`, `title`, `price`, `stockQuantity`, `description`, `imageUrl`, `embedding` (Vector).
4. **`Order` Model**:
   - `id`, `conversationId`, `customerPhone`, `deliveryAddress`, `totalAmount`, `courierName`, `courierTrackingCode`, `status`.