/**
 * @openapi
 * components:
 *   schemas:
 *     addedAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when added to the server.
 *       example: 1633522963509
 *     createdAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when was created.
 *       example: 1633522963509
 *     updatedAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when last updated.
 *       example: 1633522963509
 *     size:
 *       description: The total size (in bytes) of the item or file.
 *       type: integer
 *       example: 268824228
 *     durationSec:
 *       description: The total length (in seconds) of the item or file.
 *       type: number
 *       example: 33854.905
 *     newId:
 *       type: string
 *       description: The ID for all database entries. Migration occurred in 2.3.0.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 */