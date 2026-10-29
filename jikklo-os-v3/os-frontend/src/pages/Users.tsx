import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type StaffUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  role_id: string;
  role_label: string;
};

type Role = { id: string; name: string; label: string };

export function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  // Modification d'un utilisateur existant
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function load() {
    api
      .get<{ users: StaffUser[] }>("/api/admin/users")
      .then((r) => setUsers(r.users))
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Impossible de charger les utilisateurs."));
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
      setFullName("");
      setEmail("");
      setPassword("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création.");
    }
  }

  async function toggleStatus(id: string, current: string) {
    setListError(null);
    try {
      await api.patch(`/api/admin/users/${id}/status`, { status: current === "active" ? "suspended" : "active" });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  function startEdit(u: StaffUser) {
    setEditingId(u.id);
    setEditName(u.full_name);
    setEditEmail(u.email);
    setEditPhone(u.phone ?? "");
    setEditRoleId(u.role_id);
    setEditPassword("");
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    try {
      const payload: Record<string, string> = {
        fullName: editName,
        email: editEmail,
        phone: editPhone,
        roleId: editRoleId,
      };
      // Le mot de passe n'est envoyé que s'il est rempli : vide = inchangé.
      if (editPassword) payload.password = editPassword;
      await api.patch(`/api/admin/users/${editingId}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Erreur lors de la modification.");
    }
  }

  async function remove(u: StaffUser) {
    if (!window.confirm(`Supprimer définitivement le compte de ${u.full_name} (${u.email}) ?`)) return;
    setListError(null);
    try {
      await api.delete(`/api/admin/users/${u.id}`);
      if (editingId === u.id) setEditingId(null);
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur lors de la suppression.");
    }
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

      {listError && <div className="text-sm text-red-600">{listError}</div>}

      <div className="bg-white border rounded-xl divide-y">
        {users.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun utilisateur.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 break-words">{u.full_name}</div>
                  <div className="text-xs text-slate-500 break-all">{u.email}</div>
                  <div className="text-xs text-slate-500">
                    {u.role_label}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {u.status === "active" ? "Actif" : "Suspendu"}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => (editingId === u.id ? setEditingId(null) : startEdit(u))}
                  className="text-jikklo-navy text-xs font-medium underline"
                >
                  {editingId === u.id ? "Fermer" : "Modifier"}
                </button>
                {u.id !== me?.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleStatus(u.id, u.status)}
                      className="text-jikklo-navy text-xs font-medium underline"
                    >
                      {u.status === "active" ? "Suspendre" : "Réactiver"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      className="text-red-600 text-xs font-medium underline"
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>

              {editingId === u.id && (
                <form onSubmit={handleSaveEdit} className="bg-slate-50 border rounded-lg p-3 space-y-3">
                  {editError && <div className="text-sm text-red-600">{editError}</div>}
                  <input required placeholder="Nom complet" value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input required type="email" placeholder="Email" value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Téléphone" value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)}
                    disabled={u.id === me?.id}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <input type="password" placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                    value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">
                    Enregistrer les modifications
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
