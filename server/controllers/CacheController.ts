import type { Response as ExpressResponse } from 'express'
import { Inject, Post, Request, Response, Route, Security, SuccessResponse, Tags } from 'tsoa'

const CacheManager: {
  purgeAll: () => Promise<void>
  purgeItems: () => Promise<void>
} = require('../managers/CacheManager')

interface RequestWithUser {
  user: {
    isAdminOrUp: boolean
  }
}

@Route('cache')
@Tags('Cache')
@Security('BearerAuth')
export class CacheController {
  /**
   * Purge all server caches.
   */
  @Post('purge')
  @SuccessResponse('200', 'All caches purged')
  @Response<void>(403, 'Administrator permission required')
  async purgeCache(@Request() req: RequestWithUser, @Inject() res: ExpressResponse): Promise<void> {
    if (!req.user.isAdminOrUp) {
      res.sendStatus(403)
      return
    }

    await CacheManager.purgeAll()
    res.sendStatus(200)
  }

  /**
   * Purge cached library items.
   */
  @Post('items/purge')
  @SuccessResponse('200', 'Item cache purged')
  @Response<void>(403, 'Administrator permission required')
  async purgeItemsCache(@Request() req: RequestWithUser, @Inject() res: ExpressResponse): Promise<void> {
    if (!req.user.isAdminOrUp) {
      res.sendStatus(403)
      return
    }

    await CacheManager.purgeItems()
    res.sendStatus(200)
  }
}

export default new CacheController()
