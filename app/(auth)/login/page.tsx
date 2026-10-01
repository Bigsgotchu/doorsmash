"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, signup } from "@/lib/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [loginState, loginAction, loginPending] = useActionState(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState(signup, undefined);

  useEffect(() => {
    if (loginState?.success) {
      router.push("/");
    }
  }, [loginState?.success, router]);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-symbol" aria-hidden="true">d</span>
          <span>door<span>smash</span></span>
        </div>
        <h1>Meet someone. Make a plan.</h1>

          <div className="auth-tabs">
            <button
              type="button"
              className="tab active"
            >
              Log in
            </button>
            <button
              type="button"
              className="tab"
              tabIndex={-1}
            >
              Sign up
            </button>
          </div>

        <p className="auth-sub">Enter your email and password to continue.</p>

        {loginState?.message && (
          <p className="auth-error">{loginState.message}</p>
        )}

        <form action={loginAction}>
          <div className="field-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>
          <button type="submit" disabled={loginPending} className="auth-submit">
            {loginPending ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form action={signupAction} className="signup-form">
          {signupState?.errors?.email && (
            <p className="field-error">{signupState.errors.email.join(", ")}</p>
          )}
          {signupState?.errors?.password && (
            <p className="field-error">{signupState.errors.password.join(", ")}</p>
          )}
          {signupState?.message && (
            <p className="auth-success">{signupState.message}</p>
          )}

          <div className="field-group">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field-group">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
              minLength={8}
            />
            <p className="hint">8+ characters with a number and symbol.</p>
          </div>
          <button type="submit" disabled={signupPending} className="auth-submit">
            {signupPending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          <br />
          <Link href="/login" className="auth-link">
            Have a sign-in link? Use email magic link.
          </Link>
        </p>
      </div>
    </main>
  );
}
