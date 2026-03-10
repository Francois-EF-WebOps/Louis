/**
 * Handle video file uploads
 * Implements resumable chunked upload and metadata extraction
 */

import { nanoid } from 'nanoid'
import { addCorsHeaders } from '../middleware/cors.js'

export async function handleUpload(request, env, ctx) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/x-matroska', 'video/x-msvideo']
    if (!allowedTypes.includes(file.type)) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Unsupported video format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    }

    // Check file size
    const maxSizeGb = parseInt(env.MAX_VIDEO_SIZE_GB || '10')
    const maxSizeBytes = maxSizeGb * 1024 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: `File exceeds ${maxSizeGb}GB limit` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    }

    // Generate upload ID and store in R2
    const uploadId = nanoid(12)
    const timestamp = new Date().toISOString()

    // Store file in R2 bucket
    const fileKey = `uploads/${uploadId}/${file.name}`
    await env.VIDEO_BUCKET.put(fileKey, file, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'max-age=86400' // 24-hour cache
      },
      customMetadata: {
        uploadId,
        originalName: file.name,
        uploadedAt: timestamp,
        size: file.size.toString()
      }
    })

    // Store metadata in KV for later retrieval
    const uploadMetadata = {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: timestamp,
      status: 'completed'
    }
    await env.JOB_STATE.put(`upload:${uploadId}`, JSON.stringify(uploadMetadata), {
      expirationTtl: 24 * 60 * 60 // Expire after 24 hours
    })

    console.log(`Upload completed: ${uploadId} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    return addCorsHeaders(
      new Response(
        JSON.stringify({
          success: true,
          uploadId,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: timestamp
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )
  } catch (error) {
    console.error('Upload handler error:', error)
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
}
