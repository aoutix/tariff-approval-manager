import { useRole } from "../context/RoleContext";

const ROLE_SHORT = {
  "Tariff Creator": "Creator",
  Approver: "Approver",
  Viewer: "Viewer",
};

export default function RoleSwitcher() {
  const { users, activeUser, switchUser } = useRole();

  if (!activeUser) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.65rem] uppercase tracking-widest text-[var(--ink-faint)] font-mono">
        Logged in as
      </span>
      <select
        className="bg-[var(--panel-2)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] cursor-pointer"
        value={activeUser.id}
        onChange={(e) => {
          const u = users.find((u) => String(u.id) === e.target.value);
          if (u) switchUser(u);
        }}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username} — {ROLE_SHORT[u.role] || u.role}
          </option>
        ))}
      </select>
    </div>
  );
}
