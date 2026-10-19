// ===================== 局外成长：金币 + 永久强化（localStorage 持久化） =====================
import type { Player } from './types'

const KEY = 'matchless_meta'

export interface MetaUpgradeDef {
  id: string
  name: string
  icon: string
  max: number
  base: number                          // 1 级价格，之后 ×1.6 递增
  apply: (p: Player, lv: number) => void
}

// EXTENSIBLE: 加永久强化往这里塞
export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'atk',    name: '攻击', icon: '力', max: 5, base: 100, apply: (p, lv) => { p.atk += 4 * lv } },
  { id: 'hp',     name: '生命', icon: '体', max: 5, base: 100, apply: (p, lv) => { p.maxHp += 15 * lv; p.hp += 15 * lv } },
  { id: 'speed',  name: '移速', icon: '风', max: 5, base: 120, apply: (p, lv) => { p.speed *= 1 + 0.03 * lv } },
  { id: 'magnet', name: '磁力', icon: '磁', max: 5, base: 120, apply: (p, lv) => { p.magnetMul *= 1 + 0.15 * lv } },
  { id: 'musou',  name: '战意', icon: '意', max: 5, base: 150, apply: (p, lv) => { p.musouGain *= 1 + 0.1 * lv } },
  { id: 'revive', name: '复活', icon: '魂', max: 1, base: 800, apply: (p, lv) => { p.revives += lv } },
]

interface MetaData { coins: number; upgrades: Record<string, number> }
let meta: MetaData = { coins: 0, upgrades: {} }

export function loadMeta(): void {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (m) { meta.coins = m.coins | 0; meta.upgrades = m.upgrades || {} }
  } catch (e) { /* 忽略 */ }
}
function saveMeta(): void {
  try { localStorage.setItem(KEY, JSON.stringify(meta)) } catch (e) { /* 忽略 */ }
}

export function getCoins(): number { return meta.coins }
export function addCoins(n: number): void { meta.coins += n; saveMeta() }
export function getUpgradeLv(id: string): number { return meta.upgrades[id] || 0 }
export function upgradeCost(def: MetaUpgradeDef): number {
  return Math.round(def.base * Math.pow(1.6, getUpgradeLv(def.id)))
}
export function buyUpgrade(id: string): boolean {
  const def = META_UPGRADES.find(u => u.id === id)
  if (!def) return false
  const lv = getUpgradeLv(id)
  const cost = upgradeCost(def)
  if (lv >= def.max || meta.coins < cost) return false
  meta.coins -= cost
  meta.upgrades[id] = lv + 1
  saveMeta()
  return true
}

/** 开局时把永久强化应用到玩家 */
export function applyMeta(p: Player): void {
  for (const def of META_UPGRADES) {
    const lv = getUpgradeLv(def.id)
    if (lv > 0) def.apply(p, lv)
  }
}

/** 结算金币：击杀×1 + 波次×10 + Boss×50 */
export function earnCoins(kills: number, wave: number, bossKills: number): number {
  return kills + wave * 10 + bossKills * 50
}

// ---------------- 生涯统计（武林录，localStorage 累积） ----------------
const SKEY = 'matchless_stats'

export interface CareerStats {
  kills: number; runs: number; wins: number; time: number
  maxWave: number; bestCombo: number; bosses: number
}
let stats: CareerStats = { kills: 0, runs: 0, wins: 0, time: 0, maxWave: 0, bestCombo: 0, bosses: 0 }

export function loadStats(): void {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || 'null')
    if (s) stats = { ...stats, ...s }
  } catch (e) { /* 忽略 */ }
}
export function getStats(): CareerStats { return stats }

/** 每局结算时累积（win=通关） */
export function recordRun(r: { kills: number; wave: number; time: number; combo: number; bosses: number; win: boolean }): void {
  stats.kills += r.kills
  stats.runs++
  stats.time += r.time
  if (r.win) stats.wins++
  stats.maxWave = Math.max(stats.maxWave, r.wave)
  stats.bestCombo = Math.max(stats.bestCombo, r.combo)
  stats.bosses += r.bosses
  try { localStorage.setItem(SKEY, JSON.stringify(stats)) } catch (e) { /* 忽略 */ }
}

export interface LocalBest { wave: number; combo: number; time: number }

/** 阵亡与通关共用，避免两条结算路径口径分叉 */
export function updateLocalBest(
  wave: number, kills: number, time: number, combo: number, dailyKey?: string,
): { best: LocalBest; daily: { wave: number; kills: number } | null } {
  let best: LocalBest = { wave: 0, combo: 0, time: 0 }
  try {
    const raw = JSON.parse(localStorage.getItem('matchless_best') || 'null')
    if (raw) best = { ...best, ...raw }
  } catch (e) { /* 忽略 */ }
  const next = {
    wave: Math.max(best.wave, wave),
    combo: Math.max(best.combo, combo),
    time: Math.max(best.time, time),
  }
  try { localStorage.setItem('matchless_best', JSON.stringify(next)) } catch (e) { /* 忽略 */ }

  let daily: { wave: number; kills: number } | null = null
  if (dailyKey) {
    let db = { wave: 0, kills: 0 }
    try { db = JSON.parse(localStorage.getItem(dailyKey) || 'null') || db } catch (e) { /* 忽略 */ }
    daily = { wave: Math.max(db.wave, wave), kills: Math.max(db.kills, kills) }
    try { localStorage.setItem(dailyKey, JSON.stringify(daily)) } catch (e) { /* 忽略 */ }
  }
  return { best: next, daily }
}
