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
 * Uses actual video duration estimation based on typical bitrates
 */
function calculateCostEstimate(fileSizeBytes, workflow) {
  // Estimate video duration from file size
  // Average bitrate assumptions:
  // - 1080p: ~5 Mbps = ~2.25 GB/hour
  // - 720p: ~2.5 Mbps = ~1.1 GB/hour
  // - 480p: ~1 Mbps = ~0.45 GB/hour
  // Using conservative estimate: 2 GB/hour average
  
  const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024)
  const estimatedMinutes = fileSizeGb * 30 // ~30 min per GB
  
  let cost = 0
  
  // Base processing cost (storage, bandwidth)
  cost += 0.01
  
  // Google Video Intelligence: $0.00075 per minute
  // Free tier: 1,000 minutes/month
  if (workflow.removeSilence) {
    const analysisCost = estimatedMinutes * 0.00075
    cost += analysisCost
  }
  
  // Cloudinary transformations: Free tier covers most use cases
  // Paid: ~$0.0001 per transformation
  cost += 0.005 // Small overhead for transformations
  
  // Replicate AI Upscaling: ~$0.027 per minute for 720p
  // This is the most expensive feature
  if (workflow.enableUpscale) {
    const upscaleCost = estimatedMinutes * 0.027
    cost += upscaleCost
  }
  
  // Storage cost (R2): $0.015 per GB per month
  // We store for 24 hours max, so prorated
  const storageCost = fileSizeGb * 0.015 / 30
  cost += storageCost
  
  return parseFloat(cost.toFixed(3))
}
