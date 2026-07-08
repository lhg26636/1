/**
 * 本地多账号管理 — 无需微信云开发
 * 每个账号拥有独立的数据空间，通过账号ID隔离存储
 */
const ACCOUNTS_KEY = 'local_accounts'
const ACTIVE_KEY = 'active_account_id'

function getAll() {
  return wx.getStorageSync(ACCOUNTS_KEY) || []
}

function saveAll(list) {
  wx.setStorageSync(ACCOUNTS_KEY, list)
}

function getActiveId() {
  return wx.getStorageSync(ACTIVE_KEY) || ''
}

function getActive() {
  const id = getActiveId()
  if (!id) return null
  return getAll().find(a => a.id === id) || null
}

/** 创建账号 */
function create(name, avatarUrl) {
  const list = getAll()
  const account = {
    id: 'a_' + Date.now().toString(36),
    name: name || '默认用户',
    avatarUrl: avatarUrl || '',
    createTime: Date.now()
  }
  list.push(account)
  saveAll(list)
  wx.setStorageSync(ACTIVE_KEY, account.id)
  return account
}

/** 切换账号 */
function switchTo(id) {
  const account = getAll().find(a => a.id === id)
  if (account) {
    wx.setStorageSync(ACTIVE_KEY, id)
    return account
  }
  return null
}

/** 登出 */
function logout() {
  wx.removeStorageSync(ACTIVE_KEY)
}

/** 更新账号信息 */
function update(id, patch) {
  const list = getAll()
  const idx = list.findIndex(a => a.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...patch }
  saveAll(list)
  return list[idx]
}

/** 删除账号及其所有数据 */
function remove(id) {
  const list = getAll().filter(a => a.id !== id)
  saveAll(list)
  // 清除该账号的所有数据
  const prefix = 'acc_' + id + '_'
  const info = wx.getStorageInfoSync()
  info.keys.forEach(k => {
    if (k.startsWith(prefix)) wx.removeStorageSync(k)
  })
  // 如果删的是当前活跃，切到第一个或清空
  if (getActiveId() === id) {
    if (list.length > 0) {
      wx.setStorageSync(ACTIVE_KEY, list[0].id)
    } else {
      wx.removeStorageSync(ACTIVE_KEY)
    }
  }
}

module.exports = { getAll, saveAll, getActiveId, getActive, create, switchTo, logout, update, remove }
