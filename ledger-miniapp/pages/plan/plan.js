const storage = require('../../utils/storage')

const METHODS = [
  { id: 'flexible', icon: '💰', color: '#FF9800', title: '灵活存钱法', desc: '设定存钱目标金额，每次存钱金额不固定，使用灵活。' },
  { id: '365', icon: '📅', color: '#42A5F5', title: '365存钱法', desc: '以365天为周期，每日存钱金额递增，累计66,795.00元。' },
  { id: '52week', icon: '📈', color: '#66BB6A', title: '52周存钱法', desc: '第一周存1元，每周递增1元，第52周存52元，累计1,378元。' },
  { id: '52week-reverse', icon: '📉', color: '#AB47BC', title: '52周存钱法（逆向）', desc: '第1周存52元，每周递减1元，第52周存1元，累计1,378元。' },
  { id: 'fixed', icon: '📌', color: '#26C6DA', title: '定额存钱法', desc: '每个周期固定存入一笔金额，持续存入N次。' },
  { id: '12deposit', icon: '🏦', color: '#EF5350', title: '12存单法', desc: '每月固定存入一定金额，持续12个月。' },
  { id: '36deposit', icon: '🏛', color: '#5C6BC0', title: '36存单法', desc: '每月固定存入一定金额，持续36个月。' }
]

Page({
  data: {
    theme: wx.getStorageSync('theme') || 'light',
    methods: METHODS,
    plans: [],
    showMethodPicker: false
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'light' })
    this.loadPlans()
  },

  loadPlans() {
    const all = storage.getSavingPlans()
    const now = new Date()
    const plans = all.map(p => {
      // 计算进度
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
      const method = METHODS.find(m => m.id === p.methodId) || {}
      return { ...p, savedDisp: (p.saved||0).toFixed(2), totalDisp: (p.total||0).toFixed(2), percent: pct, methodIcon: method.icon, methodColor: method.color, methodTitle: method.title }
    })
    plans.sort((a, b) => b.createTime - a.createTime)
    this.setData({ plans })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/plan-detail/plan-detail?id=${id}` })
  },

  goPlanDetail(e) {
    const methodId = e.currentTarget.dataset.methodid
    const planId = e.currentTarget.dataset.planid
    wx.navigateTo({ url: `/pages/plan-detail/plan-detail?id=${methodId}&planId=${planId}` })
  },

  toggleMethodPicker() {
    this.setData({ showMethodPicker: !this.data.showMethodPicker })
  }
})
