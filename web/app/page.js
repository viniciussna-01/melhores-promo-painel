"use client";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCollection, useDoc } from "@/lib/useFirestore";
import { ago } from "@/lib/format";
import Login from "@/components/Login";
import { IconStatus, IconGrupos, IconFila, IconHistorico, IconDiag } from "@/components/icons";
import { StatusView, GruposView, FilaView, HistoricoView, DiagView } from "@/components/views";
import OfferDrawer from "@/components/OfferDrawer";

const TABS = [
  ["status", "Status", IconStatus],
  ["grupos", "Grupos", IconGrupos],
  ["fila", "Fila", IconFila],
  ["hist", "Histórico", IconHistorico],
  ["diag", "Diag", IconDiag],
];

export default function Page() {
  const [user, setUser] = useState(undefined); // undefined = carregando
  const [tab, setTab] = useState("status");
  const [sel, setSel] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  if (user === undefined) return <div className="center">Carregando…</div>;
  if (!user) return <Login />;
  return <Panel tab={tab} setTab={setTab} sel={sel} setSel={setSel} />;
}

function Panel({ tab, setTab, sel, setSel }) {
  const { data: status } = useDoc(() => doc(db, "status", "singleton"), []);
  const { data: offers } = useCollection(
    () => query(collection(db, "offers"), orderBy("detected_at", "desc"), limit(60)), []
  );
  const { data: publications } = useCollection(
    () => query(collection(db, "publications"), orderBy("published_at", "desc"), limit(90)), []
  );
  const { data: queue } = useCollection(
    () => query(collection(db, "queue_items"), orderBy("position", "asc")), []
  );
  const { data: groups } = useCollection(
    () => query(collection(db, "source_groups"), orderBy("captured_total", "desc")), []
  );

  const fresh = useMemo(() => {
    if (!status?.synced_at) return false;
    return Date.now() - new Date(status.synced_at).getTime() < 90_000;
  }, [status]);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  return (
    <div className="app">
      <header className="top">
        <div className="mark">MP</div>
        <div>
          <h1>Melhores Promo</h1>
          <div className="sub">Painel · somente leitura</div>
        </div>
        <span className={"live" + (fresh ? "" : " stale")}>
          <span className="b" />
          {fresh ? "ao vivo" : status?.synced_at ? ago(status.synced_at) : "sem sync"}
        </span>
        <button className="logout" onClick={() => signOut(auth)}>sair</button>
      </header>

      <main>
        {tab === "status" && <StatusView status={status} offers={offers} publications={publications} queue={queue} />}
        {tab === "grupos" && <GruposView groups={groups} />}
        {tab === "fila" && <FilaView queue={queue} onOpen={setSel} />}
        {tab === "hist" && <HistoricoView publications={publications} onOpen={setSel} />}
        {tab === "diag" && <DiagView status={status} publications={publications} />}
      </main>

      <nav className="tabbar" role="tablist" aria-label="Seções">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            <span className="ind" />
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {sel && (
        <OfferDrawer sel={sel} offers={offers} publications={publications} onClose={() => setSel(null)} />
      )}
    </div>
  );
}
