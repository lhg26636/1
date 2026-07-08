const storage = require('../../utils/storage')
const currencyUtil = require('../../utils/currency')

const WDAY = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    theme: wx.getStorageSync('theme') || 'light',
    year: 0, month: 0,
    weeks: [],           // [[{day,income,expense,isToday,isOtherMonth}]]
    displaySymbol: '¥',
    // 选中日期详情
    selectedDay: 0, selectedDate: '', dayRecords: [],
    dayIncome: '0.00', dayExpense: '0.00', showDayDetail: false
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    const n = new Date()
    this.setData({ year: n.getFullYear(), month: n.getMonth() + 1 })
    this.buildCalendar()
  },
  onShow() { this.buildCalendar() },

  prevMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 1) { y--; m = 12 } else m--
    this.setData({ year: y, month: m, showDayDetail: false }); this.buildCalendar()
  },
  nextMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 12) { y++; m = 1 } else m++
    this.setData({ year: y, month: m, showDayDetail: false }); this.buildCalendar()
  },

  buildCalendar() {
    const { year, month } = this.data
    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)
    const toSymbol = cs.showSymbol !== false ? currencyUtil.getSymbol(toCode) : ''
    this.setData({ displaySymbol: toSymbol })

    // 获取当月每日汇总
    const list = storage.getByMonth(year, month)
    const dailyMap = {}
    list.forEach(r => {
      const d = parseInt(r.date.slice(-2))
      if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 }
      const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
      if (r.type === 'income') dailyMap[d].income += v
      else dailyMap[d].expense += v
    })

    // 构建日历网格
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const firstDay = new Date(year, month-1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysInPrev = new Date(year, month-1, 0).getDate()

    const weeks = []
    let week = []
    // 填充上月末尾
    for (let i = firstDay-1; i >= 0; i--) {
      week.push({ day: daysInPrev - i, income: 0, expense: 0, total: '0', totalSign: '', totalClass: '', hasData: false, isOtherMonth: true, isToday: false })
    }
    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const data = dailyMap[d] || { income: 0, expense: 0 }
      const net = data.income - data.expense
      const hasData = data.income > 0 || data.expense > 0
      week.push({ day: d, income: data.income, expense: data.expense, total: Math.abs(net).toFixed(0), totalSign: net >= 0 ? '+' : '-', totalClass: net >= 0 ? 'cd-inc' : 'cd-exp', hasData, isOtherMonth: false, isToday: ds === todayStr, dateStr: ds })
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    // 填充下月开头
    if (week.length > 0) {
      for (let d = 1; week.length < 7; d++) {
        week.push({ day: d, income: 0, expense: 0, total: '0', totalSign: '', totalClass: '', hasData: false, isOtherMonth: true, isToday: false })
      }
      weeks.push(week)
    }

    this.setData({ weeks, showDayDetail: false })
  },

  tapDay(e) {
    const { day, datestr } = e.currentTarget.dataset
    if (!datestr) return
    const list = storage.getByMonth(this.data.year, this.data.month)
    const icons = getApp().globalData.categoryIcons
    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)

    const dayList = list.filter(r => r.date === datestr)
    let inc = 0, exp = 0
    const records = dayList.map(r => {
      const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
      if (r.type === 'income') inc += v; else exp += v
      const disp = currencyUtil.recordDisplay(r, cs)
      return {
        ...r,
        icon: icons[r.category] || '📌',
        amountFmt: disp.amountFmt,
        isIncome: r.type === 'income',
        currencySymbol: disp.currencySymbol
      }
    }).sort((a,b) => b.createTime - a.createTime)

    // 读取前后月份的记录
    const prevMonth = this.data.month === 1 ? 12 : this.data.month - 1
    const nextMonth = this.data.month === 12 ? 1 : this.data.month + 1
    const prevYear = this.data.month === 1 ? this.data.year - 1 : this.data.year
    const nextYear = this.data.month === 12 ? this.data.year + 1 : this.data.year
    const prevList = storage.getByMonth(prevYear, prevMonth).filter(r => r.date === datestr)
    const nextList = storage.getByMonth(nextYear, nextMonth).filter(r => r.date === datestr)
    // 如果有跨月数据也加入（datestr可能跨月）
    const allDayRecords = [...prevList, ...dayList, ...nextList]
    const unique = []
    const seen = new Set()
    allDayRecords.forEach(r => {
      if (!seen.has(r.id)) { seen.add(r.id); unique.push(r) }
    })

    const finalRecords = unique.map(r => {
      const disp = currencyUtil.recordDisplay(r, cs)
      return { ...r, icon: icons[r.category] || '📌', amountFmt: disp.amountFmt, isIncome: r.type === 'income', currencySymbol: disp.currencySymbol }
    }).sort((a,b) => b.createTime - a.createTime)

    this.setData({
      selectedDay: day, selectedDate: datestr,
      dayRecords: finalRecords, dayIncome: inc.toFixed(2), dayExpense: exp.toFixed(2),
      showDayDetail: true
    })
  },

  closeDetail() { this.setData({ showDayDetail: false }) }
})
