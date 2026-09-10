#!/usr/bin/env python3
"""sync_agent.py - espelha os arquivos do bot Melhores Promo para o Firebase (Firestore).

=============================================================================
PROCESSO SEPARADO E INDEPENDENTE DO BOT.
- NAO importa nenhum modulo do bot.
- NAO escreve, NAO trava e NAO renomeia nenhum arquivo do bot.
- Abre os arquivos do bot SOMENTE em leitura ('rb') / os.stat().
- Se este processo cair, travar ou o Firebase ficar fora do ar, o bot
  continua funcionando exatamente igual - nada aqui bloqueia o worker.

Escreve no Firestore com a Admin SDK (service account) -> ignora as regras
de seguranca, entao o painel nunca precisa de permissao de escrita.

Rodar num terminal A PARTE (nao no mesmo do worker.py):
    cd melhores-promo-painel/sync
    pip install -r requirements.txt
    copy .env.example .env   &  preencha o .env
    python sync_agent.py

Parar:  Ctrl+C   (o bot nao percebe)
=============================================================================
"""
from __future__ import annotations

import hashlib
import json
import os
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    sys.exit("[sync] falta 'firebase-admin'. Rode: pip install -r requirements.txt")

try:  # filtro moderno; cai no .where posicional se a versao for antiga
    from google.cloud.firestore_v1 import FieldFilter
    _HAS_FIELD_FILTER = True
except Exception:  # pragma: no cover
    _HAS_FIELD_FILTER = False

# --------------------------------------------------------------------------- config
def _need(name: str) -> str:
    v = os.getenv(name)
    if not v:
        sys.exit(f"[sync] falta a variavel {name} no .env (veja .env.example)")
    return v.strip()

SA_KEY_PATH  = Path(_need("FIREBASE_SA_KEY")).expanduser()
BOT_DATA_DIR = Path(_need("BOT_DATA_DIR")).expanduser()
BOT_SESSION  = os.getenv("BOT_SESSION_FILE", "").strip()
BOT_SESSION_PATH = Path(BOT_SESSION).expanduser() if BOT_SESSION else None
INTERVAL     = float(os.getenv("SYNC_INTERVAL_SECONDS", "2"))
STATUS_EVERY = float(os.getenv("STATUS_RECOUNT_SECONDS", "15"))
COMMAND_POLL = float(os.getenv("COMMAND_POLL_SECONDS", "10"))
WORKER_SILENCE_MIN = float(os.getenv("WORKER_SILENCE_MINUTES", "12"))
LOCAL_TZ = timezone(timedelta(hours=-3))  # Brasilia - so para derivar "hoje"

OFFERS_FILE = BOT_DATA_DIR / "detected_offers.jsonl"
PUBS_FILE   = BOT_DATA_DIR / "publications.jsonl"
QUEUE_FILE  = BOT_DATA_DIR / "publish_queue.json"
SOURCES_CONFIG = BOT_DATA_DIR.parent / "config" / "sources.json"
# UNICA escrita deste agente dentro da pasta do bot. O worker so LE este
# arquivo (services/control_state.py) e e fail-open -> nunca ve algo pela
# metade (gravacao atomica via os.replace). Nada mais do bot e tocado.
CONTROL_FILE = BOT_DATA_DIR / "control.json"
STATE_FILE  = Path(__file__).with_name(".sync_state.json")

BATCH_MAX = 450  # limite do Firestore e 500 ops/batch; folga de seguranca

if not SA_KEY_PATH.exists():
    sys.exit(f"[sync] service account nao encontrado: {SA_KEY_PATH}")

firebase_admin.initialize_app(credentials.Certificate(str(SA_KEY_PATH)))
db = firestore.client()

_running = True
def _stop(*_a):
    global _running
    _running = False
signal.signal(signal.SIGINT, _stop)
signal.signal(signal.SIGTERM, _stop)


# --------------------------------------------------------------------------- helpers
def sha1(*parts) -> str:
    return hashlib.sha1("|".join("" if p is None else str(p) for p in parts).encode("utf-8")).hexdigest()

def headline(msg: str | None) -> str | None:
    if not msg:
        return None
    for line in msg.splitlines():
        line = line.strip()
        if line:
            return line[:180]
    return None

def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"offers_pos": 0, "pubs_pos": 0}

def save_state(st: dict) -> None:
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st), encoding="utf-8")
    tmp.replace(STATE_FILE)

def read_new_lines(path: Path, pos: int):
    """Le tudo depois de `pos` bytes. Devolve (lista_de_dicts, novo_pos).

    So avanca `pos` ate o ultimo '\\n' completo - se o bot estiver no meio de
    um append, a linha parcial no fim fica para o proximo ciclo. Nunca trava
    o arquivo do bot.
    """
    if not path.exists():
        return [], pos
    size = path.stat().st_size
    if size < pos:            # arquivo encolheu (rotacao/reset) -> recomeca
        pos = 0
    if size == pos:
        return [], pos
    with open(path, "rb") as fh:
        fh.seek(pos)
        raw = fh.read()
    last_nl = raw.rfind(b"\n")
    if last_nl == -1:
        return [], pos
    new_pos = pos + last_nl + 1
    out = []
    for line in raw[: last_nl + 1].split(b"\n"):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line.decode("utf-8")))
        except Exception:
            pass              # linha corrompida/parcial - ignora, nao para o sync
    return out, new_pos

def read_json_file(path: Path):
    for _ in range(3):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            time.sleep(0.1)
    return None

def batch_set(collection: str, rows: list[dict], merge: bool = True) -> None:
    """Upsert de `rows` (cada um com 'id') numa colecao, em lotes."""
    for i in range(0, len(rows), BATCH_MAX):
        wb = db.batch()
        for row in rows[i : i + BATCH_MAX]:
            doc_id = row["id"]
            wb.set(db.collection(collection).document(doc_id), row, merge=merge)
        wb.commit()

def replace_queue(rows: list[dict]) -> None:
    """queue_items reflete a fila ATUAL: grava a fila e apaga o que saiu."""
    keep = {r["id"] for r in rows}
    existing = {d.id for d in db.collection("queue_items").stream()}
    wb = db.batch()
    ops = 0
    for row in rows:
        wb.set(db.collection("queue_items").document(row["id"]), row)
        ops += 1
    for stale in existing - keep:
        wb.delete(db.collection("queue_items").document(stale))
        ops += 1
    if ops:
        wb.commit()

def write_status(fields: dict) -> None:
    fields = {**fields, "synced_at": datetime.now(timezone.utc).isoformat()}
    db.collection("status").document("singleton").set(fields, merge=True)


# --------------------------------------------------------------------------- controle (pausa)
# Fluxo: painel cria docs em `commands` (status="pending") -> este agente
# aplica em `data/control.json` (que o worker le) e marca "applied" ->
# espelha o estado em `control/state` para o painel refletir a verdade.
_EMPTY_CONTROL = {"paused_all": False, "paused_chat_ids": [], "updated_at": None}


def read_control_file() -> dict:
    """Le data/control.json (se ja existir de uma execucao anterior)."""
    try:
        data = json.loads(CONTROL_FILE.read_text(encoding="utf-8"))
        return {
            "paused_all": bool(data.get("paused_all", False)),
            "paused_chat_ids": [str(x) for x in (data.get("paused_chat_ids") or [])],
            "updated_at": data.get("updated_at"),
        }
    except Exception:
        return dict(_EMPTY_CONTROL)


def write_control_file(state: dict) -> None:
    """Grava data/control.json de forma ATOMICA (tmp + os.replace).

    Esta e a unica coisa que este agente escreve dentro da pasta do bot.
    O arquivo so e LIDO pelo worker (fail-open), nunca travado.
    """
    payload = {
        "paused_all": bool(state.get("paused_all", False)),
        "paused_chat_ids": [str(x) for x in state.get("paused_chat_ids", [])],
        "updated_at": state.get("updated_at") or datetime.now(timezone.utc).isoformat(),
    }
    CONTROL_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONTROL_FILE.with_name(CONTROL_FILE.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CONTROL_FILE)


def mirror_control(state: dict) -> None:
    db.collection("control").document("state").set(
        {
            "paused_all": bool(state.get("paused_all", False)),
            "paused_chat_ids": [str(x) for x in state.get("paused_chat_ids", [])],
            "updated_at": state.get("updated_at"),
            "mirrored_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def _pending_commands():
    col = db.collection("commands")
    q = col.where(filter=FieldFilter("status", "==", "pending")) if _HAS_FIELD_FILTER \
        else col.where("status", "==", "pending")
    return list(q.limit(50).stream())


def process_commands(state: dict) -> dict:
    """Aplica os comandos pendentes do painel. Nunca levanta excecao para
    fora (o loop principal ja tem backoff, mas comando e best-effort)."""
    try:
        snaps = _pending_commands()
    except Exception as exc:
        print(f"[sync] leitura de commands falhou ({type(exc).__name__}: {exc}) - tento no proximo ciclo")
        return state
    if not snaps:
        return state

    items = []
    for s in snaps:
        d = s.to_dict() or {}
        items.append((s, d))
    items.sort(key=lambda it: str(it[1].get("created_at") or ""))

    changed = False
    for snap, c in items:
        t = c.get("type")
        src = str(c.get("source")).strip() if c.get("source") is not None else None
        if t == "pause_all":
            changed |= not state["paused_all"]
            state["paused_all"] = True
        elif t == "resume_all":
            changed |= state["paused_all"]
            state["paused_all"] = False
        elif t == "pause_source" and src:
            if src not in state["paused_chat_ids"]:
                state["paused_chat_ids"].append(src)
                changed = True
        elif t == "resume_source" and src:
            if src in state["paused_chat_ids"]:
                state["paused_chat_ids"].remove(src)
                changed = True
        else:
            print(f"[sync] comando ignorado (tipo/origem invalidos): type={t!r} source={src!r}")
        try:
            snap.reference.update(
                {"status": "applied", "applied_at": datetime.now(timezone.utc).isoformat()}
            )
        except Exception as exc:
            print(f"[sync] nao consegui marcar comando {snap.id} como applied: {exc}")

    if changed:
        state["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            write_control_file(state)
        except Exception as exc:
            print(f"[sync] FALHA ao gravar control.json ({exc}) - o bot segue no estado anterior")
        mirror_control(state)
        print(
            f"[sync] controle atualizado -> pausa_global={state['paused_all']} "
            f"grupos_pausados={state['paused_chat_ids'] or '-'}"
        )
    return state


# --------------------------------------------------------------------------- mapeadores
def offer_row(o: dict) -> dict:
    return {
        "id": sha1(o.get("platform"), o.get("product_id"), o.get("detected_at"), o.get("source_message_id")),
        "platform": o.get("platform"),
        "product_id": o.get("product_id"),
        "source_chat_id": o.get("source_chat_id"),
        "source_name": str(o.get("source")) if o.get("source") is not None else None,
        "original_url": o.get("original_url"),
        "affiliate_url": o.get("affiliate_url"),
        "has_photo": bool(o.get("telegram_image_path")),
        "headline": headline(o.get("original_message")),
        "original_message": o.get("original_message"),
        "detected_at": o.get("detected_at"),   # ISO string; ordena lexicograficamente
    }

def pub_row(p: dict) -> dict:
    return {
        "id": sha1(p.get("platform"), p.get("product_id"), p.get("destination"), p.get("published_at")),
        "platform": p.get("platform"),
        "product_id": p.get("product_id"),
        "destination": p.get("destination"),
        "destination_id": p.get("destination_id"),
        "status": p.get("status"),
        "error_message": p.get("error_message"),
        "headline": headline(p.get("message")),
        "published_at": p.get("published_at"),
    }

def queue_row(item: dict, position: int) -> dict:
    res = item.get("result", {})
    return {
        "id": sha1(res.get("platform"), res.get("product_id")),
        "position": position,
        "platform": res.get("platform"),
        "product_id": res.get("product_id"),
        "original_url": res.get("original_url"),
        "affiliate_url": res.get("affiliate_url"),
        "headline": headline(item.get("message")),
        "has_photo": bool(res.get("telegram_image_path")),
    }


# --------------------------------------------------------------------------- status derivado
def _mtime(path: Path | None):
    if path is None:
        return None
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    except Exception:
        return None

def _iter_jsonl(path: Path):
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue

def _config_source_list() -> list[str]:
    try:
        data = json.loads(SOURCES_CONFIG.read_text(encoding="utf-8"))
        return [e.get("name") for e in data if isinstance(e, dict)]
    except Exception:
        return []

def compute_status() -> dict:
    now = datetime.now(timezone.utc)
    today_local = datetime.now(LOCAL_TZ).date()

    seen = [m for m in (_mtime(OFFERS_FILE), _mtime(PUBS_FILE), _mtime(QUEUE_FILE), _mtime(BOT_SESSION_PATH)) if m]
    worker_last = max(seen) if seen else None
    worker_state = "ok" if (worker_last and (now - worker_last) < timedelta(minutes=WORKER_SILENCE_MIN)) else "sem_sinal"

    last_capture = None
    captured_today = 0
    per_group: dict = {}
    for o in _iter_jsonl(OFFERS_FILE):
        ts = o.get("detected_at")
        if ts:
            if last_capture is None or ts > last_capture:
                last_capture = ts
            try:
                if datetime.fromisoformat(ts).astimezone(LOCAL_TZ).date() == today_local:
                    captured_today += 1
            except Exception:
                pass
        cid = o.get("source_chat_id")
        if cid is not None:
            g = per_group.setdefault(cid, {"n": 0, "last": None})
            g["n"] += 1
            if ts and (g["last"] is None or ts > g["last"]):
                g["last"] = ts

    last_publish = None
    published_today = 0
    errors_7d = 0
    last_by_dest: dict = {}
    for p in _iter_jsonl(PUBS_FILE):
        ts = p.get("published_at")
        stt = p.get("status")
        dest = p.get("destination")
        if ts and dest:
            prev = last_by_dest.get(dest)
            if prev is None or ts > prev["ts"]:
                last_by_dest[dest] = {"ts": ts, "status": stt}
        if stt == "success" and ts:
            if last_publish is None or ts > last_publish:
                last_publish = ts
            try:
                if datetime.fromisoformat(ts).astimezone(LOCAL_TZ).date() == today_local:
                    published_today += 1
            except Exception:
                pass
        if stt == "error" and ts:
            try:
                if (now - datetime.fromisoformat(ts)) < timedelta(days=7):
                    errors_7d += 1
            except Exception:
                pass

    def dest_state(dest: str) -> str:
        d = last_by_dest.get(dest)
        if not d:
            return "sem_dados"
        return "atencao" if d["status"] == "error" else "ok"

    q = read_json_file(QUEUE_FILE)
    qsize = len(q) if isinstance(q, list) else 0

    cfg_list = _config_source_list()
    grp_rows = []
    for i, (cid, g) in enumerate(sorted(per_group.items(), key=lambda kv: -kv[1]["n"])):
        grp_rows.append({
            "id": str(cid),
            "chat_id": cid,
            "config_name": cfg_list[i] if i < len(cfg_list) else None,
            "active": True,
            "captured_total": g["n"],
            "last_capture_at": g["last"],
        })
    if grp_rows:
        try:
            batch_set("source_groups", grp_rows)
        except Exception as exc:
            print(f"[sync] source_groups: {exc}")

    return {
        "worker_last_seen": worker_last.isoformat() if worker_last else None,
        "worker_state": worker_state,
        "last_capture_at": last_capture,
        "last_publish_at": last_publish,
        "telegram_state": dest_state("telegram"),
        "whatsapp_state": dest_state("whatsapp"),
        "ml_state": "desconhecido",   # sinal fino exige heartbeat no bot (fase futura, com aprovacao)
        "captured_today": captured_today,
        "published_today": published_today,
        "queue_size": qsize,
        "errors_7d": errors_7d,
    }


# --------------------------------------------------------------------------- loop
def main() -> None:
    print(f"[sync] Firestore: projeto {db.project}")
    print(f"[sync] lendo (somente leitura): {OFFERS_FILE.name}, {PUBS_FILE.name}, {QUEUE_FILE.name}")
    print(f"[sync] intervalo: {INTERVAL}s  |  Ctrl+C para parar (o bot continua)")

    st = load_state()
    first_run = not STATE_FILE.exists()
    if first_run:
        print("[sync] primeira execucao - carga inicial (backfill) de todo o historico...")

    control = read_control_file()
    try:
        mirror_control(control)
    except Exception as exc:
        print(f"[sync] mirror_control inicial falhou ({exc}) - segue mesmo assim")
    print(
        f"[sync] controle: pausa_global={control['paused_all']} "
        f"grupos_pausados={control['paused_chat_ids'] or '-'}  (comandos a cada {COMMAND_POLL:.0f}s)"
    )

    last_status = 0.0
    last_cmd = 0.0
    backoff = INTERVAL

    while _running:
        cycle_start = time.monotonic()
        try:
            if time.monotonic() - last_cmd >= COMMAND_POLL:
                control = process_commands(control)
                last_cmd = time.monotonic()

            new_offers, st["offers_pos"] = read_new_lines(OFFERS_FILE, st.get("offers_pos", 0))
            if new_offers:
                batch_set("offers", [offer_row(o) for o in new_offers])

            new_pubs, st["pubs_pos"] = read_new_lines(PUBS_FILE, st.get("pubs_pos", 0))
            if new_pubs:
                batch_set("publications", [pub_row(p) for p in new_pubs])

            q = read_json_file(QUEUE_FILE)
            if isinstance(q, list):
                replace_queue([queue_row(it, i) for i, it in enumerate(q)])

            if time.monotonic() - last_status >= STATUS_EVERY or new_offers or new_pubs:
                write_status(compute_status())
                last_status = time.monotonic()

            save_state(st)
            if new_offers or new_pubs:
                print(f"[sync] +{len(new_offers)} ofertas, +{len(new_pubs)} publicacoes")
            if first_run:
                print("[sync] carga inicial concluida.")
                first_run = False
            backoff = INTERVAL

        except Exception as exc:
            print(f"[sync] erro no ciclo ({type(exc).__name__}: {exc}) - tento de novo em {backoff:.0f}s (o bot nao e afetado)")
            backoff = min(max(backoff * 2, INTERVAL), 60)

        elapsed = time.monotonic() - cycle_start
        time.sleep(max(0.2, backoff - elapsed))

    print("[sync] encerrado. O bot continua rodando normalmente.")


if __name__ == "__main__":
    main()
