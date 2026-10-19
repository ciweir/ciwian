// ===================== 成就系统（localStorage 持久化 + 解锁弹窗） =====================
import { G } from './state'
import { ACHIEVEMENTS } from './config'
import { tone } from './audio'

const KEY = 'matchless_achv'
let unlocked: Set<string> = new Set()

export function loadAchievements(): void {
  try { unlocked = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch (e) { unlocked = new Set() }
}

export function achievementCount(): { got: number; total: number } {
  return { got: unlocked.size, total: ACHIEVEMENTS.length }
}

/** 已解锁集合（武林录图鉴渲染用，勿改动返回值） */
export function getUnlocked(): Set<string> { return unlocked }

/** 解锁成就：持久化 + 金色弹窗 + 音效 */
export function unlock(id: string): void {
  if (unlocked.has(id)) return
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def) return
  unlocked.add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...unlocked])) } catch (e) { /* 忽略 */ }
  G.achvToasts.push({ text: '成就解锁：' + def.name, t: 2.4 })
  tone(880, 1320, .15, 'triangle', .3)
  tone(1320, 1760, .2, 'triangle', .3, .12)
}
