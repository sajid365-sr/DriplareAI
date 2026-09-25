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

// ── Signed Direct Upload: Merchant Feedback ───────────────────────────────────

export type FeedbackUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  /** Cloudinary resource type — audio and video both live under "video". */
  resourceType: "image" | "video";
  /** Where the browser must POST the file. */
  uploadUrl: string;
};

/**
 * Builds the payload the browser needs to upload a feedback attachment
 * *directly* to Cloudinary.
 *
 * Why the server does not take the bytes itself: a screen recording can be
 * 25 MB, and Vercel rejects request bodies over 4.5 MB before our handler ever
 * runs. So the server only signs the upload — the file never touches our API,
 * and the signature is scoped to a single folder and a single timestamp.
 *
 * The folder is namespaced per user, so one merchant's signature cannot be
 * replayed to write into another merchant's space.
 */
export function createFeedbackUploadSignature(args: {
  userId: string;
  kind: "image" | "audio" | "video";
}): FeedbackUploadSignature {
  initCloudinary();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are not configured");
  }

  const env = process.env.NODE_ENV === "production" ? "production" : "development";
  const folder = `driplare/${env}/feedback/${args.userId}`;
  const timestamp = Math.round(Date.now() / 1000);

  // Only the fields signed here may be sent by the client — Cloudinary rejects
  // the upload if any signed parameter is missing or altered.
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);

  // Cloudinary serves both audio and video under the "video" resource type.
  const resourceType = args.kind === "image" ? "image" : "video";

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
  };
}
