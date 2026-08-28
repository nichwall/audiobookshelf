import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express'
import * as Path from 'path'
import { Body, Get, Post, Query, Request, Response, Route, Security, SuccessResponse, Tags } from 'tsoa'

const Logger: { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void } = require('../Logger')
const fs: { pathExists: (path: string) => Promise<boolean> } = require('../libs/fsExtra')
const toNumber: (value: unknown, fallback?: number) => number = require('../utils/index').toNumber
const fileUtils: {
  filePathToPOSIX: (path: string) => string
  getDirectoriesInPath: (path: string, level: number) => Promise<Directory[]>
  getWindowsDrives: () => Promise<string[]>
  isSameOrSubPath: (parentPath: string, childPath: string) => boolean
} = require('../utils/fileUtils')
const Database: {
  libraryFolderModel: { findOne: (options: { where: { path: string } }) => Promise<LibraryFolder | null> }
  libraryItemModel: { findOne: (options: { where: { path: string[] } }) => Promise<LibraryItem | null> }
} = require('../Database')

interface RequestUser {
  isAdminOrUp: boolean
  canUpload: boolean
  username: string
  checkCanAccessLibrary: (libraryId: string) => boolean
}

type RequestWithUser = ExpressRequest & { user: RequestUser }

interface Directory {
  path: string
  dirname: string
  level: number
}

interface LibraryFolder {
  path: string
  libraryId: string
}

interface LibraryItem {
  title: string
}

export interface GetPathsResponse {
  posix: boolean
  directories: Directory[]
}

export interface CheckPathExistsRequest {
  directory: string
  folderPath: string
}

export interface CheckPathExistsResponse {
  exists: boolean
  libraryItemTitle?: string
}

export interface InvalidRequestResponse {
  error: string
}

type ErrorResponseKind = 'status' | 'text' | 'json'

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly responseKind: ErrorResponseKind,
    message = ''
  ) {
    super(message)
  }
}

function isCheckPathExistsRequest(body: unknown): body is CheckPathExistsRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false

  const payload = body as Record<string, unknown>
  return typeof payload.directory === 'string' && payload.directory.length > 0 && typeof payload.folderPath === 'string' && payload.folderPath.length > 0
}

function sendRequestError(res: ExpressResponse, error: RequestError): void {
  if (error.responseKind === 'json') {
    res.status(error.status).json({ error: error.message })
    return
  }
  if (error.responseKind === 'text') {
    res.status(error.status).send(error.message)
    return
  }
  res.sendStatus(error.status)
}

@Route('filesystem')
@Tags('Filesystem')
@Security('BearerAuth')
export class FileSystemController {
  /**
   * List directories at an absolute path, or at the filesystem root.
   */
  @Get()
  @SuccessResponse('200', 'Directories returned')
  @Response<void>(400, 'Invalid path query string')
  @Response<void>(403, 'Administrator permission required')
  async getPaths(@Request() req: RequestWithUser, @Query('path') relpath?: string, @Query() level?: number): Promise<GetPathsResponse> {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[FileSystemController] Non-admin user "${req.user.username}" attempting to get filesystem paths`)
      throw new RequestError(403, 'status')
    }

    const appEnvironment = global as typeof globalThis & { isWin: boolean; appRoot: string }
    const directoryLevel = level ?? 0

    // Validate path. Must be absolute
    if (relpath && (!Path.isAbsolute(relpath) || !(await fs.pathExists(relpath)))) {
      Logger.error(`[FileSystemController] Invalid path in query string "${relpath}"`)
      throw new RequestError(400, 'text', 'Invalid "path" query string')
    }
    Logger.debug(`[FileSystemController] Getting file paths at ${relpath || 'root'} (${directoryLevel})`)

    let directories: Directory[] = []

    // Windows returns drives first
    if (appEnvironment.isWin) {
      if (relpath) {
        directories = await fileUtils.getDirectoriesInPath(relpath, directoryLevel)
      } else {
        const drives = await fileUtils.getWindowsDrives().catch((error: unknown) => {
          Logger.error('[FileSystemController] Failed to get windows drives', error)
          return []
        })
        if (drives.length) {
          directories = drives.map((drive) => ({
            path: drive,
            dirname: drive,
            level: 0
          }))
        }
      }
    } else {
      directories = await fileUtils.getDirectoriesInPath(relpath || '/', directoryLevel)
    }

    // Exclude some dirs from this project to be cleaner in Docker
    const excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc', '.devcontainer', '.nyc_output', '.github', '.vscode'].map((dirname) => {
      return fileUtils.filePathToPOSIX(Path.join(appEnvironment.appRoot, dirname))
    })
    directories = directories.filter((directory) => !excludedDirs.includes(directory.path))

    return {
      posix: !appEnvironment.isWin,
      directories
    }
  }

  /**
   * Check whether a path exists inside a library folder.
   */
  @Post('pathexists')
  @SuccessResponse('200', 'Path existence returned')
  @Response<InvalidRequestResponse>(400, 'Invalid request body or path outside library folder')
  @Response<void>(403, 'Upload permission and library access required')
  @Response<void>(404, 'Library folder not found')
  async checkPathExists(@Body() body: CheckPathExistsRequest, @Request() req: RequestWithUser): Promise<CheckPathExistsResponse> {
    if (!req.user.canUpload) {
      Logger.error(`[FileSystemController] User "${req.user.username}" without upload permissions attempting to check path exists`)
      throw new RequestError(403, 'status')
    }

    if (!isCheckPathExistsRequest(body as unknown)) {
      Logger.error(`[FileSystemController] Invalid request body: ${JSON.stringify(body)}`)
      throw new RequestError(400, 'json', 'Invalid request body')
    }

    const { directory, folderPath } = body

    // Check that library folder exists
    const libraryFolder = await Database.libraryFolderModel.findOne({
      where: {
        path: folderPath
      }
    })

    if (!libraryFolder) {
      Logger.error(`[FileSystemController] Library folder not found: ${folderPath}`)
      throw new RequestError(404, 'status')
    }

    if (!req.user.checkCanAccessLibrary(libraryFolder.libraryId)) {
      Logger.error(`[FileSystemController] User "${req.user.username}" attempting to check path exists for library "${libraryFolder.libraryId}" without access`)
      throw new RequestError(403, 'status')
    }

    let filepath = Path.join(libraryFolder.path, directory)
    filepath = fileUtils.filePathToPOSIX(filepath)

    // Ensure filepath is inside library folder (prevents directory traversal)
    if (!fileUtils.isSameOrSubPath(libraryFolder.path, filepath)) {
      Logger.error(`[FileSystemController] Filepath is not inside library folder: ${filepath}`)
      throw new RequestError(400, 'status')
    }

    if (await fs.pathExists(filepath)) {
      return { exists: true }
    }

    // Check if a library item exists in a subdirectory
    // See: https://github.com/advplyr/audiobookshelf/issues/4146
    const cleanedDirectory = directory.split('/').filter(Boolean).join('/')
    if (cleanedDirectory.includes('/')) {
      // Can only be 2 levels deep
      const possiblePaths: string[] = []
      const subdir = Path.dirname(directory)
      possiblePaths.push(fileUtils.filePathToPOSIX(Path.join(folderPath, subdir)))
      if (subdir.includes('/')) {
        possiblePaths.push(fileUtils.filePathToPOSIX(Path.join(folderPath, Path.dirname(subdir))))
      }

      const libraryItem = await Database.libraryItemModel.findOne({
        where: {
          path: possiblePaths
        }
      })

      if (libraryItem) {
        return {
          exists: true,
          libraryItemTitle: libraryItem.title
        }
      }
    }

    return { exists: false }
  }

  async getPathsHandler(req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    const relpath = req.query.path as string | undefined
    const level = toNumber(req.query.level, 0)

    try {
      res.json(await this.getPaths(req, relpath, level))
    } catch (error) {
      if (error instanceof RequestError) {
        sendRequestError(res, error)
        return
      }
      next(error)
    }
  }

  async checkPathExistsHandler(req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    try {
      res.json(await this.checkPathExists(req.body as CheckPathExistsRequest, req))
    } catch (error) {
      if (error instanceof RequestError) {
        sendRequestError(res, error)
        return
      }
      next(error)
    }
  }
}

export default new FileSystemController()
