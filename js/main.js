import * as store from "./store.js";
import { initTheme } from "./theme.js";
import { toast } from "./toast.js";
import { todayISO } from "./format.js";
import { filterState, applyFilters } from "./filters.js";
import {
  populateCategories,
  renderTable,
  renderEmpty,
  renderSummary,
} from "./render.js";
import { renderChart } from "./chart.js";
import { openEditModal, openDeleteModal } from "./modals.js";
import { exportJSON, parseImport } from "./io.js";
import { attachMoneyMask, moneyToNumber } from "./money.js";

const $ = (sel) => document.querySelector(sel);

const tbody = $("#tbody");
const chartEl = $("#chart");
const legendEl = $("#chartLegend");

function sumBy(list, type) {
  return list.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);
}

function currentMonthNet(all) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = all.filter((t) => String(t.date).startsWith(ym));
  return sumBy(month, "Entrada") - sumBy(month, "Saída");
}

function render(all) {
  const list = applyFilters(all);

  const incomes = sumBy(list, "Entrada");
  const expenses = sumBy(list, "Saída");

  renderTable(tbody, list);
  renderEmpty(list.length === 0);
  renderSummary({
    incomes,
    expenses,
    total: incomes - expenses,
    monthBalance: currentMonthNet(all),
  });
  renderChart(chartEl, legendEl, { incomes, expenses });

  $('[data-value="chartHint"]').textContent =
    list.length === 0 ? "Sem lançamentos" : `${list.length} lançamento(s)`;
}

function setupForm() {
  const form = $("#formNew");
  $("#date").value = todayISO();
  attachMoneyMask($("#amount"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const desc = $("#desc").value.trim();
    const amount = moneyToNumber($("#amount").value);
    const date = $("#date").value || todayISO();

    if (!desc) return toast("Informe uma descrição.", "error");
    if (!(amount > 0)) return toast("O valor deve ser maior que zero.", "error");

    store.add({
      desc,
      amount,
      type: $("#type").value,
      category: $("#category").value,
      date,
    });
    toast("Lançamento incluído!", "success");

    form.reset();
    $("#date").value = todayISO();
    $("#desc").focus();
  });
}

function setupFilters() {
  const rerender = () => render(store.getAll());

  $("#search").addEventListener("input", (e) => {
    filterState.search = e.target.value;
    rerender();
  });
  $("#filterType").addEventListener("change", (e) => {
    filterState.type = e.target.value;
    rerender();
  });
  $("#filterCategory").addEventListener("change", (e) => {
    filterState.category = e.target.value;
    rerender();
  });
  $("#filterPeriod").addEventListener("change", (e) => {
    filterState.period = e.target.value;
    rerender();
  });

  document.querySelectorAll("th.th-sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (filterState.sortBy === key) {
        filterState.sortDir = filterState.sortDir === "asc" ? "desc" : "asc";
      } else {
        filterState.sortBy = key;
        filterState.sortDir = "desc";
      }
      document.querySelectorAll("th.th-sortable").forEach((t) => {
        t.removeAttribute("data-dir");
      });
      th.setAttribute("data-dir", filterState.sortDir);
      rerender();
    });
  });
}

function setupTableActions() {
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const item = store.getById(id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      openEditModal(item, (patch) => {
        store.update(id, patch);
        toast("Lançamento atualizado!", "success");
      });
    } else if (btn.dataset.action === "delete") {
      openDeleteModal(item, () => {
        store.remove(id);
        toast("Lançamento excluído.", "error");
      });
    }
  });
}

function setupIO() {
  $("#btnExport").addEventListener("click", () => {
    const all = store.getAll();
    if (!all.length) return toast("Nada para exportar.", "info");
    exportJSON(all);
    toast("Dados exportados (JSON).", "success");
  });

  const fileInput = $("#fileImport");
  $("#btnImport").addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await parseImport(file);
      if (!Array.isArray(data) || !data.length) throw new Error("Vazio");
      if (!confirm(`Importar ${data.length} lançamento(s)? Isso substitui os dados atuais.`)) {
        return;
      }
      store.replaceAll(data);
      toast(`${data.length} lançamento(s) importado(s).`, "success");
    } catch (err) {
      toast("Arquivo inválido. Use JSON ou CSV exportado pelo app.", "error");
    } finally {
      fileInput.value = "";
    }
  });
}

function init() {
  $("#year").textContent = new Date().getFullYear();
  initTheme();
  populateCategories();
  setupForm();
  setupFilters();
  setupTableActions();
  setupIO();

  store.subscribe(render);
  store.load();
}

document.addEventListener("DOMContentLoaded", init);
