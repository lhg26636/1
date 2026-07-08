const user = require('./utils/user')
const storage = require('./utils/storage')

App({
  globalData: {
    categories: {
      income: ['工资', '奖金', '兼职', '理财', '红包', '其他收入'],
      expense: ['餐饮', '交通', '购物', '住房', '娱乐', '医疗', '教育', '通讯', '储蓄', '其他支出']
    },
    categoryIcons: {
      '工资': '💰', '奖金': '🎁', '兼职': '💼', '理财': '📈', '红包': '🧧', '其他收入': '💵',
      '餐饮': '🍜', '交通': '🚗', '购物': '🛒', '住房': '🏠', '娱乐': '🎮', '医疗': '🏥',
      '教育': '📚', '通讯': '📱', '储蓄': '🐷', '其他支出': '💸'
    },
    userInfo: null,
    theme: 'light',       // 'light' | 'dark'
    activeLedgerId: ''
  },

  onLaunch() {
    const stored = wx.getStorageSync('categories')
    if (!stored) {
      wx.setStorageSync('categories', this.globalData.categories)
    } else {
      this.globalData.categories = stored
    }
    this.globalData.userInfo = user.getLocal()
    this.globalData.activeLedgerId = storage.getActiveId()
    // 读取主题
    const theme = wx.getStorageSync('theme') || 'light'
    this.globalData.theme = theme
    this.applyTheme(theme)
  },

  applyTheme(theme) {
    this.globalData.theme = theme
    wx.setStorageSync('theme', theme)
    // 导航栏
    const barColor = theme === 'dark' ? '#1A1A2E' : '#2E7D32'
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: barColor })
    // 页面背景
    wx.setBackgroundColor({
      backgroundColorTop: theme === 'dark' ? '#1A1A2E' : '#2E7D32',
      backgroundColorBottom: theme === 'dark' ? '#121212' : '#F0F2F5',
      backgroundColor: theme === 'dark' ? '#121212' : '#F0F2F5'
    })
    // 底部 tabBar
    wx.setTabBarStyle({
      color: '#999',
      selectedColor: theme === 'dark' ? '#81C784' : '#2E7D32',
      backgroundColor: theme === 'dark' ? '#1E1E1E' : '#FFFFFF',
      borderStyle: theme === 'dark' ? 'black' : 'black'
    })
  },

  /** 切换主题 */
  switchTheme(theme) {
    this.applyTheme(theme)
    // 通知所有页面刷新
    const pages = getCurrentPages()
    pages.forEach(p => {
      if (p.onThemeChange) p.onThemeChange(theme)
    })
  }
})
