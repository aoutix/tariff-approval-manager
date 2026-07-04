import { useState } from "react";
import Modal from "./Modal";
import ErrorBanner from "./ErrorBanner";

const SIZES = ["20ft", "40ft", "45ft"];
const MOVE_TYPES = ["import", "export", "transshipment", "Any"];
const CURRENCIES = ["EUR", "USD"];

export default function TariffFormModal({ contract, initial, onSubmit, onClose }) {
  const [size, setSize] = useState(initial?.size || SIZES[0]);
  const [moveType, setMoveType] = useState(initial?.move_type || MOVE_TYPES[0]);
  const [currency, setCurrency] = useState(initial?.currency || CURRENCIES[0]);
  const [price, setPrice] = useState(initial?.price ?? "");
  const [validFrom, setValidFrom] = useState(initial?.valid_from || contract.valid_from);
  const [validUntil, setValidUntil] = useState(initial?.valid_until || contract.valid_until);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        contract_id: contract.id,
        size,
        move_type: moveType,
        currency,
        price: String(price),
        valid_from: validFrom,
        valid_until: validUntil,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit tariff row" : "New tariff row"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <p className="text-xs text-[var(--ink-faint)] font-mono">
          Contract: {contract.name} · {contract.valid_from} → {contract.valid_until}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Container size
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Move type
            </label>
            <select
              value={moveType}
              onChange={(e) => setMoveType(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
            >
              {MOVE_TYPES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {moveType === "Any" && (
              <p className="text-[0.68rem] text-[var(--ink-faint)] mt-1">
                Wildcard: covers every move type, so it conflicts with any
                overlapping approved row of this size regardless of its move type.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Price
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--ink-faint)] font-mono mb-1.5">
              Valid from
            </label>
            <input
              required
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              min={contract.valid_from}
              max={contract.valid_until}
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
              min={contract.valid_from}
              max={contract.valid_until}
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
            {saving ? "Saving…" : initial ? "Save & resubmit" : "Save as draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
