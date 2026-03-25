"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/layout/Container";
import AppToast, { type AppToastState } from "@/components/ui/AppToast";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock: number;
  active: 0 | 1;
  createdAt: number;
  coverImage?: string | null;
  featured?: 0 | 1;
  deal?: 0 | 1;
  categoryNames?: string | null;
  imageCount?: number;
  externalSource?: string | null;
  externalSku?: string | null;
  syncStock?: 0 | 1;
  syncPrice?: 0 | 1;
  lastSyncedAt?: number | null;
};

type ProductActiveFilter = "" | "1" | "0";
type ProductSort = "new" | "old" | "high" | "low";
type ProductQuickView = "all" | "olist" | "missingPhoto" | "syncing" | "outOfStock";

type ProductStats = {
  total: number;
  on: number;
  off: number;
  olist: number;
  missingPhoto: number;
  syncing: number;
  outOfStock: number;
};

type ProductPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type OlistStatus = {
  mode: "partners" | "tiny";
  configured: boolean;
  hasIdToken: boolean;
  hasToken: boolean;
  hasProductsUrl: boolean;
  hasProductDetailsUrl: boolean;
  hasProductStockUrl: boolean;
  useStockEndpoint?: boolean;
  blockedCount?: number;
};

type OlistActionResult = {
  ok: boolean;
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  nextPage?: number;
  nextOffset?: number;
  hasMore?: boolean;
  error?: string;
};

type OlistDebugResult = {
  ok: boolean;
  error?: string;
  result?: {
    query: string;
    matched: boolean;
    selectedRow: {
      id: string;
      externalSku: string;
      name: string;
    } | null;
    parsedDetail: {
      externalSku: string;
      name: string;
      price: number;
      stock: number;
      photoUrl?: string | null;
    } | null;
    parsedStock: number | null;
    rawSearch: unknown;
    rawDetail: unknown;
    rawStock: unknown;
  };
};

type CategoryOption = {
  id: string;
  name: string;
};

const OLIST_CURSOR_STORAGE_KEY = "felicio-olist-import-cursor";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatSyncDate(value?: number | null) {
  if (!value) return "Ainda nao sincronizado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default function AdminProductsClient() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<ProductActiveFilter>("");
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>("new");
  const [quickView, setQuickView] = useState<ProductQuickView>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<ProductStats>({
    total: 0,
    on: 0,
    off: 0,
    olist: 0,
    missingPhoto: 0,
    syncing: 0,
    outOfStock: 0,
  });
  const [loadedCount, setLoadedCount] = useState(0);
  const [pagination, setPagination] = useState<ProductPagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [importingOlist, setImportingOlist] = useState(false);
  const [syncingOlist, setSyncingOlist] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [autoImporting, setAutoImporting] = useState(false);
  const [autoStockSyncing, setAutoStockSyncing] = useState(false);
  const [autoImportDelay, setAutoImportDelay] = useState(10);
  const [autoImportMessage, setAutoImportMessage] = useState("");
  const [autoStockMessage, setAutoStockMessage] = useState("");
  const [olistPage, setOlistPage] = useState(1);
  const [olistOffset, setOlistOffset] = useState(0);
  const [olistPageInput, setOlistPageInput] = useState("1");
  const [olistOffsetInput, setOlistOffsetInput] = useState("1");
  const [olistBatchSize] = useState(10);
  const [olistPagesPerRun, setOlistPagesPerRun] = useState(1);
  const [olistSearch, setOlistSearch] = useState("");
  const autoImportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStockEnabledRef = useRef(false);
  const [olistStatus, setOlistStatus] = useState<OlistStatus>({
    mode: "tiny",
    configured: false,
    hasIdToken: false,
    hasToken: false,
    hasProductsUrl: false,
    hasProductDetailsUrl: false,
    hasProductStockUrl: false,
    useStockEndpoint: false,
  });
  const [toast, setToast] = useState<AppToastState>({
    open: false,
    title: "",
    message: "",
    tone: "default",
  });

  const counts = stats;

  function showToast(next: Omit<AppToastState, "open">) {
    setToast({ open: true, ...next });
  }

  async function loadOlistStatus() {
    try {
      const res = await fetch("/api/admin/olist/import", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return null;
      }

      if (!res.ok || !data?.ok) {
        setOlistStatus({
          mode: "tiny",
          configured: false,
          hasIdToken: false,
          hasToken: false,
          hasProductsUrl: false,
          hasProductDetailsUrl: false,
          hasProductStockUrl: false,
          useStockEndpoint: false,
          blockedCount: 0,
        });
        return;
      }

      setOlistStatus({
        mode: data.mode === "partners" ? "partners" : "tiny",
        configured: Boolean(data.configured),
        hasIdToken: Boolean(data.hasIdToken),
        hasToken: Boolean(data.hasToken),
        hasProductsUrl: Boolean(data.hasProductsUrl),
        hasProductDetailsUrl: Boolean(data.hasProductDetailsUrl),
        hasProductStockUrl: Boolean(data.hasProductStockUrl),
        useStockEndpoint: Boolean(data.useStockEndpoint),
        blockedCount: Number(data.blockedCount ?? 0),
      });
    } catch {
      setOlistStatus({
        mode: "tiny",
        configured: false,
        hasIdToken: false,
        hasToken: false,
        hasProductsUrl: false,
        hasProductDetailsUrl: false,
        hasProductStockUrl: false,
        useStockEndpoint: false,
        blockedCount: 0,
      });
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setCategoryOptions([]);
        return;
      }

      setCategoryOptions(
        Array.isArray(data.items)
          ? data.items.map((item: { id?: string; name?: string }) => ({
              id: String(item.id || ""),
              name: String(item.name || ""),
            }))
          : [],
      );
    } catch {
      setCategoryOptions([]);
    }
  }

  async function load(nextPage = pagination.page) {
    setLoading(true);
    setError(null);

    const url = new URL(window.location.origin + "/api/admin/products");
    if (q.trim()) url.searchParams.set("q", q.trim());
    if (active) url.searchParams.set("active", active);
    url.searchParams.set("page", String(nextPage));
    url.searchParams.set("pageSize", String(pagination.pageSize));

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return null;
      }

      if (!res.ok || !data?.ok) {
        setItems([]);
        setStats({
          total: 0,
          on: 0,
          off: 0,
          olist: 0,
          missingPhoto: 0,
          syncing: 0,
          outOfStock: 0,
        });
        setLoadedCount(0);
        setPagination((current) => ({
          ...current,
          page: 1,
          total: 0,
          totalPages: 1,
        }));
        setError("Falha ao carregar produtos.");
        setLoading(false);
        return;
      }

      setItems(data.items || []);
      setStats({
        total: Number(data?.stats?.total ?? 0),
        on: Number(data?.stats?.on ?? 0),
        off: Number(data?.stats?.off ?? 0),
        olist: Number(data?.stats?.olist ?? 0),
        missingPhoto: Number(data?.stats?.missingPhoto ?? 0),
        syncing: Number(data?.stats?.syncing ?? 0),
        outOfStock: Number(data?.stats?.outOfStock ?? 0),
      });
      setLoadedCount(Number(data?.loadedCount ?? (data?.items || []).length ?? 0));
      setPagination({
        page: Number(data?.pagination?.page ?? nextPage),
        pageSize: Number(data?.pagination?.pageSize ?? pagination.pageSize),
        total: Number(data?.pagination?.total ?? data?.stats?.total ?? 0),
        totalPages: Number(data?.pagination?.totalPages ?? 1),
      });
      setLoading(false);
    } catch {
      setItems([]);
      setStats({
        total: 0,
        on: 0,
        off: 0,
        olist: 0,
        missingPhoto: 0,
        syncing: 0,
        outOfStock: 0,
      });
      setLoadedCount(0);
      setPagination((current) => ({
        ...current,
        page: 1,
        total: 0,
        totalPages: 1,
      }));
      setError("Erro de rede ao carregar produtos.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadOlistStatus();
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OLIST_CURSOR_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as { page?: number; offset?: number };
      const nextPage = Math.max(1, Number(saved.page || 1));
      const nextOffset = Math.max(0, Number(saved.offset || 0));
      setOlistPage(nextPage);
      setOlistOffset(nextOffset);
      setOlistPageInput(String(nextPage));
      setOlistOffsetInput(String(nextOffset + 1));
    } catch {
      // ignore invalid saved cursor
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      OLIST_CURSOR_STORAGE_KEY,
      JSON.stringify({ page: olistPage, offset: olistOffset }),
    );
  }, [olistOffset, olistPage]);

  useEffect(() => {
    autoStockEnabledRef.current = autoStockSyncing;
  }, [autoStockSyncing]);

  useEffect(() => {
    return () => {
      if (autoImportTimerRef.current) {
        clearTimeout(autoImportTimerRef.current);
      }
      if (autoStockTimerRef.current) {
        clearTimeout(autoStockTimerRef.current);
      }
    };
  }, []);

  const sorted = useMemo(() => {
    const filtered = items.filter((product) => {
      if (quickView === "olist") return product.externalSource === "olist";
      if (quickView === "missingPhoto") return Number(product.imageCount ?? 0) === 0;
      if (quickView === "syncing") {
        return Number(product.syncStock ?? 0) === 1 || Number(product.syncPrice ?? 0) === 1;
      }
      if (quickView === "outOfStock") return Number(product.stock ?? 0) <= 0;
      return true;
    });

    const next = [...filtered];
    next.sort((left, right) => {
      if (sort === "new") return right.createdAt - left.createdAt;
      if (sort === "old") return left.createdAt - right.createdAt;
      if (sort === "high") return right.price - left.price;
      return left.price - right.price;
    });
    return next;
  }, [items, quickView, sort]);

  const selectedCount = selectedIds.length;

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => items.some((item) => item.id === id)),
    );
  }, [items]);

  async function removeProduct(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Remover o produto "${name}"? Essa acao nao pode ser desfeita.`,
    );
    if (!confirmed) return;

    setToggling((current) => ({ ...current, [id]: true }));

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return null;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        await load();
        return;
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch {
      await load();
    } finally {
      setToggling((current) => ({ ...current, [id]: false }));
    }
  }

  async function quickToggle(
    e: React.MouseEvent,
    id: string,
    patch: Partial<Pick<ProductRow, "featured" | "deal" | "active">>,
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (toggling[id]) return;
    setToggling((current) => ({ ...current, [id]: true }));

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...patch, quick: true }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return null;
      }

      if (!res.ok || !data?.ok) {
        await load();
      }
    } catch {
      await load();
    } finally {
      setToggling((current) => ({ ...current, [id]: false }));
    }
  }

  function toggleSelectedProduct(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = sorted.map((product) => product.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function bulkSetActive(nextActive: 0 | 1) {
    if (selectedIds.length === 0) return;

    const ids = [...selectedIds];
    const label = nextActive === 1 ? "mostrar" : "ocultar";
    const confirmed = window.confirm(
      `Deseja ${label} ${ids.length} produto(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    setToggling((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = true;
      return next;
    });

    try {
      await Promise.all(
        ids.map(async (id) => {
          await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ active: nextActive, quick: true }),
          });
        }),
      );

      setItems((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, active: nextActive } : item,
        ),
      );
      setSelectedIds([]);
    } catch {
      await load();
    } finally {
      setToggling((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  }

  async function bulkSetCategory() {
    if (selectedIds.length === 0 || !bulkCategoryId) return;

    const ids = [...selectedIds];
    const category = categoryOptions.find((item) => item.id === bulkCategoryId);
    const confirmed = window.confirm(
      `Aplicar a categoria "${category?.name || bulkCategoryId}" em ${ids.length} produto(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    setToggling((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = true;
      return next;
    });

    try {
      await Promise.all(
        ids.map(async (id) => {
          await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              categoryId: bulkCategoryId,
              categoryIds: [bulkCategoryId],
              quick: true,
            }),
          });
        }),
      );

      await load();
      setSelectedIds([]);
      setBulkCategoryId("");
    } catch {
      await load();
    } finally {
      setToggling((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  }

  async function bulkAutoEnrich() {
    if (selectedIds.length === 0) return;

    const ids = [...selectedIds];
    const confirmed = window.confirm(
      `Preencher automaticamente categoria, descricao e capa nos ${ids.length} produto(s) selecionado(s)?\n\nSo vamos completar o que estiver faltando.`,
    );
    if (!confirmed) return;

    setBulkEnriching(true);
    setToggling((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = true;
      return next;
    });

    try {
      const res = await fetch("/api/admin/products/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ids }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!res.ok || !data?.ok) {
        showToast({
          title: "Nao foi possivel preencher",
          message: data?.error || "Falha ao aplicar sugestoes em lote.",
          tone: "danger",
        });
        await load();
        return;
      }

      await load();
      setSelectedIds([]);
      showToast({
        title: "Sugestoes aplicadas",
        message: `${Number(data.processed ?? 0)} produtos processados, ${Number(data.categoriesFilled ?? 0)} com categoria, ${Number(data.descriptionsFilled ?? 0)} com descricao e ${Number(data.imagesFilled ?? 0)} com capa.`,
        tone: "success",
      });
    } catch {
      await load();
      showToast({
        title: "Erro de rede",
        message: "Nao conseguimos aplicar as sugestoes em lote agora.",
        tone: "danger",
      });
    } finally {
      setBulkEnriching(false);
      setToggling((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  }

  async function runOlistAction(
    path: "/api/admin/olist/import" | "/api/admin/olist/sync",
    options?: {
      query?: string;
      keepCursor?: boolean;
      silent?: boolean;
      page?: number;
      offset?: number;
      forceStockEndpoint?: boolean;
      customBatchSize?: number;
      customPagesPerRun?: number;
    },
  ): Promise<OlistActionResult | null> {
    const setBusy = path.endsWith("/import")
      ? setImportingOlist
      : options?.forceStockEndpoint
        ? setSyncingStock
        : setSyncingOlist;
    setBusy(true);
    setError(null);
    const query = String(options?.query || "").trim();
    const keepCursor = Boolean(options?.keepCursor);
    const silent = Boolean(options?.silent);
    const requestPage = Math.max(1, Number(options?.page ?? olistPage));
    const requestOffset = Math.max(0, Number(options?.offset ?? olistOffset));

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: query ? 1 : requestPage,
          offset: query ? 0 : requestOffset,
          batchSize: options?.customBatchSize ?? olistBatchSize,
          pagesPerRun: query ? 1 : (options?.customPagesPerRun ?? olistPagesPerRun),
          pauseMs: 1200,
          query,
          forceStockEndpoint: Boolean(options?.forceStockEndpoint),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return null;
      }

      if (!res.ok || !data?.ok) {
        const nextError = data?.error || "Falha ao executar integracao com Olist.";
        setError(nextError);
        if (!silent) {
          showToast({
            title: "Nao foi possivel concluir",
            message: nextError,
            tone: "danger",
          });
        }
        setBusy(false);
        return {
          ok: false,
          error: nextError,
        };
      }

      if (!silent) {
        showToast({
          title: query ? `Importacao do item ${query}` : options?.forceStockEndpoint ? "Estoque sincronizado" : "Integracao concluida",
          message: query
            ? `${data.total ?? 0} itens processados, ${data.created ?? 0} criados e ${data.updated ?? 0} atualizados.`
            : `Pagina ${data.pageStart ?? requestPage}, posicao ${data.offsetStart ?? requestOffset}.\n${data.total ?? 0} itens processados, ${data.created ?? 0} criados e ${data.updated ?? 0} atualizados.`,
          tone: "success",
        });
      }
      if (!keepCursor && !query) {
        const nextPage = Number(data.nextPage || olistPage);
        const nextOffset = Number(data.nextOffset || 0);
        setOlistPage(nextPage);
        setOlistOffset(nextOffset);
        setOlistPageInput(String(nextPage));
        setOlistOffsetInput(String(nextOffset + 1));
      }
      await load();
      await loadOlistStatus();
      return data as OlistActionResult;
    } catch {
      const nextError = "Erro de rede ao falar com Olist.";
      setError(nextError);
      if (!silent) {
        showToast({
          title: "Erro de rede",
          message: nextError,
          tone: "danger",
        });
      }
      return {
        ok: false,
        error: nextError,
      };
    } finally {
      setBusy(false);
    }
  }

  async function runStockSync(page = olistPage, offset = olistOffset) {
    return runOlistAction("/api/admin/olist/sync", {
      page,
      offset,
      forceStockEndpoint: true,
      customBatchSize: 1,
      customPagesPerRun: 1,
      silent: true,
    });
  }

  async function diagnoseTinySku() {
    const query = olistSearch.trim();
    if (!query) {
      showToast({
        title: "Falta um codigo",
        message: "Digite um SKU ou codigo para diagnosticar.",
        tone: "warning",
      });
      return;
    }

    try {
      const res = await fetch("/api/admin/olist/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json().catch(() => ({}))) as OlistDebugResult;

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!res.ok || !data?.ok || !data.result) {
        showToast({
          title: "Falha no diagnostico",
          message: data?.error || "Falha ao diagnosticar item da Tiny.",
          tone: "danger",
        });
        return;
      }

      console.log("Tiny debug", data.result);
      showToast({
        title: data.result.matched ? "Diagnostico Tiny" : "Nenhum item exato encontrado",
        message: data.result.matched
          ? `Busca: ${data.result.selectedRow?.externalSku || "-"} | ID Tiny: ${data.result.selectedRow?.id || "-"}\nFoto no detalhe: ${data.result.parsedDetail?.photoUrl ? "sim" : "nao"}\nEstoque no detalhe: ${data.result.parsedDetail?.stock ?? 0}\nEstoque no endpoint especifico: ${data.result.parsedStock ?? 0}\n\nO retorno bruto foi enviado ao console do navegador.`
          : "Nenhum item exato foi encontrado para esse SKU/codigo. O retorno bruto foi enviado ao console do navegador.",
        tone: data.result.matched ? "warning" : "default",
      });
    } catch {
      showToast({
        title: "Erro de rede",
        message: "Erro de rede ao diagnosticar item da Tiny.",
        tone: "danger",
      });
    }
  }

  async function runAutoImportStep(page = olistPage, offset = olistOffset) {
    const result = await runOlistAction("/api/admin/olist/import", {
      silent: true,
      page,
      offset,
    });
    if (!result?.ok) {
      setAutoImporting(false);
      setAutoImportMessage(result?.error || "Autoimportacao interrompida.");
      return;
    }

    setAutoImportMessage(
      `Pagina ${page}, posicao ${offset + 1}: ${result.total ?? 0} itens processados, ${result.created ?? 0} criados e ${result.updated ?? 0} atualizados.`,
    );

    if (!result.hasMore) {
      setAutoImporting(false);
      setAutoImportMessage("Autoimportacao concluida para o lote atual do Tiny.");
      return;
    }

    autoImportTimerRef.current = setTimeout(() => {
      void runAutoImportStep(
        Number(result.nextPage ?? page),
        Number(result.nextOffset ?? 0),
      );
    }, autoImportDelay * 1000);
  }

  function toggleAutoImport() {
    if (autoImporting) {
      setAutoImporting(false);
      setAutoImportMessage("Autoimportacao pausada.");
      if (autoImportTimerRef.current) {
        clearTimeout(autoImportTimerRef.current);
      }
      return;
    }

    setAutoImporting(true);
    setAutoImportMessage("Autoimportacao iniciada.");
    void runAutoImportStep();
  }

  async function runAutoStockStep(page = olistPage, offset = olistOffset) {
    if (!autoStockEnabledRef.current) return;

    const result = await runStockSync(page, offset);
    if (!result?.ok) {
      const errorMessage = result?.error || "Sync automatico de estoque interrompido.";
      const isRateLimited =
        errorMessage.toLowerCase().includes("excedido o numero de acessos") ||
        errorMessage.toLowerCase().includes("api bloqueada");

      if (isRateLimited) {
        setAutoStockMessage(
          `Tiny bloqueou temporariamente. Aguardando 5s para retomar da pagina ${page}, posicao ${offset + 1}.`,
        );
        autoStockTimerRef.current = setTimeout(() => {
          void runAutoStockStep(page, offset);
        }, 5000);
        return;
      }

      autoStockEnabledRef.current = false;
      setAutoStockSyncing(false);
      setAutoStockMessage(errorMessage);
      return;
    }

    setAutoStockMessage(
      `Estoque: pagina ${page}, posicao ${offset + 1}. ${result.total ?? 0} itens processados, ${result.updated ?? 0} atualizados.`,
    );

    if (!result.hasMore) {
      autoStockEnabledRef.current = false;
      setAutoStockSyncing(false);
      setAutoStockMessage("Sync automatico de estoque concluiu o lote atual.");
      return;
    }

    autoStockTimerRef.current = setTimeout(() => {
      void runAutoStockStep(
        Number(result.nextPage ?? page),
        Number(result.nextOffset ?? 0),
      );
    }, 2000);
  }

  function toggleAutoStockSync() {
    if (autoStockSyncing) {
      autoStockEnabledRef.current = false;
      setAutoStockSyncing(false);
      setAutoStockMessage("Sync automatico de estoque pausado.");
      if (autoStockTimerRef.current) {
        clearTimeout(autoStockTimerRef.current);
      }
      return;
    }

    autoStockEnabledRef.current = true;
    setAutoStockSyncing(true);
    setAutoStockMessage("Sync automatico de estoque iniciado.");
    void runAutoStockStep();
  }

  function applyOlistCursor() {
    const nextPage = Math.max(1, Number(olistPageInput || 1));
    const nextPosition = Math.max(1, Number(olistOffsetInput || 1));
    const nextOffset = nextPosition - 1;
    setOlistPage(nextPage);
    setOlistOffset(nextOffset);
    setOlistPageInput(String(nextPage));
    setOlistOffsetInput(String(nextOffset + 1));
    setAutoImportMessage(
      `Cursor ajustado para pagina ${nextPage}, posicao ${nextOffset + 1}.`,
    );
  }

  return (
    <main>
      <AppToast
        toast={toast}
        onClose={() =>
          setToast((current) => ({
            ...current,
            open: false,
          }))
        }
      />
      <Container>
        <div className="pt-10 pb-16">
          <div className="flex flex-col gap-5 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">
                Admin • Produtos
              </h1>

              <div className="mt-2 space-y-3">
                <span className="block text-sm text-felicio-ink/60">
                  Organize produtos da Tiny, ajuste categorias e controle o que aparece na loja.
                </span>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/5 bg-white/80 px-3 py-1 text-xs text-felicio-ink/70">
                    Total <b>{counts.total}</b>
                  </span>
                  <span className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1 text-xs text-felicio-ink/70">
                    Ativos <b>{counts.on}</b>
                  </span>
                  <span className="rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1 text-xs text-felicio-ink/70">
                    Inativos <b>{counts.off}</b>
                  </span>
                  <span className="rounded-full border border-felicio-lilac/20 bg-felicio-lilac/12 px-3 py-1 text-xs text-felicio-ink/70">
                    Olist <b>{counts.olist}</b>
                  </span>
                  <span className="rounded-full border border-felicio-sun/25 bg-felicio-sun/14 px-3 py-1 text-xs text-felicio-ink/70">
                    Sem foto <b>{counts.missingPhoto}</b>
                  </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-felicio-ink/70">
                  Esgotados <b>{counts.outOfStock}</b>
                </span>
              </div>

              <div className="mt-2 text-xs text-felicio-ink/55">
                Mostrando <b>{loadedCount}</b> de <b>{counts.total}</b> produtos nesta pagina.
                <span className="ml-2">
                  Pagina <b>{pagination.page}</b> de <b>{pagination.totalPages}</b>.
                </span>
              </div>
            </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-white/70 bg-white/72 p-2">
              <button
                onClick={() => void runOlistAction("/api/admin/olist/import")}
                disabled={
                  importingOlist ||
                  syncingOlist ||
                  syncingStock ||
                  autoImporting ||
                  autoStockSyncing ||
                  !olistStatus.configured
                }
                className="rounded-full border border-felicio-lilac/20 bg-felicio-lilac/12 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-felicio-lilac/18 disabled:opacity-60"
              >
                {importingOlist ? "Importando Olist..." : "Importar Olist"}
              </button>

              <button
                onClick={() => void runOlistAction("/api/admin/olist/sync")}
                disabled={
                  importingOlist ||
                  syncingOlist ||
                  syncingStock ||
                  autoImporting ||
                  autoStockSyncing ||
                  !olistStatus.configured
                }
                className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-felicio-mint/22 disabled:opacity-60"
              >
                {syncingOlist ? "Sincronizando..." : "Sync Olist"}
              </button>

              <button
                onClick={() => void runStockSync()}
                disabled={
                  importingOlist ||
                  syncingOlist ||
                  syncingStock ||
                  autoImporting ||
                  autoStockSyncing ||
                  !olistStatus.configured
                }
                className="rounded-full border border-felicio-sun/25 bg-felicio-sun/15 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-felicio-sun/22 disabled:opacity-60"
              >
                {syncingStock ? "Sync estoque..." : "Sync estoque Tiny"}
              </button>

              <button
                onClick={toggleAutoStockSync}
                disabled={
                  importingOlist ||
                  syncingOlist ||
                  syncingStock ||
                  autoImporting ||
                  !olistStatus.configured
                }
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
                  autoStockSyncing
                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border border-felicio-cream/40 bg-felicio-cream/70 text-felicio-ink/80 hover:bg-felicio-cream",
                ].join(" ")}
              >
                {autoStockSyncing ? "Parar auto estoque" : "Auto sync estoque"}
              </button>

              <button
                onClick={toggleAutoImport}
                disabled={
                  importingOlist ||
                  syncingOlist ||
                  syncingStock ||
                  autoStockSyncing ||
                  !olistStatus.configured
                }
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
                  autoImporting
                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border border-felicio-sun/25 bg-felicio-sun/15 text-felicio-ink/80 hover:bg-felicio-sun/22",
                ].join(" ")}
              >
                {autoImporting ? "Parar autoimportacao" : "Autoimportar"}
              </button>

              </div>

              <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/produtos/novo"
                className="rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Novo produto
              </Link>

              <button
                onClick={() => void load()}
                className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white"
              >
                Atualizar
              </button>

              <button
                onClick={async () => {
                  await fetch("/api/admin/logout", { method: "POST" });
                  window.location.href = "/admin/login";
                }}
                className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/60 transition hover:text-felicio-ink/80"
              >
                Sair
              </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou slug..."
                className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={active}
                  onChange={(e) => setActive(e.target.value as ProductActiveFilter)}
                  className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                >
                  <option value="">Todos</option>
                  <option value="1">Ativos</option>
                  <option value="0">Inativos</option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ProductSort)}
                  className="w-full rounded-2xl border border-black/5 bg-white/85 px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                >
                  <option value="new">Recentes</option>
                  <option value="old">Antigos</option>
                  <option value="high">Maior preço</option>
                  <option value="low">Menor preço</option>
                </select>
              </div>
            </div>

            <div className="lg:col-span-1">
              <button
                onClick={() => {
                  void load(1);
                }}
                className="w-full rounded-2xl bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Filtrar
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-5">
            {loading && <p className="text-sm text-felicio-ink/70">Carregando...</p>}
            {error && <p className="text-sm text-felicio-ink/70">{error}</p>}

            {!loading && !error && sorted.length === 0 && (
              <p className="text-sm text-felicio-ink/70">
                Nenhum produto encontrado.
              </p>
            )}

            {!loading && !error && sorted.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 transition hover:text-felicio-ink/85"
                >
                  {sorted.length > 0 && sorted.every((item) => selectedIds.includes(item.id))
                    ? "Desmarcar visiveis"
                    : "Selecionar visiveis"}
                </button>

                <span className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70">
                  Selecionados <b>{selectedCount}</b>
                </span>

                <button
                  type="button"
                  onClick={() => void bulkSetActive(0)}
                  disabled={selectedCount === 0}
                  className="rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/75 transition disabled:opacity-50"
                >
                  Ocultar selecionados
                </button>

                <button
                  type="button"
                  onClick={() => void bulkSetActive(1)}
                  disabled={selectedCount === 0}
                  className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/75 transition disabled:opacity-50"
                >
                  Mostrar selecionados
                </button>

                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 outline-none"
                >
                  <option value="">Categoria em lote</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void bulkSetCategory()}
                  disabled={selectedCount === 0 || !bulkCategoryId}
                  className="rounded-full border border-felicio-lilac/20 bg-felicio-lilac/12 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/75 transition disabled:opacity-50"
                >
                  Aplicar categoria
                </button>

                <button
                  type="button"
                  onClick={() => void bulkAutoEnrich()}
                  disabled={selectedCount === 0 || bulkEnriching}
                  className="rounded-full border border-felicio-sun/25 bg-felicio-sun/15 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/75 transition disabled:opacity-50"
                >
                  {bulkEnriching ? "Preenchendo..." : "Auto preencher selecionados"}
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-black/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(252,232,238,0.82))] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-felicio-ink/45">
                      Integracao {olistStatus.mode === "tiny" ? "Tiny ERP" : "Olist Partners"}
                    </div>
                    <div className="mt-1 text-sm text-felicio-ink/70">
                      {olistStatus.mode === "tiny"
                        ? olistStatus.configured
                          ? "Tudo pronto para puxar produtos, atualizar estoque e organizar a vitrine."
                          : "Complete a configuracao da Tiny para liberar importacao e sincronizacao."
                        : olistStatus.configured
                          ? "Tudo pronto para importar ou sincronizar pela Olist Partners."
                          : "Complete a configuracao da Olist Partners para liberar os botoes."}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold",
                        olistStatus.configured
                          ? "border-felicio-mint/25 bg-felicio-mint/15 text-felicio-ink/80"
                          : "border-felicio-sun/25 bg-felicio-sun/12 text-felicio-ink/70",
                      ].join(" ")}
                    >
                      {olistStatus.configured ? "Pronto para usar" : "Configuracao pendente"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-black/5 bg-white/90 px-3 py-1 text-[11px] font-semibold text-felicio-ink/65">
                      Bloqueados <b className="ml-1">{Number(olistStatus.blockedCount ?? 0)}</b>
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Importacao
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {[1, 3, 5].map((value) => {
                          const isActive = olistPagesPerRun === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setOlistPagesPerRun(value)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                                isActive
                                  ? "border-felicio-lilac/25 bg-felicio-lilac/12 text-felicio-ink/80"
                                  : "border-black/5 bg-white/90 text-felicio-ink/60 hover:text-felicio-ink/80",
                              ].join(" ")}
                            >
                              {value} pagina{value > 1 ? "s" : ""} por clique
                            </button>
                          );
                        })}
                        <select
                          value={String(autoImportDelay)}
                          onChange={(e) => setAutoImportDelay(Number(e.target.value))}
                          disabled={autoImporting}
                          className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 outline-none disabled:opacity-60"
                        >
                          <option value="10">Auto a cada 10s</option>
                          <option value="15">Auto a cada 15s</option>
                          <option value="20">Auto a cada 20s</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Cursor manual
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={olistPageInput}
                          onChange={(e) => setOlistPageInput(e.target.value)}
                          disabled={autoImporting}
                          className="w-24 rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 outline-none disabled:opacity-60"
                          placeholder="Pagina"
                        />
                        <input
                          type="number"
                          min={1}
                          value={olistOffsetInput}
                          onChange={(e) => setOlistOffsetInput(e.target.value)}
                          disabled={autoImporting}
                          className="w-28 rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 outline-none disabled:opacity-60"
                          placeholder="Posicao"
                        />
                        <button
                          type="button"
                          onClick={applyOlistCursor}
                          disabled={autoImporting || importingOlist || syncingOlist}
                          className="rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-felicio-ink/70 transition hover:bg-white disabled:opacity-60"
                        >
                          Aplicar cursor
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Buscar item especifico
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={olistSearch}
                          onChange={(e) => setOlistSearch(e.target.value)}
                          placeholder="Importar por SKU ou codigo do Tiny"
                          className="min-w-[260px] flex-1 rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm text-felicio-ink/80 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void runOlistAction("/api/admin/olist/import", {
                              query: olistSearch,
                              keepCursor: true,
                            })
                          }
                          disabled={
                            importingOlist ||
                            syncingOlist ||
                            autoImporting ||
                            !olistStatus.configured ||
                            !olistSearch.trim()
                          }
                          className="rounded-full border border-felicio-sun/25 bg-felicio-sun/15 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-felicio-sun/22 disabled:opacity-60"
                        >
                          Importar SKU
                        </button>
                        <button
                          type="button"
                          onClick={() => void diagnoseTinySku()}
                          disabled={!olistSearch.trim()}
                          className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/72 transition hover:bg-white disabled:opacity-60"
                        >
                          Diagnosticar SKU
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/70 bg-white/72 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Status da fila
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-felicio-ink/68">
                        <div>
                          Pagina atual <b>{olistPage}</b>, posicao <b>{olistOffset + 1}</b> e ate{" "}
                          <b>{olistBatchSize}</b> itens por rodada.
                        </div>
                        <div>
                          Ritmo atual: <b>{olistPagesPerRun}</b> pagina
                          {olistPagesPerRun > 1 ? "s" : ""} por clique.
                        </div>
                      </div>
                    </div>

                    {autoImportMessage && (
                      <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-xs text-felicio-ink/65">
                        {autoImportMessage}
                      </div>
                    )}

                    {autoStockMessage && (
                      <div className="rounded-2xl border border-felicio-sun/20 bg-felicio-sun/10 px-4 py-3 text-xs text-felicio-ink/65">
                        {autoStockMessage}
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/70 bg-white/72 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-felicio-ink/45">
                        Filtros rapidos
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          { id: "all", label: "Todos", count: counts.total },
                          { id: "olist", label: "So Olist", count: counts.olist },
                          { id: "missingPhoto", label: "Sem foto", count: counts.missingPhoto },
                          { id: "syncing", label: "Com sync ativo", count: counts.syncing },
                          { id: "outOfStock", label: "Esgotados", count: counts.outOfStock },
                        ].map((option) => {
                          const isActive = quickView === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setQuickView(option.id as ProductQuickView)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                                isActive
                                  ? "border-felicio-pink/25 bg-felicio-pink/12 text-felicio-ink/80"
                                  : "border-black/5 bg-white/90 text-felicio-ink/60 hover:text-felicio-ink/80",
                              ].join(" ")}
                            >
                              {option.label} <b>{option.count}</b>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {sorted.map((product) => {
                const isBusy = !!toggling[product.id];
                const featuredOn = Number(product.featured ?? 0) === 1;
                const dealOn = Number(product.deal ?? 0) === 1;
                const isOlist = product.externalSource === "olist";
                const hasImages = Number(product.imageCount ?? 0) > 0;
                const outOfStock = Number(product.stock ?? 0) <= 0;
                const isSelected = selectedIds.includes(product.id);

                return (
                  <Link
                    key={product.id}
                    href={`/admin/produtos/${encodeURIComponent(product.id)}`}
                    className={[
                      "block rounded-2xl border bg-white p-4 transition hover:bg-white/90",
                      isSelected
                        ? "border-felicio-lilac/35 ring-2 ring-felicio-lilac/15"
                        : "border-black/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectedProduct(e, product.id)}
                          className={[
                            "mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition",
                            isSelected
                              ? "border-felicio-lilac/35 bg-felicio-lilac/18 text-felicio-ink"
                              : "border-black/10 bg-white/90 text-felicio-ink/45",
                          ].join(" ")}
                          aria-label={isSelected ? "Desmarcar produto" : "Selecionar produto"}
                        >
                          {isSelected ? "OK" : ""}
                        </button>

                        {product.coverImage ? (
                          <Image
                            src={product.coverImage}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-xl border border-black/5 object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl border border-black/5 bg-black/5" />
                        )}

                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-felicio-ink/80">
                            {product.name}
                          </div>
                          <div className="mt-1 truncate text-xs text-felicio-ink/60">
                            /{product.slug}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-black/5 bg-white/90 px-3 py-1 text-[11px] text-felicio-ink/70">
                              Categorias:{" "}
                              <b>{product.categoryNames ? product.categoryNames : "-"}</b>
                            </span>

                            {isOlist && (
                              <span className="rounded-full border border-felicio-lilac/20 bg-felicio-lilac/12 px-3 py-1 text-[11px] font-semibold text-felicio-ink/75">
                                Olist
                              </span>
                            )}

                            {!hasImages && (
                              <span className="rounded-full border border-felicio-sun/30 bg-felicio-sun/15 px-3 py-1 text-[11px] font-semibold text-felicio-ink/75">
                                Sem foto
                              </span>
                            )}

                            {outOfStock && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700">
                                Esgotado
                              </span>
                            )}

                            {Number(product.syncStock ?? 0) === 1 && (
                              <span className="rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1 text-[11px] font-semibold text-felicio-ink/75">
                                Sync estoque
                              </span>
                            )}

                            {Number(product.syncPrice ?? 0) === 1 && (
                              <span className="rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1 text-[11px] font-semibold text-felicio-ink/75">
                                Sync preço
                              </span>
                            )}

                            <button
                              onClick={(e) =>
                                quickToggle(e, product.id, {
                                  featured: featuredOn ? 0 : 1,
                                })
                              }
                              disabled={isBusy}
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                                featuredOn
                                  ? "border-yellow-200 bg-yellow-100/70 text-felicio-ink/80"
                                  : "border-black/10 bg-white/90 text-felicio-ink/60 hover:text-felicio-ink/80",
                                isBusy ? "cursor-not-allowed opacity-60" : "",
                              ].join(" ")}
                            >
                              <span>Destaque</span>
                            </button>

                            <button
                              onClick={(e) =>
                                quickToggle(e, product.id, {
                                  deal: dealOn ? 0 : 1,
                                })
                              }
                              disabled={isBusy}
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                                dealOn
                                  ? "border-orange-200 bg-orange-100/70 text-felicio-ink/80"
                                  : "border-black/10 bg-white/90 text-felicio-ink/60 hover:text-felicio-ink/80",
                                isBusy ? "cursor-not-allowed opacity-60" : "",
                              ].join(" ")}
                            >
                              <span>Oferta</span>
                            </button>

                            <button
                              onClick={(e) =>
                                quickToggle(e, product.id, {
                                  active: product.active ? 0 : 1,
                                })
                              }
                              disabled={isBusy}
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                                product.active
                                  ? "border-felicio-mint/25 bg-felicio-mint/12 text-felicio-ink/75"
                                  : "border-felicio-pink/20 bg-felicio-pink/10 text-felicio-ink/75",
                                isBusy ? "cursor-not-allowed opacity-60" : "",
                              ].join(" ")}
                            >
                              <span>{product.active ? "Ocultar da loja" : "Mostrar na loja"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-extrabold text-felicio-ink/80">
                          {formatBRL(Number(product.price || 0))}
                        </div>
                        <div className="mt-1 text-xs text-felicio-ink/60">
                          Estoque: <b>{product.stock}</b>
                        </div>
                        {isOlist && (
                          <div className="mt-1 text-xs text-felicio-ink/55">
                            SKU ERP: <b>{product.externalSku || "-"}</b>
                          </div>
                        )}
                        {isOlist && (
                          <div className="mt-1 text-[11px] text-felicio-ink/50">
                            Ultimo sync: {formatSyncDate(product.lastSyncedAt)}
                          </div>
                        )}
                        <div className="mt-2">
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold text-felicio-ink/80",
                              product.active
                                ? "border-felicio-mint/25 bg-felicio-mint/15"
                                : "border-felicio-pink/20 bg-felicio-pink/10",
                            ].join(" ")}
                          >
                            {product.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <span className="rounded-full border border-black/5 bg-white/90 px-3 py-1 text-[11px] font-semibold text-felicio-ink/60">
                            Clique para editar
                          </span>

                          <button
                            type="button"
                            onClick={(e) => removeProduct(e, product.id, product.name)}
                            disabled={isBusy}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {!loading && !error && pagination.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/90 px-4 py-3">
                  <div className="text-sm text-felicio-ink/65">
                    Pagina <b>{pagination.page}</b> de <b>{pagination.totalPages}</b>
                    <span className="ml-2">
                      Total encontrado: <b>{pagination.total}</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void load(pagination.page - 1)}
                      disabled={loading || pagination.page <= 1}
                      className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-felicio-ink/75 transition hover:bg-felicio-cream/60 disabled:opacity-50"
                    >
                      Anterior
                    </button>

                    <button
                      type="button"
                      onClick={() => void load(pagination.page + 1)}
                      disabled={loading || pagination.page >= pagination.totalPages}
                      className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-felicio-ink/75 transition hover:bg-felicio-cream/60 disabled:opacity-50"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
