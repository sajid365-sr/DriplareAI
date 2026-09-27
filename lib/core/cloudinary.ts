import "server-only";

import { v2 as cloudinary } from "cloudinary";

/**
 * Ensures Cloudinary SDK is initialized with current process.env credentials.
 */
function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

// ── Types ─────────────────────────────────────────────────────────────────────

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

export type CloudinaryMediaUploadResult = {
  url: string;
  publicId: string;
};

// ── Upload Utility: Product Images ────────────────────────────────────────────

/**
 * Uploads a product image to Cloudinary using the multi-tenant folder hierarchy:
 * `driplare/{env}/workspaces/{workspaceId}/products`
 */
export async function uploadProductImage(
  fileBuffer: Buffer,
  workspaceId: string
): Promise<CloudinaryUploadResult> {
  initCloudinary();
  const env = process.env.NODE_ENV === "production" ? "production" : "development";
  const folderPath = `driplare/${env}/workspaces/${workspaceId}/products`;
  const publicId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: publicId,
        resource_type: "image",
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

// ── Upload Utility: Inbox Media (Image & Audio) ───────────────────────────────

/**
 * Uploads a human-agent media attachment (image or audio) to Cloudinary.
 * Folder: `driplare/{env}/workspaces/{workspaceId}/inbox`
 *
 * For audio files, Cloudinary requires resource_type "video" (handles both).
 */
export async function uploadInboxMedia(
  fileBuffer: Buffer,
  workspaceId: string,
  mediaType: "image" | "audio"
): Promise<CloudinaryMediaUploadResult> {
  initCloudinary();
  const env = process.env.NODE_ENV === "production" ? "production" : "development";
  const folderPath = `driplare/${env}/workspaces/${workspaceId}/inbox`;
  const prefix = mediaType === "image" ? "img" : "aud";
  const publicId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Cloudinary uses "video" resource_type for audio files as well
  const resourceType = mediaType === "image" ? "image" : "video";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: publicId,
        resource_type: resourceType,
        ...(mediaType === "image" && {
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        }),
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary inbox media upload failed"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}
