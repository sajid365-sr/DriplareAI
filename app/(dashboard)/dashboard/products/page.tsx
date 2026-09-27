"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  ProductsHeader,
  ProductsAgentDropdown,
  AllProductsTab,
  SyncImportTab,
  type ProductAgent,
  type SavedProduct,
} from "./_components";
import type { PaginationMeta } from "./_components/ProductPagination";

const DEFAULT_LIMIT = 12;

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation("products");

  // ── State ──────────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<ProductAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  // Primary Tabbed Navigation: "all_products" | "sync_import"
  const [activeMainTab, setActiveMainTab] = useState<"all_products" | "sync_import">("all_products");

  // Saved product catalog state (paginated)
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Read page/limit from URL
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const currentLimit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));

  // Helper: push page param to URL (preserves other params)
  const pushPage = useCallback(
    (page: number, limit = currentLimit) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      params.set("limit", String(limit));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, currentLimit]
  );

  // Load agents
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/chatbots");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ProductAgent[] = data.map(
            (bot: { id: string; chatbotId: string; name: string }) => ({
              id: bot.chatbotId,
              name: bot.name,
            })
          );
          setAgents(mapped);

          const paramBotId = searchParams?.get("botId");
          const initial =
            paramBotId && mapped.some((a) => a.id === paramBotId)
              ? paramBotId
              : mapped[0].id;
          setSelectedAgentId(initial);
        }
      } catch {
        toast.error("Failed to load AI Agents.");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved products (paginated)
  const loadProducts = useCallback(async (page = currentPage, limit = currentLimit) => {
    if (!selectedAgentId) return;
    setLoadingProducts(true);
    try {
      const res = await fetch(
        `/api/chatbots/${selectedAgentId}/products?page=${page}&limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to load products");
      const json = await res.json();

      // Support both old format (array) and new paginated format ({ data, meta })
      if (Array.isArray(json)) {
        setProducts(json);
        setPaginationMeta(null);
      } else {
        setProducts(json.data ?? []);
        setPaginationMeta(json.meta ?? null);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedAgentId, currentPage, currentLimit]);

  // Load credits balance
  const loadCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/credits");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.creditsBalance === "number") setCredits(data.creditsBalance);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    loadProducts(currentPage, currentLimit);
    loadCredits();
  }, [loadProducts, loadCredits, currentPage, currentLimit]);

  // Agent change handler — also resets to page 1
  const handleSelectAgent = useCallback((id: string) => {
    setSelectedAgentId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("botId", id);
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const handlePageChange = (page: number) => {
    pushPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!selectedAgentId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading AI Agents...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 max-w-6xl mx-auto"
    >
      {/* Header with Title and Credits Badge */}
      <ProductsHeader credits={credits} />

      {/* Agent Selector Dropdown */}
      <div className="flex items-center justify-between">
        <ProductsAgentDropdown
          agents={agents}
          selectedAgentId={selectedAgentId}
          isOpen={isBotDropdownOpen}
          onToggle={() => setIsBotDropdownOpen((prev) => !prev)}
          onClose={() => setIsBotDropdownOpen(false)}
          onSelect={handleSelectAgent}
        />
      </div>

      {/* Primary 2-Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab("all_products")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all relative ${
            activeMainTab === "all_products"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t("primaryTabs.allProducts")}</span>
          <span
            className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeMainTab === "all_products"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted-foreground/15 text-muted-foreground"
            }`}
          >
            {paginationMeta ? paginationMeta.total : products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab("sync_import")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeMainTab === "sync_import"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t("primaryTabs.syncImport")}</span>
        </button>
      </div>

      {/* Primary Tab Content Area */}
      {activeMainTab === "all_products" ? (
        <AllProductsTab
          agentId={selectedAgentId}
          products={products}
          loadingProducts={loadingProducts}
          paginationMeta={paginationMeta}
          onRefresh={() => loadProducts(currentPage, currentLimit)}
          onPageChange={handlePageChange}
          onNavigateToSync={() => setActiveMainTab("sync_import")}
        />
      ) : (
        <SyncImportTab
          agentId={selectedAgentId}
          onProductsSaved={() => {
            loadProducts(1, currentLimit);
            pushPage(1);
            setActiveMainTab("all_products");
          }}
        />
      )}
    </motion.div>
  );
}
