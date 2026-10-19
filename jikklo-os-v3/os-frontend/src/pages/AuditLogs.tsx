import { useEffect, useState } from "react";
import { api } from "../api/client";

type LogEntry = {
  id: string;
  user_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export function AuditLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get<{ logs: LogEntry[] }>("/api/admin/audit-logs").then((r) => setLogs(r.logs));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-jikklo-navy">Journal d'audit</h1>
      <div className="bg-white border rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune action enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Utilisateur</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Cible</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">{l.user_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {l.entity_type ? `${l.entity_type}:${l.entity_id}` : "—"}
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
