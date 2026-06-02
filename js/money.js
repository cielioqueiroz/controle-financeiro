const fmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function maskMoney(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return "R$ " + fmt.format(cents / 100);
}

export function formatFromNumber(number) {
  const cents = Math.round((Number(number) || 0) * 100);
  return cents ? "R$ " + fmt.format(cents / 100) : "";
}

export function moneyToNumber(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) / 100 : 0;
}

export function attachMoneyMask(input) {
  input.addEventListener("input", () => {
    input.value = maskMoney(input.value);
  });
}
