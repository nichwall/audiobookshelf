// Import dependencies and modules for testing
const chai = require('chai')
const sinon = require('sinon')
const expect = chai.expect
const chaiResponseValidator = require('chai-openapi-response-validator').default
const Author = require('../../../../server/objects/entities/Author')
const Logger = require('../../../../server/Logger')

// Load an OpenAPI file (YAML or JSON) into this plugin
const path = require('path')
const specPath = path.resolve('build-docs/swagger-output.json')
// Need to use `path.resolve` or the validator gets mad about the path
chai.use(chaiResponseValidator(specPath))

// Write your test (e.g. using Mocha)
describe('object - Author Class', () => {
  describe('Constructor', () => {
    it('should initialize with default values if no author data provided', () => {
      const author = new Author()
      expect(author.id).to.be.null
      expect(author.asin).to.be.null
      expect(author.name).to.be.null
      expect(author.description).to.be.null
      expect(author.imagePath).to.be.null
      expect(author.addedAt).to.be.null
      expect(author.updatedAt).to.be.null
      expect(author.libraryId).to.be.null
    })

    it('should initialize with provided author data', () => {
      const authorData = {
        id: 'author-id',
        asin: 'author-asin',
        name: 'John Doe',
        // Add other properties as needed
      }
      const author = new Author(authorData)
      expect(author.id).to.equal(authorData.id)
      expect(author.asin).to.equal(authorData.asin)
      expect(author.name).to.equal(authorData.name)
      expect(author.description).to.be.null
      expect(author.imagePath).to.be.null
      expect(author.addedAt).to.be.null

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })
  })

  describe('setData method', () => {
    it('should set author data correctly', () => {
      const data = {
        name: 'Jane Smith'
      }
      const libraryId = 'library-id'
      const author = new Author()
      author.setData(data, libraryId)
      expect(author.id).to.be.a('string')
      expect(author.asin).to.be.null
      expect(author.name).to.equal(data.name)
      expect(author.description).to.be.null
      expect(author.imagePath).to.be.null
      expect(author.addedAt).to.be.a('number')
      expect(author.updatedAt).to.be.a('number')
      expect(author.libraryId).to.be.a('string')

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })

    it('fill all fields', () => {
      const data = {
        name: 'John Doe',
        description: 'Sample description',
        asin: '1234567890',
        imagePath: '/path/to/image.jpg'
      }
      const libraryId = 'library-id'
      const author = new Author()
      author.setData(data, libraryId)
      expect(author.id).to.be.a('string')
      expect(author.asin).to.equal(data.asin)
      expect(author.name).to.equal(data.name)
      expect(author.description).to.equal(data.description)
      expect(author.imagePath).to.equal(data.imagePath)
      expect(author.addedAt).to.be.a('number')
      expect(author.updatedAt).to.be.a('number')
      expect(author.libraryId).to.be.a('string')

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })

    it('fill all fields', () => {
      const data = {
        name: 'John Doe',
        description: 'Sample description',
        asin: '1234567890',
        imagePath: '/path/to/image.jpg'
      }
      const libraryId = 'library-id'
      const author = new Author()
      author.setData(data, libraryId)
      expect(author.id).to.be.a('string')
      expect(author.asin).to.equal(data.asin)
      expect(author.name).to.equal(data.name)
      expect(author.description).to.equal(data.description)
      expect(author.imagePath).to.equal(data.imagePath)
      expect(author.addedAt).to.be.a('number')
      expect(author.updatedAt).to.be.a('number')
      expect(author.libraryId).to.be.a('string')

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })

    it('empty author name and optional fields filled', () => {
      const data = {
        name: '',
        description: 'Sample description',
        asin: '1234567890',
        imagePath: '/path/to/image.jpg'
      }
      const libraryId = 'library-id'
      const author = new Author()
      author.setData(data, libraryId)
      expect(author.id).to.be.a('string')
      expect(author.asin).to.equal(data.asin)
      expect(author.name).to.equal(data.name)
      expect(author.description).to.equal(data.description)
      expect(author.imagePath).to.equal(data.imagePath)
      expect(author.addedAt).to.be.a('number')
      expect(author.updatedAt).to.be.a('number')
      expect(author.libraryId).to.be.a('string')

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })

    it('should error if null name provided', () => {
      const data = {
        name: null
      }
      const libraryId = 'library-id'
      // Mock Logger.error method to check if it's called
      const loggerErrorSpy = sinon.spy(Logger, 'error')
      const author = new Author()
      author.setData(data, libraryId)
      expect(loggerErrorSpy.calledOnce).to.be.true
      // Add other assertions if needed
      loggerErrorSpy.restore() // Restore the original method

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })

    it('should log error if no name provided', () => {
      const data = {} // No name provided
      const libraryId = 'library-id'
      // Mock Logger.error method to check if it's called
      const loggerErrorSpy = sinon.spy(Logger, 'error')
      const author = new Author()
      author.setData(data, libraryId)
      expect(loggerErrorSpy.calledOnce).to.be.true
      // Add other assertions if needed
      loggerErrorSpy.restore() // Restore the original method

      // Validate OpenAPI spec
      expect(author.toJSON()).to.satisfySchemaInApiSpec('author')
    })
  })

  // Add more test cases as needed for other methods in the Author class
  describe('update method', () => {
    it('should return false if payload is empty', () => {
      const author = new Author({
        id: 'author-id',
        name: 'John Doe',
        description: 'Sample description',
      })

      const result = author.update({})
      expect(result).to.be.false
    })

    it('should update properties if they differ in payload', () => {
      const author = new Author({
        id: 'author-id',
        name: 'John Doe',
        description: 'Sample description',
      })

      const payload = {
        name: 'Jane Smith',
        description: 'Updated description',
      }

      const result = author.update(payload)
      expect(result).to.be.true
      expect(author.name).to.equal(payload.name)
      expect(author.description).to.equal(payload.description)
    })

    it('should not update properties if they are the same in payload', () => {
      const author = new Author({
        id: 'author-id',
        name: 'John Doe',
        description: 'Sample description',
      })

      const payload = {
        name: 'John Doe', // Same as current value
        description: 'Sample description', // Same as current value
      }

      const result = author.update(payload)
      expect(result).to.be.false
      // Ensure properties remain unchanged
      expect(author.name).to.equal('John Doe')
      expect(author.description).to.equal('Sample description')
    })

    it('should ignore extra keys in payload', () => {
      const author = new Author({
        id: 'author-id',
        name: 'John Doe',
        description: 'Sample description',
      })

      const payload = {
        name: 'Jane Smith',
        description: 'Updated description',
        extraField: 'Extra value', // Extra field not present in Author object
      }

      const result = author.update(payload)
      expect(result).to.be.true
      // Ensure extra field is ignored
      expect(author.extraField).to.be.undefined
    })

    it('should return true if some properties are updated', () => {
      const author = new Author({
        id: 'author-id',
        name: 'John Doe',
        description: 'Sample description',
      })

      const payload = {
        name: 'Jane Smith', // Updated
        description: 'Sample description', // Not updated
      }

      const result = author.update(payload)
      expect(result).to.be.true
    })
  })
})
