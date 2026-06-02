const KEY = "cf_theme";

function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector("#btnTheme i");
  if (icon) icon.className = theme === "dark" ? "bx bx-sun" : "bx bx-moon";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0d11" : "#4f46e5");
}

export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = saved ?? (prefersDark ? "dark" : "light");
  apply(theme);

  const btn = document.querySelector("#btnTheme");
  btn?.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  });
}
