'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Lock, Mail, ShieldCheck, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const rawReturnUrl = searchParams.get('returnUrl') || '/admin';
  const returnUrl = (rawReturnUrl && rawReturnUrl.startsWith('/') && !rawReturnUrl.startsWith('//')) ? rawReturnUrl : '/admin';

  useEffect(() => {
    fetch('/api/admin/session')
      .then(res => {
        if (res.ok) router.replace(returnUrl as any);
        else setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, [router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Read the submitted controls as the source of truth. The login page
    // performs an async session check before rendering the form, and a
    // browser autofill or an automation client can update the controls
    // during that transition before React's controlled state has committed.
    // Using FormData prevents a valid visible form from submitting an empty
    // JSON payload.
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const submittedEmail = String(formData.get('email') ?? email).trim();
    const submittedPassword = String(formData.get('password') ?? password);

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: submittedEmail, password: submittedPassword })
    });

    setIsLoading(false);

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || 'Invalid login credentials.');
      toast({ title: 'Login failed', description: payload.error || 'Incorrect email or password.', variant: 'destructive' });
    } else {
      toast({ title: 'Login successful', description: 'Welcome back to Kruthika Studio.' });
      window.location.assign(returnUrl);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0a18] p-4 sm:p-6">
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-violet-600/25 blur-[110px]" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-500/20 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
            <BookOpen className="h-6 w-6 text-white" />
          </span>
          <h1 className="text-lg font-bold tracking-tight text-white">Kruthika Studio</h1>
          <p className="mt-1 text-xs font-medium text-violet-200/60">Admin &amp; Publishing Console</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign in</h2>
            <p className="mt-1 text-sm text-slate-400">Enter your admin credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-slate-300">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kruthika.fun"
                  required
                  disabled={isLoading}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-violet-400 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-violet-400 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              suppressHydrationWarning
              aria-label={isLoading ? 'Logging in' : 'Login'}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-violet-400" />
            <span>Secured with HMAC-SHA256 · Sessions expire after 8 hours · Hostinger-backed authentication</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Kruthika Publishing Engine · Internal use only
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
