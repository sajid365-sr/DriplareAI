import "server-only";

import { v2 as cloudinary } from "cloudinary";

// ── Cloudinary Configuration ──────────────────────────────────────────────────
// Configured once as a module-level singleton.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// ── Types ─────────────────────────────────────────────────────────────────────

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

// ── Upload Utility ────────────────────────────────────────────────────────────

/**
 * Uploads a product image to Cloudinary using the multi-tenant folder hierarchy:
 * `driplare/{env}/workspaces/{workspaceId}/products`
 *
 * @param fileBuffer  - Raw file buffer from the uploaded file.
 * @param workspaceId - The workspace unique ID (used to isolate uploads per tenant).
 * @returns           CloudinaryUploadResult with URL, publicId, and dimensions.
 */
export async function uploadProductImage(
  fileBuffer: Buffer,
  workspaceId: string
): Promise<CloudinaryUploadResult> {
  const env = process.env.NODE_ENV === "production" ? "production" : "development";
  const folderPath = `driplare/${env}/workspaces/${workspaceId}/products`;
  const publicId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: publicId,
        resource_type: "image",
        // Transformation: auto-format & quality for performance
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}
