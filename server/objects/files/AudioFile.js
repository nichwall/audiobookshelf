const { AudioMimeType } = require('../../utils/constants')
const AudioMetaTags = require('../metadata/AudioMetaTags')
const FileMetadata = require('../metadata/FileMetadata')

/**
 * @openapi
 * components:
 *   schemas:
 *     audioFile:
 *       type: object
 *       properties:
 *         index:
 *           description: The index of the audio file.
 *           type: integer
 *           example: 1
 *         ino:
 *           description: The inode of the audio file.
 *           type: string
 *           example: '649644248522215260'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the audio file was added to the library.
 *           type: integer
 *           example: 1650621074131
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the audio file last updated. (Read Only)
 *           type: integer
 *           example: 1651830828023
 *         trackNumFromMeta:
 *           description: The track number of the audio file as pulled from the file's metadata. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 1
 *         discNumFromMeta:
 *           description: The disc number of the audio file as pulled from the file's metadata. Will be null if unknown.
 *           type: [string, 'null']
 *         trackNumFromFilename:
 *           description: The track number of the audio file as determined from the file's name. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 1
 *         discNumFromFilename:
 *           description: The track number of the audio file as determined from the file's name. Will be null if unknown.
 *           type: [string, 'null']
 *         manuallyVerified:
 *           description: Whether the audio file has been manually verified by a user.
 *           type: boolean
 *           example: false
 *         invalid:
 *           description: Whether the audio file is missing from the server.
 *           type: boolean
 *           example: false
 *         exclude:
 *           description: Whether the audio file has been marked for exclusion.
 *           type: boolean
 *           example: false
 *         error:
 *           description: Any error with the audio file. Will be null if there is none.
 *           type: [string, 'null']
 *         format:
 *           description: The format of the audio file.
 *           type: string
 *           example: MP2/3 (MPEG audio layer 2/3)
 *         duration:
 *           description: The total length (in seconds) of the audio file.
 *           type: number
 *           example: 6004.6675
 *         bitRate:
 *           description: The bit rate (in bit/s) of the audio file.
 *           type: integer
 *           example: 64000
 *         language:
 *           description: The language of the audio file.
 *           type: [string, 'null']
 *         codec:
 *           description: The codec of the audio file.
 *           type: string
 *           example: mp3
 *         timeBase:
 *           description: The time base of the audio file.
 *           type: string
 *           example: 1/14112000
 *         channels:
 *           description: The number of channels the audio file has.
 *           type: integer
 *           example: 2
 *         channelLayout:
 *           description: The layout of the audio file's channels.
 *           type: string
 *           example: stereo
 *         chapters:
 *           description: If the audio file is part of an audiobook, the chapters the file contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         embeddedCoverArt:
 *           description: The type of embedded cover art in the audio file. Will be null if none exists.
 *           type: [string, 'null']
 *         metaTags:
 *           $ref: '#/components/schemas/audioMetaTags'
 *         mimeType:
 *           description: The MIME type of the audio file.
 *           type: string
 *           example: audio/mpeg
 */
class AudioFile {
  constructor(data) {
    this.index = null
    this.ino = null
    /** @type {FileMetadata} */
    this.metadata = null
    this.addedAt = null
    this.updatedAt = null

    this.trackNumFromMeta = null
    this.discNumFromMeta = null
    this.trackNumFromFilename = null
    this.discNumFromFilename = null

    this.format = null
    this.duration = null
    this.bitRate = null
    this.language = null
    this.codec = null
    this.timeBase = null
    this.channels = null
    this.channelLayout = null
    this.chapters = []
    this.embeddedCoverArt = null

    // Tags scraped from the audio file
    /** @type {AudioMetaTags} */
    this.metaTags = null

    this.manuallyVerified = false
    this.invalid = false
    this.exclude = false
    this.error = null

    if (data) {
      this.construct(data)
    }
  }

  toJSON() {
    return {
      index: this.index,
      ino: this.ino,
      metadata: this.metadata.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      trackNumFromMeta: this.trackNumFromMeta,
      discNumFromMeta: this.discNumFromMeta,
      trackNumFromFilename: this.trackNumFromFilename,
      discNumFromFilename: this.discNumFromFilename,
      manuallyVerified: !!this.manuallyVerified,
      invalid: !!this.invalid,
      exclude: !!this.exclude,
      error: this.error || null,
      format: this.format,
      duration: this.duration,
      bitRate: this.bitRate,
      language: this.language,
      codec: this.codec,
      timeBase: this.timeBase,
      channels: this.channels,
      channelLayout: this.channelLayout,
      chapters: this.chapters,
      embeddedCoverArt: this.embeddedCoverArt,
      metaTags: this.metaTags?.toJSON() || {},
      mimeType: this.mimeType
    }
  }

  construct(data) {
    this.index = data.index
    this.ino = data.ino
    this.metadata = new FileMetadata(data.metadata || {})
    this.addedAt = data.addedAt
    this.updatedAt = data.updatedAt
    this.manuallyVerified = !!data.manuallyVerified
    this.invalid = !!data.invalid
    this.exclude = !!data.exclude
    this.error = data.error || null

    this.trackNumFromMeta = data.trackNumFromMeta
    this.discNumFromMeta = data.discNumFromMeta
    this.trackNumFromFilename = data.trackNumFromFilename

    if (data.cdNumFromFilename !== undefined) this.discNumFromFilename = data.cdNumFromFilename // TEMP:Support old var name
    else this.discNumFromFilename = data.discNumFromFilename

    this.format = data.format
    this.duration = data.duration
    this.bitRate = data.bitRate
    this.language = data.language
    this.codec = data.codec || null
    this.timeBase = data.timeBase
    this.channels = data.channels
    this.channelLayout = data.channelLayout
    this.chapters = data.chapters
    this.embeddedCoverArt = data.embeddedCoverArt || null

    this.metaTags = new AudioMetaTags(data.metaTags || {})
  }

  get mimeType() {
    const format = this.metadata.format.toUpperCase()
    if (AudioMimeType[format]) {
      return AudioMimeType[format]
    } else {
      return AudioMimeType.MP3
    }
  }

  get isValidTrack() {
    return !this.invalid && !this.exclude
  }

  // New scanner creates AudioFile from AudioFileScanner
  setDataFromProbe(libraryFile, probeData) {
    this.ino = libraryFile.ino || null

    if (libraryFile.metadata instanceof FileMetadata) {
      this.metadata = libraryFile.metadata.clone()
    } else {
      this.metadata = new FileMetadata(libraryFile.metadata)
    }

    this.addedAt = Date.now()
    this.updatedAt = Date.now()

    this.format = probeData.format
    this.duration = probeData.duration
    this.bitRate = probeData.bitRate || null
    this.language = probeData.language
    this.codec = probeData.codec || null
    this.timeBase = probeData.timeBase
    this.channels = probeData.channels
    this.channelLayout = probeData.channelLayout
    this.chapters = probeData.chapters || []
    this.metaTags = probeData.audioMetaTags
    this.embeddedCoverArt = probeData.embeddedCoverArt
  }

  syncChapters(updatedChapters) {
    if (this.chapters.length !== updatedChapters.length) {
      this.chapters = updatedChapters.map(ch => ({ ...ch }))
      return true
    } else if (updatedChapters.length === 0) {
      if (this.chapters.length > 0) {
        this.chapters = []
        return true
      }
      return false
    }

    let hasUpdates = false
    for (let i = 0; i < updatedChapters.length; i++) {
      if (JSON.stringify(updatedChapters[i]) !== JSON.stringify(this.chapters[i])) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.chapters = updatedChapters.map(ch => ({ ...ch }))
    }
    return hasUpdates
  }

  clone() {
    return new AudioFile(this.toJSON())
  }

  /**
   * 
   * @param {AudioFile} scannedAudioFile 
   * @returns {boolean} true if updates were made
   */
  updateFromScan(scannedAudioFile) {
    let hasUpdated = false

    const newjson = scannedAudioFile.toJSON()
    const ignoreKeys = ['manuallyVerified', 'ctimeMs', 'addedAt', 'updatedAt']

    for (const key in newjson) {
      if (key === 'metadata') {
        if (this.metadata.update(newjson[key])) {
          hasUpdated = true
        }
      } else if (key === 'metaTags') {
        if (!this.metaTags || !this.metaTags.isEqual(scannedAudioFile.metaTags)) {
          this.metaTags = scannedAudioFile.metaTags.clone()
          hasUpdated = true
        }
      } else if (key === 'chapters') {
        if (this.syncChapters(newjson.chapters || [])) {
          hasUpdated = true
        }
      } else if (!ignoreKeys.includes(key) && this[key] !== newjson[key]) {
        this[key] = newjson[key]
        hasUpdated = true
      }
    }
    return hasUpdated
  }
}
module.exports = AudioFile