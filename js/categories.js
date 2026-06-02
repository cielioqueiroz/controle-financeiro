export const CATEGORIES = [
  { id: "salario", label: "Salário", icon: "bx-money", color: "#0e9f6e" },
  { id: "alimentacao", label: "Alimentação", icon: "bx-restaurant", color: "#f59e0b" },
  { id: "transporte", label: "Transporte", icon: "bx-car", color: "#3b82f6" },
  { id: "moradia", label: "Moradia", icon: "bx-home-alt", color: "#8b5cf6" },
  { id: "lazer", label: "Lazer", icon: "bx-game", color: "#ec4899" },
  { id: "saude", label: "Saúde", icon: "bx-plus-medical", color: "#ef4444" },
  { id: "educacao", label: "Educação", icon: "bx-book", color: "#06b6d4" },
  { id: "outros", label: "Outros", icon: "bx-dots-horizontal-rounded", color: "#64748b" },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export const getCategory = (id) => byId.get(id) ?? byId.get("outros");
