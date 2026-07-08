const storage = require('../../utils/storage')
const currencyUtil = require('../../utils/currency')

Page({
  data: {
    theme: wx.getStorageSync('theme') || 'light',
    type: 'expense',
    categories: [],
    categoryIcons: {},
    activeCategory: '',
    amount: '', date: '', note: '',
    canSubmit: false,
    // 货币
    multiCurrency: false,
    currencies: currencyUtil.getCurrencies(),
    currencyNames: [],
    currencyIndex: 0,
    currencyCode: 'CNY',
    amountSymbol: '¥',
    // 多币种实时换算
    baseCurrencyCode: 'CNY',
    baseSymbol: '¥',
    convertedAmount: '0.00',
    showConversion: false
  },

  onLoad() {
    const app = getApp()
    const cats = app.globalData.categories
    const icons = app.globalData.categoryIcons
    this.setData({
      categories: cats.expense, categoryIcons: icons,
      activeCategory: cats.expense[0], date: this.fmt(new Date())
    })
    this.loadCurrencySettings()
  },

  onShow() {
    const app = getApp()
    this.setData({ theme: app.globalData.theme || 'light' })
    const t = this.data.type
    const cats = app.globalData.categories
    this.setData({
      categories: cats[t], categoryIcons: app.globalData.categoryIcons,
      activeCategory: cats[t][0]
    })
    this.loadCurrencySettings()
  },

  loadCurrencySettings() {
    const cs = currencyUtil.getSettings()
    const list = currencyUtil.getCurrencies()
    const names = list.map(c => c.flag + ' ' + c.name + ' (' + c.code + ')')

    if (cs.multiCurrency) {
      // 多币种模式：显示货币选择器，用基准币种符号
      const display = currencyUtil.getDisplayCurrency()
      const idx = Math.max(0, list.findIndex(c => c.code === display.code))
      this.setData({
        multiCurrency: true,
        currencyIndex: idx,
        currencyCode: display.code,
        amountSymbol: display.symbol,
        baseCurrencyCode: display.code,
        baseSymbol: display.symbol,
        currencyNames: names,
        showConversion: false
      })
    } else {
      // 单币种模式：不显示选择器，统一用默认货币
      const cur = currencyUtil.getByCode(cs.defaultCurrency)
      this.setData({
        multiCurrency: false,
        currencyCode: cs.defaultCurrency,
        amountSymbol: cs.showSymbol !== false ? cur.symbol : '',
        currencyNames: names,
        baseCurrencyCode: cs.defaultCurrency,
        baseSymbol: cs.showSymbol !== false ? cur.symbol : '',
        showConversion: false,
        convertedAmount: '0.00'
      })
    }
  },

  switchType(e) {
    const t = e.currentTarget.dataset.type
    const app = getApp()
    this.setData({
      type: t, categories: app.globalData.categories[t],
      activeCategory: app.globalData.categories[t][0]
    })
  },

  selectCategory(e) { this.setData({ activeCategory: e.currentTarget.dataset.name }) },

  onAmountInput(e) {
    const v = e.detail.value
    this.setData({ amount: v, canSubmit: parseFloat(v) > 0 })
    this.updateConversion()
  },

  onCurrencyChange(e) {
    const idx = e.detail.value
    const list = currencyUtil.getCurrencies()
    const cur = list[idx]
    const cs = currencyUtil.getSettings()
    // 金额符号随所选币种变化
    const showSym = cs.showSymbol !== false
    this.setData({
      currencyIndex: idx,
      currencyCode: cur.code,
      amountSymbol: showSym ? cur.symbol : ''
    })
    this.updateConversion()
  },

  // 实时换算：当前币种 → 基准币种
  updateConversion() {
    const { multiCurrency, currencyCode, baseCurrencyCode, amount } = this.data
    if (!multiCurrency) return
    const val = parseFloat(amount) || 0
    if (val > 0 && currencyCode !== baseCurrencyCode) {
      const result = currencyUtil.convert(val, currencyCode, baseCurrencyCode)
      const fixed = (baseCurrencyCode === 'JPY' || baseCurrencyCode === 'KRW') ? 0 : 2
      this.setData({ convertedAmount: result.toFixed(fixed), showConversion: true })
    } else {
      this.setData({ showConversion: false })
    }
  },

  onDateChange(e) { this.setData({ date: e.detail.value }) },
  onNoteInput(e) { this.setData({ note: e.detail.value }) },

  submit() {
    const { type, activeCategory, amount, date, note, currencyCode } = this.data
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val <= 0) { wx.showToast({ title: '请输入有效金额', icon: 'none' }); return }
    if (val > 99999999) { wx.showToast({ title: '金额过大', icon: 'none' }); return }
    if (!date) { wx.showToast({ title: '请选择日期', icon: 'none' }); return }

    storage.add({
      type, category: activeCategory,
      amount: Math.round(val * 100) / 100,
      date, note: note.trim(),
      currency: currencyCode
    })

    wx.showToast({ title: '记账成功', icon: 'success' })
    this.setData({ amount: '', note: '', canSubmit: false, showConversion: false })
  },

  fmt(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
})
