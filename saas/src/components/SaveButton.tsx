'use client';
import { useState, useTransition } from 'react';
import { toggleSaved } from '@/app/actions';

export function SaveButton({ productId, initiallySaved }: { productId: string; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <span className="row">
      <button
        className={`btn sm${saved ? ' primary' : ''}`}
        aria-pressed={saved}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleSaved(productId);
            if (r?.ok) setSaved(!saved);
            setMsg(r?.ok ? '' : r?.message ?? '');
          })
        }
      >
        {saved ? '★ Saved' : '☆ Save'}
      </button>
      {msg && <span className="small bad-text" role="alert">{msg}</span>}
    </span>
  );
}
