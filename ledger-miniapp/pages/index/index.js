const storage = require('../../utils/storage')
const alert = require('../../utils/alert')
const currencyUtil = require('../../utils/currency')

const WDAY = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    year: 0, month: 0,
    income: '0.00', expense: '0.00', balance: '0.00',
    balanceSign: '', balanceClass: 'income-text', isCurrentMonth: true,
    groupedRecords: [],
    alertInfo: null, showAlert: false,
    activePlans: [], totalSaved: '0.00', totalTarget: '0.00', overallPercent: 0,
    displaySymbol: '¥',
    // 主题
    theme: wx.getStorageSync('theme') || 'light',
    // 账本
    ledgerName: '日常账本', ledgerIcon: '📋', activeLedgerId: '',
    allLedgers: [], ledgerVisible: false,
    // 搜索
    showSearch: false, searchQuery: '', allRecords: [],
    // 搜索过滤
    showFilter: false, filterCategoryList: ['全部'], filterCategoryIdx: 0,
    filterAmountMin: '', filterAmountMax: '',
    // 编辑弹窗
    editVisible: false, editId: '', editType: 'expense',
    editAmount: '', editCategoryIdx: 0, editCategories: [], editCategoryName: '',
    editDate: '', editNote: '', editSymbol: '¥',
    editRecordIndex: -1, editDayIndex: -1,
    // 多选
    selectMode: false, selectedIds: [],
    // 日历弹窗
    calVisible: false, calYear: 0, calMonth: 0, calWeeks: [],
    calSelectedDate: '', calDayRecords: [],
    // 回到顶部
    showBackTop: false
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.goCurrent()
  },
  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.refresh(); this.loadPlans(); this.loadLedger()
  },
  onPullDownRefresh() { this.refresh(); this.loadPlans(); wx.stopPullDownRefresh() },

  onPageScroll(e) {
    const show = e.scrollTop > 300
    if (show !== this.data.showBackTop) {
      this.setData({ showBackTop: show })
    }
  },
  scrollToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  loadLedger() {
    const ledgers = storage.getLedgers()
    const activeId = storage.getActiveId()
    const cur = ledgers.find(l => l.id === activeId) || ledgers[0] || { name: '日常账本', icon: '📋' }
    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)
    const enriched = ledgers.map(l => {
      const records = storage.getAllRecords(l.id)
      let inc = 0, exp = 0
      records.forEach(r => {
        const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
        if (r.type === 'income') inc += v; else exp += v
      })
      return { ...l, income: inc.toFixed(2), expense: exp.toFixed(2), net: (inc - exp).toFixed(2) }
    })
    this.setData({ ledgerName: cur.name, ledgerIcon: cur.icon, activeLedgerId: activeId, allLedgers: enriched })
  },

  goLedgerSwitch() {
    const ledgers = storage.getLedgers()
    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)
    const enriched = ledgers.map(l => {
      const records = storage.getAllRecords(l.id)
      let inc = 0, exp = 0
      records.forEach(r => {
        const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
        if (r.type === 'income') inc += v; else exp += v
      })
      return { ...l, income: inc.toFixed(2), expense: exp.toFixed(2), net: (inc - exp).toFixed(2) }
    })
    this.setData({ ledgerVisible: true, allLedgers: enriched })
  },
  closeLedger() { this.setData({ ledgerVisible: false }) },
  switchLedger(e) {
    const id = e.currentTarget.dataset.id
    storage.switchLedger(id)
    getApp().globalData.activeLedgerId = id
    this.setData({ ledgerVisible: false })
    this.loadLedger()
    this.refresh()
    this.loadPlans()
  },
  goTrash() {
    this.setData({ ledgerVisible: false })
    wx.navigateTo({ url: '/pages/settings/settings?tab=trash' })
  },
  goLedgerManage() {
    this.setData({ ledgerVisible: false })
    getApp().globalData.settingsTab = 'ledger'
    wx.switchTab({ url: '/pages/settings/settings' })
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/calendar/calendar' })
  },

  // ===== 日历弹窗 =====
  openCalendar() {
    const n = new Date()
    this.setData({ calYear: n.getFullYear(), calMonth: n.getMonth() + 1, calVisible: true, calSelectedDate: '', calDayRecords: [] })
    this.buildCalendar()
  },
  closeCalendar() { this.setData({ calVisible: false }) },
  calPrevMonth() {
    let y = this.data.calYear, m = this.data.calMonth
    if (m === 1) { y--; m = 12 } else m--
    this.setData({ calYear: y, calMonth: m, calSelectedDate: '', calDayRecords: [] })
    this.buildCalendar()
  },
  calNextMonth() {
    let y = this.data.calYear, m = this.data.calMonth
    if (m === 12) { y++; m = 1 } else m++
    this.setData({ calYear: y, calMonth: m, calSelectedDate: '', calDayRecords: [] })
    this.buildCalendar()
  },
  calGoToday() {
    const n = new Date()
    this.setData({ calYear: n.getFullYear(), calMonth: n.getMonth() + 1, calSelectedDate: '', calDayRecords: [] })
    this.buildCalendar()
  },
  buildCalendar() {
    const { calYear: year, calMonth: month } = this.data
    const list = storage.getByMonth(year, month)
    const dailyMap = {}
    list.forEach(r => {
      const d = parseInt(r.date.slice(-2))
      if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 }
      if (r.type === 'income') dailyMap[d].income += r.amount
      else dailyMap[d].expense += r.amount
    })
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const firstDay = new Date(year, month-1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysInPrev = new Date(year, month-1, 0).getDate()
    const weeks = []
    let week = []
    for (let i = firstDay-1; i >= 0; i--) {
      week.push({ day: daysInPrev - i, income: 0, expense: 0, total: '0', totalSign: '', totalClass: '', hasData: false, isOtherMonth: true, isToday: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const data = dailyMap[d] || { income: 0, expense: 0 }
      const net = data.income - data.expense
      const hasData = data.income > 0 || data.expense > 0
      week.push({ day: d, income: data.income, expense: data.expense, total: Math.abs(net).toFixed(0), totalSign: net >= 0 ? '+' : '-', totalClass: net >= 0 ? 'cmd-inc' : 'cmd-exp', hasData, isOtherMonth: false, isToday: ds === todayStr, dateStr: ds })
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    if (week.length > 0) {
      for (let d = 1; week.length < 7; d++) {
        week.push({ day: d, income: 0, expense: 0, total: '0', totalSign: '', totalClass: '', hasData: false, isOtherMonth: true, isToday: false })
      }
      weeks.push(week)
    }
    this.setData({ calWeeks: weeks })
  },
  calTapDay(e) {
    const { day, datestr } = e.currentTarget.dataset
    if (!datestr) return
    const icons = getApp().globalData.categoryIcons
    const cs = currencyUtil.getSettings()
    const list = storage.getByMonth(this.data.calYear, this.data.calMonth).filter(r => r.date === datestr)
    const records = list.map(r => {
      const disp = currencyUtil.recordDisplay(r, cs)
      return { ...r, icon: icons[r.category] || '📌', amountFmt: disp.amountFmt, isIncome: r.type === 'income', currencySymbol: disp.currencySymbol }
    }).sort((a, b) => b.createTime - a.createTime)
    this.setData({ calSelectedDate: datestr, calDayRecords: records })
  },

  goCurrent() {
    const n = new Date()
    this.setData({ year: n.getFullYear(), month: n.getMonth() + 1 })
    this.refresh(); this.loadPlans()
  },

  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }) },

  loadPlans() {
    const all = storage.getSavingPlans()
    const now = new Date()
    const plans = all.map(p => {
      if (p.methodId !== 'flexible') {
        const startD = new Date(p.startDate)
        let cp = 0, ca = 0
        const tp = p.periods || (p.methodId==='365'?365:p.methodId==='52week'||p.methodId==='52week-reverse'?52:p.methodId==='12deposit'?12:36)
        if (tp > 0) {
          if (p.methodId === '365') cp = Math.min(tp, Math.max(0, Math.floor((now-startD)/(86400000)) + 1))
          else if (p.methodId === '52week' || p.methodId === '52week-reverse') cp = Math.min(tp, Math.max(0, Math.floor((now-startD)/(604800000)) + 1))
          else { const fd = p.frequency==='每天'?1:p.frequency==='每周'?7:30; cp = Math.min(tp, Math.max(0, Math.floor((now-startD)/(86400000*fd)) + 1)) }
          if (p.methodId === '365' || p.methodId === '52week') for (let i=0;i<cp;i++) ca += p.startAmount + p.increment*i
          else if (p.methodId === '52week-reverse') for (let i=0;i<cp;i++) ca += Math.max(0, p.startAmount - p.decrement*i)
          else ca = cp * p.amount
        }
        p.saved = ca; p.currentPeriod = cp
      }
      const pct = p.total > 0 ? Math.min(100, Math.round(p.saved/p.total*100)) : 0
      return { ...p, savedDisp: p.saved.toFixed(2), totalDisp: p.total.toFixed(2), percent: pct }
    })
    const ts = plans.reduce((s,p) => s + parseFloat(p.savedDisp||0), 0)
    const tt = plans.reduce((s,p) => s + parseFloat(p.totalDisp||0), 0)
    this.setData({
      activePlans: plans, totalSaved: ts.toFixed(2),
      totalTarget: tt.toFixed(2), overallPercent: tt>0?Math.min(100,Math.round(ts/tt*100)):0
    })
  },

  refresh() {
    const { year, month, searchQuery } = this.data
    const n = new Date()
    this.setData({ isCurrentMonth: year === n.getFullYear() && month === n.getMonth() + 1 })

    const cs = currencyUtil.getSettings()
    const toCode = currencyUtil.getTotalCurrency(cs)
    const toSymbol = cs.showSymbol !== false ? currencyUtil.getSymbol(toCode) : ''

    // 搜索模式：按搜索词或全部；非搜索模式：按月
    let list
    const { showSearch, filterCategoryIdx, filterCategoryList, filterAmountMin, filterAmountMax } = this.data
    if (showSearch) {
      list = searchQuery ? storage.search(searchQuery) : storage.getAll()
      // 应用分类和金额过滤
      if (filterCategoryIdx > 0) {
        const cat = filterCategoryList[filterCategoryIdx]
        list = list.filter(r => r.category === cat)
      }
      if (filterAmountMin) {
        const min = parseFloat(filterAmountMin)
        if (!isNaN(min)) list = list.filter(r => r.amount >= min)
      }
      if (filterAmountMax) {
        const max = parseFloat(filterAmountMax)
        if (!isNaN(max)) list = list.filter(r => r.amount <= max)
      }
    } else {
      list = storage.getByMonth(year, month)
    }
    this.setData({ allRecords: showSearch ? list : [] })

    let totalIncome = 0, totalExpense = 0
    list.forEach(r => {
      const v = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
      if (r.type === 'income') totalIncome += v; else totalExpense += v
    })
    const ban = totalIncome - totalExpense

    this.setData({
      income: totalIncome.toFixed(2),
      expense: totalExpense.toFixed(2),
      balance: Math.abs(ban).toFixed(2),
      balanceSign: ban >= 0 ? '+' : '-',
      balanceClass: ban >= 0 ? 'income-text' : 'expense-text',
      groupedRecords: this.buildGroups(list, year, month, cs, toCode, toSymbol, showSearch),
      displaySymbol: toSymbol
    })

    this.setData({ showAlert: false, alertInfo: null })
    if (!showSearch && totalExpense > 0 && month === n.getMonth()+1 && year === n.getFullYear()) {
      const a = alert.shouldShow(totalExpense)
      if (a) this.setData({ alertInfo: a, showAlert: true })
    }
  },

  buildGroups(list, y, m, cs, toCode, toSymbol, isSearch) {
    const app = getApp()
    const icons = app.globalData.categoryIcons
    const map = {}

    list.forEach(r => {
      const d = r.date ? parseInt(r.date.slice(-2)) : 0
      const key = isSearch ? (r.date || '未知') : String(d)
      if (!map[key]) {
        const dt = r.date ? new Date(r.date) : new Date()
        map[key] = { day: isSearch ? (r.date || '未知') : d, weekday: isSearch ? '' : WDAY[dt.getDay()], income: 0, expense: 0, items: [] }
      }
      const dayAmt = currencyUtil.convert(r.amount, r.currency || 'CNY', toCode)
      if (r.type === 'income') map[key].income += dayAmt; else map[key].expense += dayAmt
      const net = map[key].income - map[key].expense
      map[key].net = Math.abs(net).toFixed(2)
      map[key].netSign = net >= 0 ? '+' : '-'
      map[key].netClass = net >= 0 ? 'income-text' : 'expense-text'
      map[key].incomeFmt = map[key].income.toFixed(2)
      map[key].expenseFmt = map[key].expense.toFixed(2)
      const disp = currencyUtil.recordDisplay(r, cs)
      map[key].items.push({
        ...r,
        icon: icons[r.category] || '📌',
        amountFmt: disp.amountFmt,
        isIncome: r.type === 'income',
        currencySymbol: disp.currencySymbol
      })
    })
    const values = Object.values(map)
    return isSearch ? values : values.sort((a, b) => b.day - a.day)
  },

  // ===== 搜索 =====
  toggleSearch() {
    const show = !this.data.showSearch
    if (show) {
      const app = getApp()
      const cats = ['全部', ...app.globalData.categories.expense, ...app.globalData.categories.income]
      this.setData({ showSearch: true, showFilter: false, filterCategoryIdx: 0, filterAmountMin: '', filterAmountMax: '', filterCategoryList: cats })
    } else {
      this.setData({ showSearch: false, searchQuery: '', showFilter: false, filterCategoryIdx: 0, filterAmountMin: '', filterAmountMax: '' })
      this.refresh()
    }
  },
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
    // 防抖：300ms 后执行搜索
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => { this.refresh() }, 300)
  },
  onSearchConfirm(e) {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchQuery: e.detail.value })
    this.refresh()
  },
  clearSearch() {
    this.setData({ searchQuery: '' })
    this.refresh()
  },

  // ===== 搜索过滤 =====
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },
  onFilterCategory(e) {
    this.setData({ filterCategoryIdx: parseInt(e.detail.value) })
    this.refresh()
  },
  onFilterAmountMin(e) {
    this.setData({ filterAmountMin: e.detail.value })
    this.refresh()
  },
  onFilterAmountMax(e) {
    this.setData({ filterAmountMax: e.detail.value })
    this.refresh()
  },
  resetFilter() {
    this.setData({ filterCategoryIdx: 0, filterAmountMin: '', filterAmountMax: '' })
    this.refresh()
  },

  // ===== 多选模式 =====
  enterSelectMode(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectMode: true, selectedIds: [id] })
  },
  exitSelectMode() { this.setData({ selectMode: false, selectedIds: [] }) },
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    const selected = this.data.selectedIds
    const idx = selected.indexOf(id)
    if (idx >= 0) {
      selected.splice(idx, 1)
      if (selected.length === 0) { this.setData({ selectMode: false, selectedIds: [] }); return }
    } else {
      selected.push(id)
    }
    this.setData({ selectedIds: [...selected] })
  },
  batchDelete() {
    const { selectedIds } = this.data
    if (selectedIds.length === 0) return
    wx.showModal({ title: '确认删除', content: `删除选中的 ${selectedIds.length} 条记录？` }).then(res => {
      if (res.confirm) {
        selectedIds.forEach(id => storage.remove(id))
        this.setData({ selectMode: false, selectedIds: [] })
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },
  batchReimburse() {
    const { selectedIds } = this.data
    if (selectedIds.length === 0) return
    wx.showModal({ title: '标记报销', content: `将选中的 ${selectedIds.length} 条记录标记为已报销？` }).then(res => {
      if (res.confirm) {
        selectedIds.forEach(id => storage.update(id, { reimbursed: true }))
        this.setData({ selectMode: false, selectedIds: [] })
        this.refresh()
        wx.showToast({ title: '已标记报销', icon: 'success' })
      }
    })
  },

  // ===== 编辑弹窗 =====
  editRecord(e) {
    const id = e.currentTarget.dataset.id
    const record = storage.getAll().find(r => r.id === id)
    if (!record) return

    const app = getApp()
    const cats = app.globalData.categories
    const catList = record.type === 'expense' ? cats.expense : cats.income
    const catIdx = Math.max(0, catList.indexOf(record.category))
    const cs = currencyUtil.getSettings()
    const sym = cs.showSymbol !== false ? currencyUtil.getSymbol(record.currency || 'CNY') : ''

    this.setData({
      editVisible: true, editId: id, editType: record.type,
      editAmount: String(record.amount), editCategoryIdx: catIdx,
      editCategories: catList, editCategoryName: catList[catIdx] || '',
      editDate: record.date, editNote: record.note || '', editSymbol: sym,
      editRecordIndex: e.currentTarget.dataset.idx, editDayIndex: e.currentTarget.dataset.dayidx
    })
  },

  closeEdit() { this.setData({ editVisible: false }) },

  switchEditType(e) {
    const t = e.currentTarget.dataset.type
    const app = getApp()
    const cats = app.globalData.categories
    this.setData({ editType: t, editCategories: cats[t], editCategoryIdx: 0, editCategoryName: cats[t][0] })
  },

  onEditAmount(e) { this.setData({ editAmount: e.detail.value }) },
  onEditCategory(e) {
    const idx = e.detail.value
    this.setData({ editCategoryIdx: idx, editCategoryName: this.data.editCategories[idx] })
  },
  onEditDate(e) { this.setData({ editDate: e.detail.value }) },
  onEditNote(e) { this.setData({ editNote: e.detail.value }) },

  saveEdit() {
    const { editId, editType, editAmount, editCategoryIdx, editCategories, editDate, editNote } = this.data
    const val = parseFloat(editAmount)
    if (!editAmount || isNaN(val) || val <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' }); return
    }
    if (val > 99999999) { wx.showToast({ title: '金额过大', icon: 'none' }); return }

    const updated = storage.update(editId, {
      type: editType, amount: Math.round(val * 100) / 100,
      category: editCategories[editCategoryIdx], date: editDate, note: editNote.trim()
    })
    if (!updated) { wx.showToast({ title: '记录不存在', icon: 'none' }); return }

    this.setData({ editVisible: false })
    this.refresh()
    wx.showToast({ title: '已修改', icon: 'success' })
  },

  deleteFromEdit() {
    wx.showModal({ title: '确认删除', content: '删除后无法恢复' }).then(res => {
      if (res.confirm) {
        storage.remove(this.data.editId)
        this.setData({ editVisible: false })
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  // ===== 主题切换回调 =====
  onThemeChange(theme) {
    this.setData({ theme })
    this.refresh()
  },

  dismissAlert(e) {
    if (e.currentTarget.dataset.mode === 'month') alert.dismissMonth()
    else alert.dismissSession()
    this.setData({ showAlert: false })
  },

  prevMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 1) { y--; m = 12 } else m--
    this.setData({ year: y, month: m, searchQuery: '', showSearch: false }); this.refresh()
  },
  nextMonth() {
    let y = this.data.year, m = this.data.month
    if (m === 12) { y++; m = 1 } else m++
    this.setData({ year: y, month: m, searchQuery: '', showSearch: false }); this.refresh()
  }
})
