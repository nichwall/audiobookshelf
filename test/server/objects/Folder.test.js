// Import dependencies and modules for testing
const chai = require('chai')
const sinon = require('sinon')
const expect = chai.expect
const chaiResponseValidator = require('chai-openapi-response-validator').default

// Load an OpenAPI file (YAML or JSON) into this plugin
const path = require('path')
const specPath = path.resolve('build-docs/swagger-output.json')
// Need to use `path.resolve` or the validator gets mad about the path
chai.use(chaiResponseValidator(specPath))

const Folder = require('../../../server/objects/Folder')

describe('object - Folder Class', () => {
  describe('Constructor', () => {
    it('should initialize with default values if no folder data provided', () => {
      const folder = new Folder()
      expect(folder.id).to.be.null
      expect(folder.fullPath).to.be.null
      expect(folder.libraryId).to.be.null
      expect(folder.addedAt).to.be.null
    })

    it('should initialize with provided folder data', () => {
      const folderData = {
        id: 'folder-id',
        fullPath: '/path/to/folder',
        libraryId: 'library-id',
        addedAt: Date.now()
      }
      const folder = new Folder(folderData)
      expect(folder.id).to.equal(folderData.id)
      expect(folder.fullPath).to.equal(folderData.fullPath)
      expect(folder.libraryId).to.equal(folderData.libraryId)
      expect(folder.addedAt).to.equal(folderData.addedAt)

      // Validate OpenAPI spec
      expect(folder.toJSON()).to.satisfySchemaInApiSpec('folder')
    })
  })

  describe('setData method', () => {
    it('should set folder data correctly', () => {
      const data = {
        fullPath: '/path/to/folder',
        libraryId: 'library-id',
      }
      const folder = new Folder()
      folder.setData(data)
      expect(folder.id).to.be.a('string')
      expect(folder.fullPath).to.equal(data.fullPath)
      expect(folder.libraryId).to.equal(data.libraryId)
      expect(folder.addedAt).to.be.a('number')

      // Validate OpenAPI spec
      expect(folder.toJSON()).to.satisfySchemaInApiSpec('folder')
    })
  })

  // Add more test cases as needed for other methods in the Folder class
})