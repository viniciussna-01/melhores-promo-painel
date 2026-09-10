// Horario de Brasilia (GMT-3) para exibicao. Os dados vem em UTC (ISO).
const BR = "America/Sao_Paulo";

export function hm(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: BR });
}

export function hms(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: BR });
}

export function dm(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: BR });
}

export function ago(iso) {
  if (!iso) return "sem registro";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export function nfmt(n) {
  return (n ?? 0).toLocaleString("pt-BR");
}

// tail dos 3 ultimos digitos de um chat_id, p/ rotulo curto
export function shortId(v) {
  const s = String(v ?? "");
  return s.length > 6 ? "…" + s.slice(-6) : s;
}
