"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch {
      setErr("E-mail ou senha incorretos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="mark">MP</div>
      <h1>Painel Melhores Promo</h1>
      <p>Entre com o e-mail cadastrado no Firebase.</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="voce@email.com"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="senha"
          autoComplete="current-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        {err && <div className="err">{err}</div>}
        <button type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
