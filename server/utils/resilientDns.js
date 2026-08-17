const dns = require('node:dns')

/**
 * Resolve a hostname with one DNS record type.
 *
 * @param {string} hostname
 * @param {4|6} family
 * @param {(addresses: Array<{ address: string, family: 4|6 }>) => void} callback
 * @returns {void}
 */
function resolveFamily(hostname, family, callback) {
  const resolver = family === 4 ? dns.resolve4 : dns.resolve6
  resolver(hostname, (error, addresses) => {
    if (error || !Array.isArray(addresses)) return callback([])
    callback(addresses.map((address) => ({ address, family })))
  })
}

/**
 * Resolve A and AAAA records independently after getaddrinfo returns EAI_AGAIN.
 *
 * IPv4 results are returned before IPv6 results. A failure for one family does
 * not discard valid results from the other family.
 *
 * @param {string} hostname
 * @param {4|6|undefined} requestedFamily
 * @param {(addresses: Array<{ address: string, family: 4|6 }>) => void} callback
 * @returns {void}
 */
function resolveFallback(hostname, requestedFamily, callback) {
  const families = requestedFamily === 4 || requestedFamily === 6 ? [requestedFamily] : [4, 6]
  const results = new Map()
  let pending = families.length

  for (const family of families) {
    resolveFamily(hostname, family, (addresses) => {
      results.set(family, addresses)
      pending--
      if (pending > 0) return

      callback(families.flatMap((resultFamily) => results.get(resultFamily) || []))
    })
  }
}

/**
 * Drop-in DNS lookup with a fallback for partial A/AAAA resolution failures.
 *
 * The system resolver remains the primary path so hosts files and normal
 * container DNS behavior are preserved. When getaddrinfo returns EAI_AGAIN,
 * A and AAAA records are queried independently so one address family can still
 * be used if the other returns SERVFAIL or a similar temporary error.
 *
 * @param {string} hostname
 * @param {import('node:dns').LookupOptions|import('node:dns').LookupAllOptions|Function} options
 * @param {Function} [callback]
 * @returns {void}
 */
function resilientLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  options ||= {}

  dns.lookup(hostname, options, (error, address, family) => {
    if (!error || error.code !== 'EAI_AGAIN') return callback(error, address, family)

    const requestedFamily = Number(options.family) || undefined
    resolveFallback(hostname, requestedFamily, (addresses) => {
      if (!addresses.length) return callback(error, address, family)
      if (options.all) return callback(null, addresses)

      const result = addresses[0]
      callback(null, result.address, result.family)
    })
  })
}

module.exports = { resilientLookup }
