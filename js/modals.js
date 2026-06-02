import { CATEGORIES } from "./categories.js";
import { formatCurrency, escapeHTML } from "./format.js";
import { attachMoneyMask, formatFromNumber, moneyToNumber } from "./money.js";

const root = () => document.querySelector("#modalRoot");

function openModal(buildHTML, onMount) {
  const previouslyFocused = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const close = () => {
    overlay.classList.add("modal--closing");
    overlay.addEventListener(
      "animationend",
      () => {
        overlay.remove();
        previouslyFocused?.focus?.();
      },
      { once: true }
    );
  };

  overlay.innerHTML = `<div class="modal-content" role="document">${buildHTML()}</div>`;
  root().appendChild(overlay);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      const f = overlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  onMount(overlay, close);

  overlay.querySelector("input, select, button")?.focus();
  return close;
}

export function openDeleteModal(t, onConfirm) {
  openModal(
    () => `
      <div class="modal-icon modal-icon--danger"><i class="bx bx-trash"></i></div>
      <h3 class="modal-title">Excluir lançamento?</h3>
      <p class="modal-text">
        <strong>${escapeHTML(t.desc)}</strong><br />
        ${formatCurrency(t.amount)} · ${t.type}
      </p>
      <div class="modal-actions">
        <button type="button" class="btn btn--ghost" data-act="cancel">Cancelar</button>
        <button type="button" class="btn btn--danger" data-act="confirm">Excluir</button>
      </div>`,
    (overlay, close) => {
      overlay.querySelector('[data-act="cancel"]').onclick = close;
      overlay.querySelector('[data-act="confirm"]').onclick = () => {
        onConfirm();
        close();
      };
    }
  );
}

export function openEditModal(t, onSave) {
  const options = CATEGORIES.map(
    (c) => `<option value="${c.id}" ${c.id === t.category ? "selected" : ""}>${c.label}</option>`
  ).join("");

  openModal(
    () => `
      <h3 class="modal-title">Editar lançamento</h3>
      <form class="modal-form" id="editForm" novalidate>
        <div class="field">
          <label for="editDesc">Descrição</label>
          <input type="text" id="editDesc" value="${escapeHTML(t.desc)}" required />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="editAmount">Valor</label>
            <input type="text" id="editAmount" value="${formatFromNumber(t.amount)}" inputmode="numeric" autocomplete="off" required />
          </div>
          <div class="field">
            <label for="editDate">Data</label>
            <input type="date" id="editDate" value="${t.date}" required />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="editType">Tipo</label>
            <select id="editType">
              <option ${t.type === "Entrada" ? "selected" : ""}>Entrada</option>
              <option ${t.type === "Saída" ? "selected" : ""}>Saída</option>
            </select>
          </div>
          <div class="field">
            <label for="editCategory">Categoria</label>
            <select id="editCategory">${options}</select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Salvar</button>
        </div>
      </form>`,
    (overlay, close) => {
      overlay.querySelector('[data-act="cancel"]').onclick = close;
      attachMoneyMask(overlay.querySelector("#editAmount"));
      overlay.querySelector("#editForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const desc = overlay.querySelector("#editDesc").value.trim();
        const amount = moneyToNumber(overlay.querySelector("#editAmount").value);
        if (!desc || !(amount > 0)) return;
        onSave({
          desc,
          amount,
          date: overlay.querySelector("#editDate").value,
          type: overlay.querySelector("#editType").value,
          category: overlay.querySelector("#editCategory").value,
        });
        close();
      });
    }
  );
}
