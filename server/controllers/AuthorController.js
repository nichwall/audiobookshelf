const sequelize = require('sequelize')
const fs = require('../libs/fsExtra')
const { createNewSortInstance } = require('../libs/fastSort')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')
const AuthorFinder = require('../finders/AuthorFinder')

const { reqSupportsWebp } = require('../utils/index')

/**
 * @openapi
 * components:
 *   parameters:
 *     authorID:
 *       name: id
 *       in: path
 *       description: Author ID
 *       required: true
 *       schema:
 *         $ref: '#/components/schemas/authorId'
 *     authorInclude:
 *       name: include
 *       in: query
 *       description: A comma separated list of what to include with the author. The options are `items` and `series`. `series` will only have an effect if `items` is included.
 *       required: false
 *       schema:
 *         type: string
 *         example: "items"
 *       examples:
 *         empty:
 *           summary: Do not return library items
 *           value: ""
 *         itemOnly:
 *           summary: Only return library items
 *           value: "items"
 *         itemsAndSeries:
 *           summary: Return library items and series
 *           value: "items,series"
 *     authorLibraryId:
 *       name: library
 *       in: query
 *       description: The ID of the library to to include filter included items from.
 *       required: false
 *       schema:
 *         $ref: '#/components/schemas/libraryId'
 *     asin:
 *       name: asin
 *       in: query
 *       description: The Audible Identifier (ASIN).
 *       required: false
 *       schema:
 *         $ref: '#/components/schemas/authorASIN'
 *     authorSearchName:
 *       name: q
 *       in: query
 *       description: The name of the author to use for searching.
 *       required: false
 *       schema:
 *         type: string
 *         example: Terry Goodkind
 *     authorName:
 *       name: name
 *       in: query
 *       description: The new name of the author.
 *       required: false
 *       schema:
 *         $ref: '#/components/schemas/authorName'
 *     authorDescription:
 *       name: description
 *       in: query
 *       description: The new description of the author.
 *       required: false
 *       schema:
 *         type: string
 *         nullable: true
 *         example: Terry Goodkind is a #1 New York Times Bestselling Author and creator of the critically acclaimed masterwork, ‘The Sword of Truth’. He has written 30+ major, bestselling novels, has been published in more than 20 languages world-wide, and has sold more than 26 Million books. ‘The Sword of Truth’ is a revered literary tour de force, comprised of 17 volumes, borne from over 25 years of dedicated writing.
 *     authorImagePath:
 *       name: imagePath
 *       in: query
 *       description: The new absolute path for the author image.
 *       required: false
 *       schema:
 *         type: string
 *         nullable: true
 *         example: /metadata/authors/aut_z3leimgybl7uf3y4ab.jpg
 *     imageURL:
 *       name: url
 *       in: query
 *       description: The URL of the image to add to the server
 *       required: true
 *       schema:
 *         type: string
 *         format: uri
 *         example: https://images-na.ssl-images-amazon.com/images/I/51NoQTm33OL.__01_SX120_CR0,0,120,120__.jpg
 *     imageWidth:
 *       name: width
 *       in: query
 *       description: The requested width of image in pixels.
 *       schema:
 *         type: integer
 *         default: 400
 *         example: 400
 *       example: 400
 *     imageHeight:
 *       name: height
 *       in: query
 *       description: The requested height of image in pixels. If `null`, the height is scaled to maintain aspect ratio based on the requested width.
 *       schema:
 *         type: integer
 *         nullable: true
 *         default: null
 *         example: 600
 *       examples:
 *         scaleHeight:
 *           summary: Scale height with width
 *           value: null
 *         fixedHeight:
 *           summary: Force height of image
 *           value: 600
 *     imageFormat:
 *       name: format
 *       in: query
 *       description: The requested output format.
 *       schema:
 *         type: string
 *         default: jpeg
 *         example: webp
 *     imageRaw:
 *       name: raw
 *       in: query
 *       description: Return the raw image without scaling if true.
 *       schema:
 *         type: boolean
 *         default: false
 *   responses: 
 *     ok200:
 *       description: OK
 *     author404:
 *       description: Author not found.
 *       content:
 *         text/html:
 *           schema:
 *             type: string
 *             example: Not found
 */

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})
class AuthorController {
  constructor() { }

  async findOne(req, res) {
    const include = (req.query.include || '').split(',')

    const authorJson = req.author.toJSON()

    // Used on author landing page to include library items and items grouped in series
    if (include.includes('items')) {
      authorJson.libraryItems = await Database.libraryItemModel.getForAuthor(req.author, req.user)

      if (include.includes('series')) {
        const seriesMap = {}
        // Group items into series
        authorJson.libraryItems.forEach((li) => {
          if (li.media.metadata.series) {
            li.media.metadata.series.forEach((series) => {

              const itemWithSeries = li.toJSONMinified()
              itemWithSeries.media.metadata.series = series

              if (seriesMap[series.id]) {
                seriesMap[series.id].items.push(itemWithSeries)
              } else {
                seriesMap[series.id] = {
                  id: series.id,
                  name: series.name,
                  items: [itemWithSeries]
                }
              }
            })
          }
        })
        // Sort series items
        for (const key in seriesMap) {
          seriesMap[key].items = naturalSort(seriesMap[key].items).asc(li => li.media.metadata.series.sequence)
        }

        authorJson.series = Object.values(seriesMap)
      }

      // Minify library items
      authorJson.libraryItems = authorJson.libraryItems.map(li => li.toJSONMinified())
    }

    return res.json(authorJson)
  }

  async update(req, res) {
    const payload = req.body
    let hasUpdated = false

    // author imagePath must be set through other endpoints as of v2.4.5
    if (payload.imagePath !== undefined) {
      Logger.warn(`[AuthorController] Updating local author imagePath is not supported`)
      delete payload.imagePath
    }

    const authorNameUpdate = payload.name !== undefined && payload.name !== req.author.name

    // Check if author name matches another author and merge the authors
    let existingAuthor = null
    if (authorNameUpdate) {
      const author = await Database.authorModel.findOne({
        where: {
          id: {
            [sequelize.Op.not]: req.author.id
          },
          name: payload.name
        }
      })
      existingAuthor = author?.getOldAuthor()
    }
    if (existingAuthor) {
      const bookAuthorsToCreate = []
      const itemsWithAuthor = await Database.libraryItemModel.getForAuthor(req.author)
      itemsWithAuthor.forEach(libraryItem => { // Replace old author with merging author for each book
        libraryItem.media.metadata.replaceAuthor(req.author, existingAuthor)
        bookAuthorsToCreate.push({
          bookId: libraryItem.media.id,
          authorId: existingAuthor.id
        })
      })
      if (itemsWithAuthor.length) {
        await Database.removeBulkBookAuthors(req.author.id) // Remove all old BookAuthor
        await Database.createBulkBookAuthors(bookAuthorsToCreate) // Create all new BookAuthor
        SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
      }

      // Remove old author
      await Database.removeAuthor(req.author.id)
      SocketAuthority.emitter('author_removed', req.author.toJSON())
      // Update filter data
      Database.removeAuthorFromFilterData(req.author.libraryId, req.author.id)

      // Send updated num books for merged author
      const numBooks = (await Database.libraryItemModel.getForAuthor(existingAuthor)).length
      SocketAuthority.emitter('author_updated', existingAuthor.toJSONExpanded(numBooks))

      res.json({
        author: existingAuthor.toJSON(),
        merged: true
      })
    } else { // Regular author update
      if (req.author.update(payload)) {
        hasUpdated = true
      }

      if (hasUpdated) {
        req.author.updatedAt = Date.now()

        const itemsWithAuthor = await Database.libraryItemModel.getForAuthor(req.author)
        if (authorNameUpdate) { // Update author name on all books
          itemsWithAuthor.forEach(libraryItem => {
            libraryItem.media.metadata.updateAuthor(req.author)
          })
          if (itemsWithAuthor.length) {
            SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
          }
        }

        await Database.updateAuthor(req.author)
        SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(itemsWithAuthor.length))
      }

      res.json({
        author: req.author.toJSON(),
        updated: hasUpdated
      })
    }
  }

  /**
   * DELETE: /api/authors/:id
   * Remove author from all books and delete
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async delete(req, res) {
    Logger.info(`[AuthorController] Removing author "${req.author.name}"`)

    await Database.authorModel.removeById(req.author.id)

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id) // Purge cache
    }

    SocketAuthority.emitter('author_removed', req.author.toJSON())

    // Update filter data
    Database.removeAuthorFromFilterData(req.author.libraryId, req.author.id)

    res.sendStatus(200)
  }

  /**
   * POST: /api/authors/:id/image
   * Upload author image from web URL
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async uploadImage(req, res) {
    if (!req.user.canUpload) {
      Logger.warn('User attempted to upload an image without permission', req.user)
      return res.sendStatus(403)
    }
    if (!req.body.url) {
      Logger.error(`[AuthorController] Invalid request payload. 'url' not in request body`)
      return res.status(400).send(`Invalid request payload. 'url' not in request body`)
    }
    if (!req.body.url.startsWith?.('http:') && !req.body.url.startsWith?.('https:')) {
      Logger.error(`[AuthorController] Invalid request payload. Invalid url "${req.body.url}"`)
      return res.status(400).send(`Invalid request payload. Invalid url "${req.body.url}"`)
    }

    Logger.debug(`[AuthorController] Requesting download author image from url "${req.body.url}"`)
    const result = await AuthorFinder.saveAuthorImage(req.author.id, req.body.url)

    if (result?.error) {
      return res.status(400).send(result.error)
    } else if (!result?.path) {
      return res.status(500).send('Unknown error occurred')
    }

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id) // Purge cache
    }

    req.author.imagePath = result.path
    await Database.authorModel.updateFromOld(req.author)

    const numBooks = (await Database.libraryItemModel.getForAuthor(req.author)).length
    SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(numBooks))
    res.json({
      author: req.author.toJSON()
    })
  }

  /**
   * DELETE: /api/authors/:id/image
   * Remove author image & delete image file
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async deleteImage(req, res) {
    if (!req.author.imagePath) {
      Logger.error(`[AuthorController] Author "${req.author.imagePath}" has no imagePath set`)
      return res.status(400).send('Author has no image path set')
    }
    Logger.info(`[AuthorController] Removing image for author "${req.author.name}" at "${req.author.imagePath}"`)
    await CacheManager.purgeImageCache(req.author.id) // Purge cache
    await CoverManager.removeFile(req.author.imagePath)
    req.author.imagePath = null
    await Database.authorModel.updateFromOld(req.author)

    const numBooks = (await Database.libraryItemModel.getForAuthor(req.author)).length
    SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(numBooks))
    res.json({
      author: req.author.toJSON()
    })
  }

  async match(req, res) {
    let authorData = null
    const region = req.body.region || 'us'
    if (req.body.asin) {
      authorData = await AuthorFinder.findAuthorByASIN(req.body.asin, region)
    } else {
      authorData = await AuthorFinder.findAuthorByName(req.body.q, region)
    }
    if (!authorData) {
      return res.status(404).send('Author not found')
    }
    Logger.debug(`[AuthorController] match author with "${req.body.q || req.body.asin}"`, authorData)

    let hasUpdates = false
    if (authorData.asin && req.author.asin !== authorData.asin) {
      req.author.asin = authorData.asin
      hasUpdates = true
    }

    // Only updates image if there was no image before or the author ASIN was updated
    if (authorData.image && (!req.author.imagePath || hasUpdates)) {
      await CacheManager.purgeImageCache(req.author.id)

      const imageData = await AuthorFinder.saveAuthorImage(req.author.id, authorData.image)
      if (imageData?.path) {
        req.author.imagePath = imageData.path
        hasUpdates = true
      }
    }

    if (authorData.description && req.author.description !== authorData.description) {
      req.author.description = authorData.description
      hasUpdates = true
    }

    if (hasUpdates) {
      req.author.updatedAt = Date.now()

      await Database.updateAuthor(req.author)

      const numBooks = (await Database.libraryItemModel.getForAuthor(req.author)).length
      SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(numBooks))
    }

    res.json({
      updated: hasUpdates,
      author: req.author
    })
  }

  // GET api/authors/:id/image
  async getImage(req, res) {
    const { query: { width, height, format, raw }, author } = req

    if (raw) { // any value
      if (!author.imagePath || !await fs.pathExists(author.imagePath)) {
        return res.sendStatus(404)
      }

      return res.sendFile(author.imagePath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return CacheManager.handleAuthorCache(res, author, options)
  }

  async middleware(req, res, next) {
    const author = await Database.authorModel.getOldById(req.params.id)
    if (!author) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[AuthorController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[AuthorController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.author = author
    next()
  }
}
module.exports = new AuthorController()