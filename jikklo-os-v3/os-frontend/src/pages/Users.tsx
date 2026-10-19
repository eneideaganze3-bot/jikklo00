import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type StaffUser = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role_label: string;
};

type Role = { id: string; name: string; label: string };

export function Users() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  function load() {
    api.get<{ users: StaffUser[] }>("/api/admin/users").then((r) => setUsers(r.users));
    api.get<{ roles: Role[] }>("/api/admin/users/roles").then((r) => {
      setRoles(r.roles);
      if (r.roles.length && !roleId) setRoleId(r.roles[r.roles.length - 1].id);
    });
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/users", { fullName, email, password, roleId });
      setFullName(""); setEmail(""); setPassword("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création.");
    }
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "active" ? "suspended" : "active";
    await api.patch(`/api/admin/users/${id}/status`, { status: next });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Utilisateurs</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg"
        >
          {showForm ? "Annuler" : "+ Nouvel utilisateur"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Nom complet" value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input required type="password" placeholder="Mot de passe (min. 8 caractères)" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">
            Créer l'utilisateur
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun utilisateur.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Rôle</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2">{u.role_label}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {u.status === "active" ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleStatus(u.id, u.status)}
                      className="text-jikklo-navy text-xs font-medium underline"
                    >
                      {u.status === "active" ? "Suspendre" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
