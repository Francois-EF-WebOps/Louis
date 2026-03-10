/**
 * Handle job submission and orchestration
 * Routes to appropriate cloud processing services
 */

import { nanoid } from 'nanoid'
import { addCorsHeaders } from '../middleware/cors.js'
import { startProcessingPipeline } from '../services/pipeline.js'

export async function handleJobSubmit(request, env, ctx) {
  try {
    const body = await request.json()
    const { uploadId, workflow } = body

    if (!uploadId || !workflow) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    // Verify upload exists
    const uploadMetadata = await env.JOB_STATE.get(`upload:${uploadId}`, 'json')
    if (!uploadMetadata) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Upload not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    // Create job record
    const jobId = nanoid(12)
    const timestamp = new Date().toISOString()

    const jobData = {
      jobId,
      uploadId,
      fileName: uploadMetadata.fileName,
      fileSize: uploadMetadata.fileSize,
      workflow,
      status: 'queued', // queued | processing | completed | failed
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      logs: [],
      resultUrl: null,
      error: null,
      costEstimate: calculateCostEstimate(uploadMetadata.fileSize, workflow),
      actualCost: 0
    }

    // Store job state in KV
    const ttlSeconds = parseInt(env.JOB_RETENTION_HOURS || '24') * 60 * 60
    await env.JOB_STATE.put(`job:${jobId}`, JSON.stringify(jobData), {
      expirationTtl: ttlSeconds
    })

    // Add job to processing queue (asynchronous)
    ctx.waitUntil(
      startProcessingPipeline(jobId, uploadId, workflow, env)
    )

    console.log(`Job submitted: ${jobId}`)

    return addCorsHeaders(
      new Response(
        JSON.stringify({
          success: true,
          jobId,
          status: 'queued',
          costEstimate: jobData.costEstimate
        }),
        {
          status: 202, // Accepted
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )
  } catch (error) {
    console.error('Job submission error:', error)
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
}

/**
 * Estimate processing cost based on file size and workflow
 */
function calculateCostEstimate(fileSizeBytes, workflow) {
  const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024)
  const fileMinutes = fileSizeGb * 60 * 2 // Rough estimate: 2 min per GB

  let cost = 0.01 // Base cost

  // Google Video Intelligence: ~$0.00075 per minute for analysis
  if (workflow.removeSilence) {
    cost += fileMinutes * 0.00075
  }

  // Cloudinary: Free tier usually covers transformations
  cost += 0.01 // Small overhead

  // Replicate upscale: ~$0.027 per minute
  if (workflow.enableUpscale) {
    cost += fileMinutes * 0.027
  }

  return parseFloat(cost.toFixed(2))
}
