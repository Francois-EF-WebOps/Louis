/**
 * Louis Backend - Cloudflare Workers Serverless Video Processing
 * Cloud-native video preprocessing pipeline with zero heavy computation on client
 */

import { nanoid } from 'nanoid'
import { handleUpload } from './handlers/upload.js'
import { handleJobSubmit } from './handlers/jobs.js'
import { handleJobStatus } from './handlers/status.js'
import { handleCors } from './middleware/cors.js'

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
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (jobData.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Job not completed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate signed URL for R2 download
    const fileKey = `${jobId}/output.zip`
    // Implementation depends on R2 bucket setup
    // This is a placeholder

    return new Response(JSON.stringify({ downloadUrl: `/api/download/${jobId}/output.zip` }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Download handler error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
