export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 bg-[var(--danger-dim)] border border-[var(--danger)]/40 text-[var(--danger)] text-sm rounded-lg px-4 py-3 mb-4">
      <span className="leading-snug">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-[var(--danger)]/70 hover:text-[var(--danger)] shrink-0">
          ×
        </button>
      )}
    </div>
  );
}
