import { useState } from "react";
import { RoleProvider, useRole } from "./context/RoleContext";
import RoleSwitcher from "./components/RoleSwitcher";
import ContractsPage from "./pages/ContractsPage";
import DashboardPage from "./pages/DashboardPage";

function Shell() {
  const { activeUser, loading, error } = useRole();
  const [tab, setTab] = useState("contracts");

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-[var(--ink-dim)] font-mono text-sm">
        Loading manifest…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center border border-[var(--danger)]/40 bg-[var(--danger-dim)] rounded-xl p-6">
          <p className="text-[var(--danger)] font-medium mb-1">Can't reach the API</p>
          <p className="text-sm text-[var(--ink-dim)]">{error}</p>
          <p className="text-xs text-[var(--ink-faint)] mt-3 font-mono">
            Make sure the backend is running on http://localhost:8000
          </p>
        </div>
      </div>
    );
  }

  const isApprover = activeUser?.role === "Approver";

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] sticky top-0 z-40 backdrop-blur bg-[var(--bg)]/85">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--accent)] flex items-center justify-center font-display font-bold text-[#1a0d06] text-sm">
              TA
            </div>
            <div>
              <h1 className="font-display font-semibold text-sm leading-tight">Tariff Approval Manager</h1>
              <p className="text-[0.65rem] text-[var(--ink-faint)] font-mono leading-tight">PORT OPERATIONS CONSOLE</p>
            </div>
          </div>
          <RoleSwitcher />
        </div>
        <nav className="max-w-6xl mx-auto px-6 flex gap-1">
          <button
            onClick={() => setTab("contracts")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "contracts"
                ? "border-[var(--accent)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            Contracts
          </button>
          {isApprover && (
            <button
              onClick={() => setTab("dashboard")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "dashboard"
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
              }`}
            >
              Dashboard
            </button>
          )}
        </nav>
      </header>

      <main>
        {tab === "dashboard" && isApprover ? <DashboardPage /> : <ContractsPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <Shell />
    </RoleProvider>
  );
}
