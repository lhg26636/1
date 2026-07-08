const app = getApp()
const account = require('../../utils/account')
const userUtil = require('../../utils/user')
const currencyUtil = require('../../utils/currency')
const storage = require('../../utils/storage')

const LEDGER_ICONS = ['📋', '✈️', '💒', '🔧', '🎓', '🏠', '🚗', '💊', '🎂', '📱']

Page({
  data: {
    incomeCategories: [], expenseCategories: [],
    showAdd: false, addingType: '', newCategory: '',
    avatarUrl: '', nickName: '',
    // 货币
    multiCurrency: false, showSymbol: true,
    defaultCurrencyIdx: 0, defaultCurrencySymbol: '¥',
    baseCurrencyIdx: 0, baseCurrencySymbol: '¥',
    currencyNames: [],
    // 换算器
    convFromIdx: 0, convToIdx: 1, convFrom: '', convTo: '',
    convAmount: '', convResult: '',
    // 账号
    activeAccount: null, accountList: [],
    // 账本
    ledgers: [], activeLedgerId: '', searchLedgerQuery: '', focusTab: '',
    showLedgerAdd: false, newLedgerName: '', newLedgerIcon: '📋',
    ledgerIcons: LEDGER_ICONS,
    // 主题
    theme: wx.getStorageSync('theme') || 'light',
    // 回收站
    trashItems: []
  },

  onLoad(options) {
    if (options && options.tab) {
      this.setData({ focusTab: options.tab })
      // 滚动到对应区域
      if (options.tab === 'ledger' || options.tab === 'trash') {
        setTimeout(() => {
          wx.pageScrollTo({ selector: '#ledger-section', duration: 300 })
        }, 300)
      }
    }
  },
  onShow() {
    this.loadAll()
    // 处理从首页跳转来的 focus
    const tab = getApp().globalData.settingsTab
    if (tab) {
      getApp().globalData.settingsTab = ''
      setTimeout(() => wx.pageScrollTo({ selector: '#ledger-section', duration: 300 }), 300)
    }
  },

  loadAll() {
    this.loadCats(); this.loadUser(); this.loadCurrency();
    // 回收站数据
    const trash = storage.getTrash()
    const icons = getApp().globalData.categoryIcons
    const trashItems = trash.map(r => ({
      ...r,
      icon: icons[r.category] || '📌',
      amountFmt: (r.amount || 0).toFixed(2),
      isIncome: r.type === 'income'
    }))
    this.setData({
      ledgers: storage.getLedgers(),
      activeLedgerId: storage.getActiveId(),
      theme: app.globalData.theme || 'light',
      trashItems,
      activeAccount: account.getActive(),
      accountList: account.getAll()
    })
  },

  // ===== 账号管理 =====
  goSwitchAccount() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  // ===== 账本搜索 =====
  onSearchLedger(e) {
    const q = e.detail.value
    const all = storage.getLedgers()
    this.setData({
      searchLedgerQuery: q,
      ledgers: q ? all.filter(l => l.name.includes(q)) : all
    })
  },

  restoreRecord(e) {
    const id = e.currentTarget.dataset.id
    storage.restoreFromTrash(id)
    this.loadAll()
    wx.showToast({ title: '已恢复', icon: 'success' })
  },
  permDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '彻底删除', content: '此操作不可恢复' }).then(res => {
      if (res.confirm) {
        storage.permanentlyDelete(id)
        this.loadAll()
        wx.showToast({ title: '已彻底删除', icon: 'success' })
      }
    })
  },
  emptyTrash() {
    wx.showModal({ title: '清空回收站', content: '将彻底删除回收站内所有记录' }).then(res => {
      if (res.confirm) {
        storage.emptyTrash()
        this.loadAll()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  },

  // ===== 账本 =====
  switchToLedger(e) {
    const id = e.currentTarget.dataset.id
    if (id === storage.getActiveId()) return
    storage.switchLedger(id)
    app.globalData.activeLedgerId = id
    this.loadAll()
    wx.showToast({ title: '账本已切换', icon: 'success' })
  },
  deleteLedgerItem(e) {
    const id = e.currentTarget.dataset.id
    const ledgers = storage.getLedgers()
    const l = ledgers.find(x => x.id === id)
    wx.showModal({ title: '删除账本', content: `确定删除「${l ? l.name : ''}」及其全部记录？不可恢复！` }).then(res => {
      if (res.confirm) {
        storage.deleteLedger(id)
        app.globalData.activeLedgerId = storage.getActiveId()
        this.loadAll()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },
  showAddLedger() { this.setData({ showLedgerAdd: true, newLedgerName: '', newLedgerIcon: '📋' }) },
  hideLedgerAdd() { this.setData({ showLedgerAdd: false }) },
  pickLedgerIcon(e) { this.setData({ newLedgerIcon: e.currentTarget.dataset.icon }) },
  onLedgerNameInput(e) { this.setData({ newLedgerName: e.detail.value }) },
  confirmAddLedger() {
    const name = this.data.newLedgerName.trim()
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    storage.addLedger(name, this.data.newLedgerIcon)
    this.setData({ showLedgerAdd: false })
    this.loadAll()
    wx.showToast({ title: '账本已创建', icon: 'success' })
  },

  // ===== 主题 =====
  onThemeChange(e) {
    const dark = e.detail.value
    const theme = dark ? 'dark' : 'light'
    app.switchTheme(theme)
    this.setData({ theme })
  },

  // ===== 货币 =====
  loadCurrency() {
    const list = currencyUtil.getCurrencies()
    const names = list.map(c => c.flag + ' ' + c.name + ' (' + c.code + ')')
    const s = currencyUtil.getSettings()
    const defIdx = Math.max(0, list.findIndex(c => c.code === s.defaultCurrency))
    const baseIdx = Math.max(0, list.findIndex(c => c.code === (s.baseCurrency || s.defaultCurrency)))
    this.setData({
      multiCurrency: s.multiCurrency, showSymbol: s.showSymbol !== false,
      defaultCurrencyIdx: defIdx, defaultCurrencySymbol: list[defIdx].symbol,
      baseCurrencyIdx: baseIdx, baseCurrencySymbol: list[baseIdx].symbol,
      currencyNames: names,
      convFrom: names[0], convTo: names[1]
    })
    this.doConvert()
  },

  onMultiCurrencyChange(e) {
    currencyUtil.saveSettings({ multiCurrency: e.detail.value })
    this.loadCurrency()  // reload all to refresh UI
  },
  onDefaultCurrencyChange(e) {
    currencyUtil.saveSettings({ defaultCurrency: currencyUtil.getCurrencies()[e.detail.value].code })
    this.loadCurrency()
  },
  onBaseCurrencyChange(e) {
    currencyUtil.saveSettings({ baseCurrency: currencyUtil.getCurrencies()[e.detail.value].code })
    this.loadCurrency()
  },
  onShowSymbolChange(e) {
    currencyUtil.saveSettings({ showSymbol: e.detail.value })
    this.loadCurrency()
  },

  // 换算器
  onConvFromChange(e) { this.setData({ convFromIdx: e.detail.value, convFrom: this.data.currencyNames[e.detail.value] }); this.doConvert() },
  onConvToChange(e) { this.setData({ convToIdx: e.detail.value, convTo: this.data.currencyNames[e.detail.value] }); this.doConvert() },
  onConvAmount(e) { this.setData({ convAmount: e.detail.value }); this.doConvert() },
  doConvert() {
    const list = currencyUtil.getCurrencies()
    const from = list[this.data.convFromIdx], to = list[this.data.convToIdx]
    const amount = parseFloat(this.data.convAmount) || 0
    if (amount > 0) {
      const r = currencyUtil.convert(amount, from.code, to.code)
      this.setData({ convResult: to.symbol + ' ' + r.toFixed(to.code === 'JPY' || to.code === 'KRW' ? 0 : 2) })
    } else { this.setData({ convResult: '' }) }
  },

  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }) },

  // ===== 分类 =====
  loadCats() {
    const cats = wx.getStorageSync('categories') || app.globalData.categories
    this.setData({ incomeCategories: [...cats.income], expenseCategories: [...cats.expense] })
  },
  loadUser() {
    const u = userUtil.getLocal()
    this.setData({ avatarUrl: u.avatarUrl, nickName: u.nickName })
  },
  onChooseAvatar(e) {
    if (e.detail.avatarUrl) { userUtil.updateAvatar(e.detail.avatarUrl); this.loadUser(); wx.showToast({ title: '已更新', icon: 'success' }) }
  },
  onNickBlur(e) {
    if (e.detail.value) { userUtil.updateNickName(e.detail.value); this.loadUser() }
  },
  save() {
    const { incomeCategories, expenseCategories } = this.data
    wx.setStorageSync('categories', { income: incomeCategories, expense: expenseCategories })
    app.globalData.categories = { income: [...incomeCategories], expense: [...expenseCategories] }
    wx.showToast({ title: '已保存', icon: 'success' })
  },
  showAdd(e) { this.setData({ showAdd: true, addingType: e.currentTarget.dataset.type, newCategory: '' }) },
  hideAdd() { this.setData({ showAdd: false }) },
  onInput(e) { this.setData({ newCategory: e.detail.value.trim() }) },
  confirmAdd() {
    const { addingType, newCategory, incomeCategories, expenseCategories } = this.data
    if (!newCategory) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    const list = addingType === 'income' ? incomeCategories : expenseCategories
    if (list.includes(newCategory)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    if (addingType === 'income') this.setData({ incomeCategories: [...incomeCategories, newCategory] })
    else this.setData({ expenseCategories: [...expenseCategories, newCategory] })
    this.hideAdd()
  },
  delCat(e) {
    const { type, name } = e.currentTarget.dataset
    const list = type === 'income' ? this.data.incomeCategories : this.data.expenseCategories
    if (list.length <= 1) { wx.showToast({ title: '至少保留一个', icon: 'none' }); return }
    wx.showModal({ title: '删除分类', content: `确定删除「${name}」？` }).then(res => {
      if (res.confirm) {
        const nl = list.filter(c => c !== name)
        if (type === 'income') this.setData({ incomeCategories: nl })
        else this.setData({ expenseCategories: nl })
      }
    })
  },
  exportData() {
    const records = storage.getAll()
    if (!records.length) { wx.showToast({ title: '暂无数据', icon: 'none' }); return }
    wx.setClipboardData({ data: JSON.stringify(records, null, 2), success() { wx.showToast({ title: '已复制', icon: 'success' }) } })
  },
  clearAll() {
    wx.showModal({ title: '⚠️ 危险操作', content: `确定清空「${this.data.ledgers.find(l=>l.id===this.data.activeLedgerId)?.name||'当前账本'}」全部数据？不可恢复！` }).then(res => {
      if (res.confirm) { storage.saveAll([]); wx.showToast({ title: '已清空', icon: 'success' }) }
    })
  }
})
