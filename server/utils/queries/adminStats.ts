import { Op } from 'sequelize'

const Database: DatabaseModels = require('../../Database')
const fsExtra: { pathExists: (path: string) => Promise<boolean> } = require('../../libs/fsExtra')

interface MediaMetadata {
  authors?: Array<{ name: string }>
  narrators?: string[]
  genres?: string[]
}

interface PlaybackSession {
  timeListening?: number
  mediaMetadata?: MediaMetadata
}

interface LibraryItem {
  id: string
  size?: number
}

interface Book {
  coverPath?: string
  duration?: number
  libraryItem: LibraryItem
}

interface TotalStatsRow {
  totalSize?: number
  totalDuration?: number
  totalItems?: number
}

interface MediaTypeStatsRow {
  mediaType: string
  totalSize?: number
  numItems?: number
}

interface AudioFileStatsRow {
  numAudioFiles?: number
}

interface SizeStats {
  totalSize: number
  numItems: number
}

interface YearStats {
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
  topAuthors: Array<{ name: string; time: number }>
  topNarrators: Array<{ name: string; time: number }>
  topGenres: Array<{ genre: string; time: number }>
}

interface DatabaseModels {
  playbackSessionModel: { findAll: (options: unknown) => Promise<PlaybackSession[]> }
  authorModel: { count: (options: unknown) => Promise<number> }
  bookModel: { findAll: (options: unknown) => Promise<Book[]> }
  libraryItemModel: unknown
  podcastEpisodeModel: { count: () => Promise<number> }
  sequelize: {
    query: <Row extends object>(query: string, options?: { replacements?: Record<string, number> }) => Promise<[Row[], unknown]>
    random: () => unknown
  }
}

class AdminStats {
  async getListeningSessionsForYear(year: number): Promise<PlaybackSession[]> {
    return Database.playbackSessionModel.findAll({
      where: {
        createdAt: {
          [Op.gte]: `${year}-01-01`,
          [Op.lt]: `${year + 1}-01-01`
        }
      }
    })
  }

  async getNumAuthorsAddedForYear(year: number): Promise<number> {
    return Database.authorModel.count({
      where: {
        createdAt: {
          [Op.gte]: `${year}-01-01`,
          [Op.lt]: `${year + 1}-01-01`
        }
      }
    })
  }

  async getBooksAddedForYear(year: number): Promise<Book[]> {
    return Database.bookModel.findAll({
      attributes: ['id', 'title', 'coverPath', 'duration', 'createdAt'],
      where: {
        createdAt: {
          [Op.gte]: `${year}-01-01`,
          [Op.lt]: `${year + 1}-01-01`
        }
      },
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'mediaId', 'mediaType', 'size'],
        required: true
      },
      order: Database.sequelize.random()
    })
  }

  async getStatsForYear(year: number): Promise<YearStats> {
    const booksAdded = await this.getBooksAddedForYear(year)

    let totalBooksAddedSize = 0
    let totalBooksAddedDuration = 0
    const booksWithCovers: string[] = []

    for (const book of booksAdded) {
      // Grab first 25 that have a cover
      if (book.coverPath && !booksWithCovers.includes(book.libraryItem.id) && booksWithCovers.length < 25 && (await fsExtra.pathExists(book.coverPath))) {
        booksWithCovers.push(book.libraryItem.id)
      }
      if (book.duration && !isNaN(book.duration)) {
        totalBooksAddedDuration += book.duration
      }
      if (book.libraryItem.size && !isNaN(book.libraryItem.size)) {
        totalBooksAddedSize += book.libraryItem.size
      }
    }

    const numAuthorsAdded = await this.getNumAuthorsAddedForYear(year)

    const authorListeningMap: Record<string, number> = {}
    const narratorListeningMap: Record<string, number> = {}
    const genreListeningMap: Record<string, number> = {}

    const listeningSessions = await this.getListeningSessionsForYear(year)
    let totalListeningTime = 0
    for (const listeningSession of listeningSessions) {
      totalListeningTime += listeningSession.timeListening || 0

      const authors = listeningSession.mediaMetadata?.authors || []
      authors.forEach((author) => {
        if (!authorListeningMap[author.name]) authorListeningMap[author.name] = 0
        authorListeningMap[author.name] += listeningSession.timeListening || 0
      })

      const narrators = listeningSession.mediaMetadata?.narrators || []
      narrators.forEach((narrator) => {
        if (!narratorListeningMap[narrator]) narratorListeningMap[narrator] = 0
        narratorListeningMap[narrator] += listeningSession.timeListening || 0
      })

      // Filter out bad genres like "audiobook" and "audio book"
      const genres = (listeningSession.mediaMetadata?.genres || []).filter((genre) => genre && !genre.toLowerCase().includes('audiobook') && !genre.toLowerCase().includes('audio book'))
      genres.forEach((genre) => {
        if (!genreListeningMap[genre]) genreListeningMap[genre] = 0
        genreListeningMap[genre] += listeningSession.timeListening || 0
      })
    }

    const topAuthors = Object.keys(authorListeningMap)
      .map((authorName) => ({
        name: authorName,
        time: Math.round(authorListeningMap[authorName])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    const topNarrators = Object.keys(narratorListeningMap)
      .map((narratorName) => ({
        name: narratorName,
        time: Math.round(narratorListeningMap[narratorName])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    const topGenres = Object.keys(genreListeningMap)
      .map((genre) => ({
        genre,
        time: Math.round(genreListeningMap[genre])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    // Stats for total books, size and duration for everything added this year or earlier
    const [totalStatResultsRow] = await Database.sequelize.query<TotalStatsRow>(`SELECT SUM(li.size) AS totalSize, SUM(b.duration) AS totalDuration, COUNT(*) AS totalItems FROM libraryItems li, books b WHERE b.id = li.mediaId AND li.mediaType = 'book' AND li.createdAt < ":nextYear-01-01";`, {
      replacements: {
        nextYear: year + 1
      }
    })
    const totalStatResults = totalStatResultsRow[0]

    return {
      numListeningSessions: listeningSessions.length,
      numBooksAdded: booksAdded.length,
      numAuthorsAdded,
      totalBooksAddedSize,
      totalBooksAddedDuration: Math.round(totalBooksAddedDuration),
      booksAddedWithCovers: booksWithCovers,
      totalBooksSize: totalStatResults?.totalSize || 0,
      totalBooksDuration: totalStatResults?.totalDuration || 0,
      totalListeningTime,
      numBooks: totalStatResults?.totalItems || 0,
      topAuthors,
      topNarrators,
      topGenres
    }
  }

  async getTotalSize(): Promise<{ books: SizeStats; podcasts: SizeStats; total: SizeStats }> {
    const [mediaTypeStats] = await Database.sequelize.query<MediaTypeStatsRow>('SELECT li.mediaType, SUM(li.size) AS totalSize, COUNT(*) AS numItems FROM libraryItems li group by li.mediaType;')
    const bookStats = mediaTypeStats.find((mediaTypeStat) => mediaTypeStat.mediaType === 'book')
    const podcastStats = mediaTypeStats.find((mediaTypeStat) => mediaTypeStat.mediaType === 'podcast')

    return {
      books: {
        totalSize: bookStats?.totalSize || 0,
        numItems: bookStats?.numItems || 0
      },
      podcasts: {
        totalSize: podcastStats?.totalSize || 0,
        numItems: podcastStats?.numItems || 0
      },
      total: {
        totalSize: (bookStats?.totalSize || 0) + (podcastStats?.totalSize || 0),
        numItems: (bookStats?.numItems || 0) + (podcastStats?.numItems || 0)
      }
    }
  }

  async getNumAudioFiles(): Promise<{ numBookAudioFiles: number; numPodcastAudioFiles: number; numAudioFiles: number }> {
    const [numBookAudioFilesRow] = await Database.sequelize.query<AudioFileStatsRow>('SELECT SUM(json_array_length(b.audioFiles)) AS numAudioFiles FROM books b;')
    const numBookAudioFiles = numBookAudioFilesRow[0]?.numAudioFiles || 0
    const numPodcastAudioFiles = await Database.podcastEpisodeModel.count()
    return {
      numBookAudioFiles,
      numPodcastAudioFiles,
      numAudioFiles: numBookAudioFiles + numPodcastAudioFiles
    }
  }
}

export default new AdminStats()
