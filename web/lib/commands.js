"use client";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useDoc } from "@/lib/useFirestore";

// Estado de controle (pausa) espelhado pelo sync_agent a partir do
// data/control.json que o worker lê. `control/state`:
//   { paused_all: bool, paused_chat_ids: string[], updated_at, mirrored_at }
export function useControl() {
  return useDoc(() => doc(db, "control", "state"), []);
}

// Cria um comando "pending" na coleção `commands`. O sync_agent aplica em
// ~10 s (grava o control.json e marca o comando como "applied").
// `type`: "pause_all" | "resume_all" | "pause_source" | "resume_source"
// `source`: chat_id do grupo (obrigatório para *_source)
export async function sendCommand(type, source = null) {
  const u = auth.currentUser;
  return addDoc(collection(db, "commands"), {
    type,
    source: source == null ? null : String(source),
    status: "pending",
    created_at: serverTimestamp(),
    created_by: u?.email || u?.uid || "painel",
  });
}
