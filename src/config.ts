// ===================== 配置与数值（调参都集中在这里） =====================
import type { WeaponDef, WeaponId, SkillDef, AchievementDef, BossKind, DailyMod } from './types'

export const PLAYER_COLOR = '#FF8C00'   // EXTENSIBLE: 主角皮肤颜色
export const ENEMY_COLOR = '#222'
export const TAU = Math.PI * 2

export const WAVE_INTERVAL = 30   // 波次每 30s +1
export const ENEMY_CAP = 60       // 同屏上限 60

// ---------------- 无限世界 + 滚动镜头 ----------------
// 世界无边界：相机自由跟随玩家，小地图为雷达式（范围见下）
export const RADAR_RANGE = 800    // 雷达探测半径（世界单位）
export const MILESTONES = [50, 100, 200, 400, 800]   // 击杀里程碑播报

// ---------------- Boss 轮换池 ----------------
export const BOSS_NAMES: Record<BossKind, string> = {
  charger: '裂地者',
  spitter: '咒雨术士',
  twins: '双子煞星',
  overlord: '武林霸主',
}
export const FINAL_WAVE = 20      // 第 20 波出最终 Boss，击杀即通关
/** 每 5 波 Boss 形态轮换（第 20 波固定为霸主） */
export function bossKindFor(wave: number): BossKind {
  if (wave >= FINAL_WAVE && wave % FINAL_WAVE === 0) return 'overlord'
  const seq: BossKind[] = ['charger', 'spitter', 'twins']
  return seq[(Math.floor(wave / 5) - 1) % 3]
}

// ---------------- 群雄轮战（Boss Rush） ----------------
export const RUSH_LENGTH = 5      // 连战 5 名 Boss，击败霸主即通关
export const RUSH_SEQ: BossKind[] = ['charger', 'spitter', 'twins', 'charger', 'overlord']
export const RUSH_REST = 4        // Boss 间歇（秒），期间回复 30% 气血
/** 轮战第 n 个 Boss 的等效波次（决定血量/攻防/移速成长） */
export function rushEffWave(n: number): number { return 5 + n * 3 }

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v
/** O(1) 删除数组元素（不保持顺序），替代 splice 减少 GC 与搬移 */
export function swapRemove<T>(arr: T[], i: number): void {
  arr[i] = arr[arr.length - 1]
  arr.pop()
}
export const angDiff = (a: number, b: number) => {
  let d = a - b
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  return d
}

// ---------------- 武器系统 ----------------
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist: {
    id: 'fist', name: '拳脚', icon: '拳', desc: '均衡易上手\n三段快打',
    coef: [1.0, 1.1, 1.5], dur: [0.24, 0.26, 0.40], lunge: [150, 170, 300],
    range: 78, arc: 1.1,
    heavyCoef: 3.0, heavyRange: 150, heavyArc: Math.PI * 0.95, heavyPower: 650,
    evo: { name: '崩拳', need: 'atk', desc: '三段释放冲击波\n范围 AOE' },
  },
  spear: {
    id: 'spear', name: '长枪', icon: '枪', desc: '判定距离超长\n扇形较窄',
    coef: [0.9, 1.0, 1.4], dur: [0.26, 0.28, 0.42], lunge: [150, 170, 300],
    range: 130, arc: 0.55,
    heavyCoef: 2.8, heavyRange: 210, heavyArc: 0.9, heavyPower: 750,
    evo: { name: '龙卷枪', need: 'speed', desc: '攻击距离 +50\n扇形加倍' },
  },
  dual: {
    id: 'dual', name: '双刀', icon: '刀', desc: '攻速极快\n单发伤害较低',
    coef: [0.7, 0.8, 1.3], dur: [0.16, 0.17, 0.30], lunge: [140, 150, 260],
    range: 70, arc: 1.0,
    heavyCoef: 2.4, heavyRange: 130, heavyArc: Math.PI, heavyPower: 550,
    evo: { name: '瞬狱双牙', need: 'crit', desc: '攻速 +33%\n暴击率 +15%' },
  },
  hammer: {
    id: 'hammer', name: '重锤', icon: '锤', desc: '大开大合\n高伤高击飞',
    coef: [1.4, 1.5, 2.0], dur: [0.38, 0.40, 0.55], lunge: [120, 130, 220],
    range: 88, arc: 1.35,
    heavyCoef: 3.5, heavyRange: 175, heavyArc: Math.PI, heavyPower: 850,
    evo: { name: '陨星锤', need: 'heavy', desc: '重击引发\n延迟陨星爆炸' },
  },
  bow: {
    id: 'bow', name: '弓', icon: '弓', desc: '远程射击\n自动索敌',
    coef: [1.15, 0.8, 0.75], dur: [0.30, 0.34, 0.50], lunge: [40, 50, 60],
    range: 520, arc: 0.9,                        // range/arc 用作索敌距离与锥角
    heavyCoef: 3.2, heavyRange: 520, heavyArc: 0.9, heavyPower: 600,
    evo: { name: '连珠', need: 'window', desc: '普攻箭矢 +1\n全部箭矢贯穿' },
  },
}

// ---------------- 技能树（升级三选一池） ----------------
export const SKILLS: SkillDef[] = [
  { id: 'atk',    icon: '力', name: '蛮力',   desc: '攻击 +5',            apply: p => { p.atk += 5 } },
  { id: 'hp',     icon: '体', name: '强体',   desc: '生命上限 +25\n并回复 30', apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 30) } },
  { id: 'crit',   icon: '眼', name: '鹰眼',   desc: '暴击率 +3%',         apply: p => { p.critBonus += 0.03 } },
  { id: 'speed',  icon: '风', name: '疾风',   desc: '移速 +8%',           apply: p => { p.speed *= 1.08 } },
  { id: 'musou',  icon: '意', name: '战意',   desc: '无双获取 +25%',      apply: p => { p.musouGain *= 1.25 } },
  { id: 'window', icon: '拍', name: '节奏大师', desc: '连击窗口 +0.2s',   apply: p => { p.comboWindow += 0.2 } },
  { id: 'heavy',  icon: '地', name: '碎地',   desc: '重击范围 +25%',      apply: p => { p.heavyRangeMul *= 1.25 } },
  { id: 'vamp',   icon: '血', name: '吸血',   desc: '3% 伤害转化为生命',  apply: p => { p.lifesteal += 0.03 } },
  { id: 'magnet', icon: '磁', name: '磁力',   desc: '宝石拾取范围 +40%',  apply: p => { p.magnetMul *= 1.4 } },
]

// ---------------- 每日挑战词条 ----------------
/** 每天由种子确定 1 个，只作用于每日模式 */
export const DAILY_MODS: DailyMod[] = [
  { id: 'swift',  name: '疾风', desc: '敌人移速 +15%', enemySpeedMul: 1.15 },
  { id: 'elite',  name: '群狼', desc: '精英出现率翻倍', eliteChance: 0.24 },
  { id: 'frenzy', name: '狂潮', desc: '每波敌人 +20%', spawnMul: 1.2 },
  { id: 'iron',   name: '铁壁', desc: '敌人防御 +2', enemyDefBonus: 2 },
  { id: 'blood',  name: '血战', desc: '气血上限 -20%，攻击 +10%', player: p => {
    p.maxHp = Math.round(p.maxHp * 0.8); p.hp = p.maxHp; p.atk = Math.round(p.atk * 1.1)
  } },
]
/** 每日种子 → 今日词条（确定性，所有玩家同一天同词条） */
export function dailyModFor(seed: number): DailyMod {
  return DAILY_MODS[Math.abs(seed) % DAILY_MODS.length]
}

// ---------------- 成就系统 ----------------
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstBlood',   name: '第一滴血',   desc: '完成首次击杀' },
  { id: 'combo20',      name: '连招入门',   desc: '达成 20 连击' },
  { id: 'combo50',      name: '无双乱舞',   desc: '达成 50 连击' },
  { id: 'kill100',      name: '百人斩',     desc: '单局击杀 100' },
  { id: 'kill500',      name: '割草机',     desc: '单局击杀 500' },
  { id: 'wave5',        name: '站稳脚跟',   desc: '到达第 5 波' },
  { id: 'wave10',       name: '生存专家',   desc: '到达第 10 波' },
  { id: 'boss1',        name: '屠王者',     desc: '击败一个 Boss' },
  { id: 'bossEnrage',   name: '狂怒见证者', desc: '触发 Boss 狂暴形态' },
  { id: 'musou1',       name: '无双觉醒',   desc: '首次释放无双' },
  { id: 'level10',      name: '十级武者',   desc: '升到 10 级' },
  { id: 'survive300',   name: '老兵不死',   desc: '单局存活 5 分钟' },
  { id: 'weaponSwitch', name: '十八般兵器', desc: '局内拾取并更换武器' },
]
