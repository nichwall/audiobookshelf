// Import required modules
const sinon = require('sinon')
const { expect } = require('chai')
const chaiResponseValidator = require('chai-openapi-response-validator').default
const AuthorController = require('../../../server/controllers/AuthorController')

describe('AuthorController', () => {
  describe('findOne', () => {
    let findOneStub

    beforeEach(() => {
      // Stub Sequelize's findOne function
      findOneStub = sinon.stub(AuthorController, 'findOne')
    })

    afterEach(() => {
      // Restore the stub after each test
      findOneStub.restore()
    })

    it('should return the correct data', async () => {
      // Define what the stub should return
      findOneStub.returns(Promise.resolve({ id: 'itemId', name: 'Item Name' }))

      // Call the function
      const result = await Model.findOne({ where: { id: 'itemId' } })

      // Check if the function returned the correct data
      expect(result).to.deep.equal({ id: 'itemId', name: 'Item Name' })
    })
  })
})
