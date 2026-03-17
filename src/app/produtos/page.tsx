import Link from "next/link";
import Container from "@/components/layout/Container";
import ProductCard from "@/components/product/ProductCard";
import { COLOR_OPTIONS, SUBCATEGORY_OPTIONS } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

type Category = {
  id: string | number;
  name: string;
};

type ProductListItem = {
  id: string | number;
  slug: string;
  name: string;
  price?: number;
  compareAtPrice?: number | null;
  coverImage?: string | null;
  images?: Array<{ url?: string | null }> | null;
  stock?: number | null;
  isCollection?: number | null;
  isWeeklyFavorite?: number | null;
  subCategoryId?: string | null;
  color?: string | null;
};

type CategoriesResponse = {
  items: Category[];
};

type ProductsResponse = {
  items: ProductListItem[];
  total: number;
};

async function getCategories() {
  const base = getSiteUrl();
  const res = await fetch(`${base}/api/categories`, { cache: "no-store" });
  if (!res.ok) return { items: [] } satisfies CategoriesResponse;
  return (await res.json()) as CategoriesResponse;
}

async function getProducts(query?: string) {
  const base = getSiteUrl();
  const qs = query ? `?${query}` : "";
  const res = await fetch(`${base}/api/products${qs}`, { cache: "no-store" });
  if (!res.ok) return { items: [], total: 0 } satisfies ProductsResponse;
  return (await res.json()) as ProductsResponse;
}

function buildQuery(params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  return searchParams.toString();
}

function countByValue(items: ProductListItem[], pick: (item: ProductListItem) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const value = pick(item).trim();
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
}

function splitVisibleOptions(
  options: readonly string[],
  activeValue: string,
  visibleCount: number,
) {
  const baseVisible = options.slice(0, visibleCount);
  const visible =
    activeValue && !baseVisible.includes(activeValue)
      ? [...baseVisible, activeValue]
      : baseVisible;
  const hidden = options.filter((option) => !visible.includes(option));
  return { visible, hidden };
}

function FilterSection({
  title,
  toneClass,
  children,
}: {
  title: string;
  toneClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-5 rounded-[1.6rem] border border-white/70 p-4 ${toneClass}`}>
      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-felicio-ink/45">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-white/90 bg-white/92 text-felicio-ink shadow-soft"
          : "border-white/70 bg-white/55 text-felicio-ink/72 hover:bg-white/80",
      ].join(" ")}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="rounded-full bg-white/75 px-2 py-1 text-[11px] font-extrabold text-felicio-ink/55">
          {count}
        </span>
      )}
    </Link>
  );
}

function CompactChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-2 text-xs font-semibold transition",
        active
          ? "border-white/90 bg-white/92 text-felicio-ink shadow-soft"
          : "border-white/70 bg-white/55 text-felicio-ink/72 hover:bg-white/80",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function ActiveFilterChip({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/78 px-3 py-2 text-xs font-bold text-felicio-ink/75 shadow-soft transition hover:bg-white"
    >
      <span>{label}</span>
      <span className="text-felicio-ink/45">x</span>
    </Link>
  );
}

function MenuSummary({ label }: { label: string }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-full border border-white/75 bg-white/85 px-4 py-3 text-sm font-extrabold text-felicio-ink shadow-soft marker:hidden">
      <span>{label}</span>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white/90">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="stroke-current text-felicio-ink/70">
          <path d="M4 7h16" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 12h16" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 17h16" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </summary>
  );
}

function FiltersPanel({
  baseQuery,
  category,
  categoryCounts,
  categories,
  color,
  colorCounts,
  deal,
  filterItems,
  hasActiveFilters,
  hiddenColors,
  hiddenSubCategories,
  subCategory,
  subCategoryCounts,
  subCategoryOptions,
  visibleColors,
  visibleSubCategories,
}: {
  baseQuery: Record<string, string>;
  category: string;
  categoryCounts: Map<string, number>;
  categories: Category[];
  color: string;
  colorCounts: Map<string, number>;
  deal: string;
  filterItems: ProductListItem[];
  hasActiveFilters: boolean;
  hiddenColors: string[];
  hiddenSubCategories: string[];
  subCategory: string;
  subCategoryCounts: Map<string, number>;
  subCategoryOptions: readonly string[];
  visibleColors: string[];
  visibleSubCategories: string[];
}) {
  return (
    <>
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
        Filtros
      </div>
      <h2 className="mt-2 text-2xl font-extrabold text-felicio-ink/88">
        Encontre seu estilo
      </h2>
      <p className="mt-2 text-sm leading-6 text-felicio-ink/65">
        Navegue pelas categorias da loja e va direto ao tipo de produto
        que faz mais sentido para a sua compra.
      </p>

      <FilterSection toneClass="bg-white/45" title="Categorias">
        <div className="space-y-2">
          <FilterLink
            href={`/produtos?${buildQuery({
              ...baseQuery,
              category: "",
              deal: "",
              subCategory: "",
              color: "",
              page: "1",
            })}`}
            active={!category && deal !== "1"}
            label="Todos os produtos"
            count={Array.from(categoryCounts.values()).reduce((sum, value) => sum + value, 0)}
          />

          <Link
            href={`/produtos?${buildQuery({
              ...baseQuery,
              category: "",
              deal: "1",
              subCategory: "",
              color: "",
              page: "1",
            })}`}
            className={[
              "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              deal === "1"
                ? "border-white/90 bg-white/92 text-felicio-ink shadow-soft"
                : "border-white/70 bg-white/55 text-felicio-ink/72 hover:bg-white/80",
            ].join(" ")}
          >
            <span>Ofertas</span>
            <span className="rounded-full bg-felicio-pink/12 px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
              promo
            </span>
          </Link>

          {categories.map((item) => (
            <FilterLink
              key={item.id}
              href={`/produtos?${buildQuery({
                ...baseQuery,
                category: String(item.id),
                deal: "",
                subCategory: "",
                color: "",
                page: "1",
              })}`}
              active={String(item.id) === category && deal !== "1"}
              label={item.name}
              count={categoryCounts.get(String(item.id)) ?? 0}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection
        toneClass="bg-[linear-gradient(180deg,rgba(255,223,186,0.18),rgba(255,255,255,0.4))]"
        title="Atalhos"
      >
        <div className="flex flex-wrap gap-2">
          <CompactChip
            href="/produtos?category=cadernos"
            active={category === "cadernos" && !subCategory && deal !== "1"}
            label="Volta as aulas"
          />
          <CompactChip
            href="/produtos?category=presentes"
            active={category === "presentes" && deal !== "1"}
            label="Presentes"
          />
          <CompactChip
            href="/produtos?deal=1"
            active={deal === "1"}
            label="Ofertas"
          />
          <CompactChip
            href="/produtos"
            active={!hasActiveFilters}
            label="Limpar"
          />
        </div>
      </FilterSection>

      {subCategoryOptions.length > 0 && (
        <FilterSection
          toneClass="bg-[linear-gradient(180deg,rgba(244,150,180,0.08),rgba(255,255,255,0.4))]"
          title="Subcategorias"
        >
          <div className="space-y-2">
            <FilterLink
              href={`/produtos?${buildQuery({
                ...baseQuery,
                subCategory: "",
                page: "1",
              })}`}
              active={!subCategory}
              label="Ver todas"
              count={filterItems.length}
            />

            {visibleSubCategories.map((option) => (
              <FilterLink
                key={option}
                href={`/produtos?${buildQuery({
                  ...baseQuery,
                  subCategory: option,
                  page: "1",
                })}`}
                active={subCategory === option}
                label={option}
                count={subCategoryCounts.get(option) ?? 0}
              />
            ))}

            {hiddenSubCategories.length > 0 && (
              <details className="rounded-2xl border border-white/65 bg-white/45 px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-felicio-ink/72 marker:hidden">
                  Ver mais subcategorias
                </summary>
                <div className="mt-3 space-y-2">
                  {hiddenSubCategories.map((option) => (
                    <FilterLink
                      key={option}
                      href={`/produtos?${buildQuery({
                        ...baseQuery,
                        subCategory: option,
                        page: "1",
                      })}`}
                      active={subCategory === option}
                      label={option}
                      count={subCategoryCounts.get(option) ?? 0}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        </FilterSection>
      )}

      <FilterSection
        toneClass="bg-[linear-gradient(180deg,rgba(191,168,255,0.08),rgba(255,255,255,0.36))]"
        title="Cores"
      >
        <div className="flex flex-wrap gap-2">
          <CompactChip
            href={`/produtos?${buildQuery({
              ...baseQuery,
              color: "",
              page: "1",
            })}`}
            active={!color}
            label="Todas"
          />

          {visibleColors.map((option) => (
            <CompactChip
              key={option}
              href={`/produtos?${buildQuery({
                ...baseQuery,
                color: option,
                page: "1",
              })}`}
              active={color === option}
              label={`${option} (${colorCounts.get(option) ?? 0})`}
            />
          ))}
        </div>

        {hiddenColors.length > 0 && (
          <details className="mt-3 rounded-2xl border border-white/65 bg-white/45 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-felicio-ink/72 marker:hidden">
              Ver todas as cores
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenColors.map((option) => (
                <CompactChip
                  key={option}
                  href={`/produtos?${buildQuery({
                    ...baseQuery,
                    color: option,
                    page: "1",
                  })}`}
                  active={color === option}
                  label={`${option} (${colorCounts.get(option) ?? 0})`}
                />
              ))}
            </div>
          </details>
        )}
      </FilterSection>
    </>
  );
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;

  const category = String(resolvedSearchParams?.category ?? "");
  const q = String(resolvedSearchParams?.q ?? "");
  const sort = String(resolvedSearchParams?.sort ?? "new");
  const deal = String(resolvedSearchParams?.deal ?? "");
  const subCategory = String(resolvedSearchParams?.subCategory ?? "");
  const color = String(resolvedSearchParams?.color ?? "");
  const page = Math.max(Number(resolvedSearchParams?.page ?? 1), 1);

  const pageSize = 8;
  const offset = (page - 1) * pageSize;

  const cats = await getCategories();
  const categories = Array.isArray(cats?.items) ? cats.items : [];

  const categoryCountEntries = await Promise.all(
    categories.map(async (item) => {
      const response = await getProducts(
        buildQuery({
          category: String(item.id),
          q,
          deal,
          limit: "1",
          offset: "0",
        }),
      );
      return [String(item.id), Number(response.total ?? 0)] as const;
    }),
  );

  const [prod, filterUniverse] = await Promise.all([
    getProducts(
      buildQuery({
        category,
        q,
        sort,
        deal,
        subCategory,
        color,
        limit: String(pageSize),
        offset: String(offset),
      }),
    ),
    getProducts(
      buildQuery({
        category,
        q,
        sort,
        deal,
        limit: "200",
        offset: "0",
      }),
    ),
  ]);

  const items = Array.isArray(prod?.items) ? prod.items : [];
  const filterItems = Array.isArray(filterUniverse?.items) ? filterUniverse.items : [];
  const total = Number(prod?.total ?? 0);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const baseQuery = { category, q, sort, deal, subCategory, color };
  const activeCategory = categories.find((item) => String(item.id) === category);
  const categoryCounts = new Map<string, number>(categoryCountEntries);
  const subCategoryOptions = category ? SUBCATEGORY_OPTIONS[category] ?? [] : [];
  const subCategoryCounts = countByValue(filterItems, (item) => item.subCategoryId ?? "");
  const colorCounts = countByValue(filterItems, (item) => item.color ?? "");
  const { visible: visibleSubCategories, hidden: hiddenSubCategories } =
    splitVisibleOptions(subCategoryOptions, subCategory, 5);
  const { visible: visibleColors, hidden: hiddenColors } = splitVisibleOptions(
    COLOR_OPTIONS,
    color,
    6,
  );
  const hasActiveFilters = Boolean(category || q || deal || subCategory || color);

  return (
    <main className="py-12">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <details className="lg:hidden">
            <MenuSummary label="Filtros da vitrine" />
            <div className="mt-3">
              <aside className="h-fit rounded-[2rem] border border-white/70 bg-white/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl">
                <FiltersPanel
                  baseQuery={baseQuery}
                  category={category}
                  categoryCounts={categoryCounts}
                  categories={categories}
                  color={color}
                  colorCounts={colorCounts}
                  deal={deal}
                  filterItems={filterItems}
                  hasActiveFilters={hasActiveFilters}
                  hiddenColors={hiddenColors}
                  hiddenSubCategories={hiddenSubCategories}
                  subCategory={subCategory}
                  subCategoryCounts={subCategoryCounts}
                  subCategoryOptions={subCategoryOptions}
                  visibleColors={visibleColors}
                  visibleSubCategories={visibleSubCategories}
                />
              </aside>
            </div>
          </details>

          <aside className="hidden h-fit rounded-[2rem] border border-white/70 bg-white/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:sticky lg:top-28 lg:block">
            <FiltersPanel
              baseQuery={baseQuery}
              category={category}
              categoryCounts={categoryCounts}
              categories={categories}
              color={color}
              colorCounts={colorCounts}
              deal={deal}
              filterItems={filterItems}
              hasActiveFilters={hasActiveFilters}
              hiddenColors={hiddenColors}
              hiddenSubCategories={hiddenSubCategories}
              subCategory={subCategory}
              subCategoryCounts={subCategoryCounts}
              subCategoryOptions={subCategoryOptions}
              visibleColors={visibleColors}
              visibleSubCategories={visibleSubCategories}
            />
          </aside>

          <section>
            <div className="rounded-[2rem] border border-white/70 bg-white/64 p-5 sm:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur-xl">
              <div className="grid gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                    <span>Catalogo</span>
                    <span className="hidden h-px w-8 bg-felicio-ink/15 sm:block" />
                    <span className="normal-case tracking-normal text-sm font-semibold text-felicio-ink/52">
                      Explore a vitrine completa.
                    </span>
                  </div>
                  <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-felicio-ink/88">
                    Produtos
                  </h1>
                </div>

                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,360px)] xl:gap-8">
                  <form
                    action="/produtos"
                    method="GET"
                    className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                  >
                    {category && (
                      <input type="hidden" name="category" value={category} />
                    )}
                    {sort && <input type="hidden" name="sort" value={sort} />}
                    {deal && <input type="hidden" name="deal" value={deal} />}
                    {subCategory && (
                      <input type="hidden" name="subCategory" value={subCategory} />
                    )}
                    {color && <input type="hidden" name="color" value={color} />}

                    <input
                      name="q"
                      defaultValue={q}
                      placeholder="Buscar produto..."
                      className="w-full min-w-0 rounded-full border border-white/70 bg-white/82 px-5 py-3 text-sm font-semibold shadow-soft outline-none focus:bg-white"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-white/70 bg-white/82 px-7 py-3 text-sm font-extrabold shadow-soft transition hover:bg-white"
                    >
                      Buscar
                    </button>
                  </form>

                  <details className="xl:hidden">
                    <MenuSummary label="Ordenar produtos" />
                    <div className="mt-3">
                      <form
                        action="/produtos"
                        method="GET"
                        className="grid min-w-0 gap-3 rounded-[1.7rem] border border-white/70 bg-white/65 p-4"
                      >
                        {category && (
                          <input type="hidden" name="category" value={category} />
                        )}
                        {q && <input type="hidden" name="q" value={q} />}
                        {deal && <input type="hidden" name="deal" value={deal} />}
                        {subCategory && (
                          <input type="hidden" name="subCategory" value={subCategory} />
                        )}
                        {color && <input type="hidden" name="color" value={color} />}

                        <select
                          name="sort"
                          defaultValue={sort}
                          className="min-w-0 rounded-full border border-white/70 bg-white/82 px-5 py-3 text-sm font-semibold shadow-soft outline-none focus:bg-white"
                        >
                          <option value="new">Mais recentes</option>
                          <option value="price_asc">Menor preco</option>
                          <option value="price_desc">Maior preco</option>
                        </select>

                        <button
                          type="submit"
                          className="rounded-full border border-white/70 bg-white/82 px-7 py-3 text-sm font-extrabold shadow-soft transition hover:bg-white"
                        >
                          Aplicar ordenacao
                        </button>
                      </form>
                    </div>
                  </details>

                  <form
                    action="/produtos"
                    method="GET"
                    className="hidden min-w-0 gap-4 justify-self-start xl:flex xl:justify-self-end"
                  >
                    {category && (
                      <input type="hidden" name="category" value={category} />
                    )}
                    {q && <input type="hidden" name="q" value={q} />}
                    {deal && <input type="hidden" name="deal" value={deal} />}
                    {subCategory && (
                      <input type="hidden" name="subCategory" value={subCategory} />
                    )}
                    {color && <input type="hidden" name="color" value={color} />}

                    <select
                      name="sort"
                      defaultValue={sort}
                      className="min-w-0 flex-1 rounded-full border border-white/70 bg-white/82 px-5 py-3 text-sm font-semibold shadow-soft outline-none focus:bg-white"
                    >
                      <option value="new">Mais recentes</option>
                      <option value="price_asc">Menor preco</option>
                      <option value="price_desc">Maior preco</option>
                    </select>

                    <button
                      type="submit"
                      className="rounded-full border border-white/70 bg-white/82 px-7 py-3 text-sm font-extrabold shadow-soft transition hover:bg-white"
                    >
                      Ordenar
                    </button>
                  </form>
                </div>

                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeCategory && (
                      <ActiveFilterChip
                        label={`Categoria: ${activeCategory.name}`}
                        href={`/produtos?${buildQuery({
                          ...baseQuery,
                          category: "",
                          subCategory: "",
                          page: "1",
                        })}`}
                      />
                    )}

                    {deal === "1" && (
                      <ActiveFilterChip
                        label="Oferta ativa"
                        href={`/produtos?${buildQuery({
                          ...baseQuery,
                          deal: "",
                          page: "1",
                        })}`}
                      />
                    )}

                    {subCategory && (
                      <ActiveFilterChip
                        label={`Subcategoria: ${subCategory}`}
                        href={`/produtos?${buildQuery({
                          ...baseQuery,
                          subCategory: "",
                          page: "1",
                        })}`}
                      />
                    )}

                    {color && (
                      <ActiveFilterChip
                        label={`Cor: ${color}`}
                        href={`/produtos?${buildQuery({
                          ...baseQuery,
                          color: "",
                          page: "1",
                        })}`}
                      />
                    )}

                    {q && (
                      <ActiveFilterChip
                        label={`Busca: ${q}`}
                        href={`/produtos?${buildQuery({
                          ...baseQuery,
                          q: "",
                          page: "1",
                        })}`}
                      />
                    )}

                    <Link
                      href="/produtos"
                      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-felicio-pink/14 px-3 py-2 text-xs font-extrabold text-felicio-ink/78 transition hover:bg-felicio-pink/20"
                    >
                      Limpar filtros
                    </Link>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-felicio-ink/58">
                  <span>{total} produtos encontrados</span>
                  <span className="h-1 w-1 rounded-full bg-felicio-ink/25" />
                  <span>
                    Pagina {page} de {totalPages}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {items.map((item) => (
                <ProductCard
                  key={item.id}
                  compact
                  product={{
                    id: String(item.id),
                    slug: String(item.slug),
                    title: String(item.name),
                    price: Number(item.price || 0),
                    oldPrice: item.compareAtPrice
                      ? Number(item.compareAtPrice)
                      : undefined,
                    image:
                      item.coverImage ||
                      (Array.isArray(item.images) ? item.images[0]?.url : "") ||
                      "",
                    stock: Number(item.stock ?? 0),
                    badges: [
                      Number(item.isCollection ?? 0) === 1 ? "Colecao" : "",
                      Number(item.isWeeklyFavorite ?? 0) === 1
                        ? "Favoritos da semana"
                        : "",
                    ].filter(Boolean),
                  }}
                />
              ))}
            </div>

            {items.length === 0 && (
              <div className="mt-6 rounded-[2rem] border border-white/70 bg-white/72 p-8 text-center shadow-[0_18px_50px_rgba(0,0,0,0.04)]">
                <div className="text-lg font-extrabold text-felicio-ink/85">
                  Nenhum produto encontrado
                </div>
                <p className="mt-2 text-sm text-felicio-ink/65">
                  Tente trocar a busca ou voltar para outra categoria da loja.
                </p>
                <Link
                  href="/produtos"
                  className="mt-4 inline-flex rounded-full border border-white/75 bg-white px-4 py-2 text-sm font-extrabold text-felicio-ink shadow-soft transition hover:bg-white/90"
                >
                  Ver todos os produtos
                </Link>
              </div>
            )}

            <div className="mt-10 flex items-center justify-center gap-3">
              <Link
                aria-disabled={!canPrev}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-extrabold shadow-soft transition",
                  canPrev
                    ? "border-white/70 bg-white/70 hover:bg-white/90"
                    : "pointer-events-none border-white/40 bg-white/40 opacity-60",
                ].join(" ")}
                href={`/produtos?${buildQuery({
                  ...baseQuery,
                  page: String(page - 1),
                })}`}
              >
                Anterior
              </Link>

              <span className="text-sm font-semibold text-felicio-ink/70">
                Pagina {page} de {totalPages}
              </span>

              <Link
                aria-disabled={!canNext}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-extrabold shadow-soft transition",
                  canNext
                    ? "border-white/70 bg-white/70 hover:bg-white/90"
                    : "pointer-events-none border-white/40 bg-white/40 opacity-60",
                ].join(" ")}
                href={`/produtos?${buildQuery({
                  ...baseQuery,
                  page: String(page + 1),
                })}`}
              >
                Proxima
              </Link>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
