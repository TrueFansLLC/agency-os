import { getPostingTimes } from "@/types/threads"

type ThreadsMessageBatch = {
  id: string
  posts_count: number
  images_count: number
  drive_folder_url: string
  account?: {
    username?: string
    creator?: string
    branding?: string | null
  } | null
}

type ThreadsStatusAccount = {
  id: string
  username: string
  creator: string
  branding?: string | null
  status: string
}

export const THREADS_STATUS_BUTTONS = (batchId: string) => [[
  { text: "✅ Active",     callback_data: `th:active:${batchId}` },
  { text: "🟠 Restricted", callback_data: `th:restricted:${batchId}` },
  { text: "🔴 Banned",     callback_data: `th:banned:${batchId}` },
]]

export const THREADS_POSTING_BUTTONS = (batchId: string) => [
  [{ text: "✅ All posts published", callback_data: `th:posted:${batchId}` }],
  [
    { text: "🟠 Restricted", callback_data: `th:restricted:${batchId}` },
    { text: "🔴 Banned",     callback_data: `th:banned:${batchId}` },
  ],
]

export const THREADS_ACCOUNT_STATUS_BUTTONS = (accountId: string, status: string) => [[
  { text: status === "active" ? "✅ Active" : "Active", callback_data: `ts:active:${accountId}` },
  { text: status === "restricted" ? "🟠 Restricted" : "Restricted", callback_data: `ts:restricted:${accountId}` },
  { text: status === "banned" ? "🔴 Banned" : "Banned", callback_data: `ts:banned:${accountId}` },
]]

export function buildThreadsStatusCheckMessage(batch: ThreadsMessageBatch) {
  const account = batch.account
  const label = `${account?.creator ?? "Creator"}${account?.branding ? ` · ${account.branding}` : ""}`

  return [
    `📱 <b>Threads — @${account?.username ?? "account"}</b>`,
    `📅 Today: <b>${batch.posts_count} Posts</b> (${label})`,
    ``,
    `⚠️ <b>Check the account status before posting.</b>`,
    `Open the Threads account and confirm its current status below.`,
    ``,
    `Do not publish anything if the account is restricted or banned.`,
  ].join("\n")
}

export function buildThreadsPostingMessage(batch: ThreadsMessageBatch) {
  const account = batch.account
  const times = getPostingTimes(batch.posts_count).join(" / ")
  const label = `${account?.creator ?? "Creator"}${account?.branding ? ` · ${account.branding}` : ""}`

  return [
    `📱 <b>Threads — @${account?.username ?? "account"}</b>`,
    `✅ Account status: <b>Active</b>`,
    `📅 Today: <b>${batch.posts_count} Posts</b> (${label})`,
    `🕘 Times: ${times} (Bangkok)`,
    `📁 <a href="${batch.drive_folder_url}">Open Google Drive folder</a>`,
    ``,
    `——————————————`,
    `📌 Format: 2 images each as a carousel + caption`,
    `💡 Caption: copy a viral post from your FYP (1000+ likes in 24h)`,
    `⚠️ Use each image only <b>once</b> — delete it immediately after posting!`,
    `——————————————`,
    ``,
    `Tap the button once all ${batch.posts_count} posts are published.`,
  ].join("\n")
}

export function buildThreadsDailyStatusMessage(account: ThreadsStatusAccount, updatedBy?: string) {
  const icon = account.status === "banned" ? "🔴" : account.status === "restricted" ? "🟠" : "🟢"
  const label = account.status === "banned" ? "Banned" : account.status === "restricted" ? "Restricted" : "Active"

  return [
    `📱 <b>@${account.username}</b>`,
    `${account.creator}${account.branding ? ` · ${account.branding}` : ""}`,
    ``,
    `${icon} Current status: <b>${label}</b>`,
    `Confirm the current account status below.`,
    updatedBy ? `\n✅ Last updated by ${updatedBy}` : "",
  ].join("\n")
}
