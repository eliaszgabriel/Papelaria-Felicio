export const DEFAULT_CATEGORIES = [
  { id: "mochilas", name: "Mochilas", sortOrder: 1 },
  { id: "cadernos", name: "Cadernos", sortOrder: 2 },
  { id: "papeis", name: "Papeis", sortOrder: 3 },
  { id: "fofuras", name: "Fofuras", sortOrder: 4 },
  { id: "desenhos", name: "Desenhos", sortOrder: 5 },
  { id: "agendas-planners", name: "Agendas e Planners", sortOrder: 6 },
  { id: "canetas", name: "Canetas", sortOrder: 7 },
  { id: "tesouras-reguas", name: "Tesouras e Reguas", sortOrder: 8 },
  { id: "escritorio", name: "Escritorio", sortOrder: 9 },
  { id: "presentes", name: "Presentes", sortOrder: 10 },
] as const;

export const CATEGORY_NAME_BY_ID = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.id, category.name]),
) as Record<string, string>;

export const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  mochilas: ["Escolar", "Passeio", "Infantil", "Mini mochila"],
  cadernos: [
    "Universitario",
    "Colegial",
    "10 materias",
    "Argolado",
    "Brochura",
  ],
  papeis: ["Bloco", "Papel sulfite", "Papel colorido", "Cartolina"],
  fofuras: ["Acessorios", "Kits fofos", "Presentinhos", "Decor"],
  desenhos: ["Lapis de cor", "Marcadores", "Pintura", "Sketchbook"],
  "agendas-planners": ["Agenda", "Planner", "Bloco semanal", "Checklist"],
  canetas: ["Gel", "Coloridas", "Kit", "Marca-texto", "Esferografica"],
  "tesouras-reguas": ["Tesoura", "Regua", "Kit geometrico", "Escolar"],
  escritorio: ["Organizacao", "Mesa", "Arquivo", "Acessorios"],
  presentes: ["Kits", "Criativos", "Lembrancinhas", "Personalizados"],
};

export const COLOR_OPTIONS = [
  "Rosa",
  "Azul",
  "Lilás",
  "Amarelo",
  "Verde",
  "Preto",
  "Branco",
  "Colorido",
] as const;

export function normalizeCategoryIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return [...new Set(input.map(String).map((value) => value.trim()).filter(Boolean))];
}

export function normalizeTextValue(input: unknown): string | null {
  const value = String(input ?? "").trim();
  return value ? value : null;
}
