const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const CustomMetadataProviderController = require('../../../server/controllers/CustomMetadataProviderController').default

describe('CustomMetadataProviderController', () => {
  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substring(1)}` : '')
    await Database.buildModels()
    sinon.stub(SocketAuthority, 'emitter')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  function adminRequest(overrides = {}) {
    return {
      body: {},
      params: {},
      path: '/api/custom-metadata-providers',
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

  it('validates, creates, and serializes a provider through Sequelize', async () => {
    const request = adminRequest({
      body: {
        name: 'Metadata API',
        url: 'https://metadata.example/api',
        mediaType: 'book',
        authHeaderValue: 'Bearer secret'
      }
    })

    const response = makeResponse()
    await CustomMetadataProviderController.createHandler(request, response, sinon.spy())

    const { provider } = response.json.firstCall.args[0]

    expect(provider).to.include({
      name: 'Metadata API',
      mediaType: 'book',
      url: 'https://metadata.example/api',
      authHeaderValue: 'Bearer secret'
    })
    expect(provider.id).to.be.a('string')
    expect(provider.createdAt).to.be.instanceOf(Date)
    expect(provider.updatedAt).to.be.instanceOf(Date)

    const storedProvider = await Database.customMetadataProviderModel.findByPk(provider.id)
    expect(storedProvider.toJSON()).to.include({
      name: provider.name,
      url: provider.url,
      authHeaderValue: provider.authHeaderValue
    })
    expect(SocketAuthority.emitter.calledWith('custom_metadata_provider_added', sinon.match({ id: provider.id }))).to.be.true
  })

  it('returns the complete typed provider response collection', async () => {
    const provider = await Database.customMetadataProviderModel.create({
      name: 'Metadata API',
      url: 'https://metadata.example/api',
      mediaType: 'book',
      authHeaderValue: null,
      extraData: { region: 'us' }
    })
    const response = makeResponse()
    await CustomMetadataProviderController.getAllHandler(adminRequest(), response, sinon.spy())

    const { providers } = response.json.firstCall.args[0]

    expect(providers).to.have.length(1)
    expect(providers[0]).to.deep.include({
      id: provider.id,
      name: 'Metadata API',
      extraData: { region: 'us' }
    })
  })

  it('deletes a provider and restores affected libraries to their fallback provider', async () => {
    const provider = await Database.customMetadataProviderModel.create({
      name: 'Metadata API',
      url: 'https://metadata.example/api',
      mediaType: 'book',
      authHeaderValue: null
    })
    const library = await Database.libraryModel.create({
      name: 'Library',
      mediaType: 'book',
      provider: `custom-${provider.id}`
    })
    const response = makeResponse()
    await CustomMetadataProviderController.deleteHandler(adminRequest({ params: { id: provider.id } }), response, sinon.spy())

    expect(response.sendStatus.calledWith(200)).to.be.true
    expect(await Database.customMetadataProviderModel.findByPk(provider.id)).to.equal(null)
    await library.reload()
    expect(library.provider).to.equal('google')
    expect(SocketAuthority.emitter.calledWith('custom_metadata_provider_removed', sinon.match({ id: provider.id }))).to.be.true
  })

  it('rejects malformed provider creation payloads before accessing Sequelize', async () => {
    const response = makeResponse()
    const next = sinon.spy()
    await CustomMetadataProviderController.createHandler(adminRequest({ body: { name: 'Metadata API', url: 12, mediaType: 'book' } }), response, next)

    expect(response.status.calledWith(400)).to.be.true
    expect(response.send.calledWith('Invalid request body')).to.be.true
    expect(next.called).to.be.false
    expect(await Database.customMetadataProviderModel.count()).to.equal(0)
  })

})
