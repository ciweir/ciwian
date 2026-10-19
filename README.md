# Matchless · 火柴无双

A Chinese ink-wash stickman action roguelite built with Vite, TypeScript and Canvas 2D. The production build is a single offline HTML file.

**Play (GitHub Pages):** https://ciweir.github.io/ciwian/ — available after the Pages workflow finishes.
**Source:** https://github.com/ciweir/ciwian

## Highlights

- Five weapons — fists, spear, dual blades, hammer and bow — each with 3-hit combos, charged heavies, Musou and an evolution.
- Endless waves, rotating bosses, a daily challenge with a rotating modifier, and a 5-boss Rush mode.
- Meta upgrades, career stats, 13 achievements, local records and a 900×1200 share card.
- 2D skeletal player/enemies/bosses, ink-wash UI, a bamboo-night scene and data-driven weapon poses.
- Keyboard and touch controls, forced portrait/landscape support, and a single-file offline build.

## Controls

WASD/Arrows move · J attack · hold K for heavy · L Musou · Space dash · Esc/P pause.
Touch: joystick + buttons; double-tap empty space to dash.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
npm run check
npm run build
```

The build output is `dist/index.html`.

## Deploy

Push to `main`; the included GitHub Actions workflow builds and deploys `dist` to GitHub Pages.
Set **Settings → Pages → Source** to **GitHub Actions**.

## Cloud

Daily leaderboard and cloud saves use CloudBase. They currently fail with `403 EXCEED_AUTHORITY`; single-player works fully offline. See the Chinese sections below for details.

> 中文详细说明见下方。

---
# 火柴无双 · Matchless

一款国风水墨风格的火柴人格斗 roguelite。基于 Vite + TypeScript + Canvas 2D，构建产物是单个 HTML，可离线双击游玩。

在线试玩：https://ciweir.github.io/ciwian/ （GitHub Pages 部署完成后生效）

## 项目状态

- 单机玩法完整：普通模式、每日挑战、群雄轮战。
- 已完成 2D 骨骼升级：玩家、追击者/投掷者/精英、四种 Boss 都有独立骨骼剪影。
- 五把武器的普攻三段、重击、蓄力姿态已数据化，改动作只需改内容表。
- 已加入夜雨竹林场景层、Boss 前摇/符阵/冲撞预警、每日词条。
- 云函数当前返回 `403 EXCEED_AUTHORITY`，每日天梯与云存档暂不可用；单机玩法不受影响。
- 项目仍在持续打磨，后续会补破庙/雪岭场景、更多武器细节与真机性能验收。

## 核心特性

- 五种武器：拳脚、长枪、双刀、重锤、弓。
- 三段普攻、蓄力重击、无双、超武进化。
- 无限世界、波次刷怪、精英、Boss、宝箱、武器掉落。
- 每日挑战、每日词条、群雄轮战。
- 局外金币强化、武林录、生涯统计、13 项成就。
- 国风水墨 UI、夜雨竹林场景、2D 骨骼角色与 Boss。
- 键盘与触屏操作，支持强制横屏/竖屏。
- 单文件交付，无外部美术/音频资源。

## 玩法结构

### 普通模式

- 无限世界，30 秒一波。
- 每波敌人数量约为 `5 + 波次 × 2`，同屏上限 60。
- 每 5 波出现 Boss：第 5/10/15 波轮换，第 20 波为最终霸主。
- 击杀最终霸主即通关，之后进入结算。

### 每日挑战

- 每天使用日期种子 `YYYYMMDD` 生成世界。
- 刷怪位置、敌人类型、宝箱与技能选项按种子确定。
- 战斗暴击等随机数仍不完全确定，属于“同布局、不同操作结果”。
- 每日成绩可提交到 CloudBase 天梯（当前云端 403 待修）。
- 每日模式会从 5 个词条中轮换 1 个，只作用于当日。

### 群雄轮战

- 5 连 Boss：裂地者 → 咒雨术士 → 双子煞星 → 裂地者 → 武林霸主。
- 每个 Boss 之间休息 4 秒，回复 30% 最大气血。
- 击败霸主通关，奖励 +300 金币，并记录最速通关时间。

## 武器

| 武器 | 特点 | 超武 |
|---|---|---|
| 拳脚 | 均衡、三段快打、近身压制 | 崩拳：三段释放冲击波 |
| 长枪 | 判定距离长、扇形窄 | 龙卷枪：距离 +50、扇形加倍 |
| 双刀 | 攻速快、单发低 | 瞬狱双牙：攻速 +33%、暴击 +15% |
| 重锤 | 大开大合、高击飞 | 陨星锤：重击引发延迟爆炸 |
| 弓 | 远程自动索敌 | 连珠：多射一矢、全部贯穿 |

- 武器等级 1–5，每级伤害 +15%、范围 +8。
- 超武进化条件：武器 Lv5 + 拥有指定被动技能。
- 精英 25% 掉落武器，Boss 必掉（不掉当前武器）。
- 选器页的武器选择会持久化到 `matchless_weapon`。

## 操作

| 操作 | 键盘 | 触屏 |
|---|---|---|
| 移动 | WASD / 方向键 | 左下摇杆 |
| 普攻 | J | 「攻」 |
| 重击 | 按住 K 蓄力，松开释放 | 按住「重」 |
| 无双 | L | 「无双」 |
| 冲刺 | 空格 | 空白处双击 |
| 暂停 | Esc / P | 暂停按钮 |

- 冲刺自带 0.2 秒位移与短暂无敌。
- 重击蓄力满 0.5 秒后释放。
- 无双满槽释放：当前视野 AOE、2 秒慢动作、回复 40% 最大气血。

## 战斗与成长

- 伤害：`(攻击 × 技能系数 - 敌人防御) × 暴击倍率 × 连击加成`。
- 暴击率：基础 15% + 每级 2% + 技能/超武加成。
- 暴击倍率：2.5。
- 连击：每 5 连击 +10% 伤害，上限 +100%。
- 无双：命中 +2、击杀 +8，上限 100。
- 经验：升级自动成长，并触发技能三选一。
- 技能池：攻击、生命、暴击、移速、无双获取、连击窗口、重击范围、吸血、磁力。
- 升级三选一包含武器强化、超武进化与被动技能；多级连升会连续选择。

## 每日词条

| 词条 | 效果 |
|---|---|
| 疾风 | 敌人移速 +15% |
| 群狼 | 精英出现率翻倍 |
| 狂潮 | 每波敌人 +20% |
| 铁壁 | 敌人防御 +2 |
| 血战 | 气血上限 -20%，攻击 +10% |

- 按每日种子轮换 1 个，只作用于每日模式。
- 择器页、HUD、暂停、结算与分享卡都会显示词条。

## 敌人与 Boss

| 单位 | 特点 |
|---|---|
| 追击者 | 基础近战，斗笠与爪 |
| 投掷者 | 远程石块，兜帽与投掷预备 |
| 精英 | 更大体型、护甲、角，死亡爆炸 |
| 裂地者 | 冲撞、召唤、巨拳与骨角 |
| 咒雨术士 | 环形弹幕、狂暴定向三连、浮空法袍与法球 |
| 双子煞星 | 双子镜像、双刃与面具，一方死亡后另一方暴走 |
| 武林霸主 | 冲撞、弹幕、召唤、披风冠冕巨刃，最终 Boss |

- Boss 半血进入狂暴：提速、加伤、技能冷却缩短。
- 地面预警包含预警环、冲撞方向虚线/箭头、裂地者裂纹、冲撞拖尘与符阵。

## 局外成长与记录

- 金币结算：击杀 ×1 + 波次 ×10 + Boss ×50。
- 强化项目：攻击、生命、移速、磁力、战意、复活。
- 记录：生涯统计、成就图鉴、历史最佳、每日最佳、群雄轮战最速。
- 云存档：8 位存档码，支持复制、上传、恢复；未接入云端时自动降级。
- 分享卡：结算面板生成 900×1200 PNG，优先调用系统分享，否则下载。

## 画面与表现升级

- 玩家 2D 骨骼模型：关节、武器挂点、飘带、武器拖尾、冲刺墨影。
- 敌人骨骼模型：斗笠追击者、兜帽投掷者、角盔精英。
- Boss 骨骼模型：四种独立剪影与狂暴外观。
- 竹林夜雨场景：竹影、暖光、雨线、萤火、飘叶。
- 武器姿态数据化：五把武器的普攻三段、重击、蓄力由内容表驱动。
- Boss FX 数据化：预警环、方向楔、裂纹、冲撞拖尘、符阵按 Boss 类型配置。
- 性能策略：远处敌人 LOD、低配模式、对象池、屏外降频、动态画质。

## 技术栈

- Vite 5 + TypeScript 5
- Canvas 2D
- WebAudio 程序化音效与 BGM
- vite-plugin-singlefile 单文件构建
- CloudBase 云函数（每日天梯、云存档）
- GitHub Actions + GitHub Pages 自动部署

## 目录结构

```text
src/
  main.ts            主循环与模块装配
  state.ts           全局状态与重置
  playerSys.ts       玩家动作、攻击、蓄力、无双、冲刺
  enemySys.ts        敌人 AI、波次、Boss Rush、出生队列
  combat.ts          伤害、连击、无双、经验、击杀结算
  worldSys.ts        石块/宝石/尸体/掉落/宝箱/计时器
  render.ts          渲染入口、HUD、雷达、Boss 血条
  model.ts           玩家 2D 骨骼模型与拖尾
  enemyModel.ts      小怪/精英骨骼模型
  bossModel.ts       四 Boss 骨骼与地面预警
  biome.ts           竹林夜雨场景层
  content/
    weaponPoses.ts   五武器姿态数据与采样器
    bossFx.ts        Boss 预警/符阵配色配置
  ui.ts              菜单、设置、武林录、天梯、结算
  leaderboard.ts     天梯与云函数调用
  savevault.ts       存档码与云存档
  share.ts           战绩分享卡
  orientation.ts     强制横/竖屏
  audio.ts / bgm.ts  WebAudio 音效与 BGM
  style.css          水墨 UI 样式
cloudfunctions/
  leaderboard/       CloudBase 云函数
.github/workflows/
  deploy.yml         GitHub Pages 自动部署
```

## 本地开发

需要 Node.js 20+。

```bash
npm install
npm run dev      # 开发服务器
npm run check    # TypeScript 检查
npm run build    # 构建到 dist/index.html
npm run preview  # 预览构建产物
```

构建完成后可以直接双击 `dist/index.html` 游玩。

## 部署到 GitHub Pages

仓库包含 `.github/workflows/deploy.yml`：

1. 推送到 `main`；
2. Actions 自动执行 `npm ci`、`npm run check`、`npm run build`；
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**；
4. 部署完成后访问 `https://ciweir.github.io/ciwian/`。

注意：Pages 的 Source 不要选 `main` 根目录，否则会托管源码入口而不是构建后的单文件。

## CloudBase 云端配置

- 客户端入口：`src/leaderboard.ts`。
- 云函数：`cloudfunctions/leaderboard`。
- 数据集合：`daily_leaderboard`、`save_vault`（源码当前配置）。
- 接口动作：`submit`、`top`、`save`、`load`。
- 需要：CloudBase 环境 ID、匿名登录、HTTP 网关、云函数调用权限与集合权限。
- 当前线上返回 `403 EXCEED_AUTHORITY`，天梯与云存档待修复；未接入时自动使用本地记录。

## 测试与验收

- `npm run check`：TypeScript 0 错误。
- `npm run build`：Vite 构建单文件。
- 浏览器验收：菜单、选器、普通/每日/轮战、结算、设置、分享卡、强制横竖屏。
- 性能参考：测试环境 60 骨骼敌人 p95 约 6.5ms（797×728）；真机性能仍需单独验收。
- 无自动化 E2E 测试，当前以类型检查、构建和浏览器实测为主。

## 路线图

- 继续细化 Boss 攻击动作与受击反馈。
- 增加破庙、雪岭场景。
- 补充武器受击/蓄力细节与更多武器姿态。
- 真机触屏、旋转与低端设备性能验收。
- 修复 CloudBase 403，恢复天梯与云存档。
- 评估 B 包内容：新武器、武器精通、图鉴、试炼场。

## 说明

- 项目保持单文件交付，无外部美术/音频资源；音效与 BGM 由 WebAudio 程序化生成。
- 字体使用系统楷体/宋体回退链，不依赖外部字体。
- 当前未指定开源许可证。
