"use client";
import { useEffect } from "react";
import { hms } from "@/lib/format";

function firstLine(s) {
  return (s || "").split("\n").find((l) => l.trim())?.trim() || "—";
}
function pubTag(p) {
  if (!p) return <span style={{ color: "var(--ink-faint)" }}>sem registro</span>;
  if (p.status === "success") return <span style={{ color: "var(--ok)" }}>publicado · {hms(p.published_at)}</span>;
  if (p.status === "error") return <span style={{ color: "var(--bad)" }}>erro · {hms(p.published_at)}</span>;
  return <span style={{ color: "var(--warn)" }}>{p.status} · {hms(p.published_at)}</span>;
}

export default function OfferDrawer({ sel, offers, publications, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!sel) return null;

  const offer = offers.find((o) => o.platform === sel.platform && o.product_id === sel.product_id);
  const pubs = publications.filter((p) => p.platform === sel.platform && p.product_id === sel.product_id);
  const lastByDest = {};
  for (const p of pubs) {
    const cur = lastByDest[p.destination];
    if (!cur || p.published_at > cur.published_at) lastByDest[p.destination] = p;
  }

  const title = firstLine(offer?.headline || offer?.original_message || pubs[0]?.headline);
  const finalMsg = offer?.original_message && offer?.original_url && offer?.affiliate_url
    ? offer.original_message.split(offer.original_url).join(offer.affiliate_url)
    : offer?.original_message;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Detalhe da oferta">
        <div className="drawer-h">
          <div>
            <h2>{title}</h2>
            <div className="pid mono">{sel.platform} · {sel.product_id}</div>
          </div>
          <button className="xbtn" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
        <div className="drawer-b">
          {!offer && (
            <p className="note" style={{ marginTop: 0 }}>
              Detalhes completos fora da janela carregada (as ofertas mais recentes). Mostrando só a publicação.
            </p>
          )}

          {offer && (
            <>
              <div className="block">
                <p className="eyebrow">Original</p>
                <div className="kv">Grupo <b className="mono">{offer.source_name || offer.source_chat_id}</b></div>
                <div className="kv">Link <b className="mono">{offer.original_url || "—"}</b></div>
                <div className="kv">Foto anexada <b>{offer.has_photo ? "sim" : "não"}</b></div>
                <div className="msgbox">{offer.original_message || "—"}</div>
              </div>
              <div className="block">
                <p className="eyebrow">Processada</p>
                <div className="kv">Link de afiliado <b className="mono">{offer.affiliate_url || "— (não gerado)"}</b></div>
                {finalMsg && <div className="msgbox">{finalMsg}</div>}
              </div>
            </>
          )}

          <div className="block">
            <p className="eyebrow">Publicação</p>
            <div className="pubrow"><span className="c tg">Telegram</span>{pubTag(lastByDest.telegram)}</div>
            <div className="pubrow"><span className="c wa">WhatsApp</span>{pubTag(lastByDest.whatsapp)}</div>
            {pubs.some((p) => p.error_message) && (
              <div className="kv" style={{ marginTop: 8, color: "var(--bad)" }}>
                {pubs.find((p) => p.error_message)?.error_message}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
