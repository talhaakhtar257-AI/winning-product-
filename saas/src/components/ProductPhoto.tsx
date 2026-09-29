'use client';
import { useState } from 'react';
import { photo } from '@/lib/format';

export function ProductPhoto({ src, alt = '', w = 480, h = 360, niche }: { src: string | null; alt?: string; w?: number; h?: number; niche: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="muted small">📦 {niche}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo(src, w, h)} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
