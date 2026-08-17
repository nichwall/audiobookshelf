/**
 * Fetch a successful response.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<Response>}
 */
async function fetchResponse(url, { timeout, ...options } = {}) {
  return assertOk(await fetchWithTimeout(url, options, timeout, getDispatcher(false)))
}

/**
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, options) {
  return (await fetchResponse(url, options)).json()
}

async function safeFetchResponse(url, options) {
  return assertOk(await safeFetch(url, options))
}

async function safeFetchJson(url, options) {
  return (await safeFetchResponse(url, options)).json()
}

module.exports = { fetchJson, fetchResponse, safeFetch, safeFetchJson, safeFetchResponse }
const dns = require('node:dns')
const ipaddr = require('ipaddr.js')
const { Agent, EnvHttpProxyAgent, getGlobalDispatcher } = require('undici')

function getAddressRange(address) {
  if (!ipaddr.isValid(address)) return null

  const parsed = ipaddr.parse(address)
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address().range()
  }
  return parsed.range()
}

function isAllowedAddress(address) {
  const range = getAddressRange(address)
  return range === null || range === 'unicast'
}

function isAllowedResolvedAddress(address) {
  return typeof address === 'string' && ipaddr.isValid(address) && getAddressRange(address) === 'unicast'
}

function getUrl(url) {
  const parsedUrl = new URL(url)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`)
  }

  return parsedUrl
}

function assertAllowedUrl(url) {
  const parsedUrl = getUrl(url)
  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '')
  if (!isAllowedAddress(hostname)) {
    throw new Error(`Call to ${hostname} is blocked.`)
  }
  return parsedUrl
}

/**
 * Resolve every DNS result and hand Undici only an allowed address. Because
 * this lookup is used to create the socket, it cannot be bypassed through a
 * second lookup after validation.
 */
function safeLookup(hostname, options, callback) {
  if (!isAllowedAddress(hostname)) {
    callback(new Error(`Call to ${hostname} is blocked.`))
    return
  }

  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error)

    // `dns.lookup` normally returns address objects when `all` is enabled, but
    // do not pass a malformed resolver result to Undici as an undefined IP.
    const address = addresses.find((result) =>
      isAllowedResolvedAddress(result?.address)
    )
    if (!address) return callback(new Error(`Call to ${hostname} is blocked.`))

    // Undici requests every address (`all: true`). Match Node's DNS lookup
    // callback shape in that mode: an array of { address, family } objects.
    if (options.all) return callback(null, [address])
    callback(null, address.address, address.family)
  })
}

const safeDispatcher = new Agent({ connect: { lookup: safeLookup } })
let proxyDispatcher = null

function getDispatcher(useSsrfFilter) {
  if (process.env.EXP_PROXY_SUPPORT === '1') {
    if (!proxyDispatcher) proxyDispatcher = new EnvHttpProxyAgent()
    return proxyDispatcher
  }
  return useSsrfFilter ? safeDispatcher : getGlobalDispatcher()
}

/**
 * Apply the configured timeout while connecting and receiving headers. Once
 * headers arrive, Undici's bodyTimeout continues to enforce the same timeout
 * as an inactivity limit between body chunks rather than a total transfer
 * duration.
 */
async function fetchWithTimeout(url, options, timeout, dispatcher) {
  if (!timeout) {
    return fetch(url, { ...options, dispatcher })
  }

  const timeoutController = new AbortController()
  const timeoutHandle = setTimeout(() => timeoutController.abort(new Error(`Request timed out after ${timeout}ms`)), timeout)
  timeoutHandle.unref?.()
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal

  try {
    const timeoutDispatcher = dispatcher.compose((dispatch) => (options, handler) => dispatch({
      ...options,
      headersTimeout: timeout,
      bodyTimeout: timeout
    }, handler))
    return await fetch(url, {
      ...options,
      signal,
      dispatcher: timeoutDispatcher
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function isRedirect(response) {
  return [301, 302, 303, 307, 308].includes(response.status)
}

function getRedirectOptions(options, status, currentUrl, nextUrl) {
  const headers = new Headers(options.headers)
  if (currentUrl.origin !== nextUrl.origin) {
    headers.delete('authorization')
    headers.delete('cookie')
  }

  const method = options.method?.toUpperCase()
  if (status !== 303 && !([301, 302].includes(status) && method === 'POST')) {
    return { ...options, headers }
  }

  headers.delete('content-length')
  headers.delete('content-type')
  return { ...options, method: 'GET', body: undefined, headers }
}

/**
 * Fetch an external URL with connection-time SSRF protection. Redirects are
 * followed manually so each destination receives the same validation.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number, maxRedirects?: number, allowPrivateNetwork?: boolean }} [options]
 * @returns {Promise<Response>}
 */
async function safeFetch(url, { timeout, maxRedirects = 5, signal, allowPrivateNetwork = false, ...options } = {}) {
  let currentUrl = getUrl(url)
  let currentOptions = { ...options, signal }

  for (let redirectCount = 0; ; redirectCount++) {
    const bypassFilter = allowPrivateNetwork || global.DisableSsrfRequestFilter?.(currentUrl.toString())
    if (!bypassFilter) assertAllowedUrl(currentUrl)
    const dispatcher = getDispatcher(!bypassFilter)
    const response = await fetchWithTimeout(currentUrl, {
      ...currentOptions,
      redirect: 'manual'
    }, timeout, dispatcher)

    if (!isRedirect(response)) return response
    if (redirectCount >= maxRedirects) {
      await response.body?.cancel()
      throw new Error(`Too many redirects while requesting ${currentUrl}`)
    }

    const location = response.headers.get('location')
    if (!location) return response

    const nextUrl = getUrl(new URL(location, currentUrl))
    await response.body?.cancel()
    currentOptions = getRedirectOptions(currentOptions, response.status, currentUrl, nextUrl)
    currentUrl = nextUrl
  }
}

function assertOk(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response
}
