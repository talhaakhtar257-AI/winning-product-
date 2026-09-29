import Link from 'next/link';

export function Upgrade({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="lock-overlay">
      <div>
        <h3>🔒 {title}</h3>
        {children && <p className="muted">{children}</p>}
        <Link className="btn accent" href="/pricing">
          See plans
        </Link>
      </div>
    </div>
  );
}
