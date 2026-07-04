import { useState } from "react";
import Modal from "./Modal";
import ErrorBanner from "./ErrorBanner";

export default function RejectModal({ onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(reason.trim() || null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Reject tariff row" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Price below floor rate for this lane"
            className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-[var(--border)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-[var(--danger)] text-[#2a0410] font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Rejecting…" : "Reject row"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
