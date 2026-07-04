import { useEffect, useState, useCallback } from "react";
import { useRole } from "../context/RoleContext";
import { api } from "../api";
import ErrorBanner from "../components/ErrorBanner";
import Timeline from "../components/Timeline";

const STATUS_COLORS = {
  Draft: "var(--ink-faint)",
  Pending: "var(--amber)",
  Approved: "var(--teal)",
  Rejected: "var(--danger)",
};

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-[var(--ink-dim)] capitalize">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-[var(--panel-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-[var(--ink)]">{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
      <p className="text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono mb-2">{label}</p>
      <p className="font-display text-3xl font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

const EMPTY_FILTERS = { status: "", currency: "", date_from: "", date_to: "" };

function timeAgo(iso) {
  // Backend timestamps are naive UTC (no offset suffix); without "Z", the
  // JS Date constructor would parse them as local time and skew "time ago"
  // by the browser's UTC offset.
  const utcIso = iso.endsWith("Z") ? iso : `${iso}Z`;
  const diffMs = Date.now() - new Date(utcIso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTION_LABEL = {
  created: "created",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  edited_and_resubmitted: "edited & resubmitted",
};

export default function DashboardPage() {
  const { activeUser } = useRole();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = useCallback(async () => {
    if (!activeUser) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard(activeUser.id, filters);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeUser, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtersActive = Object.values(filters).some(Boolean);

  if (!activeUser) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight mb-1">Ops Dashboard</h1>
      <p className="text-sm text-[var(--ink-dim)] mb-6">Fleet-wide tariff summary, visible to Approvers only.</p>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-end gap-3 mb-6 border border-[var(--border)] rounded-xl bg-[var(--panel)] p-4">
        <div>
          <label className="block text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono mb-1">
            Currency
          </label>
          <select
            value={filters.currency}
            onChange={(e) => setFilter("currency", e.target.value)}
            className="bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono mb-1">
            From
          </label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilter("date_from", e.target.value)}
            className="bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono mb-1">
            To
          </label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilter("date_to", e.target.value)}
            className="bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
        {filtersActive && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="text-[var(--ink-dim)] text-sm">Loading summary…</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total rows" value={data.total_tariffs} color="var(--ink)" />
            {Object.entries(data.counts_by_status).map(([status, count]) => (
              <StatCard key={status} label={status} value={count} color={STATUS_COLORS[status]} />
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
              <h2 className="font-display font-semibold text-sm mb-4">Breakdown by move type</h2>
              <div className="space-y-3">
                {Object.entries(data.breakdown_by_move_type).map(([label, value]) => (
                  <BarRow
                    key={label}
                    label={label}
                    value={value}
                    max={data.total_tariffs}
                    color="var(--accent)"
                  />
                ))}
              </div>
            </div>

            <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
              <h2 className="font-display font-semibold text-sm mb-4">Breakdown by currency</h2>
              <div className="space-y-3">
                {Object.entries(data.breakdown_by_currency).map(([label, value]) => (
                  <BarRow
                    key={label}
                    label={label}
                    value={value}
                    max={data.total_tariffs}
                    color="var(--teal)"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
            <h2 className="font-display font-semibold text-sm mb-4">Status distribution</h2>
            <div className="space-y-3">
              {Object.entries(data.counts_by_status).map(([label, value]) => (
                <BarRow
                  key={label}
                  label={label}
                  value={value}
                  max={data.total_tariffs}
                  color={STATUS_COLORS[label]}
                />
              ))}
            </div>
          </div>

          <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
            <h2 className="font-display font-semibold text-sm mb-1">Validity timeline</h2>
            <p className="text-xs text-[var(--ink-dim)] mb-4">
              Tariff periods grouped by size + move type — overlapping bars in the same
              lane show where a conflict exists or would arise once approved.
            </p>
            <Timeline lanes={data.timeline} />
          </div>

          <div className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-5">
            <h2 className="font-display font-semibold text-sm mb-4">Recent activity</h2>
            {data.recent_activity.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)]">No workflow activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recent_activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-[var(--ink-dim)]">
                      <span className="text-[var(--ink)] font-medium">{a.username}</span>{" "}
                      {ACTION_LABEL[a.action] || a.action} tariff{" "}
                      <span className="font-mono text-xs text-[var(--ink-faint)]">
                        #{a.tariff_id}
                      </span>{" "}
                      <span className="text-[var(--ink-faint)]">
                        ({a.size} / {a.move_type}, {a.contract_name})
                      </span>
                      {a.detail && (
                        <span className="italic text-[var(--ink-faint)]"> — "{a.detail}"</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[0.68rem] font-mono text-[var(--ink-faint)]">
                      {timeAgo(a.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
