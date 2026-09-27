"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, Check, Loader2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CSVProductItem } from "@/app/api/chatbots/[chatbotId]/products/csv-ingest/route";

type CSVBatchUploaderProps = {
  agentId: string;
  onSuccess: () => void;
};

/**
 * Parses raw CSV content into array of product items.
 */
function parseCSV(text: string): CSVProductItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse header line
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ""));

  const getIndex = (keys: string[]) => {
    return headers.findIndex((h) => keys.includes(h));
  };

  const nameIdx = getIndex(["name", "title", "product_name", "productname", "product"]);
  const descIdx = getIndex(["description", "desc", "details"]);
  const priceIdx = getIndex(["price", "cost", "amount"]);
  const currIdx = getIndex(["currency", "curr"]);
  const stockIdx = getIndex(["stock", "quantity", "qty", "count", "inventory"]);
  const colorIdx = getIndex(["colors", "color"]);
  const sizeIdx = getIndex(["sizes", "size"]);
  const imgIdx = getIndex(["image_url", "image", "img", "imageurl", "photo"]);

  const items: CSVProductItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === 0) continue;

    const name = nameIdx !== -1 ? row[nameIdx]?.trim() : "";
    if (!name) continue;

    const description = descIdx !== -1 ? row[descIdx]?.trim() || null : null;
    const rawPrice = priceIdx !== -1 ? row[priceIdx]?.replace(/[^0-9.]/g, "") : "";
    const price = rawPrice ? Number(rawPrice) : null;
    const currency = currIdx !== -1 ? row[currIdx]?.trim() || "BDT" : "BDT";

    const rawColors = colorIdx !== -1 ? row[colorIdx] : "";
    const colors = rawColors ? rawColors.split(/[,/|]/).map((c) => c.trim()).filter(Boolean) : [];

    const rawSizes = sizeIdx !== -1 ? row[sizeIdx] : "";
    const sizes = rawSizes ? rawSizes.split(/[,/|]/).map((s) => s.trim()).filter(Boolean) : [];

    const imageUrl = imgIdx !== -1 ? row[imgIdx]?.trim() || null : null;

    const rawStock = stockIdx !== -1 ? row[stockIdx]?.replace(/[^0-9]/g, "") : "";
    const stock = rawStock ? Number(rawStock) : 10;

    items.push({
      name,
      description,
      price: price && !isNaN(price) ? price : null,
      currency: currency || "BDT",
      stock: !isNaN(stock) ? stock : 10,
      colors: colors.length > 0 ? colors : null,
      sizes: sizes.length > 0 ? sizes : null,
      imageUrl,
    });
  }

  return items;
}

/**
 * Basic CSV row tokenizer handling quoted strings.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function CSVBatchUploader({ agentId, onSuccess }: CSVBatchUploaderProps) {
  const { t } = useTranslation("products");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedItems, setParsedItems] = useState<CSVProductItem[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(csv|txt|xlsx)$/i)) {
      toast.error("Please upload a valid .csv file");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const items = parseCSV(content);
        if (items.length === 0) {
          toast.error("No valid product rows found in CSV. Check column headers.");
        } else {
          setParsedItems(items);
          toast.success(`Found ${items.length} products in ${file.name}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const downloadSampleCSV = () => {
    const sampleContent =
      'name,description,price,currency,stock,colors,sizes,imageUrl\n' +
      '"Irani Borka","Premium quality soft Irani borka",2500,BDT,15,"Black, Olive, Purple","Free Size",https://res.cloudinary.com/demo/image/upload/sample.jpg\n' +
      '"Love Pearl Necklace","Elegant pearl gift box set",1500,BDT,5,"Gold, Silver","One Size",\n';

    const blob = new Blob([sampleContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_products_catalog.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample CSV downloaded!");
  };

  const handleBatchSubmit = async () => {
    if (parsedItems.length === 0) return;

    setIsUploading(true);
    try {
      const res = await fetch(`/api/chatbots/${agentId}/products/csv-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedItems }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Batch import failed");
      }

      const data = await res.json();
      toast.success(`Successfully imported ${data.count} products!`);
      setParsedItems([]);
      setFileName("");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Batch import failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sample Download Bar */}
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">
            Need a standard template? Download our sample CSV header structure.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadSampleCSV}
          className="h-8 gap-1.5 rounded-lg text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
        >
          <Download className="h-3.5 w-3.5" />
          Download Sample CSV
        </Button>
      </div>

      {/* Drag & Drop Dropzone */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,.txt,.xlsx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/10 scale-[0.99]"
            : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">
          {fileName ? fileName : "Drag and drop your catalog CSV here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supported format: <span className="font-semibold text-foreground">.csv, .xlsx</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl text-xs font-semibold h-8"
        >
          Browse File
        </Button>
      </div>

      {/* Parsed Items Preview & Import Actions */}
      {parsedItems.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                <Check className="h-3 w-3" />
                {parsedItems.length} Products Ready for Import
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setParsedItems([]);
                setFileName("");
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Mini Table Preview */}
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-muted/20">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/50 font-semibold text-muted-foreground sticky top-0">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Colors</th>
                  <th className="p-2">Sizes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {parsedItems.slice(0, 5).map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="p-2 font-medium text-foreground">{item.name}</td>
                    <td className="p-2 font-semibold text-emerald-500">
                      {item.price ? `${item.price} ${item.currency}` : "N/A"}
                    </td>
                    <td className="p-2 font-semibold text-foreground">{item.stock ?? 10}</td>
                    <td className="p-2 text-muted-foreground">{item.colors?.join(", ") || "-"}</td>
                    <td className="p-2 text-muted-foreground">{item.sizes?.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedItems.length > 5 && (
              <div className="p-2 text-center text-[11px] text-muted-foreground font-medium bg-muted/40 border-t border-border/40">
                + {parsedItems.length - 5} more products...
              </div>
            )}
          </div>

          {/* Submit Import Button */}
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleBatchSubmit}
              disabled={isUploading}
              className="rounded-xl text-xs font-semibold h-9 gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Products...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Import {parsedItems.length} Products Now
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
