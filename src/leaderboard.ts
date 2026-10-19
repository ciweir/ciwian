// ===================== 云端服务：每日天梯 + 云存档 =====================
// 通道：CloudBase HTTP 网关 + 匿名登录（设备级），后端为云函数 leaderboard
//       action: submit(提交成绩) / top(取当日榜) / save(上传档案) / load(按码取档)
// 未填 ENV_ID 时全部能力自动降级为"仅本地"，不影响单机游玩
import { dailySeed } from './state'

/** CloudBase 环境 ID（留空则关闭云端功能） */
export const ENV_ID = 'ai-native-d2grek6ae62cc6772'
const BASE = `https://${ENV_ID}.api.tcloudbasegateway.com`
const FN = 'leaderboard'

export function lbEnabled(): boolean { return !!ENV_ID }

export interface RankRow { name: string; wave: number; kills: number; time: number }

// ---------------- 本机标识与昵称 ----------------
function deviceId(): string {
  let d = ''
  try { d = localStorage.getItem('matchless_device') || '' } catch (e) { /* 忽略 */ }
  if (!d) {
    d = 'dev_' + Math.random().toString(36).slice(2, 10)
    try { localStorage.setItem('matchless_device', d) } catch (e) { /* 忽略 */ }
  }
  return d
}
export function getPlayerName(): string {
  try { return localStorage.getItem('matchless_name') || '' } catch (e) { return '' }
}
/** 清洗并保存昵称，返回实际保存值（供输入框回填） */
export function setPlayerName(n: string): string {
  const v = String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 12)
  try { localStorage.setItem('matchless_name', v) } catch (e) { /* 忽略 */ }
  return v
}

// ---------------- 匿名令牌（缓存到过期前 5 分钟） ----------------
let token = '', tokenExp = 0
async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExp) return token
  const r = await fetch(`${BASE}/auth/v1/signin/anonymously`, {
    method: 'POST',
    headers: { 'x-device-id': deviceId(), 'Content-Type': 'application/json' },
    body: '{}',
  })
  const j = await r.json()
  token = j.access_token || ''
  tokenExp = Date.now() + ((j.expires_in || 7200) - 300) * 1000
  return token
}

/** 通用云端调用（失败静默返回 null） */
export async function cloudCall<T = any>(payload: Record<string, unknown>): Promise<T | null> {
  if (!lbEnabled()) return null
  try {
    const tk = await getToken()
    if (!tk) return null
    const r = await fetch(`${BASE}/v1/functions/${FN}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    return (j.data ?? j) as T
  } catch (e) {
    return null
  }
}

// ---------------- 每日天梯 ----------------
/** 查询当日 Top20（未接入/失败返回空数组） */
export async function fetchTop(): Promise<RankRow[]> {
  const r = await cloudCall<{ ok: boolean; list?: RankRow[] }>({ action: 'top', seed: dailySeed() })
  return r && r.ok && Array.isArray(r.list) ? r.list : []
}

/** 提交成绩后再取榜，返回最新榜单（供结算页直接渲染） */
export async function settleDaily(wave: number, kills: number, time: number): Promise<RankRow[]> {
  await cloudCall({ action: 'submit', seed: dailySeed(), pid: deviceId(), name: getPlayerName() || '无名侠客', wave, kills, time })
  return fetchTop()
}

// ---------------- 榜单渲染（供天梯页/结算页复用） ----------------
function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
export function boardLoading(box: HTMLElement): void {
  box.innerHTML = '<div class="lbTip">榜单加载中…</div>'
}
/** rows=null 表示未接入云端；空数组表示榜上无人 */
export function renderBoard(box: HTMLElement, rows: RankRow[] | null): void {
  if (!rows) {
    box.innerHTML = '<div class="lbTip">云端未接入 · 仅记录本地战绩</div>'
    return
  }
  if (!rows.length) {
    box.innerHTML = '<div class="lbTip">今日榜首虚位以待</div>'
    return
  }
  const me = getPlayerName() || '无名侠客'
  const html = rows.slice(0, 20).map((r, i) =>
    `<div class="lbRow${r.name === me ? ' me' : ''}">` +
    `<span class="rk">${i + 1}</span>` +
    `<span class="nm">${esc(r.name)}</span>` +
    `<span class="st">第${r.wave}波 · ${r.kills}杀</span>` +
    `</div>`).join('')
  box.innerHTML = '<div class="lbTitle">每日挑战 · 全服天梯</div>' + html
}
