const sinon = require('sinon')
const { expect } = require('chai')
const { Author } = require('../../../server/models/Author') // adjust the path as needed

describe('Author model', () => {
  describe('getOldAuthors', () => {
    let findAllStub

    beforeEach(() => {
      // Stub the findAll method
      findAllStub = sinon.stub(Author, 'findAll')
      findAllStub.returns(Promise.resolve([
        { id: '1', asin: 'asin1' },
        { id: '2', asin: 'asin2' },
      ]))
    })

    afterEach(() => {
      // Restore the stub after each test
      findAllStub.restore()
    })

    it('should return old authors', async () => {
      const oldAuthors = await Author.getOldAuthors()
      expect(oldAuthors).to.have.lengthOf(2)
      expect(oldAuthors[0]).to.deep.equal({ id: '1', asin: 'asin1' })
      expect(oldAuthors[1]).to.deep.equal({ id: '2', asin: 'asin2' })
    })
  })

  describe('getOldAuthor', () => {
    it('should return an old author', () => {
      const author = new Author()
      author.id = '1'
      author.asin = 'asin1'
      const oldAuthor = author.getOldAuthor()
      expect(oldAuthor).to.deep.equal({ id: '1', asin: 'asin1' })
    })
  })

  describe('getOldById', () => {
    it('should return the old author by ID', async () => {
      // Stub the findByPk method
      const findByPkStub = sinon.stub(Author, 'findByPk')
      findByPkStub.withArgs('1').returns(Promise.resolve({
        id: '1',
        asin: 'asin1',
        getOldAuthor: sinon.stub().returns({ id: '1', asin: 'asin1' })
      }))

      const oldAuthor = await Author.getOldById('1')

      expect(oldAuthor).to.deep.equal({ id: '1', asin: 'asin1' })

      // Restore the stub after the test
      findByPkStub.restore()
    })

    it('should return null if author is not found', async () => {
      // Stub the findByPk method to return null
      const findByPkStub = sinon.stub(Author, 'findByPk')
      findByPkStub.withArgs('2').returns(Promise.resolve(null))

      const oldAuthor = await Author.getOldById('2')

      expect(oldAuthor).to.be.null

      // Restore the stub after the test
      findByPkStub.restore()
    })
  })
})