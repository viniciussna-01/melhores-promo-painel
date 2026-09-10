"use client";
import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

// Assina uma query do Firestore (coleção) e devolve a lista ao vivo.
// `make` cria a query; `deps` controla quando recriar a assinatura.
export function useCollection(make, deps = []) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = make();
    if (!q) return;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}

// Assina um documento único.
export function useDoc(make, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = make();
    if (!ref) return;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setError(null);
      },
      (err) => setError(err)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}
