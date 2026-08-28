import { DataTypes, Model, type CreationOptional, type Sequelize } from 'sequelize'

export interface CustomMetadataProviderAttributes {
  id: string
  mediaType: string
  name: string
  url: string
  authHeaderValue: string | null
  extraData: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomMetadataProviderCreationAttributes {
  id?: string
  mediaType: string
  name: string
  url: string
  authHeaderValue?: string | null
  extraData?: Record<string, unknown> | null
}

export interface ClientCustomMetadataProvider {
  id: string
  mediaType: string
  name: string
  url: string
  slug: string
}

export default class CustomMetadataProvider extends Model<CustomMetadataProviderAttributes, CustomMetadataProviderCreationAttributes> {
  declare id: CreationOptional<string>
  declare mediaType: string
  declare name: string
  declare url: string
  declare authHeaderValue: string | null
  declare extraData: Record<string, unknown> | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static async getForClientByMediaType(mediaType: string): Promise<ClientCustomMetadataProvider[]> {
    if (mediaType !== 'book') return []

    const customMetadataProviders = await this.findAll({
      where: {
        mediaType
      }
    })
    return customMetadataProviders.map((provider) => provider.toClientJson())
  }

  static async checkExistsBySlug(providerSlug: string): Promise<boolean> {
    const providerId = providerSlug?.split?.('custom-')[1]
    if (!providerId) return false

    return (await this.count({ where: { id: providerId } })) > 0
  }

  static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        mediaType: DataTypes.STRING,
        url: DataTypes.STRING,
        authHeaderValue: DataTypes.STRING,
        extraData: DataTypes.JSON,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      {
        sequelize,
        modelName: 'customMetadataProvider'
      }
    )
  }

  getSlug(): string {
    return `custom-${this.id}`
  }

  toClientJson(): ClientCustomMetadataProvider {
    return {
      id: this.id,
      name: this.name,
      mediaType: this.mediaType,
      url: this.url,
      slug: this.getSlug()
    }
  }
}
