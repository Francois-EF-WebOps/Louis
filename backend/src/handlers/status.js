/**
 * Handle job status and progress queries
 */

import { addCorsHeaders } from '../middleware/cors.js'

export async function handleJobStatus(jobId, env, ctx) {
  try {
    const jobData = await env.JOB_STATE.get(`job:${jobId}`, 'json')

    if (!jobData) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    return addCorsHeaders(
      new Response(JSON.stringify(jobData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  } catch (error) {
    console.error('Status handler error:', error)
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
}
