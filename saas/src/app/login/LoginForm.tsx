'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm({ next, signupsOpen }: { next: string; signupsOpen: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: signupsOpen },
    });
    if (error) {
      setState('error');
      setMsg(error.message);
    } else setState('sent');
  }

  async function google() {
    await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  }

  if (state === 'sent')
    return <div className="alert good" role="status">Check your inbox — we sent a sign-in link to <strong>{email}</strong>.</div>;

  return (
    <div className="stack">
      <button className="btn" type="button" onClick={google} style={{ width: '100%' }}>
        Continue with Google
      </button>
      <form onSubmit={magic} className="stack">
        <div>
          <label className="lbl" htmlFor="email">Email</label>
          <input id="email" className="field" type="email" required autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={state === 'sending'} style={{ width: '100%' }}>
          {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        {state === 'error' && <div className="alert bad" role="alert">{msg}</div>}
      </form>
    </div>
  );
}
