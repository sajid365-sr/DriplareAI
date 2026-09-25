"use client";

import { resolveAttachmentKind, type FeedbackAttachmentKind } from "@/lib/domain/feedback-constants";

/**
 * Direct-to-Cloudinary upload for feedback attachments.
 * ─────────────────────────────────────────────────────────────────────────────
 * The file is POSTed from the browser straight to `api.cloudinary.com`; our own
 * API only ever returns a signature (a few hundred bytes). Going through a
 * route handler instead would hit Vercel's 4.5 MB request-body limit on any
 * screen recording, so both small images and large videos take this one path.
 */

export type UploadedAttachment = {
  kind: FeedbackAttachmentKind;
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};

type SignatureResponse = {
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: "image" | "video";
  uploadUrl: string;
};

/**
 * Uploads one file and reports progress.
 *
 * `XMLHttpRequest` rather than `fetch` because upload progress is not exposed
 * by `fetch` — and a 25 MB video with no progress bar feels broken.
 */
export async function uploadFeedbackAttachment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedAttachment> {
  const kind = resolveAttachmentKind(file.type);

  if (!kind) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }

  const signatureRes = await fetch("/api/feedback/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });

  if (!signatureRes.ok) {
    throw new Error("Could not authorise the upload. Please try again.");
  }

  const signature: SignatureResponse = await signatureRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", signature.uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Unexpected response from the upload service."));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status}).`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));

      xhr.send(form);
    }
  );

  return {
    kind,
    url: result.secure_url,
    publicId: result.public_id,
    mimeType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  };
}
