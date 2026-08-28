const { expect } = require('chai')
const sinon = require('sinon')

const CacheController = require('../../../server/controllers/CacheController').default
const CacheManager = require('../../../server/managers/CacheManager')

describe('CacheController', () => {
  afterEach(() => {
    sinon.restore()
  })

  function makeResponse() {
    return { sendStatus: sinon.spy() }
  }

  it('purges all caches for administrators', async () => {
    const response = makeResponse()
    sinon.stub(CacheManager, 'purgeAll').resolves()

    await CacheController.purgeCache({ user: { isAdminOrUp: true } }, response)

    expect(CacheManager.purgeAll.calledOnce).to.be.true
    expect(response.sendStatus.calledWith(200)).to.be.true
  })

  it('rejects non-administrators before purging all caches', async () => {
    const response = makeResponse()
    sinon.stub(CacheManager, 'purgeAll').resolves()

    await CacheController.purgeCache({ user: { isAdminOrUp: false } }, response)

    expect(CacheManager.purgeAll.called).to.be.false
    expect(response.sendStatus.calledWith(403)).to.be.true
  })

  it('purges cached items for administrators', async () => {
    const response = makeResponse()
    sinon.stub(CacheManager, 'purgeItems').resolves()

    await CacheController.purgeItemsCache({ user: { isAdminOrUp: true } }, response)

    expect(CacheManager.purgeItems.calledOnce).to.be.true
    expect(response.sendStatus.calledWith(200)).to.be.true
  })

  it('rejects non-administrators before purging cached items', async () => {
    const response = makeResponse()
    sinon.stub(CacheManager, 'purgeItems').resolves()

    await CacheController.purgeItemsCache({ user: { isAdminOrUp: false } }, response)

    expect(CacheManager.purgeItems.called).to.be.false
    expect(response.sendStatus.calledWith(403)).to.be.true
  })
})
