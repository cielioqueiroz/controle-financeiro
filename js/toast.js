const styles = {
  success: { bg: "linear-gradient(135deg,#0e9f6e,#10b981)" },
  error: { bg: "linear-gradient(135deg,#e5484d,#f43f5e)" },
  info: { bg: "linear-gradient(135deg,#4f46e5,#6366f1)" },
};

export function toast(text, kind = "info") {
  if (typeof window.Toastify !== "function") return;
  window.Toastify({
    text,
    duration: 2800,
    gravity: "top",
    position: "right",
    close: true,
    stopOnFocus: true,
    className: "toastify",
    style: { background: (styles[kind] ?? styles.info).bg },
  }).showToast();
}
