import type { SupabaseClient } from "@supabase/supabase-js"

type ThreadsAccountAssignment = {
  employee_id?: unknown
  mitarbeiter?: unknown
  [key: string]: unknown
}

type ThreadsEmployee = {
  id: string
  name: string
}

export async function normalizeThreadsAccountAssignment(
  supabase: SupabaseClient,
  body: ThreadsAccountAssignment
) {
  const employeeId =
    typeof body.employee_id === "string" && body.employee_id.trim()
      ? body.employee_id.trim()
      : null
  const legacyName =
    typeof body.mitarbeiter === "string" && body.mitarbeiter.trim()
      ? body.mitarbeiter.trim()
      : null

  if (!employeeId) {
    return { ...body, employee_id: null, mitarbeiter: legacyName }
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, name, platform")
    .eq("id", employeeId)
    .maybeSingle()

  if (error) throw error
  if (!employee || employee.platform !== "threads") {
    throw new Error("Threads-Mitarbeiter nicht gefunden.")
  }

  return {
    ...body,
    employee_id: employee.id,
    mitarbeiter: employee.name,
  }
}

export async function linkThreadsAccountsForEmployee(
  supabase: SupabaseClient,
  employee: ThreadsEmployee
) {
  const { data, error } = await supabase
    .from("threads_accounts")
    .update({ employee_id: employee.id, mitarbeiter: employee.name })
    .is("employee_id", null)
    .ilike("mitarbeiter", employee.name)
    .select("id")

  if (error) throw error
  return data?.length ?? 0
}

export async function renameLinkedThreadsAccounts(
  supabase: SupabaseClient,
  employee: ThreadsEmployee
) {
  const { error } = await supabase
    .from("threads_accounts")
    .update({ mitarbeiter: employee.name })
    .eq("employee_id", employee.id)

  if (error) throw error
}
