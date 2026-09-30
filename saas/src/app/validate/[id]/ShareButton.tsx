'use client';
import { useState, useTransition } from 'react';
import { shareValidation } from '@/app/actions';

export function ShareButton({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (url)
    return (
      <input className="field" style={{ width: 280 }} readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
    );
  return (
    <button className="btn sm" disabled={pending} onClick={() => start(async () => {
      const u = await shareValidation(id);
      setUrl(u);
      if (u) navigator.clipboard?.writeText(u).catch(() => {});
    })}>
      {pending ? '…' : 'Share report'}
    </button>
  );
}
