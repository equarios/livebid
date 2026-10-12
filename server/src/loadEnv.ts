import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Load server/.env before Prisma / Redis / S3 clients read process.env. */
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })
