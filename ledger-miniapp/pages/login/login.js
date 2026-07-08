const account = require('../../utils/account')

Page({
  data: {
    activeAccount: null,
    accounts: [],
    showRegister: false,
    newName: '',
    avatarUrl: '',
    importGuest: true,
    theme: wx.getStorageSync('theme') || 'light'
  },

  onLoad() {
    this.refresh()
  },

  onShow() {
    this.setData({ theme: wx.getStorageSync('theme') || 'light' })
    this.refresh()
  },

  refresh() {
    const active = account.getActive()
    const list = account.getAll()
    this.setData({
      activeAccount: active,
      accounts: list,
      showRegister: list.length === 0
    })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  // ===== 创建账号 =====
  showRegisterForm() {
    this.setData({ showRegister: true })
  },
  onNameInput(e) {
    this.setData({ newName: e.detail.value })
  },
  toggleImport() {
    this.setData({ importGuest: !this.data.importGuest })
  },
  onChooseAvatar(e) {
    if (e.detail.avatarUrl) {
      this.setData({ avatarUrl: e.detail.avatarUrl })
    }
  },
  createAccount() {
    const name = this.data.newName.trim()
    if (!name) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    const newAccount = account.create(name, this.data.avatarUrl)
    // 导入游客数据
    if (this.data.importGuest) {
      const info = wx.getStorageInfoSync()
      const prefix = 'acc_' + newAccount.id + '_'
      info.keys.forEach(k => {
        // 只迁移非账号前缀的数据（游客数据）
        if (!k.startsWith('acc_') && !k.startsWith('local_accounts') && k !== 'active_account_id' && k !== 'theme') {
          wx.setStorageSync(prefix + k, wx.getStorageSync(k))
        }
      })
    }
    wx.showToast({ title: '创建并登录成功', icon: 'success', duration: 1000 })
    setTimeout(() => { this.goBack() }, 1000)
  },

  // ===== 选择/切换账号 =====
  selectAccount(e) {
    const id = e.currentTarget.dataset.id
    account.switchTo(id)
    wx.showToast({ title: '已切换账号', icon: 'success', duration: 800 })
    setTimeout(() => { this.goBack() }, 800)
  },

  // ===== 退出当前账号（回到游客模式） =====
  logoutAccount() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将回到游客模式，游客数据不会丢失'
    }).then(res => {
      if (res.confirm) {
        account.logout()
        wx.showToast({ title: '已退出', icon: 'success', duration: 800 })
        setTimeout(() => { this.goBack() }, 800)
      }
    })
  },

  // ===== 删除账号 =====
  deleteAccount(e) {
    const id = e.currentTarget.dataset.id
    const acc = account.getAll().find(a => a.id === id)
    wx.showModal({
      title: '删除账号',
      content: `确定删除「${acc ? acc.name : ''}」及其全部数据？不可恢复！`
    }).then(res => {
      if (res.confirm) {
        account.remove(id)
        this.refresh()
      }
    })
  }
})
