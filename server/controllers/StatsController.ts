import type { NextFunction, Request, Response as ExpressResponse } from 'express'
import { Get, Path, Response, Route, Security, SuccessResponse, Tags } from 'tsoa'

const Logger: { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void } = require('../Logger')
const adminStats: {
  getTotalSize: () => Promise<MediaSizeStats>
  getNumAudioFiles: () => Promise<AudioFileStats>
  getStatsForYear: (year: number) => Promise<YearStatsResponse>
} = require('../utils/queries/adminStats')

interface RequestUser {
  isAdminOrUp: boolean
  username: string
}

type RequestWithUser = Request & { user: RequestUser }

export interface SizeStats {
  totalSize: number
  numItems: number
}

interface MediaSizeStats {
  books: SizeStats
  podcasts: SizeStats
  total: SizeStats
}

interface AudioFileStats {
  numBookAudioFiles: number
  numPodcastAudioFiles: number
  numAudioFiles: number
}

export interface ServerStatsResponse {
  books: SizeStats & { numAudioFiles: number }
  podcasts: SizeStats & { numAudioFiles: number }
  total: SizeStats & { numAudioFiles: number }
}

interface ListeningStat {
  time: number
}

interface AuthorListeningStat extends ListeningStat {
  name: string
}

interface GenreListeningStat extends ListeningStat {
  genre: string
}

export interface YearStatsResponse {
  numListeningSessions: number
  numBooksAdded: number
  numAuthorsAdded: number
  totalBooksAddedSize: number
  totalBooksAddedDuration: number
  booksAddedWithCovers: string[]
  totalBooksSize: number
  totalBooksDuration: number
  totalListeningTime: number
  numBooks: number
  topAuthors: AuthorListeningStat[]
  topNarrators: AuthorListeningStat[]
  topGenres: GenreListeningStat[]
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 9999
}

@Route('stats')
@Tags('Statistics')
@Security('BearerAuth')
export class StatsController {
  /**
   * Get aggregate server media statistics.
   *
   * Currently not in use by the client.
   */
  @Get('server')
  @SuccessResponse('200', 'Server statistics returned')
  @Response<void>(403, 'Administrator permission required')
  async getServerStats(): Promise<ServerStatsResponse> {
    Logger.debug('[StatsController] getServerStats')
    const totalSize = await adminStats.getTotalSize()
    const numAudioFiles = await adminStats.getNumAudioFiles()

    return {
      books: {
        ...totalSize.books,
        numAudioFiles: numAudioFiles.numBookAudioFiles
      },
      podcasts: {
        ...totalSize.podcasts,
        numAudioFiles: numAudioFiles.numPodcastAudioFiles
      },
      total: {
        ...totalSize.total,
        numAudioFiles: numAudioFiles.numAudioFiles
      }
    }
  }

  /**
   * Get aggregate server statistics for a calendar year.
   */
  @Get('year/{year}')
  @SuccessResponse('200', 'Year statistics returned')
  @Response<void>(400, 'Invalid year')
  @Response<void>(403, 'Administrator permission required')
  async getAdminStatsForYear(@Path() year: number): Promise<YearStatsResponse> {
    if (!isValidYear(year)) {
      Logger.error(`[StatsController] Invalid year "${year}"`)
      throw new RequestError(400, 'Invalid year')
    }

    return adminStats.getStatsForYear(year)
  }

  async getServerStatsHandler(_req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    try {
      res.json(await this.getServerStats())
    } catch (error) {
      next(error)
    }
  }

  async getAdminStatsForYearHandler(req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    const year = Number(req.params.year)

    try {
      res.json(await this.getAdminStatsForYear(year))
    } catch (error) {
      if (error instanceof RequestError) {
        res.status(error.status).send(error.message)
        return
      }
      next(error)
    }
  }

  middleware(req: RequestWithUser, res: ExpressResponse, next: NextFunction): void {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[StatsController] Non-admin user "${req.user.username}" attempted to access stats route`)
      res.sendStatus(403)
      return
    }

    next()
  }
}

export default new StatsController()
