/**
 * Dedicated care worker — settlement + closing-soon digests.
 *
 * Dev (two terminals):
 *   CARE_INLINE=0 npm run dev
 *   npm run worker
 *
 * Prod:
 *   CARE_INLINE=0 npm start
 *   npm run worker:start
 */
import './loadEnv'
import { startCareLoop } from './careLoop'

console.log('[worker] equarios care worker starting')
void startCareLoop({ label: 'worker' })
