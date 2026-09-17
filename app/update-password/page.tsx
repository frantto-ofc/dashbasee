"use client";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import Image from "next/image";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.assign("/");
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page single-panel">
      <section className="auth-card update-password-card">
        <Image
          className="auth-logo"
          src="/logo-dashupboard.svg"
          alt="Dash Upboard"
          width={1400}
          height={531}
          priority
        />
        <div className="auth-heading">
          <span className="auth-kicker">Segurança da conta</span>
          <h1>Crie uma nova senha</h1>
          <p>Use pelo menos 10 caracteres e não reutilize senhas antigas.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Nova senha</span>
            <div className="auth-input">
              <LockKeyhole size={17} />
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </div>
          </label>
          <label>
            <span>Confirmar senha</span>
            <div className="auth-input">
              <LockKeyhole size={17} />
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </div>
          </label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading || !isSupabaseConfigured()}>
            {loading ? "Salvando…" : "Salvar nova senha"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </section>
    </main>
  );
}
