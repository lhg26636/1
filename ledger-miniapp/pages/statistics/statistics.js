const storage = require('../../utils/storage')
const currencyUtil = require('../../utils/currency')

Page({
  data: {
    theme: wx.getStorageSync('theme') || 'light',
    year: 0, month: 0, isCurrentMonth: true,
    viewMode: 'category',
    showType: 'expense',
    // 月度总览
    totalIncome: '0.00', totalExpense: '0.00',
    totalBalance: '0.00', totalBalanceSign: '',
    // 分类排行
    expenseStats: [], incomeStats: [],
    maxExpense: 0, maxIncome: 0,
    // 每日趋势
    trendDays: [], trendMax: 0, trendAvg: '0', trendTotal: '0.00',
    // 钻取弹窗
    drillVisible: false, drillCategory: '', drillType: '',
    drillRecords: [], drillTotal: '0.00',
    displaySymbol: '¥', multiCurrency: false
  },

  onLoad() { this.setData({ theme: getApp().globalData.theme || 'light' }); this.goCurrent() },
  onShow() { this.setData({ theme: getApp().globalData.theme || 'light' }); this.calcAll() },

  goCurrent() {
    const n = new Date()
    this.setData({ year: n.getFullYear(), month: n.getMonth() + 1 })
    this.calcAll()
  },

  prevMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 1) { y--; m = 12 } else m--
    this.setData({ year: y, month: m }); this.calcAll()
  },
  nextMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 12) { y++; m = 1 } else m++
    this.setData({ year: y, month: m }); this.calcAll()
  },

  switchView(e) { this.setData({ viewMode: e.currentTarget.dataset.mode }); this.afterSwitch() },
  switchShow(e) { this.setData({ showType: e.currentTarget.dataset.type }); this.afterSwitch() },
  afterSwitch() {
    if (this.data.viewMode === 'trend') { this.calcTrend(); this.$t = setTimeout(() => this.darw(), 100) }
  },

  /** 获取当前显示参数 */
  getParams() {
    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)
    const toSymbol = cs.showSymbol !== false ? currencyUtil.getSymbol(toCode) : ''
    return { cs, toCode, toSymbol }
  },

  calcAll() {
    const n = new Date()
    const { year, month } = this.data
    const { cs, toSymbol } = this.getParams()
    this.setData({
      isCurrentMonth: year === n.getFullYear() && month === n.getMonth() + 1,
      displaySymbol: toSymbol,
      multiCurrency: cs.multiCurrency
    })
    this.calcOverview()
    this.doCalcStats()
    if (this.data.viewMode === 'trend') { this.calcTrend(); this.$t = setTimeout(() => this.darw(), 100) }
  },

  /** 月度总收支 */
  calcOverview() {
    const { year, month } = this.data
    const list = storage.getByMonth(year, month)
    const { toCode } = this.getParams()
    let inc = 0, exp = 0
    list.forEach(r => {
      const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
      if (r.type === 'income') inc += v; else exp += v
    })
    const bal = inc - exp
    this.setData({
      totalIncome: inc.toFixed(2),
      totalExpense: exp.toFixed(2),
      totalBalance: Math.abs(bal).toFixed(2),
      totalBalanceSign: bal >= 0 ? '+' : '-'
    })
  },

  doCalcStats() {
    const { year, month } = this.data
    const list = storage.getByMonth(year, month)
    const app = getApp()
    const icons = app.globalData.categoryIcons
    const { toCode } = this.getParams()

    const em = {}, im = {}
    list.forEach(r => {
      const map = r.type === 'expense' ? em : im
      if (!map[r.category]) map[r.category] = { total: 0, icon: icons[r.category] || '📌' }
      map[r.category].total += currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
    })

    const te = Object.values(em).reduce((a, b) => a + b.total, 0)
    const ti = Object.values(im).reduce((a, b) => a + b.total, 0)
    const toArr = (map, tot) => Object.entries(map)
      .map(([c, v]) => ({
        category: c, icon: v.icon,
        amount: v.total.toFixed(2),
        percent: tot ? Math.round(v.total / tot * 100) : 0
      }))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))

    this.setData({
      expenseStats: toArr(em, te), incomeStats: toArr(im, ti),
      maxExpense: Math.max(...Object.values(em).map(v => v.total), 1),
      maxIncome: Math.max(...Object.values(im).map(v => v.total), 1)
    })
  },

  calcTrend() {
    const { year, month, showType } = this.data
    const list = storage.getByMonth(year, month)
    const dim = new Date(year, month, 0).getDate()
    const dm = {}
    for (let d = 1; d <= dim; d++) dm[d] = { day: d, amount: 0 }
    const { toCode } = this.getParams()

    list.filter(r => r.type === showType).forEach(r => {
      const d = parseInt(r.date.slice(-2))
      dm[d].amount += currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
    })

    const arr = Object.values(dm)
    const max = Math.max(...arr.map(d => d.amount), 1)
    const tot = arr.reduce((a, b) => a + b.amount, 0)
    this.setData({
      trendDays: arr, trendMax: max,
      trendAvg: (arr.length ? tot / arr.length : 0).toFixed(2),
      trendTotal: tot.toFixed(2)
    })
  },

  darw() {
    const q = wx.createSelectorQuery()
    q.select('#trendCanvas').boundingClientRect()
    q.exec(res => { if (res && res[0] && res[0].width > 0) this.draw(res[0].width) })
  },

  draw(W) {
    const { trendDays, trendMax, showType } = this.data
    if (!trendDays.length) return
    const ctx = wx.createCanvasContext('trendCanvas', this)
    const H = 360 * (W / 690)
    const pl = 48, pr = 14, pt = 18, pb = 42
    const cw = W - pl - pr, ch = H - pt - pb
    const barW = Math.max(3, cw / trendDays.length * 0.65)
    const gap = cw / trendDays.length
    const main = showType === 'expense' ? '#C62828' : '#2E7D32'
    const lite = showType === 'expense' ? '#FFCDD2' : '#C8E6C9'

    ctx.clearRect(0, 0, W, H)
    ctx.setStrokeStyle('#eee'); ctx.setLineWidth(0.5)
    for (let i = 0; i <= 4; i++) {
      const y = pt + ch * i / 4
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(W - pr, y); ctx.stroke()
    }
    ctx.setFillStyle('#999'); ctx.setFontSize(10); ctx.setTextAlign('right')
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(String(Math.round(trendMax * (4 - i) / 4)), pl - 6, pt + ch * i / 4 + 3)
    }

    trendDays.forEach((d, i) => {
      const h = trendMax > 0 ? (d.amount / trendMax) * ch : 0
      const x = pl + gap * i + (gap - barW) / 2
      const y = pt + ch - Math.max(h, 0.5)
      const g = ctx.createLinearGradient(x, y, x, pt + ch)
      g.addColorStop(0, main); g.addColorStop(1, lite)
      ctx.setFillStyle(g)
      ctx.fillRect(x, y, barW, Math.max(h, 0.5))
      if (d.amount > 0 && trendDays.filter(t => t.amount > 0).length <= 8) {
        ctx.setFillStyle('#333'); ctx.setFontSize(9); ctx.setTextAlign('center')
        ctx.fillText(String(Math.round(d.amount * 100) / 100), x + barW / 2, y - 3)
      }
    })

    ctx.setFillStyle('#999'); ctx.setFontSize(10); ctx.setTextAlign('center')
    const step = Math.ceil(trendDays.length / 12)
    trendDays.forEach((d, i) => {
      if (i % step === 0 || i === trendDays.length - 1) ctx.fillText(String(d.day), pl + gap * i + gap / 2, pt + ch + 16)
    })
    ctx.draw()
  },

  drillDown(e) {
    const { category, type } = e.currentTarget.dataset
    const { year, month } = this.data
    const list = storage.getByMonth(year, month)
    const app = getApp()
    const icons = app.globalData.categoryIcons
    const { cs, toCode, toSymbol } = this.getParams()

    const filtered = list
      .filter(r => r.type === type && r.category === category)
      .map(r => {
        // 单条记录：始终原始金额 + 原始币种
        const d = currencyUtil.recordDisplay(r, cs)
        return {
          ...r,
          icon: icons[r.category] || '📌',
          amountFmt: d.amountFmt,
          currencySymbol: d.currencySymbol
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    // 钻取总额：换算到显示币种
    const total = filtered.reduce((s, r) => s + currencyUtil.convert(r.amount, r.currency || 'CNY', toCode), 0)
    this.setData({
      drillVisible: true,
      drillCategory: category, drillType: type,
      drillRecords: filtered,
      drillTotal: total.toFixed(2)
    })
  },

  closeDrill() { this.setData({ drillVisible: false }) },
  stopProp() {},
  onUnload() { if (this.$t) clearTimeout(this.$t) }
})
