import { useState } from "react";
import Modal from "./Modal";
import ErrorBanner from "./ErrorBanner";

export default function ContractFormModal({ initial, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [validFrom, setValidFrom] = useState(initial?.valid_from || "");
  const [validUntil, setValidUntil] = useState(initial?.valid_until || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name, valid_from: validFrom, valid_until: validUntil });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit contract" : "New contract"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
            Contract / shipping line name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maersk Pacific Service"
            className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Valid from
            </label>
            <input
              required
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Valid until
            </label>
            <input
              required
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
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
            className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-[#1a0d06] font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Create contract"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
