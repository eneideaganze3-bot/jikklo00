import { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jikklo-navy px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-white font-bold text-2xl tracking-tight">JIKKLO</div>
          <div className="text-white/50 text-sm mt-1">Jikklo Operating System</div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jikklo-accent"
              placeholder="admin@jikklo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jikklo-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-jikklo-navy text-white rounded-lg py-2.5 text-sm font-medium hover:bg-jikklo-blue transition-colors disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div className="text-center text-xs text-slate-400 pt-1">
            Mot de passe oublié ? Contacte un administrateur.
          </div>
        </form>
      </div>
    </div>
  );
}
