import { formatCurrency } from "./format.js";

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;

let built = false;

function build(chartEl) {
  chartEl.innerHTML = `
    <svg viewBox="0 0 ${SIZE} ${SIZE}" class="donut" role="img" aria-label="Distribuição entradas e saídas">
      <circle class="donut__track" cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke-width="${STROKE}" />
      <circle class="donut__seg donut__seg--expense" cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke-width="${STROKE}" stroke-linecap="round" />
      <circle class="donut__seg donut__seg--income" cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke-width="${STROKE}" stroke-linecap="round" />
    </svg>
    <div class="donut__center">
      <span class="donut__center-label">Saldo</span>
      <span class="donut__center-value" id="donutCenter">—</span>
    </div>`;
  built = true;
}

export function renderChart(chartEl, legendEl, { incomes, expenses }) {
  if (!built) build(chartEl);

  const total = incomes + expenses;
  const incomeFrac = total > 0 ? incomes / total : 0;
  const expenseFrac = total > 0 ? expenses / total : 0;

  const incomeSeg = chartEl.querySelector(".donut__seg--income");
  const expenseSeg = chartEl.querySelector(".donut__seg--expense");

  incomeSeg.style.strokeDasharray = `${incomeFrac * C} ${C}`;
  expenseSeg.style.strokeDasharray = `${expenseFrac * C} ${C}`;
  expenseSeg.style.strokeDashoffset = `${-incomeFrac * C}`;

  const center = chartEl.querySelector("#donutCenter");
  if (center) center.textContent = total > 0 ? formatCurrency(incomes - expenses) : "—";

  const pct = (f) => (total > 0 ? Math.round(f * 100) : 0);
  legendEl.innerHTML = `
    <li><span class="dot dot--income"></span> Entradas <strong>${pct(incomeFrac)}%</strong></li>
    <li><span class="dot dot--expense"></span> Saídas <strong>${pct(expenseFrac)}%</strong></li>`;
}
