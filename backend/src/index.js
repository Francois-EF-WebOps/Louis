/**
 * Louis Backend - Cloudflare Workers Serverless Video Processing
 * Cloud-native video preprocessing pipeline with zero heavy computation on client
 */

import { nanoid } from 'nanoid'
import { handleUpload } from './handlers/upload.js'
import { handleJobSubmit } from './handlers/jobs.js'
import { handleJobStatus } from './handlers/status.js'
import { handleCors, addCorsHeaders } from './middleware/cors.js'

const MAX_REQUEST_SIZE = 100 * 1024 * 1024 // 100MB limit for uploads

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request)
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Route: Upload video file
      if (path === '/upload' && request.method === 'POST') {
        return handleUpload(request, env, ctx)
      }

      // Route: Submit processing job
      if (path === '/jobs' && request.method === 'POST') {
        return handleJobSubmit(request, env, ctx)
      }

      // Route: Get job status and results
      if (path.match(/^\/jobs\/[a-zA-Z0-9]+$/) && request.method === 'GET') {
        const jobId = path.split('/')[2]
        return handleJobStatus(jobId, env, ctx)
      }

      // Route: Download processed files
      if (path.match(/^\/download\/[a-zA-Z0-9]+$/) && request.method === 'GET') {
        const jobId = path.split('/')[2]
        return handleDownload(jobId, env, ctx)
      }

      // Health check
      if (path === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Request handler error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

/**
 * Handle file download
 */
async function handleDownload(jobId, env, ctx) {
  try {
    const jobKey = `job:${jobId}`
    const jobData = await env.JOB_STATE.get(jobKey, 'json')

    if (!jobData) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    if (jobData.status !== 'completed') {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Job not completed yet', status: jobData.status }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    // Get the output file from R2
    const outputKey = jobData.packageInfo?.outputKey || `${jobId}/output.zip`
    
    try {
      const file = await env.VIDEO_BUCKET.get(outputKey)
      
      if (!file) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Download file not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }

      // Return the file with appropriate headers
      const headers = {
        'Content-Type': file.httpMetadata?.contentType || 'application/zip',
        'Content-Disposition': `attachment; filename="louis-${jobId}-output.zip"`,
        'Cache-Control': 'private, max-age=3600'
      }

      return addCorsHeaders(
        new Response(file.body, { headers })
      )
    } catch (r2Error) {
      console.error('R2 download error:', r2Error)
      
      // If R2 is not configured, return job data with download info
      return addCorsHeaders(
        new Response(JSON.stringify({
          downloadReady: true,
          jobId,
          message: 'R2 not configured - download implementation requires Cloudflare R2 setup',
          jobData: {
            workflow: jobData.workflow,
            segments: jobData.chunks?.segments || [],
            packageInfo: jobData.packageInfo
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }
  } catch (error) {
    console.error('Download handler error:', error)
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
}
