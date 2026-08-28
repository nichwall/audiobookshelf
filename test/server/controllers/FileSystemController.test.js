const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const FileSystemController = require('../../../server/controllers/FileSystemController').default

describe('FileSystemController', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  function makeResponse() {
    return {
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis()
    }
  }

  it('rejects filesystem browsing by non-administrators', async () => {
    const response = makeResponse()
    const next = sinon.spy()
    const request = {
      query: {},
      user: { isAdminOrUp: false, canUpload: false, username: 'member', checkCanAccessLibrary: sinon.stub() }
    }

    await FileSystemController.getPathsHandler(request, response, next)

    expect(response.sendStatus.calledWith(403)).to.be.true
    expect(next.called).to.be.false
  })

  it('rejects malformed path-existence bodies before accessing models', async () => {
    const response = makeResponse()
    const next = sinon.spy()
    const request = {
      body: { directory: 12, folderPath: '/library' },
      user: { isAdminOrUp: false, canUpload: true, username: 'uploader', checkCanAccessLibrary: sinon.stub() }
    }

    await FileSystemController.checkPathExistsHandler(request, response, next)

    expect(response.status.calledWith(400)).to.be.true
    expect(response.json.calledWith({ error: 'Invalid request body' })).to.be.true
    expect(next.called).to.be.false
  })
})
