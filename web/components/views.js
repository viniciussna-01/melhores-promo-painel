"use client";
import { useMemo, useState } from "react";
import { hm, hms, dm, ago, nfmt, shortId } from "@/lib/format";

/* ------------------------------------------------------------------ helpers */
function tag(s) {
  if (s === "ok") return { cls: "ok", label: "conectado" };
  if (s === "atencao") return { cls: "warn", label: "atenção" };
  if (s === "sem_sinal") return { cls: "bad", label: "sem sinal" };
  return { cls: "idle", label: "—" };
}
function plat(p) {
  return p === "amazon" ? { k: "az", t: "AZ" } : { k: "ml", t: "ML" };
}
function firstLine(s) {
  return (s || "").split("\n").find((l) => l.trim())?.trim() || "—";
}

/* ------------------------------------------------------------------ Status */
export function StatusView({ status, offers, publications, queue }) {
  const s = status || {};
  const wk = s.worker_state === "ok"
    ? { cls: "ok", label: "no ar" }
    : { cls: "bad", label: "sem sinal" };
  const tg = tag(s.telegram_state);
  const wa = tag(s.whatsapp_state);

  const feed = useMemo(() => {
    const evs = [];
    for (const o of offers.slice(0, 8)) {
      evs.push({ t: o.detected_at, txt: <>Oferta capturada · <b>{firstLine(o.headline || o.original_message)}</b></> });
    }
    for (const p of publications.slice(0, 8)) {
      const d = p.destination === "telegram" ? "Telegram" : "WhatsApp";
      const verb = p.status === "success" ? "Publicada" : p.status === "error" ? "Falha ao publicar" : "Registrada";
      evs.push({ t: p.published_at, txt: <>{verb} no {d} · <b>{firstLine(p.headline)}</b></> });
    }
    return evs.filter((e) => e.t).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 6);
  }, [offers, publications]);

  return (
    <>
      <div className="section">
        <p className="eyebrow">Estado do sistema</p>
        <div className="health">
          <div className="pill"><span className={"dot " + wk.cls} /><span className="name">Worker</span>
            <span className="meta">{s.worker_last_seen ? "pulso " + hms(s.worker_last_seen) : "—"}</span>
            <span className={"state " + wk.cls}>{wk.label}</span></div>
          <div className="pill"><span className={"dot " + wk.cls} /><span className="name">Telegram (captura)</span>
            <span className="meta">{s.last_capture_at ? "última " + hm(s.last_capture_at) : "—"}</span>
            <span className={"state " + wk.cls}>{wk.label === "no ar" ? "conectado" : "sem sinal"}</span></div>
          <div className="pill"><span className="dot idle" /><span className="name">Mercado Livre</span>
            <span className="meta">sinal fino: fase futura</span>
            <span className="state idle">—</span></div>
          <div className="pill"><span className={"dot " + wa.cls} /><span className="name">WhatsApp Web</span>
            <span className="meta">{s.last_publish_at ? "última " + hm(s.last_publish_at) : "—"}</span>
            <span className={"state " + wa.cls}>{wa.label}</span></div>
          <div className="pill"><span className={"dot " + tg.cls} /><span className="name">Telegram destino</span>
            <span className="meta">{publications[0]?.destination_id || "@promo_ofertas01"}</span>
            <span className={"state " + tg.cls}>{tg.label}</span></div>
        </div>
      </div>

      <div className="section">
        <p className="eyebrow">Hoje</p>
        <div className="tiles">
          <div className="tile"><div className="n mono">{nfmt(s.captured_today)}</div><div className="l">capturadas</div></div>
          <div className="tile"><div className="n mono">{nfmt(s.published_today)}</div><div className="l">publicadas</div></div>
          <div className="tile"><div className="n mono">{nfmt(s.queue_size ?? queue.length)}</div><div className="l">na fila</div></div>
        </div>
        <div className="tiles" style={{ marginTop: 9 }}>
          <div className={"tile" + ((s.errors_7d || 0) > 0 ? " alert" : "")}>
            <div className="n mono">{nfmt(s.errors_7d)}</div><div className="l">erros (7 dias)</div>
          </div>
          <div className="tile"><div className="n mono">{s.last_publish_at ? hm(s.last_publish_at) : "—"}</div><div className="l">última publicação</div></div>
          <div className="tile"><div className="n mono">{s.synced_at ? ago(s.synced_at) : "—"}</div><div className="l">sync</div></div>
        </div>
      </div>

      <div className="section">
        <p className="eyebrow">Últimas atividades</p>
        <ul className="feed">
          {feed.length === 0 && <li><span className="txt">Sem eventos ainda.</span></li>}
          {feed.map((e, i) => (
            <li key={i}><time>{hm(e.t)}</time><div className="txt">{e.txt}</div></li>
          ))}
        </ul>
      </div>

      <p className="note">Horários em Brasília (GMT−3). Atualiza sozinho em ~2 s — o bot não foi alterado.</p>
    </>
  );
}

/* ------------------------------------------------------------------ Grupos */
export function GruposView({ groups }) {
  return (
    <>
      <p className="eyebrow">Grupos de origem</p>
      <div className="banner">
        <span className="ic">!</span>
        <span>Os canais aparecem pelo ID numérico — o vínculo com os nomes do <span className="mono">config/sources.json</span> não resolve em execução (bug conhecido do bot).</span>
      </div>
      {groups.length === 0 && <p className="center">Carregando grupos…</p>}
      {groups.map((g) => (
        <div className="grp" key={g.id}>
          <div className="id mono">{g.chat_id}</div>
          <div className="cfg">{g.config_name ? "config: " + g.config_name : "sem nome no config"}</div>
          <div className="row">
            <span>Status <b>{g.active ? "Ativo" : "Pausado"}</b></span>
            <span>Capturadas <b className="mono">{nfmt(g.captured_total)}</b></span>
            <span>Última <b>{hm(g.last_capture_at)}</b></span>
          </div>
        </div>
      ))}
      <p className="note">Contagem total por grupo desde o início do histórico. Pausar grupo pelo painel só na fase de comandos.</p>
    </>
  );
}

/* ------------------------------------------------------------------ Fila */
export function FilaView({ queue, onOpen }) {
  return (
    <>
      <p className="eyebrow">Fila de ofertas</p>
      <p className="summary">{queue.length} aguardando envio · ritmo de 1 publicação a cada 4 min · toque para ver os detalhes</p>
      {queue.length === 0 && <p className="empty">Fila vazia. As ofertas prontas são publicadas em ~4 min.</p>}
      {queue.map((q) => {
        const pl = plat(q.platform);
        return (
          <button className="offer s-wait" key={q.id} onClick={() => onOpen({ platform: q.platform, product_id: q.product_id })}>
            <span className={"thumb " + pl.k}>{pl.t}</span>
            <span className="body">
              <span className="hl">{firstLine(q.headline)}</span>
              <span className="prod">{q.platform} · {q.product_id}</span>
              <span className="foot">
                <span className="chip wait">na fila · {q.position + 1}º</span>
                <span className="src">{shortId(q.product_id)}</span>
              </span>
            </span>
          </button>
        );
      })}
      <p className="note">Estados no arquivo do bot: capturada → pronta → na fila → publicada. Os passos finos (“processando”) não existem em arquivo.</p>
    </>
  );
}

/* ------------------------------------------------------------------ Histórico */
export function HistoricoView({ publications, onOpen }) {
  const [f, setF] = useState("all");
  const rows = useMemo(() => {
    return publications.filter((p) => {
      if (f === "all") return true;
      if (f === "bad") return p.status === "error";
      return p.platform === f;
    });
  }, [publications, f]);

  const btns = [
    ["all", "Tudo"], ["mercadolivre", "Mercado Livre"], ["amazon", "Amazon"], ["bad", "Com erro"],
  ];

  return (
    <>
      <p className="eyebrow">Histórico</p>
      <div className="filters">
        {btns.map(([k, label]) => (
          <button key={k} className="fbtn" aria-pressed={f === k} onClick={() => setF(k)}>{label}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="empty">Nada neste filtro.</p>}
      {rows.map((p) => {
        const pl = plat(p.platform);
        const dest = p.destination === "telegram" ? "TG" : "WA";
        const bcls = p.status === "success" ? "ok" : p.status === "error" ? "bad" : "wait";
        return (
          <div className="hrow" key={p.id} role="button" tabIndex={0}
            onClick={() => onOpen({ platform: p.platform, product_id: p.product_id })}
            onKeyDown={(e) => e.key === "Enter" && onOpen({ platform: p.platform, product_id: p.product_id })}>
            <time>{hms(p.published_at)}</time>
            <span className={"pdot " + pl.k} />
            <span className="h">{firstLine(p.headline)}</span>
            <span className="badges"><span className={"bdg " + bcls}>{dest}</span></span>
          </div>
        );
      })}
      <p className="note">Horários em Brasília. Cada linha é um envio (<b>TG</b> Telegram · <b>WA</b> WhatsApp). Verde = sucesso, vermelho = erro.</p>
    </>
  );
}

/* ------------------------------------------------------------------ Diagnóstico */
export function DiagView({ status, publications }) {
  const s = status || {};
  const wk = s.worker_state === "ok" ? { cls: "ok", label: "no ar" } : { cls: "bad", label: "sem sinal" };
  const tg = tag(s.telegram_state);
  const wa = tag(s.whatsapp_state);
  const errs = publications.filter((p) => p.status === "error").slice(0, 6);

  return (
    <>
      <p className="eyebrow">Diagnóstico</p>
      <div className="helper">
        <h3>Por que uma oferta não foi publicada?</h3>
        <ol>
          <li>A plataforma é suportada? (só Amazon e Mercado Livre)</li>
          <li>O link de afiliado foi gerado? Mercado Livre sem link oficial é pulado de propósito.</li>
          <li>Bateu o limite de 30 gerações/hora do Mercado Livre?</li>
          <li>É duplicada? A política atual é “nunca repetir o mesmo produto”.</li>
          <li>O WhatsApp Web achou o grupo “Melhores Promo 01”?</li>
        </ol>
      </div>

      <div className="diag">
        <div className="h"><span className={"dot " + wk.cls} /><span className="name">Worker</span><span className={"state " + wk.cls}>{wk.label}</span></div>
        <div className="d">Último pulso <span className="mono">{hms(s.worker_last_seen)}</span> ({ago(s.worker_last_seen)}) · fila <span className="mono">{nfmt(s.queue_size)}</span>.</div>
      </div>
      <div className="diag">
        <div className="h"><span className={"dot " + wk.cls} /><span className="name">Telegram — captura</span><span className={"state " + wk.cls}>{wk.label === "no ar" ? "conectado" : "sem sinal"}</span></div>
        <div className="d">Última captura <span className="mono">{hms(s.last_capture_at)}</span> · {nfmt(s.captured_today)} hoje.</div>
      </div>
      <div className="diag">
        <div className="h"><span className="dot idle" /><span className="name">Mercado Livre — Gerador de Links</span><span className="state idle">—</span></div>
        <div className="d">Sem sinal direto em arquivo. Rate-limit 30/h + Chrome CDP <span className="mono">:9333</span>. Sinal fino exige heartbeat no bot (fase futura, com aprovação).</div>
      </div>
      <div className="diag">
        <div className="h"><span className={"dot " + wa.cls} /><span className="name">WhatsApp Web</span><span className={"state " + wa.cls}>{wa.label}</span></div>
        <div className="d">Última publicação <span className="mono">{hms(s.last_publish_at)}</span> · grupo <span className="mono">Melhores Promo 01</span>.</div>
      </div>
      <div className="diag">
        <div className="h"><span className={"dot " + tg.cls} /><span className="name">Telegram — destino</span><span className={"state " + tg.cls}>{tg.label}</span></div>
        <div className="d">Canal <span className="mono">{publications[0]?.destination_id || "@promo_ofertas01"}</span> · Bot API.</div>
      </div>

      <p className="eyebrow" style={{ marginTop: 20 }}>Erros recentes</p>
      <ul className="errlist">
        {errs.length === 0 && <li><span>Nenhum erro no histórico carregado.</span></li>}
        {errs.map((e) => (
          <li key={e.id}>
            <time className="mono">{hms(e.published_at)}</time>
            <div><span className="k">{e.destination === "telegram" ? "Telegram" : "WhatsApp"}</span> — {e.error_message || "erro sem detalhe"} <span style={{ color: "var(--ink-faint)" }}>({firstLine(e.headline)})</span></div>
          </li>
        ))}
      </ul>
      <p className="note">Espelho dos arquivos do bot, ~2 s de atraso.</p>
    </>
  );
}
