import { CATEGORIES, getCategory } from "./categories.js";
import { formatCurrency, formatDate, escapeHTML } from "./format.js";

export function populateCategories() {
  const form = document.querySelector("#category");
  const filter = document.querySelector("#filterCategory");

  form.innerHTML = CATEGORIES.map(
    (c) => `<option value="${c.id}">${c.label}</option>`
  ).join("");

  filter.innerHTML =
    `<option value="all">Todas as categorias</option>` +
    CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
}

export function renderTable(tbody, list) {
  tbody.innerHTML = list
    .map((t, i) => {
      const cat = getCategory(t.category);
      const isIncome = t.type === "Entrada";
      const sign = isIncome ? "+" : "−";
      return `
      <tr style="--row-i:${i}">
        <td class="col-date" data-label="Data">${formatDate(t.date)}</td>
        <td class="col-desc" data-label="Descrição"><span class="desc-text">${escapeHTML(t.desc)}</span></td>
        <td data-label="Categoria">
          <span class="chip" style="--chip:${cat.color}">
            <i class="bx ${cat.icon}"></i>${cat.label}
          </span>
        </td>
        <td class="col-amount ${isIncome ? "is-income" : "is-expense"}" data-label="Valor">
          ${sign} ${formatCurrency(t.amount)}
        </td>
        <td class="col-type" data-label="Tipo">
          <span class="type-badge ${isIncome ? "is-income" : "is-expense"}" title="${t.type}">
            <i class="bx ${isIncome ? "bxs-up-arrow-circle" : "bxs-down-arrow-circle"}"></i>
          </span>
        </td>
        <td class="col-action" data-label="Ações">
          <button class="icon-btn icon-btn--ghost" data-action="edit" data-id="${t.id}" aria-label="Editar lançamento">
            <i class="bx bx-edit"></i>
          </button>
          <button class="icon-btn icon-btn--ghost danger" data-action="delete" data-id="${t.id}" aria-label="Excluir lançamento">
            <i class="bx bx-trash"></i>
          </button>
        </td>
      </tr>`;
    })
    .join("");
}

export function renderEmpty(show) {
  const el = document.querySelector("#emptyState");
  const table = document.querySelector(".table-scroll");
  el.hidden = !show;
  table.style.display = show ? "none" : "";
}

const prev = { incomes: 0, expenses: 0, total: 0 };

function animateValue(el, from, to) {
  if (!el) return;
  const dur = 600;
  const start = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  function frame(now) {
    const p = Math.min((now - start) / dur, 1);
    const v = from + (to - from) * ease(p);
    el.textContent = formatCurrency(v);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function renderSummary({ incomes, expenses, total, monthBalance }) {
  animateValue(document.querySelector('[data-value="incomes"]'), prev.incomes, incomes);
  animateValue(document.querySelector('[data-value="expenses"]'), prev.expenses, expenses);
  animateValue(document.querySelector('[data-value="total"]'), prev.total, total);

  prev.incomes = incomes;
  prev.expenses = expenses;
  prev.total = total;

  const monthEl = document.querySelector('[data-value="monthBalance"]');
  if (monthEl) monthEl.textContent = `Mês: ${formatCurrency(monthBalance)}`;

  const balanceCard = document.querySelector(".card--balance");
  if (balanceCard) {
    balanceCard.dataset.state = total > 0 ? "positive" : total < 0 ? "negative" : "zero";
  }
}
