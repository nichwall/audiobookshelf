const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const adminStats = require('../../../server/utils/queries/adminStats')
const StatsController = require('../../../server/controllers/StatsController').default

describe('StatsController', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  function adminRequest(overrides = {}) {
    return {
      params: {},
      user: { isAdminOrUp: true, username: 'admin' },
      ...overrides
    }
  }

  function makeResponse() {
    return {
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis()
    }
  }

  it('returns typed aggregate server statistics', async () => {
    sinon.stub(adminStats, 'getTotalSize').resolves({
      books: { totalSize: 12, numItems: 2 },
      podcasts: { totalSize: 8, numItems: 1 },
      total: { totalSize: 20, numItems: 3 }
    })
    sinon.stub(adminStats, 'getNumAudioFiles').resolves({
      numBookAudioFiles: 4,
      numPodcastAudioFiles: 2,
      numAudioFiles: 6
    })
    const response = makeResponse()

    await StatsController.getServerStatsHandler(adminRequest(), response, sinon.spy())

    expect(response.json.calledWith({
      books: { totalSize: 12, numItems: 2, numAudioFiles: 4 },
      podcasts: { totalSize: 8, numItems: 1, numAudioFiles: 2 },
      total: { totalSize: 20, numItems: 3, numAudioFiles: 6 }
    })).to.be.true
  })

  it('passes a validated year to the statistics query', async () => {
    const stats = { numBooks: 3, topAuthors: [], topNarrators: [], topGenres: [] }
    sinon.stub(adminStats, 'getStatsForYear').resolves(stats)
    const response = makeResponse()

    await StatsController.getAdminStatsForYearHandler(adminRequest({ params: { year: '2025' } }), response, sinon.spy())

    expect(adminStats.getStatsForYear.calledWith(2025)).to.be.true
    expect(response.json.calledWith(stats)).to.be.true
  })

  it('rejects an invalid year before querying statistics', async () => {
    sinon.stub(adminStats, 'getStatsForYear').resolves({})
    const response = makeResponse()
    const next = sinon.spy()

    await StatsController.getAdminStatsForYearHandler(adminRequest({ params: { year: '1999' } }), response, next)

    expect(response.status.calledWith(400)).to.be.true
    expect(response.send.calledWith('Invalid year')).to.be.true
    expect(adminStats.getStatsForYear.called).to.be.false
    expect(next.called).to.be.false
  })

  it('rejects non-administrators in middleware', () => {
    const response = makeResponse()
    const next = sinon.spy()

    StatsController.middleware(adminRequest({ user: { isAdminOrUp: false, username: 'member' } }), response, next)

    expect(response.sendStatus.calledWith(403)).to.be.true
    expect(next.called).to.be.false
  })
})
