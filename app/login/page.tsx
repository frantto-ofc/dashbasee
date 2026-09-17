"use client";

import Image from "next/image";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { safeNextPath } from "@/lib/supabase/redirect";

type AuthMode = "signin" | "signup" | "reset";

const authErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Este e-mail já possui uma conta.";
  }
  if (normalized.includes("password")) {
    return "Use uma senha com pelo menos 10 caracteres.";
  }
  return "Não foi possível concluir. Tente novamente.";
};

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = loading || googleLoading;
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const configured = isSupabaseConfigured();
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window === "undefined" ? "" : window.location.origin);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) {
      // Read callback errors after hydration; the URL is browser-owned state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsError(true);
      setMessage(
        callbackError === "google_cancelled"
          ? "A entrada com Google foi cancelada. Você pode tentar novamente."
          : callbackError === "google"
            ? "Não foi possível entrar com Google. Tente novamente."
            : "O link expirou ou é inválido. Solicite um novo link de confirmação ou recuperação.",
      );
    }
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
  };

  const handleGoogleSignIn = async () => {
    if (!configured || busy) return;
    setGoogleLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const callback = new URL("/auth/callback", siteOrigin);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      callback.searchParams.set("next", safeNextPath(requestedPath));
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: { prompt: "select_account" },
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) throw error || new Error("Missing OAuth URL");
      window.location.assign(data.url);
    } catch {
      setIsError(true);
      setMessage("Não foi possível iniciar a entrada com Google. Tente novamente ou use e-mail e senha.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || busy) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const supabase = createClient();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteOrigin}/auth/confirm?next=/update-password`,
        });
        if (error) throw error;
        setMessage(
          "Se o e-mail estiver cadastrado, você receberá o link para criar uma nova senha.",
        );
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteOrigin}/auth/confirm`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Conta criada. Confirme seu e-mail para entrar.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      const requestedPath = new URLSearchParams(window.location.search).get(
        "next",
      );
      window.location.assign(
        safeNextPath(requestedPath),
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        authErrorMessage(error instanceof Error ? error.message : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-rail" aria-label="Proteção de dados">
        <div className="auth-rail-mark">DU</div>
        <div className="auth-rail-copy">
          <span>Workspace privado</span>
          <strong>Seu fluxo.<br />Seus dados.</strong>
        </div>
        <div className="auth-security-note">
          <ShieldCheck size={19} />
          <span>Acesso com Google ou e-mail.</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <Image
            className="auth-logo"
            src="/logo-dashupboard.svg"
            alt="Dash Upboard"
            width={1400}
            height={531}
            priority
          />

          <div className="auth-heading">
            <span className="auth-kicker">
              {mode === "signin"
                ? "Acesso ao workspace"
                : mode === "signup"
                  ? "Nova conta"
                  : "Recuperar acesso"}
            </span>
            <h1>
              {mode === "signin"
                ? "Entre no seu painel"
                : mode === "signup"
                  ? "Crie seu workspace"
                  : "Redefina sua senha"}
            </h1>
            <p>
              {mode === "reset"
                ? "Informe seu e-mail para receber o link de recuperação."
                : "Projetos, CRM, tarefas e finanças ficam separados por conta neste navegador."}
            </p>
          </div>

          {mode !== "reset" && (
            <div className="auth-social">
              <button
                type="button"
                className="auth-google"
                onClick={handleGoogleSignIn}
                disabled={busy || !configured}
                aria-busy={googleLoading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
                  <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
                </svg>
                {googleLoading ? "Abrindo Google…" : "Entrar com Google"}
              </button>
              <div className="auth-divider"><span>ou continue com e-mail</span></div>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>E-mail</span>
              <div className="auth-input">
                <Mail size={17} aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  placeholder="voce@empresa.com"
                />
              </div>
            </label>

            {mode !== "reset" && (
              <label>
                <span>Senha</span>
                <div className="auth-input">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    minLength={mode === "signup" ? 10 : undefined}
                    required
                    placeholder={mode === "signup" ? "Mínimo de 10 caracteres" : "Sua senha"}
                  />
                </div>
              </label>
            )}

            {message && (
              <p
                className={`auth-message ${isError ? "error" : "success"}`}
                role={isError ? "alert" : "status"}
              >
                {message}
              </p>
            )}

            {!configured && (
              <p className="auth-message error" role="alert">
                O banco ainda não foi configurado neste ambiente.
              </p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={busy || !configured}
            >
              {loading
                ? "Aguarde…"
                : mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-links">
            {mode === "signin" && (
              <button type="button" disabled={busy} onClick={() => changeMode("reset")}>
                Esqueci minha senha
              </button>
            )}
            <button
              disabled={busy}
              type="button"
              onClick={() =>
                changeMode(mode === "signup" ? "signin" : "signup")
              }
            >
              {mode === "signup" ? "Já tenho uma conta" : "Criar uma conta"}
            </button>
            {mode === "reset" && (
              <button type="button" disabled={busy} onClick={() => changeMode("signin")}>
                Voltar para o login
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
