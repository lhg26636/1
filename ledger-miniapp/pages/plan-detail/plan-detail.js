const currencyUtil = require('../../utils/currency')
const storage = require('../../utils/storage')

const CURRENCIES = currencyUtil.getCurrencies()

const FREQUENCIES = ['每天', '每周', '每月']

const METHODS = {
  flexible:   { title: '灵活存钱法', icon: '💰', color: '#FF9800' },
  '365':      { title: '365存钱法', icon: '📅', color: '#42A5F5', periods: 365 },
  '52week':   { title: '52周存钱法', icon: '📈', color: '#66BB6A', periods: 52 },
  '52week-reverse': { title: '52周存钱法（逆向）', icon: '📉', color: '#AB47BC', periods: 52 },
  fixed:      { title: '定额存钱法', icon: '📌', color: '#26C6DA' },
  '12deposit':  { title: '12存单法', icon: '🏦', color: '#EF5350', periods: 12 },
  '36deposit':  { title: '36存单法', icon: '🏛', color: '#5C6BC0', periods: 36 }
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

Page({
  data: {
    theme: wx.getStorageSync('theme') || 'light',
    id: 'flexible',
    method: {},
    name: '', note: '',
    currencyIndex: 0,
    currencyNames: [],
    currencyCode: '',
    startDate: '', endDate: '',
    // flexible
    targetAmount: '',
    // 365 / 52week
    startAmount: '', increment: '',
    // 52week reverse
    decrement: '',
    // fixed / deposits
    amount: '',
    frequencyIndex: 2,
    frequencies: FREQUENCIES,
    periods: '',
    // summary
    total: 0, summary: '',
    // list
    plans: [],
    // 灵活存钱弹窗
    depositVisible: false, depositPlanId: '', depositAmount: '', depositPlanRemaining: 0,
    // 编辑模式
    editPlanId: ''
  },

  onLoad(options) {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    const id = options.id || 'flexible'
    const planId = options.planId || ''
    const method = METHODS[id] || METHODS.flexible
    const defaults = { startDate: today() }
    if (method.periods) defaults.periods = method.periods
    if (id === '12deposit' || id === '36deposit') defaults.amount = '100'
    if (id === 'fixed') { defaults.amount = '100'; defaults.periods = '12' }
    if (id === '365') { defaults.startAmount = '1'; defaults.increment = '1' }
    if (id === '52week') { defaults.startAmount = '1'; defaults.increment = '1' }
    if (id === '52week-reverse') { defaults.startAmount = '52'; defaults.decrement = '1' }
    this.setData({
      id, method, editPlanId: planId, ...defaults,
      currencyNames: CURRENCIES.map(c => c.flag + ' ' + c.name + ' (' + c.code + ')')
    })
    // 编辑已有计划：预填数据
    if (planId) {
      const plans = storage.getSavingPlans()
      const p = plans.find(x => x.id === planId)
      if (p) {
        const curIdx = Math.max(0, CURRENCIES.findIndex(c => c.code === p.currency))
        this.setData({
          name: p.name || '', note: p.note || '',
          startDate: p.startDate || today(),
          targetAmount: p.targetAmount ? String(p.targetAmount) : '',
          startAmount: p.startAmount ? String(p.startAmount) : '',
          increment: p.increment ? String(p.increment) : '',
          decrement: p.decrement ? String(p.decrement) : '',
          amount: p.amount ? String(p.amount) : '',
          periods: p.periods ? String(p.periods) : '',
          currencyIndex: curIdx, currencyCode: p.currency || 'CNY',
          endDate: p.endDate || '',
          frequencyIndex: FREQUENCIES.indexOf(p.frequency) >= 0 ? FREQUENCIES.indexOf(p.frequency) : 2
        })
      }
    }
    wx.setNavigationBarTitle({ title: planId ? '编辑' + method.title : method.title })
    this.updateSummary()
    this.loadPlans()
  },

  onShow() { this.loadPlans() },

  onNameInput(e)      { this.setData({ name: e.detail.value }); this.updateSummary() },
  onNoteInput(e)      { this.setData({ note: e.detail.value }) },
  onTargetAmountInput(e) { this.setData({ targetAmount: e.detail.value }); this.updateSummary() },
  onStartAmountInput(e)  { this.setData({ startAmount: e.detail.value }); this.updateSummary() },
  onIncrementInput(e)    { this.setData({ increment: e.detail.value }); this.updateSummary() },
  onDecrementInput(e)    { this.setData({ decrement: e.detail.value }); this.updateSummary() },
  onAmountInput(e)       { this.setData({ amount: e.detail.value }); this.updateSummary() },
  onPeriodsInput(e)      { this.setData({ periods: e.detail.value }); this.updateSummary() },

  onCurrencyChange(e) {
    const idx = e.detail.value
    this.setData({ currencyIndex: idx, currencyCode: CURRENCIES[idx].code })
  },
  onFrequencyChange(e) { this.setData({ frequencyIndex: e.detail.value }) },
  onStartDateChange(e) { this.setData({ startDate: e.detail.value }) },
  onEndDateChange(e)   { this.setData({ endDate: e.detail.value }) },

  computeTotal() {
    const { id, targetAmount, startAmount, increment, decrement, amount, periods } = this.data
    const p = parseInt(periods) || 0
    const amt = parseFloat(amount) || 0
    const start = parseFloat(startAmount) || 0
    const inc = parseFloat(increment) || 0
    const dec = parseFloat(decrement) || 0
    const target = parseFloat(targetAmount) || 0

    switch (id) {
      case 'flexible': return target
      case '365':
      case '52week': {
        const n = id === '365' ? 365 : 52
        return n * start + inc * (n - 1) * n / 2
      }
      case '52week-reverse': {
        const n = 52
        return Math.max(0, n * start - dec * (n - 1) * n / 2)
      }
      case 'fixed': return amt * p
      case '12deposit': return amt * 12
      case '36deposit': return amt * 36
      default: return 0
    }
  },

  buildSummary(total) {
    const { id, startAmount, increment, decrement, amount, periods } = this.data
    const start = parseFloat(startAmount) || 0
    const inc = parseFloat(increment) || 0
    const dec = parseFloat(decrement) || 0
    const amt = parseFloat(amount) || 0
    const p = parseInt(periods) || 0

    if (id === '365') {
      return `每次递增 ${inc.toFixed(2)} 元，第1期 ${start.toFixed(2)}，第2期 ${(start+inc).toFixed(2)} ... 第365期 ${(start+inc*364).toFixed(2)}，总计 ${total.toFixed(2)} 元`
    }
    if (id === '52week') {
      return `每周递增 ${inc.toFixed(2)} 元，第1周 ${start.toFixed(2)}，第2周 ${(start+inc).toFixed(2)} ... 第52周 ${(start+inc*51).toFixed(2)}，总计 ${total.toFixed(2)} 元`
    }
    if (id === '52week-reverse') {
      return `每周递减 ${dec.toFixed(2)} 元，第1周 ${start.toFixed(2)}，第2周 ${(start-dec).toFixed(2)} ... 第52周 ${(start-dec*51).toFixed(2)}，总计 ${total.toFixed(2)} 元`
    }
    if (id === 'fixed') {
      return `每期固定存入 ${amt.toFixed(2)} 元，共 ${p} 期，累计 ${total.toFixed(2)} 元`
    }
    if (id === '12deposit') {
      return `每月固定存入 ${amt.toFixed(2)} 元，共 12 个月，累计 ${total.toFixed(2)} 元`
    }
    if (id === '36deposit') {
      return `每月固定存入 ${amt.toFixed(2)} 元，共 36 个月，累计 ${total.toFixed(2)} 元`
    }
    return ''
  },

  updateSummary() {
    const total = this.computeTotal()
    this.setData({ total, summary: this.buildSummary(total) })
  },

  savePlan() {
    const { id, method, name, note, currencyCode, currencyIndex, startDate, endDate,
      targetAmount, startAmount, increment, decrement, amount, frequencyIndex, periods, total } = this.data

    if (id === 'flexible' && !targetAmount) {
      wx.showToast({ title: '请填写目标金额', icon: 'none' }); return
    }
    if ((id === '365' || id === '52week') && (!startAmount || !increment)) {
      wx.showToast({ title: '请填写起始金额和增量', icon: 'none' }); return
    }
    if (id === '52week-reverse' && (!startAmount || !decrement)) {
      wx.showToast({ title: '请填写起始金额和减量', icon: 'none' }); return
    }
    if ((id === 'fixed' || id === '12deposit' || id === '36deposit') && !amount) {
      wx.showToast({ title: '请填写每期存入金额', icon: 'none' }); return
    }
    if (id === 'fixed' && !periods) {
      wx.showToast({ title: '请填写期数', icon: 'none' }); return
    }

    const plans = storage.getSavingPlans()

    // 计算进度：当前已完成多少期
    let currentPeriod = 0
    let currentAmount = 0
    if (id !== 'flexible') {
      const startD = new Date(startDate)
      const nowD = new Date()
      if (id === '365') {
        currentPeriod = Math.min(method.periods, Math.max(0, Math.floor((nowD - startD) / (1000*60*60*24)) + 1))
      } else if (id === '52week' || id === '52week-reverse') {
        currentPeriod = Math.min(method.periods, Math.max(0, Math.floor((nowD - startD) / (1000*60*60*24*7)) + 1))
      } else if (id === 'fixed') {
        const freqDays = frequencyIndex === 0 ? 1 : frequencyIndex === 1 ? 7 : 30
        currentPeriod = Math.min(parseInt(periods) || 0, Math.max(0, Math.floor((nowD - startD) / (1000*60*60*24*freqDays)) + 1))
      } else if (id === '12deposit' || id === '36deposit') {
        currentPeriod = Math.min(method.periods, Math.max(0, Math.floor((nowD - startD) / (1000*60*60*24*30)) + 1))
      }
      // 计算当前已累积金额
      if (id === '365' || id === '52week') {
        const s = parseFloat(startAmount) || 0
        const inc = parseFloat(increment) || 0
        for (let i = 0; i < currentPeriod; i++) currentAmount += s + inc * i
      } else if (id === '52week-reverse') {
        const s = parseFloat(startAmount) || 0
        const dec = parseFloat(decrement) || 0
        for (let i = 0; i < currentPeriod; i++) currentAmount += Math.max(0, s - dec * i)
      } else {
        currentAmount = currentPeriod * (parseFloat(amount) || 0)
      }
    }

    const code = currencyCode || CURRENCIES[currencyIndex].code

    const { editPlanId } = this.data
    if (editPlanId) {
      // 编辑模式：更新已有计划
      const idx = plans.findIndex(p => p.id === editPlanId)
      if (idx >= 0) {
        const saved = plans[idx].saved || 0
        const cp = plans[idx].currentPeriod || 0
        plans[idx] = {
          ...plans[idx],
          name, note, currency: code,
          startDate, endDate,
          targetAmount: parseFloat(targetAmount) || 0,
          startAmount: parseFloat(startAmount) || 0,
          increment: parseFloat(increment) || 0,
          decrement: parseFloat(decrement) || 0,
          amount: parseFloat(amount) || 0,
          frequency: FREQUENCIES[frequencyIndex],
          periods: parseInt(periods) || 0,
          total,
          saved: id !== 'flexible' ? currentAmount : saved,
          currentPeriod: id !== 'flexible' ? currentPeriod : cp
        }
        storage.saveSavingPlans( plans)
        wx.showToast({ title: '计划已更新', icon: 'success' })
      }
    } else {
      plans.push({
        id: Date.now().toString(),
        methodId: id,
        title: method.title,
        name, note,
        currency: code,
        startDate, endDate,
        targetAmount: parseFloat(targetAmount) || 0,
        startAmount: parseFloat(startAmount) || 0,
        increment: parseFloat(increment) || 0,
        decrement: parseFloat(decrement) || 0,
        amount: parseFloat(amount) || 0,
        frequency: FREQUENCIES[frequencyIndex],
        periods: parseInt(periods) || 0,
        total,
        saved: currentAmount,
        currentPeriod,
        createTime: Date.now()
      })
      storage.saveSavingPlans( plans)
      wx.showToast({ title: '计划已保存', icon: 'success' })
    }

    this.setData({ name: '', note: '' })
    this.loadPlans()
  },

  loadPlans() {
    const all = storage.getSavingPlans()
    const plans = all
      .filter(p => p.methodId === this.data.id)
      .map(p => {
        const percent = p.total > 0 ? Math.min(100, Math.round(p.saved / p.total * 100)) : 0
        return { ...p, saved: p.saved.toFixed(2), total: p.total.toFixed(2), percent }
      })
    this.setData({ plans })
  },

  // 存入一次：存入当前期数对应的金额
  saveOnce(e) {
    const { id } = e.currentTarget.dataset
    const all = storage.getSavingPlans()
    const idx = all.findIndex(p => p.id === id)
    if (idx === -1) return

    const p = all[idx]

    // 灵活存钱：弹出输入框让用户自定义金额
    if (p.methodId === 'flexible') {
      const remaining = p.total - (p.saved || 0)
      if (remaining <= 0) {
        wx.showToast({ title: '🎉 目标已达成！', icon: 'success' })
        return
      }
      this.setData({ depositVisible: true, depositPlanId: id, depositAmount: '', depositPlanRemaining: Math.round(remaining * 100) / 100 })
      return
    }

    this.doDeposit(p, all)
  },

  // 执行存入
  doDeposit(p, all, customAmount) {
    let depositAmount = 0
    const currentPeriod = (p.currentPeriod || 0) + 1

    if (p.methodId === 'flexible') {
      depositAmount = customAmount || 0
    } else if (p.methodId === '365' || p.methodId === '52week') {
      depositAmount = p.startAmount + p.increment * (currentPeriod - 1)
    } else if (p.methodId === '52week-reverse') {
      depositAmount = Math.max(0, p.startAmount - p.decrement * (currentPeriod - 1))
    } else {
      depositAmount = p.amount
    }

    // 确保不超过目标
    depositAmount = Math.min(depositAmount, p.total - p.saved)
    if (depositAmount <= 0) {
      wx.showToast({ title: '🎉 目标已达成！', icon: 'success' })
      return
    }
    depositAmount = Math.round(depositAmount * 100) / 100

    // 更新储蓄进度
    p.saved += depositAmount
    p.currentPeriod = currentPeriod
    storage.saveSavingPlans( all)

    // 同步创建一笔支出记录（从账户扣钱存起来）
    const currencySettings = currencyUtil.getSettings()
    if (currencySettings.multiCurrency && p.currency) {
      storage.add({
        type: 'expense',
        category: '储蓄',
        amount: depositAmount,
        date: today(),
        note: p.name || p.title,
        currency: p.currency
      })
    } else {
      storage.add({
        type: 'expense',
        category: '储蓄',
        amount: depositAmount,
        date: today(),
        note: p.name || p.title,
        currency: 'CNY'
      })
    }

    this.loadPlans()
    wx.showToast({ title: '已存入 ' + depositAmount.toFixed(2), icon: 'none' })
  },

  deletePlan(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({ title: '确认删除', content: '删除后无法恢复' }).then(res => {
      if (res.confirm) {
        const plans = storage.getSavingPlans()
        storage.saveSavingPlans( plans.filter(p => p.id !== id))
        this.loadPlans()
      }
    })
  },

  // ===== 灵活存钱弹窗 =====
  onDepositAmountInput(e) { this.setData({ depositAmount: e.detail.value }) },
  closeDeposit() { this.setData({ depositVisible: false }) },
  confirmDeposit() {
    const { depositPlanId, depositAmount, depositPlanRemaining } = this.data
    const val = parseFloat(depositAmount)
    if (!depositAmount || isNaN(val) || val <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' }); return
    }
    if (val > depositPlanRemaining) {
      wx.showToast({ title: '超过剩余目标 ' + depositPlanRemaining.toFixed(2), icon: 'none' }); return
    }
    const all = storage.getSavingPlans()
    const idx = all.findIndex(p => p.id === depositPlanId)
    if (idx === -1) { this.closeDeposit(); return }
    const p = all[idx]
    this.setData({ depositVisible: false })
    this.doDeposit(p, all, Math.round(val * 100) / 100)
  }
})
