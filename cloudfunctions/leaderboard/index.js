// 云端后端：每日天梯 + 云存档
// action=submit: 提交成绩（同 seed+pid 保留最佳）
// action=top:    查询当日 Top 20
// action=save:   按存档码上传本机档案
// action=load:   按存档码拉取云端档案
const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()

function sanitizeName(n) {
  return String(n || '无名侠客').replace(/[<>&"']/g, '').trim().slice(0, 12) || '无名侠客'
}

exports.main = async (event) => {
  const lbc = db.collection('daily_leaderboard')
  // 部署前先确认线上集合：历史数据若在 matchless_saves，先迁移或把这里改成 matchless_saves
  const vault = db.collection('save_vault')
  const action = event.action

  // ---- 天梯 ----
  if (action === 'submit') {
    const seed = Number(event.seed) | 0
    const pid = String(event.pid || '').slice(0, 32)
    const wave = Math.max(0, Number(event.wave) | 0)
    const kills = Math.max(0, Number(event.kills) | 0)
    const time = Math.max(0, Number(event.time) | 0)
    if (!seed || !pid || !wave) return { ok: false, msg: 'bad params' }
    // 粗粒度防作弊：数值上限
    if (wave > 999 || kills > 999999 || time > 86400) return { ok: false, msg: 'out of range' }
    const name = sanitizeName(event.name)

    const q = await lbc.where({ seed, pid }).limit(1).get()
    if (q.data.length) {
      const old = q.data[0]
      // 同波次、同击杀时用时短者更优
      const better = wave > old.wave || (wave === old.wave && kills > old.kills) ||
        (wave === old.wave && kills === old.kills && time < old.time)
      if (better) await lbc.doc(old._id).update({ name, wave, kills, time, ts: Date.now() })
    } else {
      await lbc.add({ seed, pid, name, wave, kills, time, ts: Date.now() })
    }
    return { ok: true }
  }

  if (action === 'top') {
    const seed = Number(event.seed) | 0
    if (!seed) return { ok: false, msg: 'bad params' }
    const r = await lbc.where({ seed })
      .orderBy('wave', 'desc').orderBy('kills', 'desc').orderBy('time', 'asc')
      .limit(20).get()
    return {
      ok: true,
      list: r.data.map(d => ({ name: d.name, wave: d.wave, kills: d.kills, time: d.time })),
    }
  }

  // ---- 云存档（存档码即唯一凭证）----
  if (action === 'save') {
    const code = String(event.code || '').toUpperCase().slice(0, 16)
    const save = String(event.save || '')
    const ts = Number(event.ts) | 0
    if (!/^[A-Z2-9]{8}$/.test(code)) return { ok: false, msg: 'bad code' }
    if (!ts || !save || save.length > 200 * 1024) return { ok: false, msg: 'bad save' }   // 200KB 上限
    // 同码并发首存可能撞出重复文档：保留最新一份并清理其余
    const q = await vault.where({ code }).limit(5).get()
    if (q.data.length) {
      q.data.sort((a, b) => (a.ts | 0) - (b.ts | 0))
      const keep = q.data[q.data.length - 1]
      await vault.doc(keep._id).update({ save, ts })
      for (let i = 0; i < q.data.length - 1; i++) await vault.doc(q.data[i]._id).remove()
    } else {
      await vault.add({ code, save, ts })
    }
    return { ok: true }
  }

  if (action === 'load') {
    const code = String(event.code || '').toUpperCase().slice(0, 16)
    if (!/^[A-Z2-9]{8}$/.test(code)) return { ok: false, msg: 'bad code' }
    const q = await vault.where({ code }).orderBy('ts', 'desc').limit(1).get()
    if (!q.data.length) return { ok: false, msg: 'not found' }
    return { ok: true, save: q.data[0].save, ts: q.data[0].ts | 0 }
  }

  return { ok: false, msg: 'unknown action' }
}
