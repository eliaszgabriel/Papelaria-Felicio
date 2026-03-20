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

const CATEGORY_COPY: Record<string, string> = {
  mochilas:
    "Uma peca pensada para acompanhar a rotina com praticidade, charme e aquele toque delicado que combina com a vitrine da Papelaria Felicio.",
  cadernos:
    "Ideal para estudos, organizacao e rotina criativa, com um visual leve e funcional para deixar a papelaria ainda mais bonita.",
  papeis:
    "Um item versatil para escrita, organizacao e projetos do dia a dia, perfeito para quem gosta de papelaria util com visual delicado.",
  fofuras:
    "Uma escolha charmosa para deixar a rotina mais leve, decorar a mesa e transformar pequenos detalhes em algo especial.",
  desenhos:
    "Perfeito para momentos criativos, estudos e projetos artisticos, com uma proposta leve e inspiradora para o dia a dia.",
  "agendas-planners":
    "Uma opcao pensada para organizar compromissos, estudos e rotina com mais leveza, praticidade e um toque carinhoso.",
  canetas:
    "Perfeita para escrita, estudos e organizacao, com um visual delicado que deixa a rotina mais bonita e gostosa de usar.",
  presentes:
    "Uma escolha carinhosa para presentear, montar kits especiais e transformar a papelaria em uma experiencia ainda mais encantadora.",
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
  return `${capitalizeFirst(name.trim())}. ${base}`;
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
