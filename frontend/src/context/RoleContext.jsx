import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listUsers();
      setUsers(list);
      const stored = localStorage.getItem("activeUserId");
      const found = list.find((u) => String(u.id) === stored);
      setActiveUser(found || list[0] || null);
    } catch (e) {
      setError(e.message || "Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const switchUser = (user) => {
    setActiveUser(user);
    localStorage.setItem("activeUserId", String(user.id));
  };

  return (
    <RoleContext.Provider value={{ users, activeUser, switchUser, loading, error, reload: load }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
