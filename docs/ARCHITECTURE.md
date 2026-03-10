# Architecture & Design - Louis Video Processing Pipeline

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Browser (PWA - Svelte)                                      │  │
│  │  ~5MB bundle (Vite optimized)                               │  │
│  │                                                              │  │
│  │  Components:                                                 │  │
│  │  • UppyUploader (resumable, chunked)                        │  │
│  │  • WorkflowConfig (UI for options + cost estimate)         │  │
│  │  • JobMonitor (real-time progress via WebSocket/SSE)       │  │
│  │                                                              │  │
│  │  Memory usage: <50MB peak (even during large uploads)      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE/CACHE LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cloudflare Global Network                                   │  │
│  │  • Content Delivery (JS bundles, assets)                    │  │
│  │  • DDoS protection, WAF                                      │  │
│  │  • Rate limiting (Cloudflare Firewall Rules)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SERVERLESS API LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cloudflare Workers (Main Orchestrator)                      │  │
│  │  • Route requests to appropriate handlers                    │  │
│  │  • Manage job queue via KV                                  │  │
│  │  • Serve presigned download URLs                            │  │
│  │  • Handle CORS, rate limiting, auth                         │  │
│  │                                                              │  │
│  │  Handlers:                                                    │  │
│  │  POST /upload      → Validate + store in R2                │  │
│  │  POST /jobs        → Create job, enqueue processing        │  │
│  │  GET  /jobs/:id    → Return job status from KV             │  │
│  │  GET  /download/:id → Generate signed R2 URL               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                      │           │           │           │
              ┌───────┘           │           │           └─────────┐
              │                   │           │                     │
              ▼                   ▼           ▼                     ▼
    ┌──────────────────┐ ┌──────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Google Video    │ │ Cloudinary   │  │ Replicate   │  │ AWS Lambda  │
    │  Intelligence    │ │ Image        │  │ API         │  │ (Heavy work)│
    │                  │ │              │  │             │  │             │
    │ • Shot changes   │ │ • Transform  │  │ • Topaz up- │  │ • FFmpeg    │
    │ • Silence detect │ │ • Compress   │  │   scaling   │  │   chunking  │
    │ • Cost: Free     │ │ • Crop       │  │ • Cost: $50 │  │ • Cost: Low │
    │                  │ │ • Cost: Free │  │   /1M cr    │  │             │
    │ TTL: N/A         │ │   tier       │  │             │  │ TTL: N/A    │
    │ (stream)         │ │              │  │ TTL: N/A    │  │ (stream)    │
    └──────────────────┘ └──────────────┘  └─────────────┘  └─────────────┘
              │                                                     │
              └─────────────────────┬───────────────────────────────┘
                                    │
                                    ▼
            ┌──────────────────────────────────────────┐
            │  Cloud Storage (Output)                   │
            │  ┌──────────────────────────────────────┐ │
            │  │  Cloudflare R2 / AWS S3              │ │
            │  │  • Processed video segments (MP4)    │ │
            │  │  • Metadata + logs (JSON)            │ │
            │  │  • Auto-delete after 24h             │ │
            │  │  • Encryption: SSE-S3 (AES-256)      │ │
            │  │  • Access: Signed URLs (time-limited)│ │
            │  └──────────────────────────────────────┘ │
            └──────────────────────────────────────────┘
                                    │ HTTPS (Signed URL)
                                    ▼
                        ┌──────────────────────┐
                        │  Your Download       │
                        │  output.zip          │
                        │  (Auto-expires 24h)  │
                        └──────────────────────┘
```

---

## Component Architecture

### Frontend (Svelte PWA)

**Why Svelte?**
- ✅ Smallest compiled bundle size (~5MB with dependencies)
- ✅ Reactive, compiler-optimized (no runtime overhead)
- ✅ Perfect for low-bandwidth users
- ✅ Excellent mobile support

**Component Hierarchy**
```
App.svelte
├── state management (upload → config → processing → complete)
├── UppyUploader.svelte
│   └── Uppy instance (tus resumable chunks)
├── WorkflowConfig.svelte
│   ├── Workflow options (checkboxes, selects)
│   ├── Real-time cost calculation
│   └── Submit button → POST /jobs
└── JobMonitor.svelte
    ├── Progress bar
    ├── Status polling (SSE/WebSocket)
    ├── Live logs display
    └── Download button (when complete)
```

**Key Libraries**
- **Uppy**: Resumable upload, handles network interrupts
- **Vite**: Fast bundling, tree-shaking, lazy loading
- **Svelte**: Framework (ultra-lightweight)

### Backend (Cloudflare Workers)

**Why Cloudflare Workers?**
- ✅ No cold starts (always warm)
- ✅ Sub-100ms TTFB even on free tier
- ✅ Global edge deployment (low latency)
- ✅ Built-in R2 storage access
- ✅ Free tier: 100k requests/day + 3 R2 buckets

**Request Flow**
```
User Request
    ↓
Cloudflare CDN (cache/DDOS)
    ↓
Workers Edge Node
    ↓
Route Matching (index.js)
    ├── POST /upload → handlers/upload.js
    ├── POST /jobs  → handlers/jobs.js → services/pipeline.js
    ├── GET /jobs/:id → handlers/status.js
    └── GET /download → handlers/download.js
    ↓
External API Calls (async via waitUntil)
    ├── Google Video Intelligence
    ├── Cloudinary Transform
    ├── Replicate Upscale
    └── AWS Lambda (if needed)
    ↓
Store Result in R2 + KV
    ↓
Response to Client
```

**Storage Strategy**
- **R2 (Video Files)**: Raw uploads, processed segments
  - TTL: 1h (uploads), 24h (output)
  - Encryption: Server-side AES-256
- **KV (Metadata)**: Job status, workflow config, logs
  - TTL: 24h (auto-expire)
  - Namespace: `JOB_STATE`

---

## Processing Pipeline (Detailed)

### Stage 1: Upload & Validation

```javascript
// frontend/src/components/UppyUploader.svelte
const upload = new Uppy()
  .use(XHRUpload, {
    endpoint: '/api/upload',
    limit: 1, // One at a time
    headers: { /* auth if needed */ }
  })
  .on('upload-success', (file, response) => {
    dispatch('complete', { uploadId: response.body.uploadId })
  })
```

**Backend**: `backend/src/handlers/upload.js`
- Validate file type (MIME check + magic bytes)
- Check file size against limit
- Stream to R2 bucket
- Store metadata in KV
- Return uploadId

### Stage 2: Job Submission

```javascript
// frontend/src/components/WorkflowConfig.svelte
new Workflow({
  removeSilence: true,  // AI scene detection
  chunkSize: 5,         // Minutes per segment
  enableUpscale: false, // High cost, user opts in
  upscaleQuality: 'balanced'
})
```

**Backend**: `backend/src/handlers/jobs.js`
- Create unique job ID (nanoid)
- Store job state in KV
- Calculate cost estimate
- Enqueue for processing
- Return jobId to frontend

### Stage 3: Scene Analysis (Remove Silence)

**Primary**: Google Cloud Video Intelligence API

```javascript
// backend/src/services/pipeline.js
const response = await videoIntelligence.annotateVideo({
  features: [
    'SHOT_CHANGE_DETECTION',    // Detects scene transitions
    'SPEECH_TRANSCRIPTION'       // Transcribes audio
  ],
  inputUri: `gs://${bucket}/${fileId}`,
  videoContext: {
    speechTranscriptionConfig: {
      enableAutomaticPunctuation: true,
      languageCode: 'en-US'
    }
  }
})

// Output: timestamps of active vs. silent segments
```

**Cost**: Free tier 1,000 min/month, then $0.00075/min

**Fallback**: If Google API fails or free tier exhausted
- Use AWS Lambda with FFmpeg for audio-only analysis
- Run `ffmpeg -i video.mp4 -af volumedetect -f null -` to detect silence

### Stage 4: Lossless Chunking

**Strategy**: Server-side FFmpeg on AWS Lambda (or Docker Workers if available)

```bash
# Command: Copy-copy encoding (no re-encoding)
ffmpeg -i input.mp4 \
  -c copy \
  -f segment \
  -segment_time 300 \
  -segment_format mp4 \
  output_%03d.mp4

# Why -c copy?
# ✅ Fast (only 1-2% overhead vs original encoding)
# ✅ Cheap (minimal compute)
# ✅ Lossless (no quality loss)
# ✅ Keeps original codec (H.264, VP9, etc.)
```

**Cost**: AWS Lambda ~$0.0000002 per GB

### Stage 5: Optional AI Upscaling

**Service**: Replicate (Topaz Labs upscaler)

```javascript
// backend/src/services/upscale.js
const prediction = await replicate.predictions.create({
  version: "topazlabs/video-upscale:xxx",
  input: {
    video: `https://r2.example.com/segments/001.mp4`,
    target_resolution: "720p",  // Cap at 720p for cost
    target_fps: 30,
    model: 'topazgigapixel'  // Or 'seedvr'
  }
})

// Poll for completion (async)
while (prediction.status !== 'succeeded') {
  await sleep(5000)
  prediction = await replicate.predictions.get(prediction.id)
}
```

**Cost**: Replicate (Topaz) ~$0.027 per minute for 720p

### Stage 6: Packaging & Delivery

```javascript
// Generate ZIP archive with:
// - segments/001.mp4, 002.mp4, ...
// - metadata.json (processing info)
// - README.md (instructions)

// Return signed download URL (24h valid)
const signedUrl = await r2.getSignedUrl('output.zip', {
  expiresIn: 86400 // 24 hours
})
```

---

## Cost Estimation Model

### Formula

```
totalCost = analysisService + chunkingService + compressionService + upscaleService + storage

where:
  analysisService = removeSilence ? (minutes * $0.00075) : 0
  chunkingService = $0.0001 (flat Lambda invoke)
  compressionService = free (Cloudinary free tier)
  upscaleService = enableUpscale ? (minutes * $0.027) : 0
  storage = $0.015 (24h R2 storage estimate)
```

### Example Breakdown (1-hour video, 40% active after silence removal)

**Without Upscale**
```
Analysis:  60 min × $0.00075 = $0.045
Chunking:  $0.0001
Compress:  $0 (free tier)
Storage:   $0.01
Total:     $0.0551 → ~$0.06
```

**With Upscale**
```
Analysis:  60 min × $0.00075 = $0.045
Chunking:  $0.0001
Compress:  $0 (free tier)
Upscale:   24 min × $0.027 = $0.648 ← Only active after silence removal
Storage:   $0.01
Total:     $0.7031 → ~$0.70
```

---

## Error Handling & Resilience

### Retry Strategy

| Component | Failure | Retry Policy |
|-----------|---------|--------------|
| Google Video Intelligence | API rate limit | Exponential backoff, max 5 retries |
| Cloudinary | Transform fails | Fallback to original, continue |
| Replicate | Upscale timeout | Return original video, partial refund |
| R2 upload | Network error | Resume from last chunk (tus protocol) |

### Circuit Breaker Pattern

```javascript
// If Google API fails 3x in a row
if (googleFailures > 3) {
  logError("Google API circuit open")
  fallBackToLocalAnalysis() // Use FFmpeg instead
}

// Auto-recover after cooldown
setTimeout(() => {
  googleFailures = 0
  logInfo("Google API circuit closed")
}, 300000) // 5 minutes
```

---

## Monitoring & Observability

### Logging

All logs streamed to Cloudflare Workers Logs (via `console.log`)

```javascript
console.log('JobStarted', {
  jobId: 'job_xyz',
  uploadSize: '536MB',
  timestamp: new Date().toISOString()
})
```

### Metrics

Tracked via Cloudflare Analytics Engine:
- Upload success rate
- Average job duration
- Cost per job
- API errors by service
- Worker CPU time

### Alerting

Triggers for:
- >5% job failure rate
- API latency >5s
- Cost spike (>$100/day)
- Disk quota exceeded

---

## Scalability Considerations

### Horizontal Scaling
- ✅ Cloudflare Workers: Auto-scales globally, infinite concurrency
- ✅ R2: Unlimited storage
- ✅ KV: Global, auto-replicated
- ✅ AWS Lambda: Auto-scales (5000 concurrent functions)

### Rate Limiting
- Default: 10 concurrent uploads per user, 100k requests/day
- Upgrade: Unlimited (enterprise)

### Cost Optimization
1. Cache aggressively (Cloudinary transforms, static assets)
2. Delete old uploads/jobs (auto-expire KV/R2)
3. Batch API calls (combine multiple jobs)
4. Use free tier first (Google, Cloudinary)
5. Monitor and alert on cost spikes

---

## Deployment Topology

### Development
```
localhost:5173 (Vite frontend)
     ↓ HTTP (no CORS needed)
localhost:8787 (Cloudflare Workers local)
     ↓
Mock cloud APIs (docker-compose)
```

### Production
```
CloudflarePages (frontend SPA)
     ↓ HTTPS
CloudflareEdge (global CDN)
     ↓
CloudflareWorkers (API endpoint)
     ↓
CloudflareR2 (storage)
CloudflareKV (state)
     ↓
GoogleCloud (scene analysis)
Cloudinary (transform)
Replicate (upscale)
AWSLambda (chunking)
```

---

**Architecture Version**: 1.0  
**Last Updated**: March 2024
