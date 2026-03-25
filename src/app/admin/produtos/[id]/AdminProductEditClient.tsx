"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { COLOR_OPTIONS, SUBCATEGORY_OPTIONS } from "@/lib/catalog";
import { suggestProductEnrichment } from "@/lib/productEnrichment";
import {
  createColorOptionId,
  normalizeProductColorOptions,
  type ProductColorOption,
} from "@/lib/productColorOptions";
import AppToast, { type AppToastState } from "@/components/ui/AppToast";

type Mode = "create" | "edit";
type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  sku: string | null;
  active: 0 | 1;
  images: { id: string; url: string; alt: string | null; sortOrder: number }[];
  categoryId: string | null;
  categoryIds?: string[];
  subCategoryId?: string | null;
  color?: string | null;
  colorOptions?: ProductColorOption[];
  inMovingShowcase?: 0 | 1;
  featured: 0 | 1;
  deal: 0 | 1;
  isCollection?: 0 | 1;
  isWeeklyFavorite?: 0 | 1;
  externalSource?: string | null;
  externalSku?: string | null;
  syncStock?: 0 | 1;
  syncPrice?: 0 | 1;
  lastSyncedAt?: number | null;
};

function slugify(input: string) {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/(^-+|-+$)/g, "");
}

function formatSyncDate(value?: number | null) {
  if (!value) return "Ainda nao sincronizado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

export default function AdminProductEditClient({ mode, id }: { mode: Mode; id?: string }) {
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("29.90");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [sku, setSku] = useState("");
  const [active, setActive] = useState<0 | 1>(0);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subCategoryId, setSubCategoryId] = useState("");
  const [color, setColor] = useState("");
  const [colorOptions, setColorOptions] = useState<ProductColorOption[]>([]);
  const [customColorName, setCustomColorName] = useState("");
  const [customColorImageUrl, setCustomColorImageUrl] = useState("");
  const [inMovingShowcase, setInMovingShowcase] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [deal, setDeal] = useState(false);
  const [isCollection, setIsCollection] = useState(false);
  const [isWeeklyFavorite, setIsWeeklyFavorite] = useState(false);
  const [externalSource, setExternalSource] = useState("");
  const [externalSku, setExternalSku] = useState("");
  const [syncStock, setSyncStock] = useState(false);
  const [syncPrice, setSyncPrice] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [imageUrls, setImageUrls] = useState("");
  const [toast, setToast] = useState<AppToastState>({
    open: false,
    title: "",
    message: "",
    tone: "default",
  });

  const parsedUrls = useMemo(() => imageUrls.split("\n").map((v) => v.trim()).filter(Boolean), [imageUrls]);
  const primaryCategoryId = categoryIds[0] ?? "";
  const primaryCategory = categories.find((item) => item.id === primaryCategoryId);
  const backToSchoolCategory = categories.find((item) => item.id === "cadernos");
  const isBackToSchool = categoryIds.includes("cadernos");
  const isOlistProduct = externalSource === "olist";
  const subCategoryOptions = primaryCategoryId ? SUBCATEGORY_OPTIONS[primaryCategoryId] ?? [] : [];

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    const productId = id;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/products?id=${encodeURIComponent(productId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = "/admin/login";
          return;
        }
        if (!res.ok || !data?.ok || !data?.product) {
          setError("Produto nao encontrado.");
          setLoading(false);
          return;
        }
        const product: Product = data.product;
        setName(product.name || "");
        setSlug(product.slug || "");
        setShortDescription(product.shortDescription || "");
        setDescription(product.description || "");
        setPrice(String(product.price ?? 0));
        setCompareAtPrice(product.compareAtPrice ? String(product.compareAtPrice) : "");
        setStock(String(product.stock ?? 0));
        setSku(product.sku || "");
        setActive(product.active ?? 1);
        setCategoryIds(Array.isArray(product.categoryIds) && product.categoryIds.length ? product.categoryIds : product.categoryId ? [product.categoryId] : []);
        setSubCategoryId(product.subCategoryId ?? "");
        setColor(product.color ?? "");
        setColorOptions(normalizeProductColorOptions(product.colorOptions));
        setInMovingShowcase(Number(product.inMovingShowcase ?? 0) === 1);
        setFeatured(Number(product.featured ?? 0) === 1);
        setDeal(Number(product.deal ?? 0) === 1);
        setIsCollection(Number(product.isCollection ?? 0) === 1);
        setIsWeeklyFavorite(Number(product.isWeeklyFavorite ?? 0) === 1);
        setExternalSource(String(product.externalSource ?? ""));
        setExternalSku(String(product.externalSku ?? ""));
        setSyncStock(Number(product.syncStock ?? 0) === 1);
        setSyncPrice(Number(product.syncPrice ?? 0) === 1);
        setLastSyncedAt(product.lastSyncedAt ?? null);
        const productColorOptions = normalizeProductColorOptions(product.colorOptions);
        const colorImageUrls = new Set(productColorOptions.map((option) => option.imageUrl));
        setImageUrls(
          (product.images || [])
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((img) => img.url)
            .filter((url) => url && !colorImageUrls.has(url))
            .join("\n"),
        );
        setLoading(false);
      } catch {
        setError("Erro de rede ao carregar produto.");
        setLoading(false);
      }
    }
    void load();
  }, [id, mode]);

  useEffect(() => {
    fetch("/api/categories").then((res) => res.json()).then((data) => {
      if (Array.isArray(data?.items)) setCategories(data.items);
    });
  }, []);

  function toggleCategory(categoryId: string) {
    setCategoryIds((current) => {
      const next = current.includes(categoryId) ? current.filter((value) => value !== categoryId) : [...current, categoryId];
      const nextPrimary = next[0] ?? "";
      if (subCategoryId && nextPrimary && !(SUBCATEGORY_OPTIONS[nextPrimary] ?? []).includes(subCategoryId)) setSubCategoryId("");
      if (!nextPrimary) setSubCategoryId("");
      return next;
    });
  }

  function togglePresetColor(optionName: string) {
    setColorOptions((current) => {
      const existing = current.find(
        (option) => option.name.toLowerCase() === optionName.toLowerCase(),
      );

      if (existing) {
        return current.filter((option) => option.id !== existing.id);
      }

      return [
        ...current,
        {
          id: createColorOptionId(optionName),
          name: optionName,
          imageUrl: "",
          includeInGallery: false,
          source: "preset",
        },
      ];
    });
  }

  function updateColorOption(
    optionId: string,
    patch: Partial<ProductColorOption>,
  ) {
    setColorOptions((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...patch,
            }
          : option,
      ),
    );
  }

  function removeColorOption(optionId: string) {
    setColorOptions((current) => current.filter((option) => option.id !== optionId));
  }

  function addCustomColorOption() {
    const name = customColorName.trim();
    const imageUrl = customColorImageUrl.trim();
    if (!name || !imageUrl) return;

    setColorOptions((current) => [
      ...current,
      {
        id: createColorOptionId(name),
        name,
        imageUrl,
        includeInGallery: false,
        source: "custom",
      },
    ]);
    setCustomColorName("");
    setCustomColorImageUrl("");
  }

  function applySmartSuggestion() {
    const suggestion = suggestProductEnrichment({
      name,
      description,
    });

    if (!shortDescription.trim()) {
      setShortDescription(suggestion.description);
    }

    if (!description.trim()) {
      setDescription(suggestion.description);
    }

    if (!categoryIds.length && suggestion.categoryIds.length) {
      setCategoryIds(suggestion.categoryIds);
      if (suggestion.subCategoryId) {
        setSubCategoryId(suggestion.subCategoryId);
      }
    } else if (!subCategoryId && suggestion.subCategoryId) {
      setSubCategoryId(suggestion.subCategoryId);
    }

    if (!parsedUrls.length) {
      setImageUrls(`${suggestion.imageUrl}\n`);
    }

    setToast({
      open: true,
      title: "Sugestao aplicada",
      message: "Preenchemos categoria, descricao e uma capa ilustrada como teste.",
      tone: "success",
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      id,
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      price: Number(String(price).replace(",", ".")) || 0,
      compareAtPrice: compareAtPrice.trim() === "" ? null : Number(String(compareAtPrice).replace(",", ".")) || null,
      stock: Number(stock) || 0,
      sku: sku.trim() || null,
      active,
      categoryId: categoryIds[0] ?? null,
      categoryIds,
      subCategoryId: subCategoryId || null,
      color: color || null,
      colorOptions: normalizeProductColorOptions(colorOptions),
      inMovingShowcase: inMovingShowcase ? 1 : 0,
      featured: featured ? 1 : 0,
      deal: deal ? 1 : 0,
      isCollection: isCollection ? 1 : 0,
      isWeeklyFavorite: isWeeklyFavorite ? 1 : 0,
      externalSource: externalSource || null,
      externalSku: externalSku.trim() || null,
      syncStock: syncStock ? 1 : 0,
      syncPrice: syncPrice ? 1 : 0,
      lastSyncedAt,
      images: parsedUrls.map((url, index) => ({ url, alt: name.trim() || null, sortOrder: index })),
    };
    try {
      const res = mode === "create"
        ? await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/products/${encodeURIComponent(id!)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok || !data?.ok) {
        setError("Falha ao salvar. Verifique slug e campos.");
        setSaving(false);
        return;
      }
      if (mode === "create") {
        window.location.href = `/admin/produtos/${encodeURIComponent(data.id)}`;
        return;
      }
      setSaving(false);
      setToast({
        open: true,
        title: "Produto salvo",
        message: "As alteracoes foram guardadas com sucesso.",
        tone: "success",
      });
    } catch {
      setError("Erro de rede ao salvar.");
      setSaving(false);
    }
  }

  async function uploadOne(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || "Falha no upload.");
    return data.url as string;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadOne(file));
      setImageUrls((current) => {
        const existing = current
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
        const merged = [...urls, ...existing].filter(
          (value, index, array) => array.indexOf(value) === index,
        );
        return merged.length ? `${merged.join("\n")}\n` : "";
      });
    } catch (err) {
      setError(`Erro ao enviar imagem. ${err instanceof Error && typeof err.message === "string" ? err.message : ""}`.trim());
    } finally {
      setUploading(false);
    }
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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-felicio-ink/80 sm:text-3xl">Admin • {mode === "create" ? "Novo Produto" : "Editar Produto"}</h1>
              <div className="mt-2 text-sm text-felicio-ink/60">{mode === "edit" ? <>ID: <b>{id}</b></> : "Crie e publique produtos na vitrine."}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/admin/produtos" className="rounded-full border border-black/5 bg-white/90 px-4 py-2 text-sm font-semibold text-felicio-ink/80 transition hover:bg-white">Voltar</Link>
              <button onClick={() => void save()} disabled={saving || loading || uploading} className="rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            {loading && <p className="text-sm text-felicio-ink/70">Carregando...</p>}
            {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {!loading && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid gap-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Nome</label>
                      <input value={name} onChange={(e) => { const nextValue = e.target.value; setName(nextValue); if (!slugTouched) setSlug(slugify(nextValue)); }} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Slug</label>
                      <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                      <div className="mt-1 text-[11px] text-felicio-ink/50">URL oficial: <b>/produtos/{slug || "..."}</b></div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Origem do produto</label>
                      <select value={externalSource} onChange={(e) => setExternalSource(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none">
                        <option value="">Produto do site</option>
                        <option value="olist">Olist ERP</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">SKU externo / ERP</label>
                      <input value={externalSku} onChange={(e) => setExternalSku(e.target.value)} placeholder="Ex.: SKU do Olist" className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                    </div>
                  </div>

                  {isOlistProduct && (
                    <div className="rounded-2xl border border-felicio-lilac/18 bg-felicio-lilac/10 px-4 py-4 text-sm text-felicio-ink/72">
                      <div className="font-semibold text-felicio-ink/82">Produto conectado ao Olist</div>
                      <div className="mt-1 text-felicio-ink/60">Nome, estoque e preco podem ser sincronizados pelo ERP. Fotos, capa e organizacao visual continuam sendo controladas no site.</div>
                      <div className="mt-4 flex flex-wrap gap-6">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/72"><input type="checkbox" checked={syncStock} onChange={(e) => setSyncStock(e.target.checked)} />Sincronizar estoque</label>
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/72"><input type="checkbox" checked={syncPrice} onChange={(e) => setSyncPrice(e.target.checked)} />Sincronizar preco</label>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-bold text-felicio-ink/70">Categorias</label>
                    <p className="mt-1 text-xs text-felicio-ink/55">Marque quantas quiser. A primeira selecionada vira a categoria principal.</p>
                    {backToSchoolCategory && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-felicio-sun/25 bg-felicio-sun/10 px-4 py-3 text-sm text-felicio-ink/72">
                        <span className="font-semibold">Atalho “Volta as aulas”</span>
                        <span className="text-felicio-ink/55">Ele aparece quando o produto entra em {backToSchoolCategory.name}.</span>
                        <button type="button" onClick={() => toggleCategory(backToSchoolCategory.id)} className={["rounded-full px-3 py-1.5 text-xs font-bold transition", isBackToSchool ? "bg-felicio-pink text-white" : "bg-white/85 text-felicio-ink/75 hover:bg-white"].join(" ")}>{isBackToSchool ? "Remover de Volta as aulas" : "Marcar como Volta as aulas"}</button>
                      </div>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {categories.map((category) => {
                        const selected = categoryIds.includes(category.id);
                        return (
                          <label key={category.id} className={["flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition", selected ? "border-felicio-pink/30 bg-felicio-pink/10 text-felicio-ink" : "border-black/5 bg-white/80 text-felicio-ink/70 hover:bg-white"].join(" ")}>
                            <input type="checkbox" checked={selected} onChange={() => toggleCategory(category.id)} />
                            <span>{category.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Subcategoria</label>
                      <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} disabled={!primaryCategoryId} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none disabled:opacity-50">
                        <option value="">{primaryCategoryId ? "Sem subcategoria" : "Escolha uma categoria primeiro"}</option>
                        {subCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Cor</label>
                      <input list="product-colors" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ex.: Rosa, Azul, Colorido" className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                      <datalist id="product-colors">{COLOR_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
                    <div className="text-sm font-bold text-felicio-ink/72">Cores com foto</div>
                    <div className="mt-1 text-xs text-felicio-ink/55">
                      Selecione as cores que esse produto possui e cole a imagem de cada uma. A miniatura da cor sempre aparece na escolha da compra, e voce decide se ela tambem entra na galeria de fotos.
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((option) => {
                        const selected = colorOptions.some(
                          (entry) => entry.name.toLowerCase() === option.toLowerCase(),
                        );

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => togglePresetColor(option)}
                            className={[
                              "rounded-full px-3 py-2 text-xs font-bold transition",
                              selected
                                ? "bg-felicio-pink text-white"
                                : "border border-black/8 bg-white text-felicio-ink/72 hover:bg-white/90",
                            ].join(" ")}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {colorOptions.length > 0 && (
                      <div className="mt-4 grid gap-3">
                        {colorOptions.map((option) => (
                          <div key={option.id} className="rounded-2xl border border-black/6 bg-white p-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-felicio-ink/78">
                                {option.name}
                                {option.source === "custom" ? " (personalizada)" : ""}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeColorOption(option.id)}
                                className="text-xs font-semibold text-felicio-ink/58 underline underline-offset-4"
                              >
                                Remover
                              </button>
                            </div>
                            <input
                              value={option.imageUrl}
                              onChange={(e) =>
                                updateColorOption(option.id, { imageUrl: e.target.value })
                              }
                              placeholder="Cole o link da foto que representa essa cor"
                              className="mt-3 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                            />
                            <label className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-felicio-ink/65">
                              <input
                                type="checkbox"
                                checked={Boolean(option.includeInGallery)}
                                onChange={(e) =>
                                  updateColorOption(option.id, {
                                    includeInGallery: e.target.checked,
                                  })
                                }
                              />
                              Levar essa imagem para a galeria de fotos do produto
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-dashed border-black/8 bg-white/75 p-3.5">
                      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
                        Adicionar cor personalizada
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
                        <input
                          value={customColorName}
                          onChange={(e) => setCustomColorName(e.target.value)}
                          placeholder="Nome da cor"
                          className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                        />
                        <input
                          value={customColorImageUrl}
                          onChange={(e) => setCustomColorImageUrl(e.target.value)}
                          placeholder="Link da foto da cor"
                          className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none"
                        />
                        <button
                          type="button"
                          onClick={addCustomColorOption}
                          className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-felicio-ink shadow-soft transition hover:bg-felicio-pink/10"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Resumo curto do topo</label>
                      <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                      <div className="mt-1 text-[11px] text-felicio-ink/50">Esse texto aparece logo abaixo do nome do produto.</div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Descricao completa</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-felicio-ink/65">
                      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">Textos</div>
                      <div className="mt-3 space-y-2">
                        <div><b>Resumo curto:</b> {shortDescription.trim() ? "Preenchido" : "Vai usar a descricao completa como fallback"}</div>
                        <div><b>Descricao completa:</b> {description.trim() ? "Preenchida" : "Vazia"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-felicio-ink/65">
                      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">Visao rapida</div>
                      <div className="mt-3 space-y-2">
                        <div><b>Principal:</b> {primaryCategory?.name || "Nenhuma"}</div>
                        <div><b>Subcategoria:</b> {subCategoryId || "Nao definida"}</div>
                        <div><b>Cor:</b> {color || "Nao definida"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={applySmartSuggestion}
                        className="mt-4 rounded-full border border-felicio-lilac/25 bg-felicio-lilac/12 px-4 py-2 text-xs font-bold text-felicio-ink/80 transition hover:bg-felicio-lilac/18"
                      >
                        Sugerir categoria, descricao e capa
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-4">
                    <div><label className="text-xs font-semibold text-felicio-ink/60">Preco</label><input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" /></div>
                    <div><label className="text-xs font-semibold text-felicio-ink/60">Preco de</label><input value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" /></div>
                    <div><label className="text-xs font-semibold text-felicio-ink/60">Estoque</label><input value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" /></div>
                    <div><label className="text-xs font-semibold text-felicio-ink/60">SKU</label><input value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" /></div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-felicio-ink/60">Status</label>
                      <select value={active} onChange={(e) => setActive((Number(e.target.value) === 1 ? 1 : 0) as 0 | 1)} className="mt-1 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none">
                        <option value={0}>Oculto da loja</option>
                        <option value={1}>Visivel na loja</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-xs text-felicio-ink/60"><b>Como funciona:</b> voce pode colar URLs no campo abaixo ou enviar arquivos. A primeira URL vira a capa e os uploads novos entram primeiro.</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/70"><input type="checkbox" checked={inMovingShowcase} onChange={(e) => setInMovingShowcase(e.target.checked)} />Adicionar a vitrine em movimento</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/70"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />Destaque da semana</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/70"><input type="checkbox" checked={deal} onChange={(e) => setDeal(e.target.checked)} />Oferta</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/70"><input type="checkbox" checked={isCollection} onChange={(e) => setIsCollection(e.target.checked)} />Colecao</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-felicio-ink/70"><input type="checkbox" checked={isWeeklyFavorite} onChange={(e) => setIsWeeklyFavorite(e.target.checked)} />Favoritos da semana</label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-felicio-ink/60">URLs das imagens (1 por linha)</label>
                    {isOlistProduct && <div className="mt-2 rounded-2xl border border-felicio-sun/25 bg-felicio-sun/10 px-4 py-3 text-xs text-felicio-ink/65">Esse produto veio do Olist. As fotos daqui sao locais do site e nao serao sobrescritas pela sincronizacao.</div>}
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-felicio-ink/60">Upload de imagens {uploading ? <span className="font-normal text-felicio-ink/50">- enviando...</span> : null}</div>
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <span className="rounded-full bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/90 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105">Selecionar imagens</span>
                          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { void onPickFiles(e.target.files); e.currentTarget.value = ""; }} className="hidden" />
                        </label>
                      </div>
                      <textarea value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} rows={6} placeholder={`Cole aqui URLs (1 por linha), exemplo:\nhttps://...\nhttps://...\n\nOu use o upload acima e as URLs vao aparecer aqui automaticamente.`} className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-felicio-ink/80 outline-none" />
                      {parsedUrls.length > 0 && (
                        <div className="rounded-2xl border border-black/5 bg-white/70 p-3">
                          <div className="text-xs font-semibold text-felicio-ink/60">Preview das URLs ({parsedUrls.length}) - a primeira e capa</div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {parsedUrls.slice(0, 6).map((url, index) => (
                              <div key={`${url}-${index}`} className="rounded-xl border border-black/5 bg-white p-2">
                                <div className="truncate text-[11px] text-felicio-ink/60">{index === 0 ? "Capa: " : ""}{url}</div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="mt-2 h-24 w-full rounded-lg border border-black/5 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">Resumo</div>
                    <div className="mt-3 space-y-3 text-sm text-felicio-ink/68">
                      <div><b>Nome:</b> {name || "Sem nome"}</div>
                      <div><b>Slug:</b> {slug || slugify(name) || "-"}</div>
                      <div><b>Resumo curto:</b> {shortDescription.trim() ? "Configurado" : "Usando fallback"}</div>
                      <div><b>Status:</b> {active ? "Visivel na loja" : "Oculto da loja"}</div>
                      <div><b>Imagens:</b> {parsedUrls.length}</div>
                      <div><b>Origem:</b> {isOlistProduct ? "Olist ERP" : "Site"}</div>
                      {isOlistProduct && (
                        <>
                          <div><b>SKU ERP:</b> {externalSku || "-"}</div>
                          <div><b>Sync estoque:</b> {syncStock ? "Ligado" : "Desligado"}</div>
                          <div><b>Sync preco:</b> {syncPrice ? "Ligado" : "Desligado"}</div>
                          <div><b>Ultimo sync:</b> {formatSyncDate(lastSyncedAt)}</div>
                        </>
                      )}
                      <div><b>Status de foto:</b> {parsedUrls.length ? "Com capa" : "Sem foto"}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">Selos da vitrine</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featured && <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-felicio-ink/70">Destaque</span>}
                      {inMovingShowcase && <span className="rounded-full bg-felicio-mint/18 px-3 py-1 text-xs font-semibold text-felicio-ink/70">Vitrine em movimento</span>}
                      {deal && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-felicio-ink/70">Oferta</span>}
                      {isCollection && <span className="rounded-full bg-felicio-lilac/15 px-3 py-1 text-xs font-semibold text-felicio-ink/70">Colecao</span>}
                      {isWeeklyFavorite && <span className="rounded-full bg-felicio-pink/12 px-3 py-1 text-xs font-semibold text-felicio-ink/70">Favoritos da semana</span>}
                      {!featured && !deal && !isCollection && !isWeeklyFavorite && <span className="text-xs text-felicio-ink/50">Nenhum selo ativo.</span>}
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
