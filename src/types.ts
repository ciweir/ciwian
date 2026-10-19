// ===================== 全局类型定义 =====================

export type WeaponId = 'fist' | 'spear' | 'dual' | 'hammer' | 'bow'

/** 每日挑战词条：只影响每日模式，字段缺省表示不改 */
export interface DailyMod {
  id: string
  name: string
  desc: string
  player?: (p: Player) => void
  enemySpeedMul?: number
  enemyDefBonus?: number
  eliteChance?: number
  spawnMul?: number
}

/** 武器定义（EXTENSIBLE: 新增武器只需在 config.ts 的 WEAPONS 里加一条） */
export interface WeaponDef {
  id: WeaponId
  name: string
  icon: string
  desc: string
  coef: [number, number, number]   // 三连段伤害系数
  dur: [number, number, number]    // 三连段时长（节奏区分）
  lunge: [number, number, number]  // 三连段前冲
  range: number                    // 普攻判定距离
  arc: number                      // 普攻扇形半角(弧度)
  heavyCoef: number                // 蓄力重击系数
  heavyRange: number
  heavyArc: number
  heavyPower: number               // 重击击飞力度
  /** 超武进化：武器 Lv5 + 拥有指定被动技能后，升级时可选 */
  evo: { name: string; need: string; desc: string }
}

export type EnemyType = 'chaser' | 'thrower' | 'elite' | 'boss'
export type EnemyState = 'idle' | 'chase' | 'attack' | 'stagger' | 'bossTelegraph' | 'bossCharge'
/** Boss 形态：冲撞 / 弹幕 / 双子 / 最终霸主 */
export type BossKind = 'charger' | 'spitter' | 'twins' | 'overlord'

export interface Enemy {
  type: EnemyType
  x: number; y: number; vx: number; vy: number
  h: number; vh: number            // 击飞抛物线高度/速度
  rot: number; vrot: number        // 翻滚
  hp: number; maxHp: number; def: number
  state: EnemyState; stateT: number
  speed: number
  flash: number                    // 受击白闪 0.1s
  touchCd: number; throwT: number
  face: number; walk: number
  launched: boolean; dead: boolean
  scale: number; color: string; lw: number
  touchDmg: number
  specialT: number; summonT: number // Boss 技能计时
  enraged?: boolean                 // Boss 二阶段狂暴（半血触发）
  bossKind?: BossKind               // Boss 形态
  variant?: number                  // 双子左右外观区分
}

export interface Player {
  x: number; y: number; vx: number; vy: number
  face: number; walk: number; moving: boolean
  hp: number; maxHp: number
  level: number; exp: number; expNext: number
  atk: number; speed: number
  // ---- 技能树加成字段 ----
  critBonus: number    // 额外暴击率
  musouGain: number    // 无双获取倍率
  comboWindow: number  // 连击窗口(秒)
  heavyRangeMul: number// 重击范围倍率
  lifesteal: number    // 吸血比例
  magnetMul: number    // 宝石拾取范围倍率
  // ---- 武器局内成长 ----
  weaponLvs: Record<WeaponId, number>     // 每把武器独立等级 1-5
  evolvedMap: Record<WeaponId, boolean>   // 超武进化状态
  passives: Record<string, number>        // 已拥有的被动技能及叠层
  // ---- 局外强化 ----
  revives: number      // 本局剩余复活次数
  // ---- 动作状态 ----
  act: 'none' | 'atk' | 'heavy'
  atkStage: number; atkT: number; atkDur: number
  atkHitDone: boolean; buffered: boolean; chainWindow: number
  charging: boolean; chargeT: number
  dashT: number; dashDir: { x: number; y: number }
  invuln: number; hurtFlash: number
}

export interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; t: number; life: number }
export interface DmgText { x: number; y: number; val: number; crit: boolean; musou: boolean; t: number; life: number; heal?: boolean }
export interface Gem { x: number; y: number; vx: number; vy: number; val: number }
export interface Rock { x: number; y: number; vx: number; vy: number; t: number }

/** 玩家箭矢（弓）：伤害系数/暴击在射出时定格，命中原敌人时套其防御结算 */
export interface Arrow {
  x: number; y: number; vx: number; vy: number
  t: number; life: number
  coef: number; crit: boolean
  pierce: boolean; launch: boolean
  hits: Enemy[]
}
export interface Corpse { x: number; y: number; vx: number; vh: number; h: number; rot: number; vrot: number; color: string; lw: number; scale: number; t: number }

/** 技能定义（EXTENSIBLE: skillTree 二维数组的扁平化实现，加技能往 SKILLS 里塞即可） */
export interface SkillDef {
  id: string
  icon: string
  name: string
  desc: string
  apply: (p: Player) => void
}

/** 近战判定附加选项 */
export interface HitOpts {
  power?: number
  launch?: boolean
  heavy?: boolean
  musou?: boolean
  stage?: number      // 普攻段数（超武·崩拳用）
}

/** 出生预警点：红圈提示结束后才真正刷出敌人 */
export interface SpawnPoint { x: number; y: number; type: EnemyType; t: number; kind?: BossKind; eff?: number }

/** 武器掉落物（局内拾取换装） */
export interface WeaponDrop { x: number; y: number; weapon: WeaponId; t: number; life: number }

/** 成就定义（EXTENSIBLE: 加成就往 config.ts 的 ACHIEVEMENTS 里塞即可） */
export interface AchievementDef { id: string; name: string; desc: string }
