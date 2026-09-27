"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, MousePointer2, Square, Undo2, ArrowUpRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Screenshot annotator.
 * ─────────────────────────────────────────────────────────────────────────────
 * A merchant reporting a visual bug can circle the broken part instead of
 * describing it in words — which is usually the difference between a fixable
 * report and a vague one.
 *
 * Implemented directly on the canvas 2D API: the whole editor is a shape list
 * plus a redraw, so there is no drawing library to pull in.
 */

type Tool = "pen" | "arrow" | "rect" | "ellipse";

type Point = { x: number; y: number };

type Shape =
  | { tool: "pen"; color: string; width: number; points: Point[] }
  | { tool: "arrow" | "rect" | "ellipse"; color: string; width: number; from: Point; to: Point };

/**
 * Literal hex values, not CSS variables: canvas pixels are not styled by CSS,
 * and `ctx.strokeStyle` cannot resolve `oklch(var(--primary))`. The first two
 * match the brand violet/blue, the rest are the usual annotation colours.
 */
const PALETTE = ["#7c3aed", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#111827"];

const STROKE_WIDTHS = [2, 4, 8];

/** Longest edge of the annotated output — the same ceiling the capture uses. */
const MAX_EDGE = 1600;

interface ScreenshotAnnotatorProps {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
}

export function ScreenshotAnnotator({ file, open, onCancel, onSave }: ScreenshotAnnotatorProps) {
  const { t } = useTranslation("feedback");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<Shape | null>(null);

  const [ready, setReady] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(STROKE_WIDTHS[1]);
  const [saving, setSaving] = useState(false);

  // ── Draw the base image plus every committed shape ────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const shape of shapes) paintShape(ctx, shape);
    if (drawingRef.current) paintShape(ctx, drawingRef.current);
  }, [shapes]);

  // ── Load the file into an offscreen image, then size the canvas to it ─────
  useEffect(() => {
    if (!open || !file) return;

    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      imageRef.current = image;
      const canvas = canvasRef.current;
      if (canvas) {
        const ratio = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
      }

      setShapes([]);
      drawingRef.current = null;
      setReady(true);
    };

    image.onerror = () => {
      if (!cancelled) setReady(false);
    };

    image.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  // Canvas size is only known after the image loads, so the first paint is here.
  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  // ── Pointer handling ──────────────────────────────────────────────────────
  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const point = toCanvasPoint(event);

    drawingRef.current =
      tool === "pen"
        ? { tool: "pen", color, width, points: [point] }
        : { tool, color, width, from: point, to: point };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!current) return;

    const point = toCanvasPoint(event);
    if (current.tool === "pen") current.points.push(point);
    else current.to = point;

    redraw();
  };

  const handlePointerUp = () => {
    const current = drawingRef.current;
    if (!current) return;

    drawingRef.current = null;
    // A stray click with no drag would otherwise leave an invisible shape behind.
    const isTooSmall =
      current.tool !== "pen" &&
      Math.abs(current.to.x - current.from.x) < 4 &&
      Math.abs(current.to.y - current.from.y) < 4;

    if (!isTooSmall) setShapes((prev) => [...prev, current]);
  };

  const handleUndo = () => setShapes((prev) => prev.slice(0, -1));

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9)
      );

      if (!blob) return;

      const baseName = (file?.name ?? "screenshot").replace(/\.[^.]+$/, "");
      onSave(new File([blob], `${baseName}-annotated.jpg`, { type: "image/jpeg" }));
    } finally {
      setSaving(false);
    }
  };

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "pen", icon: Pencil, label: t("annotator.tools.pen", "Pen") },
    { id: "arrow", icon: ArrowUpRight, label: t("annotator.tools.arrow", "Arrow") },
    { id: "rect", icon: Square, label: t("annotator.tools.rect", "Rectangle") },
    { id: "ellipse", icon: Circle, label: t("annotator.tools.ellipse", "Ellipse") },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("annotator.title", "Mark the problem")}</DialogTitle>
        </DialogHeader>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {tools.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-label={label}
                aria-pressed={tool === id}
                title={label}
                className={cn(
                  "size-8 rounded-md flex items-center justify-center transition-colors",
                  tool === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {PALETTE.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={value}
                aria-pressed={color === value}
                style={{ backgroundColor: value }}
                className={cn(
                  "size-6 rounded-full ring-offset-2 ring-offset-background transition-all",
                  color === value ? "ring-2 ring-foreground" : "ring-1 ring-border"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {STROKE_WIDTHS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setWidth(value)}
                aria-label={`${value}px`}
                aria-pressed={width === value}
                className={cn(
                  "size-8 rounded-md flex items-center justify-center transition-colors",
                  width === value
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/50"
                )}
              >
                <span
                  className="rounded-full bg-foreground"
                  style={{ width: value + 2, height: value + 2 }}
                />
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={shapes.length === 0}
            className="gap-1.5"
          >
            <Undo2 className="size-4" />
            {t("annotator.undo", "Undo")}
          </Button>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-muted/30">
          {ready ? (
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={cn(
                "max-w-full h-auto mx-auto block touch-none",
                tool === "pen" ? "cursor-crosshair" : "cursor-copy"
              )}
            />
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <MousePointer2 className="size-4" />
              {t("annotator.loading", "Loading image…")}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!ready || saving}>
            {t("annotator.save", "Use this image")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Painting ──────────────────────────────────────────────────────────────────

function paintShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (shape.tool === "pen") {
    if (shape.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (const point of shape.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    return;
  }

  const { from, to } = shape;

  if (shape.tool === "rect") {
    ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    return;
  }

  if (shape.tool === "ellipse") {
    const centerX = (from.x + to.x) / 2;
    const centerY = (from.y + to.y) / 2;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      Math.abs(to.x - from.x) / 2,
      Math.abs(to.y - from.y) / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    return;
  }

  paintArrow(ctx, from, to, shape.width);
}

/** A line with a solid triangular head, sized relative to the stroke width. */
function paintArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number): void {
  const headLength = Math.max(10, width * 4);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 7),
    to.y - headLength * Math.sin(angle - Math.PI / 7)
  );
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 7),
    to.y - headLength * Math.sin(angle + Math.PI / 7)
  );
  ctx.closePath();
  ctx.fill();
}
