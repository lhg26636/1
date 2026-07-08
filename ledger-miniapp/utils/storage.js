/**
 * 多账本本地存储 — 每个账本独立存储记录，通过 ledgerId 隔离
 * 所有数据以账号ID为前缀，实现多账号隔离
 */
const account = require('./account')

const LEDGER_KEY = 'ledgers'
const ACTIVE_KEY = 'activeLedgerId'

/** 账号作用域前缀 */
function scope(key) {
  const aid = account.getActiveId()
  return aid ? 'acc_' + aid + '_' + key : key
}

function getActiveId() {
  const id = wx.getStorageSync(scope(ACTIVE_KEY))
  if (id) return id
  // 初始化默认账本
  const def = { id: 'default', name: '日常账本', icon: '📋', createTime: Date.now() }
  wx.setStorageSync(scope(LEDGER_KEY), [def])
  wx.setStorageSync(scope(ACTIVE_KEY), 'default')
  return 'default'
}

function getLedgers() {
  return wx.getStorageSync(scope(LEDGER_KEY)) || []
}

function saveLedgers(list) {
  wx.setStorageSync(scope(LEDGER_KEY), list)
}

function switchLedger(id) {
  wx.setStorageSync(scope(ACTIVE_KEY), id)
}

function addLedger(name, icon) {
  const list = getLedgers()
  const l = { id: Date.now().toString(36), name, icon: icon || '📋', createTime: Date.now() }
  list.push(l)
  saveLedgers(list)
  return l
}

function deleteLedger(id) {
  const list = getLedgers().filter(l => l.id !== id)
  saveLedgers(list)
  wx.removeStorageSync(scope('records_' + id))
  if (getActiveId() === id && list.length > 0) {
    switchLedger(list[0].id)
  }
}

function recordKey() {
  return scope('records_' + getActiveId())
}

function getAll() {
  return wx.getStorageSync(recordKey()) || []
}

function saveAll(records) {
  wx.setStorageSync(recordKey(), records)
}

function add(record) {
  const records = getAll()
  records.unshift({
    ...record,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createTime: Date.now()
  })
  saveAll(records)
  return records
}

function remove(id) {
  const records = getAll()
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return records
  const [deleted] = records.splice(idx, 1)
  saveAll(records)
  const trash = getTrash()
  trash.unshift({ ...deleted, deletedAt: Date.now() })
  wx.setStorageSync(scope('trash_' + getActiveId()), trash)
  return records
}

/** 回收站 */
function trashKey() { return scope('trash_' + getActiveId()) }

function getTrash() {
  return wx.getStorageSync(trashKey()) || []
}

function restoreFromTrash(id) {
  const trash = getTrash()
  const idx = trash.findIndex(r => r.id === id)
  if (idx === -1) return false
  const [record] = trash.splice(idx, 1)
  delete record.deletedAt
  wx.setStorageSync(trashKey(), trash)
  const records = getAll()
  records.unshift(record)
  saveAll(records)
  return true
}

function permanentlyDelete(id) {
  const trash = getTrash().filter(r => r.id !== id)
  wx.setStorageSync(trashKey(), trash)
}

function emptyTrash() {
  wx.removeStorageSync(trashKey())
}

function update(id, patch) {
  const records = getAll()
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return null
  records[idx] = { ...records[idx], ...patch }
  saveAll(records)
  return records[idx]
}

function getByMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getAll().filter(r => r.date && r.date.startsWith(prefix))
}

function getMonthStats(year, month) {
  const list = getByMonth(year, month)
  let income = 0, expense = 0
  list.forEach(r => {
    if (r.type === 'income') income += r.amount
    else expense += r.amount
  })
  return { income, expense, list }
}

function search(query) {
  if (!query) return getAll()
  const q = query.toLowerCase().trim()
  return getAll().filter(r => {
    if (r.category && r.category.includes(q)) return true
    if (r.note && r.note.toLowerCase().includes(q)) return true
    if (r.amount !== undefined && r.amount !== null) {
      const amt = String(r.amount)
      if (amt === q) return true
      if (amt.startsWith(q + '.') || amt.endsWith('.' + q)) return true
    }
    return false
  })
}

/** 获取所有记录（跨账本），用于账本统计 */
function getAllRecords(ledgerId) {
  return wx.getStorageSync(scope('records_' + ledgerId)) || []
}

/** 存钱计划 */
function getSavingPlans() {
  return wx.getStorageSync(scope('savingPlans')) || []
}
function saveSavingPlans(plans) {
  wx.setStorageSync(scope('savingPlans'), plans)
}

module.exports = {
  getActiveId, getLedgers, saveLedgers, switchLedger,
  addLedger, deleteLedger,
  getAll, saveAll, add, remove, update,
  getByMonth, getMonthStats, search, getAllRecords,
  getTrash, restoreFromTrash, permanentlyDelete, emptyTrash,
  getSavingPlans, saveSavingPlans
}
