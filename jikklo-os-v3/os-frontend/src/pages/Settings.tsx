import { useEffect, useState } from "react";
import { api } from "../api/client";

type Setting = { key: string; value: string };

export function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  function load() {
    api.get<{ settings: Setting[] }>("/api/settings/admin").then((r) => setSettings(r.settings));
  }

  useEffect(load, []);

  async function handleSave(key: string, value: string) {
    await api.patch(`/api/settings/admin/${key}`, { value });
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-jikklo-navy">Paramètres</h1>
      <div className="bg-white border rounded-xl divide-y">
        {settings.map((s) => (
          <div key={s.key} className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">{s.key}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                defaultValue={s.value}
                onBlur={(e) => e.target.value !== s.value && handleSave(s.key, e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm w-48"
              />
              {saved === s.key && <span className="text-xs text-green-600">Enregistré</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
