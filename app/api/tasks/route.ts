import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const PETER_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ""

async function sendTaskNotification(params: {
  chatId:  string
  name:    string
  title:   string
  desc:    string | null
  taskId:  string
  dueDate: string | null
}): Promise<number | null> {
  const due  = params.dueDate ? `\nDeadline: ${new Date(params.dueDate).toLocaleDateString("de-DE")}` : ""
  const text = `📋 <b>Neuer Task für dich</b>\n\n<b>${params.title}</b>${params.desc ? `\n${params.desc}` : ""}${due}`

  const res = await fetch(`https://api.telegram.org/bot${PETER_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    params.chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "✅ Erledigt", callback_data: `task_done:${params.taskId}` },
        { text: "🔄 In Arbeit", callback_data: `task_wip:${params.taskId}` },
      ]]}
    }),
  })
  const data = await res.json()
  return data.ok ? data.result.message_id : null
}

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("tasks")
    .select("*, employee:employees(id, name, telegram_chat_id)")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const body     = await request.json()

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title:       body.title,
      description: body.description || null,
      assignee:    body.assignee,
      employee_id: body.employee_id || null,
      priority:    body.priority ?? "mittel",
      due_date:    body.due_date || null,
      created_by:  body.created_by ?? "Dashboard",
    })
    .select("*, employee:employees(id, name, telegram_chat_id)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send Telegram notification if employee has chat_id
  const emp = (task as { employee?: { telegram_chat_id?: string; name?: string } }).employee
  if (emp?.telegram_chat_id && task.id) {
    const msgId = await sendTaskNotification({
      chatId:  emp.telegram_chat_id,
      name:    emp.name ?? body.assignee,
      title:   task.title,
      desc:    task.description,
      taskId:  task.id,
      dueDate: task.due_date,
    })
    if (msgId) {
      await supabase.from("tasks").update({ telegram_message_id: msgId }).eq("id", task.id)
    }
  }

  return NextResponse.json(task)
}
