'use client';
import { useActionState } from 'react';

type State = { ok: boolean; message: string } | null;

/** Form bound to a server action returning {ok, message}; shows the result inline. */
export function ActionForm({ action, children, className, submitLabel = 'Save', confirm }: {
  action: (prev: State, form: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className ?? 'stack'}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      <div className="row">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</button>
        {state && <span className={`small ${state.ok ? 'good-text' : 'bad-text'}`} role="status">{state.message}</span>}
      </div>
    </form>
  );
}
