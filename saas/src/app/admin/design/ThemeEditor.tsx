'use client';
import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { saveSettings } from '../actions';

type Theme = { brand: string; accent: string; good: string; bad: string; radius: number };
const LABELS: [keyof Theme, string][] = [['brand', 'Brand / hero'], ['accent', 'Accent (buttons, highlights)'], ['good', 'Positive'], ['bad', 'Negative']];

export function ThemeEditor({ initial, brandName }: { initial: Theme; brandName: string }) {
  const [t, setT] = useState(initial);
  const preview = { '--brand': t.brand, '--hero': t.brand, '--accent': t.accent, '--good': t.good, '--bad': t.bad, '--r': `${t.radius}px` } as React.CSSProperties;
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <ActionForm action={saveSettings} submitLabel="Publish theme">
        <input type="hidden" name="__key" value="theme" />
        {LABELS.map(([k, label]) => (
          <div key={k} className="row">
            <input className="swatch" type="color" value={String(t[k])} onChange={(e) => setT({ ...t, [k]: e.target.value.toUpperCase() })} aria-label={`${label} picker`} />
            <div style={{ flex: 1 }}>
              <label className="lbl" htmlFor={`t-${k}`}>{label}</label>
              <input className="field" id={`t-${k}`} name={k} value={String(t[k])} pattern="#[0-9A-Fa-f]{6}" onChange={(e) => setT({ ...t, [k]: e.target.value })} />
            </div>
          </div>
        ))}
        <div>
          <label className="lbl" htmlFor="t-radius">Corner roundness: {t.radius}px</label>
          <input id="t-radius" name="radius" type="range" min={0} max={24} value={t.radius} onChange={(e) => setT({ ...t, radius: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </ActionForm>
      <div style={preview} className="stack" aria-label="Live preview">
        <div className="lbl">Live preview</div>
        <div className="hero" style={{ padding: 24 }}>
          <span className="badge gold">Preview</span>
          <h2 style={{ marginTop: 10 }}>{brandName}</h2>
          <p>This is how your hero section looks.</p>
          <span className="btn accent">Call to action</span>
        </div>
        <div className="card row between">
          <span className="score">92</span>
          <span className="badge good">Winner</span>
          <span className="good-text">+Rs 640 profit</span>
          <span className="bad-text">−12% margin</span>
          <span className="btn primary sm">Primary</span>
        </div>
      </div>
    </div>
  );
}
