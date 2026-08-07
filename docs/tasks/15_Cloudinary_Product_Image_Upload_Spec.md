# Cloudinary Product Image Upload & Dynamic Folder Architecture Specification

## Overview
This specification outlines the integration of Cloudinary image uploads into the product management module of the Driplare platform. It covers dynamic, workspace-isolated folder structuring, upgrading the Edit Product Modal, and enhancing the Text/Prompt Context product ingestion workflow.

---

## 1. Cloudinary SaaS Folder Architecture

To ensure multi-tenant isolation, clean media organization, and environment separation, all uploads to Cloudinary must follow a dynamic folder structure.

### Folder Hierarchy Pattern
`driplare/{env}/workspaces/{workspaceId}/{module}`

### Parameters
* **`{env}`**: Dynamically set based on `process.env.NODE_ENV` (`development` or `production`).
* **`{workspaceId}`**: The unique, immutable identifier for the active workspace (`ws_...`). Never use user names or email addresses to avoid URL encoding issues or broken paths upon user updates.
* **`{module}`**:
  * `products`: Product catalog images.
  * `branding`: Logos, banners, and brand assets.
  * `kb`: Knowledge base and chatbot training attachments.

### Cloudinary Upload Helper Logic
```typescript
// Dynamic folder path resolution
const folderPath = `driplare/${process.env.NODE_ENV || 'development'}/workspaces/${workspaceId}/products`;

const uploadResult = await cloudinary.uploader.upload(file, {
  folder: folderPath,
  public_id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  resource_type: 'image',
});
```

---

## 2. Edit Product Modal Upgrade (`@components/products/EditProductModal.tsx`)

Replace the static "Image URL" text input with an interactive drag-and-drop file uploader widget while keeping manual URL input as a secondary option.

### Key Features
1. **Drag-and-Drop Area**: Drag/drop or browse for PNG, JPG, WEBP image files.
2. **Instant Cloudinary Upload**: Automatically trigger image upload to Cloudinary upon selection, routing to the active workspace's `products` folder.
3. **Loading & State Management**: Show a subtle loading spinner or progress bar during upload.
4. **Thumbnail Preview**: Display the uploaded image preview with an "X" (Remove/Replace) button.
5. **Manual Fallback**: Include a collapsible or secondary text field to manually paste external image URLs if required.

---

## 3. Text / Prompt Context Enhancement (`@components/products/TextPromptContext.tsx`)

Allow merchants to optionally attach a product image when ingesting products via raw text prompts.

### Key Features
1. **Optional Image Picker**: Add a compact image upload dropzone below the text input field.
2. **Payload Attachment**: Upload the image to Cloudinary and attach the resulting `imageUrl` to the `/api/chatbots/[chatbotId]/products/text-ingest` endpoint payload.
3. **Backend Processing**: Ensure the `text-ingest` API saves the `imageUrl` field in the Prisma `Product` record for the extracted product(s).

---

## 4. Catalog UI Fallbacks & General Styling

1. **Gradient Placeholder Badge**: On the "All Products" grid/list view, if a product does not have an `imageUrl`, render a stylish gradient placeholder card instead of an empty icon box.
2. **Theming & i18n**: Fully support Light/Dark themes (`dark:` Tailwind classes) and bilingual translations (English & Bengali).
3. **Responsiveness**: Ensure modal and upload zones adapt seamlessly across mobile, tablet, and desktop viewports.


```
