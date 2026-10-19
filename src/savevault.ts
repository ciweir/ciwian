// ===================== 云存档（存档码方案：8 位码 ↔ 云端一份玩家档案） =====================
// 匿名登录是设备级的，做不了真跨设备账号；存档码即唯一凭证：
// 上传把本机档案推到码对应的那份云端档案，恢复则反向拉回覆盖本机。
// 恢复时采用对方的码为本机码，此后自动上传继续写同一份云端档案。
import { cloudCall, lbEnabled } from './leaderboard'

const CODE_KEY = 'matchless_savecode'
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'   // 去掉 I/L/O/0/1，防手抄歧义

/** 本机存档码（首次访问生成并持久化） */
export function getSaveCode(): string {
  let v = ''
  try { v = localStorage.getItem(CODE_KEY) || '' } catch (e) { /* 忽略 */ }
  if (!/^[A-Z2-9]{8}$/.test(v)) {
    const rnd = new Uint32Array(8)
    crypto.getRandomValues(rnd)
    v = Array.from(rnd, n => ALPHA[n % ALPHA.length]).join('')
    try { localStorage.setItem(CODE_KEY, v) } catch (e) { /* 忽略 */ }
  }
  return v
}

/** 恢复成功后采纳对方存档码为本机码（云端档案延续） */
export function adoptCode(code: string): void {
  try { localStorage.setItem(CODE_KEY, code) } catch (e) { /* 忽略 */ }
}

/** 展示格式 XXXX-XXXX */
export function fmtCode(code: string): string { return code.slice(0, 4) + '-' + code.slice(4) }

// 纳入云档的 localStorage 键（不含 pid/weapon 等设备态与每日临时记录）
const SAVE_KEYS = [
  'matchless_meta', 'matchless_stats', 'matchless_achv',
  'matchless_best', 'matchless_win', 'matchless_rush_best',
  'matchless_name', 'matchless_settings',
]

function collectProfile(): string {
  const obj: Record<string, string | null> = {}
  for (const k of SAVE_KEYS) {
    try { obj[k] = localStorage.getItem(k) } catch (e) { obj[k] = null }
  }
  return JSON.stringify(obj)
}

/** 恢复档案：仅写回 localStorage，内存态由调用方重载 */
export function applyProfile(json: string): void {
  const obj = JSON.parse(json) as Record<string, unknown>
  for (const k of SAVE_KEYS) {
    if (typeof obj[k] !== 'string') continue
    try { localStorage.setItem(k, obj[k] as string) } catch (e) { /* 忽略 */ }
  }
}

/** 恢复前预览摘要（确认弹窗用） */
export function summarizeProfile(json: string): string {
  try {
    const o = JSON.parse(json)
    const meta = JSON.parse(o.matchless_meta || '{}')
    const stats = JSON.parse(o.matchless_stats || '{}')
    const achv = JSON.parse(o.matchless_achv || '[]')
    const win = JSON.parse(o.matchless_win || '{}')
    return `金币 ${meta.coins | 0} · 出战 ${stats.runs | 0} 场 · 最高波次 ${stats.maxWave | 0} · 成就 ${achv.length} 个` +
      (win.clears ? ` · 通关 ${win.clears | 0} 次` : '')
  } catch (e) { return '' }
}

export function cloudReady(): boolean { return lbEnabled() }

/** 上传本机档案；null=未接云端，'ok'=成功，'fail'=云端异常 */
export async function uploadSave(): Promise<'ok' | 'fail' | null> {
  if (!lbEnabled()) return null
  const r = await cloudCall({ action: 'save', code: getSaveCode(), save: collectProfile(), ts: Date.now() })
  return r?.ok ? 'ok' : 'fail'
}

/** 按存档码拉取云端档案 */
export async function downloadSave(code: string): Promise<{ kind: 'ok'; json: string } | { kind: 'notfound' } | { kind: 'fail' }> {
  const r = await cloudCall({ action: 'load', code })
  if (!r) return { kind: 'fail' }
  if (r.ok && typeof r.save === 'string') return { kind: 'ok', json: r.save }
  return { kind: r.msg === 'not found' ? 'notfound' : 'fail' }
}

// ---- 每局结束自动上传（60s 节流，静默失败不打扰） ----
let lastAuto = 0
export function autoCloudSave(): void {
  if (!lbEnabled()) return
  const now = Date.now()
  if (now - lastAuto < 60000) return
  lastAuto = now
  void uploadSave()
}
