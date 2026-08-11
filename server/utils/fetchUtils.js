/**
 * Fetch a successful response, applying the timeout semantics previously
 * provided by Axios. Callers that need a parsed body should use fetchJson.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<Response>}
 */
async function fetchResponse(url, { timeout, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    signal: timeout ? AbortSignal.timeout(timeout) : options.signal
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response
}

/**
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, options) {
  return (await fetchResponse(url, options)).json()
}

module.exports = { fetchJson, fetchResponse }
