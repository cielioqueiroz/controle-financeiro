import { todayISO } from "./format.js";

const KEY = "db_items";

let items = [];
const listeners = new Set();

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function migrate(raw) {
  return {
    id: raw.id ?? uid(),
    desc: String(raw.desc ?? ""),
    amount: Math.abs(Number(raw.amount) || 0),
    type: raw.type === "Saída" ? "Saída" : "Entrada",
    category: raw.category ?? "outros",
    date: raw.date ?? todayISO(),
    createdAt: raw.createdAt ?? Date.now(),
  };
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function emit() {
  listeners.forEach((fn) => fn(items));
}

export function load() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    raw = [];
  }
  items = Array.isArray(raw) ? raw.map(migrate) : [];
  persist();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getAll = () => [...items];

export function add({ desc, amount, type, category, date }) {
  items.push({
    id: uid(),
    desc,
    amount: Math.abs(Number(amount)),
    type,
    category,
    date,
    createdAt: Date.now(),
  });
  persist();
  emit();
}

export function update(id, patch) {
  const i = items.findIndex((t) => t.id === id);
  if (i === -1) return;
  items[i] = { ...items[i], ...patch, amount: Math.abs(Number(patch.amount ?? items[i].amount)) };
  persist();
  emit();
}

export function remove(id) {
  items = items.filter((t) => t.id !== id);
  persist();
  emit();
}

export const getById = (id) => items.find((t) => t.id === id) ?? null;

export function replaceAll(list) {
  items = list.map(migrate);
  persist();
  emit();
}
