/**
 * @openapi
 * components:
 *   schemas:
 *     mediaType:
 *       type: string
 *       description: The type of media, will be book or podcast.
 *       enum: [book, podcast]
 *     mediaMinified:
 *       description: The minified media of the library item.
 *       oneOf:
 *         - $ref: '#/components/schemas/bookMinified'
 */