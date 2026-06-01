import Link from "next/link"
import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/supabase/auth-server"

function MetricCard({
  label,
  value,
  detail,
  accent = "text-white",
}: {
  label: string
  value: number | string
  detail: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function ActionLink({
  href,
  title,
  detail,
}: {
  href: string
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-3 transition-colors hover:border-gray-700 hover:bg-gray-800/70"
    >
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </Link>
  )
}

export default async function DashboardPage() {
  if (!(await isAdminUser())) redirect("/unauthorized")

  const supabase = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: posts },
    { data: accountIssues },
    { data: openTasks, count: openTaskCount },
    { data: employees },
    { data: threadsBatches },
    { count: activeAccounts },
  ] = await Promise.all([
    supabase
      .from("posting_schedule")
      .select("id, status")
      .eq("send_date", today)
      .neq("status", "wartet"),
    supabase
      .from("account_pairs")
      .select("id, creator, ig_username, fb_username, status")
      .in("status", ["restricted", "banned"])
      .eq("archived", false),
    supabase
      .from("tasks")
      .select("id, title, priority, status", { count: "exact" })
      .neq("status", "erledigt")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("employees")
      .select("id, telegram_chat_id"),
    supabase
      .from("threads_daily_batches")
      .select("id, status")
      .eq("date", today),
    supabase
      .from("account_pairs")
      .select("id", { count: "exact", head: true })
      .eq("archived", false),
  ])

  const todaysPosts = posts ?? []
  const issues = accountIssues ?? []
  const tasks = openTasks ?? []
  const team = employees ?? []
  const threads = threadsBatches ?? []
  const completedPosts = todaysPosts.filter((post) => post.status === "gepostet").length
  const readyPosts = todaysPosts.filter((post) => post.status === "bereit").length
  const connectedEmployees = team.filter((employee) => employee.telegram_chat_id).length
  const sentThreads = threads.filter((batch) =>
    ["sent", "posted", "deleted"].includes(batch.status)
  ).length

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-400">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Command Center</h1>
          <p className="mt-2 text-sm text-gray-400">
            Live-Blick auf den Betrieb für {today}.
          </p>
        </div>
        <Link
          href="/rafael"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Agent Center öffnen
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Posts heute"
          value={`${completedPosts}/${todaysPosts.length}`}
          detail={`${readyPosts} bereit für Telegram`}
          accent="text-emerald-300"
        />
        <MetricCard
          label="Account-Probleme"
          value={issues.length}
          detail="Restricted oder banned"
          accent={issues.length ? "text-red-300" : "text-emerald-300"}
        />
        <MetricCard
          label="Offene Tasks"
          value={openTaskCount ?? 0}
          detail="Die letzten fünf werden unten gezeigt"
          accent={openTaskCount ? "text-amber-300" : "text-emerald-300"}
        />
        <MetricCard
          label="Aktive Accounts"
          value={activeAccounts ?? 0}
          detail={`${connectedEmployees}/${team.length} Mitarbeiter mit Telegram`}
        />
      </div>

      <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/15 via-gray-900 to-gray-900 p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
            Agent Center
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Rafael bündelt Wissen, Live-Daten und operative Fragen.
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Nutze ihn als erste Anlaufstelle für Tageslage, Engpässe und Wissen aus
            PDFs, Notizen oder YouTube-Transkripten.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-white">Operativer Puls</h2>
            <span className="text-xs text-gray-500">
              Threads: {sentThreads}/{threads.length} versendet
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionLink
              href="/posting-planer"
              title="Posting Planer"
              detail={`${readyPosts} Posts stehen für den Versand bereit.`}
            />
            <ActionLink
              href="/account-status"
              title="Account Status"
              detail={`${issues.length} Probleme brauchen Aufmerksamkeit.`}
            />
            <ActionLink
              href="/tracker"
              title="Account Tracker"
              detail={`${activeAccounts ?? 0} aktive Account-Paare verwalten.`}
            />
            <ActionLink
              href="/social"
              title="Performance Tracking"
              detail="Instagram- und Facebook-Metriken prüfen."
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-white">Offene Tasks</h2>
            <Link href="/tasks" className="text-xs text-indigo-300 hover:text-indigo-200">
              Alle ansehen
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.length ? (
              tasks.map((task) => (
                <div key={task.id} className="rounded-lg bg-gray-950/70 px-3 py-2.5">
                  <p className="truncate text-sm text-gray-200">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {task.priority} · {task.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Keine offenen Tasks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
