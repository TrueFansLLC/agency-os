"use client"

import { useState } from "react"

type RowsResult = { rows: Record<string, unknown>[] }
type OkResult = { ok: true; message: string }
type SqlResult = RowsResult | OkResult | null

const DANGER = /\b(drop|truncate|delete)\b/i

const SETUP_SQL = `create or replace function exec_sql(query text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare result jsonb;
begin
  begin
    execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (' || query || ') as t' into result;
    return jsonb_build_object('rows', result);
  exception when others then
    execute query;
    return jsonb_build_object('ok', true, 'message', 'Statement ausgeführt.');
  end;
end; $$;
revoke all on function exec_sql(text) from public, anon, authenticated;
grant execute on function exec_sql(text) to service_role;`

export default function AdminPage() {
  const [sql, setSql]         = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [needsSetup, setSetup] = useState(false)
  const [result, setResult]   = useState<SqlResult>(null)

  async function run() {
    setError(null); setResult(null); setSetup(false)

    if (DANGER.test(sql)) {
      const ok = window.confirm(
        "⚠️ Dieser Befehl kann Daten LÖSCHEN (drop/delete/truncate).\n\nWirklich ausführen?"
      )
      if (!ok) return
    }

    setLoading(true)
    try {
      const res  = await fetch("/api/admin/sql", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sql }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler.")
        setSetup(!!data.needsSetup)
      } else {
        setResult(data.result)
      }
    } catch {
      setError("Verbindung fehlgeschlagen.")
    }
    setLoading(false)
  }

  const rows = result && "rows" in result ? result.rows : null

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Datenbank-Tool</h1>
        <p className="text-gray-400 mt-1 text-sm">
          SQL-Befehle direkt ausführen — auch vom Handy. Ersetzt das Eintippen im Supabase-Dashboard.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="z.B. select * from employees limit 10;"
          spellCheck={false}
          className="w-full h-44 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-100 font-mono resize-y focus:outline-none focus:border-gray-600"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={run}
            disabled={loading || !sql.trim()}
            className="bg-white text-gray-950 font-medium text-sm px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Läuft…" : "Ausführen"}
          </button>
          <button
            onClick={() => { setSql(""); setResult(null); setError(null); setSetup(false) }}
            className="text-gray-400 text-sm px-3 py-2 rounded-lg hover:text-white"
          >
            Leeren
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-950/40 border border-red-900 rounded-xl p-4">
          <p className="text-red-300 text-sm font-medium">Fehler</p>
          <p className="text-red-200/80 text-sm mt-1 font-mono break-words">{error}</p>
        </div>
      )}

      {needsSetup && (
        <div className="mt-4 bg-amber-950/30 border border-amber-900/60 rounded-xl p-4">
          <p className="text-amber-200 text-sm font-medium">Einmalige Einrichtung nötig</p>
          <p className="text-amber-100/80 text-sm mt-1">
            Füge dieses Snippet <b>einmal</b> im Supabase SQL-Editor ein und führe es aus.
            Danach funktioniert dieses Tool dauerhaft — auch vom Handy.
          </p>
          <pre className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
        </div>
      )}

      {result && "ok" in result && (
        <div className="mt-4 bg-emerald-950/30 border border-emerald-900/60 rounded-xl p-4">
          <p className="text-emerald-300 text-sm font-medium">✓ {result.message}</p>
        </div>
      )}

      {rows && (
        <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
          <p className="text-gray-400 text-xs mb-3">{rows.length} Zeile(n)</p>
          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm">Keine Ergebnisse.</p>
          ) : (
            <table className="text-sm text-gray-200 w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  {Object.keys(rows[0]).map(col => (
                    <th key={col} className="py-2 pr-4 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="py-2 pr-4 align-top whitespace-pre-wrap break-words max-w-xs">
                        {val === null ? <span className="text-gray-600">null</span>
                          : typeof val === "object" ? JSON.stringify(val)
                          : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
