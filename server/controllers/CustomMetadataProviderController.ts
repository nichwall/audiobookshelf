import type { NextFunction, Request, Response as ExpressResponse } from 'express'
import { Body, Delete, Get, Path, Post, Response, Route, Security, SuccessResponse, Tags } from 'tsoa'
import CustomMetadataProvider, { type CustomMetadataProviderAttributes, type CustomMetadataProviderCreationAttributes } from '../models/CustomMetadataProvider'

const Logger: { error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void } = require('../Logger')
const SocketAuthority: { emitter: (event: string, data: unknown) => void } = require('../SocketAuthority')
const validateUrl: (rawUrl: string) => string | null = require('../utils/index').validateUrl

const Database: {
  customMetadataProviderModel: typeof CustomMetadataProvider
  libraryModel: {
    update: (values: { provider: string }, options: { where: { provider: string } }) => Promise<[number]>
  }
} = require('../Database')

interface RequestUser {
  isAdminOrUp: boolean
  username: string
}

type RequestWithUser = Request & { user: RequestUser }

export interface CreateCustomMetadataProviderRequest {
  name: string
  url: string
  mediaType: string
  authHeaderValue?: string
}

export interface CustomMetadataProviderExtraData {
  [key: string]: unknown
}

export interface CustomMetadataProviderResponse {
  id: string
  mediaType: string
  name: string
  url: string
  authHeaderValue: string | null
  extraData: CustomMetadataProviderExtraData | null
  createdAt: Date
  updatedAt: Date
}

export interface GetCustomMetadataProvidersResponse {
  providers: CustomMetadataProviderResponse[]
}

export interface CreateCustomMetadataProviderResponse {
  provider: CustomMetadataProviderResponse
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function isCreateRequest(body: unknown): body is CreateCustomMetadataProviderRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false

  const payload = body as Record<string, unknown>
  return (
    typeof payload.name === 'string' &&
    payload.name.length > 0 &&
    typeof payload.url === 'string' &&
    payload.url.length > 0 &&
    typeof payload.mediaType === 'string' &&
    payload.mediaType.length > 0 &&
    (payload.authHeaderValue === undefined || typeof payload.authHeaderValue === 'string')
  )
}

function toResponse(provider: CustomMetadataProvider): CustomMetadataProviderResponse {
  const attributes: CustomMetadataProviderAttributes = provider.toJSON()
  return attributes
}

@Route('custom-metadata-providers')
@Tags('Custom metadata providers')
@Security('BearerAuth')
export class CustomMetadataProviderController {
  /**
   * Get all custom metadata providers.
   */
  @Get()
  @SuccessResponse('200', 'Custom metadata providers returned')
  @Response<void>(403, 'Administrator permission required')
  async getAll(): Promise<GetCustomMetadataProvidersResponse> {
    const providers = await Database.customMetadataProviderModel.findAll()
    return {
      providers: providers.map(toResponse)
    }
  }

  /**
   * Create a custom metadata provider.
   */
  @Post()
  @SuccessResponse('200', 'Custom metadata provider created')
  @Response<void>(400, 'Invalid request body or URL')
  @Response<void>(403, 'Administrator permission required')
  async create(@Body() body: CreateCustomMetadataProviderRequest): Promise<CreateCustomMetadataProviderResponse> {
    if (!isCreateRequest(body)) throw new RequestError(400, 'Invalid request body')

    const validUrl = validateUrl(body.url)
    if (!validUrl) {
      Logger.error(`[CustomMetadataProviderController] Invalid url "${body.url}"`)
      throw new RequestError(400, 'Invalid url')
    }

    const creationAttributes: CustomMetadataProviderCreationAttributes = {
      name: body.name,
      mediaType: body.mediaType,
      url: validUrl,
      authHeaderValue: body.authHeaderValue || null
    }
    const provider = await Database.customMetadataProviderModel.create(creationAttributes)
    const response = { provider: toResponse(provider) }

    // TODO: Necessary to emit to all clients?
    SocketAuthority.emitter('custom_metadata_provider_added', provider.toClientJson())
    return response
  }

  /**
   * Delete a custom metadata provider and restore affected libraries to their default provider.
   */
  @Delete('{id}')
  @SuccessResponse('200', 'Custom metadata provider deleted')
  @Response<void>(403, 'Administrator permission required')
  @Response<void>(404, 'Custom metadata provider not found')
  async delete(@Path() id: string): Promise<void> {
    const provider = await Database.customMetadataProviderModel.findByPk(id)
    if (!provider) throw new RequestError(404, 'Custom metadata provider not found')

    const providerClientJson = provider.toClientJson()
    const fallbackProvider = provider.mediaType === 'book' ? 'google' : 'itunes'

    await provider.destroy()
    await Database.libraryModel.update(
      { provider: fallbackProvider },
      {
        where: {
          provider: `custom-${id}`
        }
      }
    )

    // TODO: Necessary to emit to all clients?
    SocketAuthority.emitter('custom_metadata_provider_removed', providerClientJson)
  }

  async getAllHandler(_req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    try {
      res.json(await this.getAll())
    } catch (error) {
      next(error)
    }
  }

  async createHandler(req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    if (!isCreateRequest(req.body)) {
      res.status(400).send('Invalid request body')
      return
    }

    try {
      res.json(await this.create(req.body))
    } catch (error) {
      if (error instanceof RequestError) {
        res.status(error.status).send(error.message)
        return
      }
      next(error)
    }
  }

  async deleteHandler(req: RequestWithUser, res: ExpressResponse, next: NextFunction): Promise<void> {
    if (typeof req.params.id !== 'string') {
      res.sendStatus(404)
      return
    }

    try {
      await this.delete(req.params.id)
      res.sendStatus(200)
    } catch (error) {
      if (error instanceof RequestError) {
        res.sendStatus(error.status)
        return
      }
      next(error)
    }
  }

  middleware(req: RequestWithUser, res: ExpressResponse, next: NextFunction): void {
    if (!req.user.isAdminOrUp) {
      Logger.warn(`[CustomMetadataProviderController] Non-admin user "${req.user.username}" attempted access route "${req.path}"`)
      res.sendStatus(403)
      return
    }

    next()
  }

}

export default new CustomMetadataProviderController()
