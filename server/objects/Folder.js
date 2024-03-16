const uuidv4 = require("uuid").v4

/**
 * @openapi
 * components:
 *   schemas:
 *     folderId:
 *       type: string
 *       description: The ID of the folder.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     folder:
 *       type: object
 *       description: Folder used in library
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/folderId'
 *         fullPath:
 *           description: The path on the server for the folder. (Read Only)
 *           type: string
 *           example: /podcasts
 *         libraryId:
 *           $ref: '#/components/schemas/libraryId'
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 */
class Folder {
  constructor(folder = null) {
    this.id = null
    this.fullPath = null
    this.libraryId = null
    this.addedAt = null

    if (folder) {
      this.construct(folder)
    }
  }

  construct(folder) {
    this.id = folder.id
    this.fullPath = folder.fullPath
    this.libraryId = folder.libraryId
    this.addedAt = folder.addedAt
  }

  toJSON() {
    return {
      id: this.id,
      fullPath: this.fullPath,
      libraryId: this.libraryId,
      addedAt: this.addedAt
    }
  }

  setData(data) {
    this.id = data.id || uuidv4()
    this.fullPath = data.fullPath
    this.libraryId = data.libraryId
    this.addedAt = Date.now()
  }
}
module.exports = Folder