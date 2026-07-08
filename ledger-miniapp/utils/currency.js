/**
 * 货币工具 — 汇率数据 + 转换函数
 *
 * 两种模式：
 * - 多币种关闭：统一用「默认货币」显示，记一笔不能选币种
 * - 多币种开启：设「基准币种」算总额，记一笔可选币种+实时换算预览，
 *   每笔保留原始币种，总额按基准币种汇总
 */

// 汇率表：1 单位外币 = 多少人民币
const RATES = {
  CNY: 1,
  USD: 7.25,
  EUR: 7.85,
  GBP: 9.20,
  JPY: 0.048,
  HKD: 0.93,
  TWD: 0.23,
  KRW: 0.0054
}

const CURRENCIES = [
  { code: 'CNY', symbol: '¥',  name: '人民币', flag: '🇨🇳' },
  { code: 'USD', symbol: '$',  name: '美元',   flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',  name: '欧元',   flag: '🇪🇺' },
  { code: 'GBP', symbol: '£',  name: '英镑',   flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥',  name: '日元',   flag: '🇯🇵' },
  { code: 'HKD', symbol: 'HK$',name: '港币',   flag: '🇭🇰' },
  { code: 'TWD', symbol: 'NT$',name: '新台币', flag: '🇹🇼' },
  { code: 'KRW', symbol: '₩',  name: '韩元',   flag: '🇰🇷' }
]

const SETTINGS_KEY = 'currencySettings'

/** 默认设置 */
function defaultSettings() {
  return {
    multiCurrency: false,       // 多币种开关
    defaultCurrency: 'CNY',      // 默认货币（关闭多币种时生效）
    baseCurrency: 'CNY',         // 基准币种（开启多币种时生效，总额以此计算）
    showSymbol: true
  }
}

/** 获取设置 */
function getSettings() {
  return Object.assign(defaultSettings(), wx.getStorageSync(SETTINGS_KEY) || {})
}

/** 保存设置 */
function saveSettings(patch) {
  const cur = getSettings()
  const next = { ...cur, ...patch }
  wx.setStorageSync(SETTINGS_KEY, next)
  return next
}

/** 获取用于显示的币种信息 */
function getDisplayCurrency() {
  const s = getSettings()
  const code = s.multiCurrency ? s.baseCurrency : s.defaultCurrency
  const found = CURRENCIES.find(c => c.code === code)
  return found || CURRENCIES[0]
}

/** 获取显示符号 */
function getDisplaySymbol() {
  const s = getSettings()
  if (s.showSymbol === false) return ''
  return getDisplayCurrency().symbol
}

/** 获取币种列表 */
function getCurrencies() {
  return CURRENCIES
}

/** 根据 code 获取币种信息 */
function getByCode(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
}

/** 根据 code 获取符号 */
function getSymbol(code) {
  const c = CURRENCIES.find(v => v.code === code)
  return c ? c.symbol : '¥'
}

/** 汇率转换：amount 从 fromCode → toCode */
function convert(amount, fromCode, toCode) {
  if (!fromCode) fromCode = 'CNY'
  if (!toCode) toCode = 'CNY'
  if (fromCode === toCode) return amount
  const fromRate = RATES[fromCode] || 1
  const toRate = RATES[toCode] || 1
  return amount * fromRate / toRate
}

/** 格式化金额显示 */
function formatAmount(amount, code, showSymbol) {
  const sym = showSymbol !== false ? getSymbol(code) : ''
  const fixed = (code === 'JPY' || code === 'KRW') ? 0 : 2
  return sym + Number(amount).toFixed(fixed)
}

/**
 * 单条记录的显示：始终用原始金额 + 原始币种符号（不换算）
 * 返回 { amountFmt, currencySymbol }
 */
function recordDisplay(r, settings) {
  const s = settings || getSettings()
  const code = r.currency || 'CNY'
  const cur = getByCode(code)
  return {
    amountFmt: Number(r.amount || 0).toFixed(code === 'JPY' || code === 'KRW' ? 0 : 2),
    currencySymbol: s.showSymbol !== false ? cur.symbol : '',
    currencyCode: code
  }
}

/**
 * 汇总金额的显示：换算到显示币种
 * 返回 { amountFmt, currencySymbol }
 */
function totalDisplay(amount, fromCode, settings) {
  const s = settings || getSettings()
  const toCode = s.multiCurrency ? (s.baseCurrency || 'CNY') : s.defaultCurrency
  const converted = convert(amount, fromCode || 'CNY', toCode)
  const cur = getByCode(toCode)
  return {
    amountFmt: Number(converted).toFixed(toCode === 'JPY' || toCode === 'KRW' ? 0 : 2),
    currencySymbol: s.showSymbol !== false ? cur.symbol : ''
  }
}

/** 获取总额显示币种 code */
function getTotalCurrency(settings) {
  const s = settings || getSettings()
  return s.multiCurrency ? (s.baseCurrency || 'CNY') : s.defaultCurrency
}

module.exports = {
  RATES,
  CURRENCIES,
  getCurrencies,
  getSettings,
  saveSettings,
  getDisplayCurrency,
  getDisplaySymbol,
  getByCode,
  getSymbol,
  convert,
  formatAmount,
  recordDisplay,
  totalDisplay,
  getTotalCurrency
}
