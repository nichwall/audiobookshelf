const uuidv4 = require("uuid").v4
const { getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')

/**
 * @openapi
 * components:
 *   schemas:
 *     oldSeriesId:
 *       description: The ID of series on server version 2.2.23 and before.
 *       type: string
 *       format: "ser_[a-z0-9]{18}"
 *       example: ser_o78uaoeuh78h6aoeif
 *     newSeriesId:
 *       type: string
 *       description: The ID of series after 2.3.0.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     seriesId:
 *       type: string
 *       description: The ID of the series.
 *       anyOf:
 *         - $ref: '#/components/schemas/oldSeriesId'
 *         - $ref: '#/components/schemas/newSeriesId'
 *     seriesName:
 *       description: The name of the series.
 *       type: string
 *       example: Sword of Truth
 *     series:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/seriesId'
 *         name:
 *           $ref: '#/components/schemas/seriesName'
 *         description:
 *           description: A description for the series. Will be null if there is none.
 *           type: [string, 'null']
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 *         updatedAt:
 *           $ref: '#/components/schemas/updatedAt'
 *     seriesNumBooks:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/seriesId'
 *         name:
 *           $ref: '#/components/schemas/seriesName'
 *         nameIgnorePrefix:
 *           description: The name of the series with any prefix moved to the end.
 *           type: string
 *           example: Sword of Truth
 *         libraryItemIds:
 *           description: The IDs of the library items in the series.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/libraryItemId'
 *         numBooks:
 *           description: The number of books in the series.
 *           type: integer
 *           example: 1
 *     seriesBooks:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/seriesId'
 *         name:
 *           $ref: '#/components/schemas/seriesName'
 *         nameIgnorePrefix:
 *           description: The name of the series with any prefix moved to the end.
 *           type: string
 *           example: Sword of Truth
 *         nameIgnorePrefixSort:
 *           description: The name of the series with any prefix removed.
 *           type: string
 *           example: Sword of Truth
 *         type:
 *           description: Will always be series.
 *           type: string
 *           example: series
 *         books:
 *           description: The library items that contain the books in the series. A sequence attribute that denotes the position in the series the book is in, is tacked on.
 *           type: array
 *           items: 
 *             $ref: '#/components/schemas/libraryItem'
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 *         totalDuration:
 *           description: The combined duration (in seconds) of all books in the series.
 *           type: number
 *           example: 12000.946
 *     seriesSequence:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/seriesId'
 *         name:
 *           $ref: '#/components/schemas/seriesName'
 *         sequence:
 *           description: The position in the series the book is.
 *           type: string
 *           example: '1'
 */
class Series {
  constructor(series) {
    this.id = null
    this.name = null
    this.description = null
    this.addedAt = null
    this.updatedAt = null
    this.libraryId = null

    if (series) {
      this.construct(series)
    }
  }

  construct(series) {
    this.id = series.id
    this.name = series.name
    this.description = series.description || null
    this.addedAt = series.addedAt
    this.updatedAt = series.updatedAt
    this.libraryId = series.libraryId
  }

  get nameIgnorePrefix() {
    if (!this.name) return ''
    return getTitleIgnorePrefix(this.name)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      nameIgnorePrefix: getTitlePrefixAtEnd(this.name),
      description: this.description,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      libraryId: this.libraryId
    }
  }

  toJSONMinimal(sequence) {
    return {
      id: this.id,
      name: this.name,
      sequence
    }
  }

  setData(data, libraryId) {
    this.id = uuidv4()
    this.name = data.name
    this.description = data.description || null
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
    this.libraryId = libraryId
  }

  update(series) {
    if (!series) return false
    const keysToUpdate = ['name', 'description']
    let hasUpdated = false
    for (const key of keysToUpdate) {
      if (series[key] !== undefined && series[key] !== this[key]) {
        this[key] = series[key]
        hasUpdated = true
      }
    }
    return hasUpdated
  }

  checkNameEquals(name) {
    if (!name || !this.name) return false
    return this.name.toLowerCase() == name.toLowerCase().trim()
  }
}
module.exports = Series