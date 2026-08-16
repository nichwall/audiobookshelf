const { expect } = require('chai')
const dns = require('node:dns')
const sinon = require('sinon')
const { safeFetch } = require('../../../server/utils/fetchUtils')

describe('fetchUtils', () => {
  afterEach(() => {
    sinon.restore()
    delete global.DisableSsrfRequestFilter
  })

  it('blocks private, loopback, and IPv4-mapped IPv6 destinations before connecting', async () => {
    const fetchStub = sinon.stub(global, 'fetch')

    await assertRejected(safeFetch('http://127.0.0.1'), 'Call to 127.0.0.1 is blocked.')
    await assertRejected(safeFetch('http://10.0.0.1'), 'Call to 10.0.0.1 is blocked.')
    await assertRejected(safeFetch('http://[::1]'), 'is blocked.')
    await assertRejected(safeFetch('http://[::ffff:127.0.0.1]'), 'is blocked.')
    sinon.assert.notCalled(fetchStub)
  })

  it('validates every redirect destination', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1' }
    }))

    await assertRejected(safeFetch('https://example.com'), 'Call to 127.0.0.1 is blocked.')
    sinon.assert.calledOnce(fetchStub)
    expect(fetchStub.firstCall.args[1].redirect).to.equal('manual')
  })

  it('does not forward sensitive headers across origins', async () => {
    const fetchStub = sinon.stub(global, 'fetch')
      .onFirstCall().resolves(new Response(null, {
        status: 302,
        headers: { location: 'https://redirect.example/result' }
      }))
      .onSecondCall().resolves(new Response('ok'))

    await safeFetch('https://provider.example/search', {
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Request-Id': 'request-id'
      }
    })

    const redirectedHeaders = new Headers(fetchStub.secondCall.args[1].headers)
    expect(redirectedHeaders.get('authorization')).to.equal(null)
    expect(redirectedHeaders.get('cookie')).to.equal(null)
    expect(redirectedHeaders.get('x-request-id')).to.equal('request-id')
  })

  it('keeps sensitive headers on same-origin redirects', async () => {
    const fetchStub = sinon.stub(global, 'fetch')
      .onFirstCall().resolves(new Response(null, {
        status: 302,
        headers: { location: '/result' }
      }))
      .onSecondCall().resolves(new Response('ok'))

    await safeFetch('https://provider.example/search', {
      headers: { Authorization: 'Bearer secret' }
    })

    const redirectedHeaders = new Headers(fetchStub.secondCall.args[1].headers)
    expect(redirectedHeaders.get('authorization')).to.equal('Bearer secret')
  })

  it('passes an Undici dispatcher to protected requests', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await safeFetch('https://example.com')

    expect(fetchStub.firstCall.args[1].dispatcher).to.exist
  })

  it('rejects malformed DNS lookup results before connecting', async () => {
    sinon.stub(dns, 'lookup').yields(null, ['203.0.113.10'])

    await assertLookupRejected(safeFetch('https://example.com'))
  })

  it('rejects non-IP DNS lookup results before connecting', async () => {
    sinon.stub(dns, 'lookup').yields(null, [{ address: 'redirect.example', family: 4 }])

    await assertLookupRejected(safeFetch('https://example.com'))
  })

  it('honors the configured SSRF bypass for private destinations', async () => {
    global.DisableSsrfRequestFilter = () => true
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await safeFetch('http://127.0.0.1')

    expect(fetchStub.firstCall.args[1].dispatcher).to.equal(undefined)
  })
})

async function assertRejected(promise, message) {
  try {
    await promise
    throw new Error('Expected promise to reject')
  } catch (error) {
    expect(error.message).to.include(message)
  }
}

async function assertLookupRejected(promise) {
  try {
    await promise
    throw new Error('Expected promise to reject')
  } catch (error) {
    expect(error.cause.message).to.include('Call to example.com is blocked.')
  }
}
