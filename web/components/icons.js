const p = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconStatus() {
  return (<svg viewBox="0 0 24 24" {...p}><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>);
}
export function IconGrupos() {
  return (<svg viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></svg>);
}
export function IconFila() {
  return (<svg viewBox="0 0 24 24" {...p}><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></svg>);
}
export function IconHistorico() {
  return (<svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
}
export function IconDiag() {
  return (<svg viewBox="0 0 24 24" {...p}><path d="M4 2v6a6 6 0 0 0 12 0V2" /><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>);
}
