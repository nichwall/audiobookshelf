const uuidv4 = require("uuid").v4
const { getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')

/**
 * @openapi
 * components:
 *   schemas:
 *     seriesId:
 *       type: string
 *       description: The ID of the series.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     seriesName:
 *       description: The name of the series.
 *       type: string
 *       example: Sword of Truth
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