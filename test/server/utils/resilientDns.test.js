const { expect } = require('chai')
const dns = require('node:dns')
const sinon = require('sinon')
const { resilientLookup } = require('../../../server/utils/resilientDns')

describe('resilientDns', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('returns the system resolver result without using the fallback', async () => {
    sinon.stub(dns, 'lookup').yields(null, '203.0.113.10', 4)
    const resolve4Stub = sinon.stub(dns, 'resolve4')
    const resolve6Stub = sinon.stub(dns, 'resolve6')

    const result = await lookup('example.com')

    expect(result).to.deep.equal({ address: '203.0.113.10', family: 4 })
    sinon.assert.notCalled(resolve4Stub)
    sinon.assert.notCalled(resolve6Stub)
  })

  it('propagates non-EAI_AGAIN errors without using the fallback', async () => {
    const lookupError = Object.assign(new Error('Not found'), { code: 'ENOTFOUND' })
    sinon.stub(dns, 'lookup').yields(lookupError)
    const resolve4Stub = sinon.stub(dns, 'resolve4')
    const resolve6Stub = sinon.stub(dns, 'resolve6')

    const error = await lookupErrorFor('example.com')

    expect(error).to.equal(lookupError)
    sinon.assert.notCalled(resolve4Stub)
    sinon.assert.notCalled(resolve6Stub)
  })

  it('uses IPv4 when A succeeds and AAAA fails after EAI_AGAIN', async () => {
    stubPartialLookupFailure()
    sinon.stub(dns, 'resolve4').yields(null, ['203.0.113.10'])
    sinon.stub(dns, 'resolve6').yields(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' }))

    const result = await lookup('example.com')

    expect(result).to.deep.equal({ address: '203.0.113.10', family: 4 })
  })

  it('uses IPv6 when AAAA succeeds and A fails after EAI_AGAIN', async () => {
    stubPartialLookupFailure()
    sinon.stub(dns, 'resolve4').yields(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' }))
    sinon.stub(dns, 'resolve6').yields(null, ['2001:4860:4860::8888'])

    const result = await lookup('example.com')

    expect(result).to.deep.equal({ address: '2001:4860:4860::8888', family: 6 })
  })

  it('returns IPv4 before IPv6 when both fallback queries succeed', async () => {
    stubPartialLookupFailure()
    sinon.stub(dns, 'resolve4').yields(null, ['203.0.113.10'])
    sinon.stub(dns, 'resolve6').yields(null, ['2001:4860:4860::8888'])

    const results = await lookupAll('example.com')

    expect(results).to.deep.equal([
      { address: '203.0.113.10', family: 4 },
      { address: '2001:4860:4860::8888', family: 6 }
    ])
  })

  it('returns the original EAI_AGAIN error when both fallback queries fail', async () => {
    const lookupError = stubPartialLookupFailure()
    sinon.stub(dns, 'resolve4').yields(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' }))
    sinon.stub(dns, 'resolve6').yields(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' }))

    const error = await lookupErrorFor('example.com')

    expect(error).to.equal(lookupError)
  })

  it('returns every address from the successful fallback families with options.all', async () => {
    stubPartialLookupFailure()
    sinon.stub(dns, 'resolve4').yields(null, ['203.0.113.10', '203.0.113.11'])
    sinon.stub(dns, 'resolve6').yields(null, ['2001:4860:4860::8888'])

    const results = await lookupAll('example.com')

    expect(results).to.deep.equal([
      { address: '203.0.113.10', family: 4 },
      { address: '203.0.113.11', family: 4 },
      { address: '2001:4860:4860::8888', family: 6 }
    ])
  })

  it('queries only the explicitly requested address family', async () => {
    stubPartialLookupFailure()
    const resolve4Stub = sinon.stub(dns, 'resolve4')
    sinon.stub(dns, 'resolve6').yields(null, ['2001:4860:4860::8888'])

    const result = await lookup('example.com', { family: 6 })

    expect(result).to.deep.equal({ address: '2001:4860:4860::8888', family: 6 })
    sinon.assert.notCalled(resolve4Stub)
  })
})

function stubPartialLookupFailure() {
  const error = Object.assign(new Error('Temporary failure in name resolution'), { code: 'EAI_AGAIN' })
  sinon.stub(dns, 'lookup').yields(error)
  return error
}

function lookup(hostname, options = {}) {
  return new Promise((resolve, reject) => {
    resilientLookup(hostname, options, (error, address, family) => {
      if (error) return reject(error)
      resolve({ address, family })
    })
  })
}

function lookupAll(hostname) {
  return new Promise((resolve, reject) => {
    resilientLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return reject(error)
      resolve(addresses)
    })
  })
}

function lookupErrorFor(hostname) {
  return new Promise((resolve) => {
    resilientLookup(hostname, {}, (error) => resolve(error))
  })
}
