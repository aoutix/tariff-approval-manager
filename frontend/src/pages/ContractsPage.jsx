import { useEffect, useState, useCallback } from "react";
import { useRole } from "../context/RoleContext";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";
import ContractFormModal from "../components/ContractFormModal";
import TariffFormModal from "../components/TariffFormModal";
import RejectModal from "../components/RejectModal";
import ErrorBanner from "../components/ErrorBanner";

function fmtMoney(price, currency) {
  const symbol = currency === "EUR" ? "€" : "$";
  return `${symbol}${Number(price).toFixed(2)}`;
}

export default function ContractsPage() {
  const { activeUser } = useRole();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const [showContractForm, setShowContractForm] = useState(false);
  const [editContract, setEditContract] = useState(null);
  const [tariffFormFor, setTariffFormFor] = useState(null); // { contract, tariff? }
  const [rejectingId, setRejectingId] = useState(null);

  const isCreator = activeUser?.role === "Tariff Creator";
  const isApprover = activeUser?.role === "Approver";
  const isViewer = activeUser?.role === "Viewer";

  const load = useCallback(async () => {
    if (!activeUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listContracts(activeUser.id);
      setContracts(data);
      setExpanded((prev) => {
        const next = { ...prev };
        data.forEach((c) => {
          if (!(c.id in next)) next[c.id] = true;
        });
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeUser]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const [rowError, setRowError] = useState(null);

  const act = async (fn) => {
    setRowError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setRowError(e.message);
    }
  };

  if (!activeUser) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Contracts &amp; Tariffs</h1>
          <p className="text-sm text-[var(--ink-dim)] mt-1">
            {isViewer
              ? "Approved tariffs across all shipping-line contracts."
              : "Manage contracts and their tariff rows through the approval workflow."}
          </p>
        </div>
        {isCreator && (
          <button
            onClick={() => setShowContractForm(true)}
            className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-[#1a0d06] font-semibold hover:brightness-110 shrink-0"
          >
            + New contract
          </button>
        )}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <ErrorBanner message={rowError} onDismiss={() => setRowError(null)} />

      {loading && <p className="text-[var(--ink-dim)] text-sm">Loading manifest…</p>}

      {!loading && contracts.length === 0 && (
        <div className="border border-dashed border-[var(--border)] rounded-xl p-10 text-center text-[var(--ink-dim)]">
          No contracts yet.
        </div>
      )}

      <div className="space-y-5">
        {contracts.map((contract) => (
          <div key={contract.id} className="border border-[var(--border)] rounded-xl bg-[var(--panel)] overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
              onClick={() => toggle(contract.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--ink-faint)] text-xs w-4">{expanded[contract.id] ? "▾" : "▸"}</span>
                <div>
                  <h2 className="font-display font-semibold text-base">{contract.name}</h2>
                  <p className="container-code">
                    VALID {contract.valid_from} → {contract.valid_until} · {contract.tariffs.length} row
                    {contract.tariffs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isCreator && (
                  <>
                    <button
                      onClick={() => setEditContract(contract)}
                      className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
                    >
                      Edit contract
                    </button>
                    <button
                      onClick={() => setTariffFormFor({ contract })}
                      className="px-3 py-1.5 text-xs rounded-md bg-[var(--teal-dim)] border border-[var(--teal)]/40 text-[var(--teal)] font-medium"
                    >
                      + Tariff row
                    </button>
                  </>
                )}
              </div>
            </div>

            {expanded[contract.id] && (
              <div className="border-t border-[var(--border)] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.65rem] uppercase tracking-wider text-[var(--ink-faint)] font-mono">
                      <th className="px-5 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Size</th>
                      <th className="px-3 py-2.5">Move type</th>
                      <th className="px-3 py-2.5">Price</th>
                      <th className="px-3 py-2.5">Validity</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.tariffs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-6 text-center text-[var(--ink-faint)]">
                          No tariff rows yet.
                        </td>
                      </tr>
                    )}
                    {contract.tariffs.map((t) => {
                      const isOwner = t.created_by_id === activeUser.id;
                      return (
                        <tr key={t.id} className="ledger-row">
                          <td className="px-5 py-3 container-code">TRF-{String(t.id).padStart(4, "0")}</td>
                          <td className="px-3 py-3">{t.size}</td>
                          <td className="px-3 py-3 capitalize">{t.move_type}</td>
                          <td className="px-3 py-3 font-mono">{fmtMoney(t.price, t.currency)}</td>
                          <td className="px-3 py-3 font-mono text-xs text-[var(--ink-dim)]">
                            {t.valid_from} → {t.valid_until}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <StatusBadge status={t.status} />
                              {t.status === "Rejected" && t.rejection_reason && (
                                <span className="text-[0.68rem] text-[var(--ink-faint)] max-w-[180px] truncate" title={t.rejection_reason}>
                                  “{t.rejection_reason}”
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-2 flex-wrap">
                              {isCreator && isOwner && (t.status === "Draft" || t.status === "Rejected") && (
                                <button
                                  onClick={() => setTariffFormFor({ contract, tariff: t })}
                                  className="px-2.5 py-1 text-xs rounded border border-[var(--border)] hover:text-[var(--ink)] text-[var(--ink-dim)]"
                                >
                                  Edit
                                </button>
                              )}
                              {isCreator && isOwner && t.status === "Draft" && (
                                <button
                                  onClick={() =>
                                    act(() => api.submitTariff(activeUser.id, t.id))
                                  }
                                  className="px-2.5 py-1 text-xs rounded bg-[var(--amber-dim)] border border-[var(--amber)]/40 text-[var(--amber)] font-medium"
                                >
                                  Submit
                                </button>
                              )}
                              {isApprover && t.status === "Pending" && !isOwner && (
                                <>
                                  <button
                                    onClick={() =>
                                      act(() => api.approveTariff(activeUser.id, t.id))
                                    }
                                    className="px-2.5 py-1 text-xs rounded bg-[var(--teal-dim)] border border-[var(--teal)]/40 text-[var(--teal)] font-medium"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(t.id)}
                                    className="px-2.5 py-1 text-xs rounded bg-[var(--danger-dim)] border border-[var(--danger)]/40 text-[var(--danger)] font-medium"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {isApprover && t.status === "Pending" && isOwner && (
                                <span className="text-[0.68rem] text-[var(--ink-faint)] italic">
                                  own row — can't approve
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {showContractForm && (
        <ContractFormModal
          onSubmit={(payload) => api.createContract(activeUser.id, payload).then(load)}
          onClose={() => setShowContractForm(false)}
        />
      )}
      {editContract && (
        <ContractFormModal
          initial={editContract}
          onSubmit={(payload) => api.updateContract(activeUser.id, editContract.id, payload).then(load)}
          onClose={() => setEditContract(null)}
        />
      )}
      {tariffFormFor && (
        <TariffFormModal
          contract={tariffFormFor.contract}
          initial={tariffFormFor.tariff}
          onSubmit={(payload) =>
            tariffFormFor.tariff
              ? api.updateTariff(activeUser.id, tariffFormFor.tariff.id, payload).then(load)
              : api.createTariff(activeUser.id, payload).then(load)
          }
          onClose={() => setTariffFormFor(null)}
        />
      )}
      {rejectingId && (
        <RejectModal
          onSubmit={(reason) => act(() => api.rejectTariff(activeUser.id, rejectingId, reason))}
          onClose={() => setRejectingId(null)}
        />
      )}
    </div>
  );
}
