"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  Link as LinkIcon,
  Check,
  Star,
  Trash2,
  Plus,
} from "lucide-react";
import { ProductImage } from "./ProductImage";

type ProductImageUploaderProps = {
  agentId: string;
  imageUrls?: string[] | null;
  currentImageUrl?: string | null; // legacy fallback
  onImagesUpdated: (urls: string[]) => void;
  maxImages?: number;
};

/**
 * Interactive Multi-Image Gallery Uploader for Product Catalog.
 * - Supports Multi-File Drag & Drop upload to Cloudinary (up to maxImages, default 5).
 * - External Image URL Link Addition.
 * - Gallery Grid preview with:
 *   * "Cover Image" badge for primary image (index 0).
 *   * "Set as Cover" action button.
 *   * Trash / Delete icon to remove individual images.
 */
export function ProductImageUploader({
  agentId,
  imageUrls,
  currentImageUrl,
  onImagesUpdated,
  maxImages = 5,
}: ProductImageUploaderProps) {
  // Normalize initial images list
  const getInitialImages = (): string[] => {
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      return imageUrls.filter((u) => Boolean(u && u.trim()));
    }
    if (currentImageUrl && currentImageUrl.trim()) {
      return [currentImageUrl.trim()];
    }
    return [];
  };

  const [images, setImages] = useState<string[]>(getInitialImages);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [linkInput, setLinkInput] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize initial prop changes if needed
  useEffect(() => {
    const init = getInitialImages();
    if (JSON.stringify(init) !== JSON.stringify(images)) {
      setImages(init);
    }
    // eslint-disable-next-deps
  }, [imageUrls, currentImageUrl]);

  const updateImagesList = (newImages: string[]) => {
    setImages(newImages);
    onImagesUpdated(newImages);
  };

  // ── File Upload Handler (Handles single or multiple files) ───────────────────
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const remainingSlots = maxImages - images.length;
      if (remainingSlots <= 0) {
        setError(`Maximum Limit Reached (${maxImages} images max)`);
        return;
      }

      const filesToUpload = fileArray.slice(0, remainingSlots);
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

      for (const file of filesToUpload) {
        if (!allowedTypes.includes(file.type)) {
          setError("Invalid file type. Allowed: JPG, PNG, WEBP, GIF");
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          setError("File size exceeds 5MB limit per image");
          return;
        }
      }

      setError(null);
      setIsUploading(true);

      const uploadedUrls: string[] = [];

      try {
        for (const file of filesToUpload) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`/api/chatbots/${agentId}/products/upload-image`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Failed to upload image");
          }

          const { url } = (await res.json()) as { url: string };
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          const nextImages = [...images, ...uploadedUrls];
          updateImagesList(nextImages);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [agentId, images, maxImages]
  );

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave() {
    setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      uploadFiles(e.dataTransfer.files);
    }
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      uploadFiles(e.target.files);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Gallery Actions ────────────────────────────────────────────────────────
  function handleSetAsCover(index: number) {
    if (index <= 0 || index >= images.length) return;
    const nextImages = [...images];
    const [selected] = nextImages.splice(index, 1);
    nextImages.unshift(selected);
    updateImagesList(nextImages);
  }

  function handleRemoveImage(index: number) {
    const nextImages = images.filter((_, i) => i !== index);
    updateImagesList(nextImages);
  }

  function handleAddLink() {
    const url = linkInput.trim();
    if (!url) return;
    if (images.length >= maxImages) {
      setError(`Maximum Limit Reached (${maxImages} images max)`);
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("Please enter a valid image URL (http:// or https://)");
      return;
    }
    setError(null);
    updateImagesList([...images, url]);
    setLinkInput("");
  }

  return (
    <div className="space-y-3">
      {/* Top Header & Dual Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">Product Gallery</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {images.length} / {maxImages} Images
          </span>
        </div>

        {/* Dual Mode Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("file");
              setError(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
              mode === "file"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="h-3 w-3 text-primary" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("link");
              setError(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
              mode === "link"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkIcon className="h-3 w-3 text-violet-400" />
            Add Link
          </button>
        </div>
      </div>

      {/* Upload Dropzone / Link Bar */}
      {images.length < maxImages && (
        <>
          {mode === "file" && (
            <div>
              {isUploading ? (
                <div className="flex h-20 w-full flex-col items-center justify-center rounded-xl border border-primary/40 bg-primary/5 text-center">
                  <Loader2 className="mb-1 h-5 w-5 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-primary">Uploading images...</p>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-all ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : "border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {isDragging ? "Drop images here" : "Click or drag up to 5 images here"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP · Max 5MB each</p>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {mode === "link" && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://example.com/product-image.jpg"
                  className="w-full rounded-xl border border-border bg-background pl-8 pr-8 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                {linkInput && (
                  <button
                    type="button"
                    onClick={() => setLinkInput("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddLink}
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Image
              </button>
            </div>
          )}
        </>
      )}

      {/* Interactive Gallery Thumbnail Grid */}
      {images.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-5 gap-2">
            {images.map((url, idx) => {
              const isCover = idx === 0;
              return (
                <div
                  key={`${url}-${idx}`}
                  className={`relative group h-20 rounded-xl overflow-hidden border bg-muted transition-all ${
                    isCover
                      ? "border-primary ring-2 ring-primary/20 shadow-xs"
                      : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  <ProductImage src={url} alt={`Gallery image ${idx + 1}`} className="h-full w-full" />

                  {/* Primary / Cover Image Star Badge */}
                  {isCover && (
                    <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground backdrop-blur-xs shadow-2xs">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Cover
                    </span>
                  )}

                  {/* Interactive Action Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-between p-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                    {/* Top right delete button */}
                    <div className="w-full flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors"
                        title="Remove image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Bottom set as cover button if not primary */}
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => handleSetAsCover(idx)}
                        className="w-full rounded-md bg-white/20 hover:bg-white/30 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Star className="h-2.5 w-2.5 text-amber-300" />
                        Set Cover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * The first image (marked with Cover) will be used as the main product thumbnail.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1">
          <X className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
