import { DEFAULT_CATEGORIES, SUBCATEGORY_OPTIONS } from "@/lib/catalog";

type EnrichmentInput = {
  name: string;
  description?: string | null;
};

export type ProductEnrichmentSuggestion = {
  categoryId: string | null;
  categoryIds: string[];
  subCategoryId: string | null;
  description: string;
  imageUrl: string;
};

type Rule = {
  categoryId: (typeof DEFAULT_CATEGORIES)[number]["id"];
  subCategoryId?: string;
  keywords: string[];
};

const RULES: Rule[] = [
  { categoryId: "canetas", subCategoryId: "Gel", keywords: ["caneta gel", "gel pen"] },
  { categoryId: "canetas", subCategoryId: "Marca-texto", keywords: ["marca texto", "marcatexto", "highlight"] },
  { categoryId: "canetas", subCategoryId: "Esferografica", keywords: ["esferografica", "caneta azul", "caneta preta", "caneta vermelha"] },
  { categoryId: "canetas", subCategoryId: "Kit", keywords: ["kit caneta", "conjunto caneta"] },
  { categoryId: "canetas", keywords: ["caneta", "lapis", "lapiseira", "borracha", "apontador", "corretivo"] },
  { categoryId: "cadernos", subCategoryId: "Universitario", keywords: ["universitario"] },
  { categoryId: "cadernos", subCategoryId: "Brochura", keywords: ["brochura"] },
  { categoryId: "cadernos", subCategoryId: "Argolado", keywords: ["argolado", "fichario"] },
  { categoryId: "cadernos", keywords: ["caderno", "refil", "folhas", "espiral"] },
  { categoryId: "agendas-planners", subCategoryId: "Planner", keywords: ["planner"] },
  { categoryId: "agendas-planners", subCategoryId: "Agenda", keywords: ["agenda"] },
  { categoryId: "agendas-planners", keywords: ["bloco semanal", "checklist", "to do"] },
  { categoryId: "papeis", subCategoryId: "Papel sulfite", keywords: ["sulfite"] },
  { categoryId: "papeis", subCategoryId: "Cartolina", keywords: ["cartolina"] },
  { categoryId: "papeis", keywords: ["papel", "bloco", "cartao", "adesivo", "etiqueta", "post-it"] },
  { categoryId: "desenhos", subCategoryId: "Lapis de cor", keywords: ["lapis de cor"] },
  { categoryId: "desenhos", subCategoryId: "Marcadores", keywords: ["marker", "marcador"] },
  { categoryId: "desenhos", subCategoryId: "Sketchbook", keywords: ["sketchbook"] },
  { categoryId: "desenhos", keywords: ["giz", "tinta", "pintura", "brush pen"] },
  { categoryId: "mochilas", subCategoryId: "Escolar", keywords: ["mochila"] },
  { categoryId: "mochilas", subCategoryId: "Mini mochila", keywords: ["mini mochila"] },
  { categoryId: "presentes", subCategoryId: "Kits", keywords: ["kit presente", "presente", "gift"] },
  { categoryId: "fofuras", subCategoryId: "Decor", keywords: ["fofo", "fofura", "pelucia", "decor"] },
];

const CATEGORY_COPY: Record<string, { lead: string; support: string }> = {
  mochilas: {
    lead: "Uma peca pensada para acompanhar a rotina com praticidade e charme.",
    support: "Combina com escola, passeio e organizacao do dia a dia.",
  },
  cadernos: {
    lead: "Ideal para estudos, anotacoes e rotina criativa.",
    support: "Uma opcao leve e funcional para deixar a papelaria ainda mais bonita.",
  },
  papeis: {
    lead: "Um item versatil para escrita, organizacao e projetos do dia a dia.",
    support: "Perfeito para quem gosta de papelaria util com visual delicado.",
  },
  fofuras: {
    lead: "Uma escolha charmosa para deixar a rotina mais leve.",
    support: "Tambem funciona muito bem para decoracao, kits e pequenos detalhes especiais.",
  },
  desenhos: {
    lead: "Perfeito para momentos criativos, estudos e projetos artisticos.",
    support: "Traz um visual leve e inspirador para o uso diario.",
  },
  "agendas-planners": {
    lead: "Uma opcao pensada para organizar compromissos, estudos e rotina.",
    support: "Ajuda a planejar o dia com mais leveza e praticidade.",
  },
  canetas: {
    lead: "Perfeita para escrita, estudos e organizacao.",
    support: "Deixa a rotina mais bonita e gostosa de usar.",
  },
  presentes: {
    lead: "Uma escolha carinhosa para presentear ou montar kits especiais.",
    support: "Ajuda a transformar a papelaria em uma experiencia ainda mais encantadora.",
  },
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function chooseRule(normalizedName: string) {
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalizedName.includes(keyword))) {
      return rule;
    }
  }

  return null;
}

function buildDescription(name: string, categoryId: string | null, existingDescription?: string | null) {
  const trimmedExisting = String(existingDescription || "").trim();
  if (trimmedExisting) return trimmedExisting;

  const base = categoryId ? CATEGORY_COPY[categoryId] : CATEGORY_COPY.presentes;
  return `${capitalizeFirst(name.trim())}.\n\n${base.lead} ${base.support}`;
}

function buildPlaceholderUrl(name: string, categoryId: string | null) {
  const params = new URLSearchParams();
  params.set("name", name.trim() || "Produto da Papelaria Felicio");
  if (categoryId) {
    params.set("category", categoryId);
  }
  return `/api/product-placeholder?${params.toString()}`;
}

export function suggestProductEnrichment(
  input: EnrichmentInput,
): ProductEnrichmentSuggestion {
  const name = String(input.name || "").trim();
  const normalizedName = normalizeText(name);
  const rule = chooseRule(normalizedName);
  const categoryId = rule?.categoryId ?? "presentes";
  const categoryIds = categoryId ? [categoryId] : [];
  const allowedSubcategories = categoryId ? SUBCATEGORY_OPTIONS[categoryId] ?? [] : [];
  const subCategoryId =
    rule?.subCategoryId && allowedSubcategories.includes(rule.subCategoryId)
      ? rule.subCategoryId
      : null;

  return {
    categoryId,
    categoryIds,
    subCategoryId,
    description: buildDescription(name, categoryId, input.description),
    imageUrl: buildPlaceholderUrl(name, categoryId),
  };
}
