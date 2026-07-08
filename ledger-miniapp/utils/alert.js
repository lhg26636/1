/**
 * 花费提醒 — 当月支出超过近6月均值20%时触发
 */
const storage = require('./storage')
const KEY = 'alertDismiss'

/** 计算近6月（不含当月）月均支出 */
function calcAvg() {
  const all = storage.getAll()
  const now = new Date()
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const map = {}
  all.forEach(r => {
    if (r.type !== 'expense') return
    const ym = r.date.slice(0, 7)
    if (ym === curYM) return
    map[ym] = (map[ym] || 0) + r.amount
  })

  const vals = Object.values(map).slice(-6)
  if (vals.length === 0) return { avg: 0, months: 0 }
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, months: vals.length }
}

/** 检查是否应触发提醒，返回 null 或 { current, avg, ratio, months } */
function check(currentExpense) {
  const { avg, months } = calcAvg()
  if (months === 0 || avg <= 0) return null
  const ratio = (currentExpense - avg) / avg
  if (ratio < 0.2) return null
  return {
    current: currentExpense,
    avg,
    percent: Math.round(ratio * 100),
    months
  }
}

/** 本月是否已永久关闭 */
function isMonthDismissed() {
  const d = wx.getStorageSync(KEY) || {}
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return d.monthDismissed === ym
}

/** 暂时关闭（仅当前会话） */
function dismissSession() {
  wx.setStorageSync(KEY, { ...wx.getStorageSync(KEY) || {}, sessionDismissed: true })
}

/** 本月不再提醒 */
function dismissMonth() {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  wx.setStorageSync(KEY, { monthDismissed: ym, sessionDismissed: true })
}

/** 是否可展示 */
function shouldShow(currentExpense) {
  const d = wx.getStorageSync(KEY) || {}
  if (d.sessionDismissed) return false
  if (isMonthDismissed()) return false
  return check(currentExpense)
}

module.exports = { check, isMonthDismissed, dismissSession, dismissMonth, shouldShow }