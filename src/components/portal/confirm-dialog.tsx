import type { ReactNode } from 'react'

export function ConfirmDialog({ title, children, confirmLabel, busy = false, onCancel, onConfirm }: { title: string; children: ReactNode; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <h2 id="confirm-dialog-title">{title}</h2>
      <div className="confirm-copy">{children}</div>
      <div className="confirm-actions">
        <button type="button" className="private-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="private-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : confirmLabel}</button>
      </div>
    </section>
  </div>
}
