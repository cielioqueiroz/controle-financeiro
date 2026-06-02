export const filterState = {
  search: "",
  type: "all",
  category: "all",
  period: "all",
  sortBy: "date",
  sortDir: "desc",
};

function inCurrentMonth(iso) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(iso).startsWith(ym);
}

export function applyFilters(items) {
  const q = filterState.search.trim().toLowerCase();

  let out = items.filter((t) => {
    if (q && !t.desc.toLowerCase().includes(q)) return false;
    if (filterState.type !== "all" && t.type !== filterState.type) return false;
    if (filterState.category !== "all" && t.category !== filterState.category) return false;
    if (filterState.period === "month" && !inCurrentMonth(t.date)) return false;
    return true;
  });

  const dir = filterState.sortDir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    if (filterState.sortBy === "amount") return (a.amount - b.amount) * dir;
    if (a.date === b.date) return (a.createdAt - b.createdAt) * dir;
    return (a.date < b.date ? -1 : 1) * dir;
  });

  return out;
}
