/**
 * 用户管理 — 本地存储头像和昵称
 */
const KEY = 'userInfo'
const DEF_AVATAR = '/images/default-avatar.png'
const DEF_NAME = '微信用户'

function getLocal() {
  return wx.getStorageSync(KEY) || { avatarUrl: DEF_AVATAR, nickName: DEF_NAME }
}
function saveLocal(info) {
  const cur = getLocal()
  const m = { ...cur, ...info }
  wx.setStorageSync(KEY, m)
  return m
}
function updateAvatar(url) { return saveLocal({ avatarUrl: url }) }
function updateNickName(n) { return saveLocal({ nickName: n || DEF_NAME }) }
function logout() { wx.setStorageSync(KEY, { avatarUrl: DEF_AVATAR, nickName: DEF_NAME }) }

module.exports = { getLocal, saveLocal, updateAvatar, updateNickName, logout }