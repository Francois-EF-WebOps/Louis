# API Reference - Louis Video Processing

## Base URL

**Development**: `http://localhost:8787`  
**Production**: `https://api.louis.your-domain.workers.dev`

All requests use JSON. CORS enabled for frontend requests.

---

## Upload Endpoint

### `POST /upload`

Upload video file (supports resumable uploads).

**Request**
```bash
curl -X POST http://localhost:8787/upload \
  -F "file=@video.mp4"
```

**Response** (200 OK)
```json
{
  "success": true,
  "uploadId": "abc123def456",
  "fileName": "my-video.mp4",
  "fileSize": 536870912,
  "uploadedAt": "2024-03-10T14:30:00Z"
}
```

**Error Responses**

| Status | Body |
|--------|------|
| 400 | `{ "error": "No file provided" }` |
| 400 | `{ "error": "Unsupported video format" }` |
| 413 | `{ "error": "File exceeds 10GB limit" }` |
| 500 | `{ "error": "Server error details" }` |

**Supported Formats**: MP4, WebM, MKV, AVI

**Max File Size**: Configurable (default: 10GB)

**Resume Support**: Yes, via tus protocol on frontend

---

## Job Management

### `POST /jobs`

Submit video processing job.

**Request**
```json
{
  "uploadId": "abc123def456",
  "workflow": {
    "removeSilence": true,
    "chunkSize": 5,
    "enableUpscale": false,
    "upscaleQuality": "balanced"
  }
}
```

**Workflow Options**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `removeSilence` | boolean | true | Use AI to detect & remove silent/static sections |
| `chunkSize` | number | 5 | Segment duration in minutes (3/5/10/15) |
| `enableUpscale` | boolean | false | Enable AI upscaling to 720p (costs $0.027/min) |
| `upscaleQuality` | string | "balanced" | Quality level: "balanced"/"high"/"max" |

**Response** (202 Accepted)
```json
{
  "success": true,
  "jobId": "job_xyz789",
  "status": "queued",
  "costEstimate": 0.15
}
```

**Error Responses**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Missing required fields" }` |
| 404 | `{ "error": "Upload not found" }` |
| 500 | `{ "error": "Job submission failed" }` |

---

### `GET /jobs/:jobId`

Get job status and progress.

**Request**
```bash
curl http://localhost:8787/jobs/job_xyz789
```

**Response** (200 OK)
```json
{
  "jobId": "job_xyz789",
  "uploadId": "abc123def456",
  "fileName": "my-video.mp4",
  "fileSize": 536870912,
  "status": "processing",
  "progress": 45,
  "logs": [
    {
      "timestamp": "2024-03-10T14:31:00Z",
      "message": "Pipeline started"
    },
    {
      "timestamp": "2024-03-10T14:31:15Z",
      "message": "Starting scene analysis..."
    },
    {
      "timestamp": "2024-03-10T14:32:00Z",
      "message": "Found 3 inactive segments (12 min total)"
    }
  ],
  "workflow": {
    "removeSilence": true,
    "chunkSize": 5,
    "enableUpscale": false
  },
  "costEstimate": 0.15,
  "actualCost": 0.08,
  "status": "processing",
  "downloadUrl": null,
  "error": null,
  "createdAt": "2024-03-10T14:30:00Z",
  "updatedAt": "2024-03-10T14:32:00Z"
}
```

**Job Status Values**
- `queued` - Waiting to start
- `processing` - Currently running
- `completed` - Success, ready for download
- `failed` - Error occurred (see `error` field)

**Error Responses**

| Status | Body |
|--------|------|
| 404 | `{ "error": "Job not found" }` |
| 500 | `{ "error": "Server error" }` |

---

### `GET /download/:jobId`

Download processed video files (ZIP archive).

**Request**
```bash
curl -O http://localhost:8787/download/job_xyz789/output.zip
```

**Response** (200 OK)
- Content-Type: `application/zip`
- File: `output.zip` containing:
  - `segments/` - Individual video chunks (MP4)
  - `metadata.json` - Processing information
  - `README.md` - Usage guide

**Error Responses**

| Status | Body |
|--------|------|
| 404 | `{ "error": "Job not found" }` |
| 400 | `{ "error": "Job not completed" }` |
| 500 | `{ "error": "Download failed" }` |

**Valid After**: Job status = `completed`

**Available For**: 24 hours (auto-deleted)

---

## Health & Diagnostics

### `GET /health`

Server health check.

**Response** (200 OK)
```json
{
  "status": "ok"
}
```

---

## Error Handling

### Response Format

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE_OPTIONAL",
  "timestamp": "2024-03-10T14:30:00Z"
}
```

### Common HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | File downloaded, status retrieved |
| 202 | Accepted (async) | Job submitted to queue |
| 400 | Bad Request | Invalid workflow options, missing fields |
| 404 | Not Found | Upload/job doesn't exist |
| 413 | Payload Too Large | File exceeds size limit |
| 500 | Server Error | API failure, internal error |

---

## Rate Limiting

**Free Tier (Cloudflare Workers)**
- 100,000 requests/day
- 10,000 requests/hour
- 10 concurrent uploads per user

**Premium Tier** (if implemented)
- Unlimited uploads
- Priority job queue
- Custom retention (default: 24h)

### Rate Limit Headers
```
X-RateLimit-Limit: 100000
X-RateLimit-Remaining: 99995
X-RateLimit-Reset: 1710158400
```

---

## Authentication (Optional)

Future versions may include API keys. Current implementation is public (rate-limited).

To add authentication:

```javascript
// Protected endpoint
if (!request.headers.get('Authorization')) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## Code Examples

### JavaScript (Frontend)

```javascript
// Upload and process video
const file = document.querySelector('input[type="file"]').files[0]

// 1. Upload
const uploadRes = await fetch('/api/upload', {
  method: 'POST',
  body: new FormData(Object.assign(new FormData(), { file }))
})
const { uploadId } = await uploadRes.json()

// 2. Submit job
const jobRes = await fetch('/api/jobs', {
  method: 'POST',
  body: JSON.stringify({
    uploadId,
    workflow: {
      removeSilence: true,
      chunkSize: 5,
      enableUpscale: false
    }
  })
})
const { jobId } = await jobRes.json()

// 3. Poll status
let job = null
while (!job || job.status !== 'completed') {
  const statusRes = await fetch(`/api/jobs/${jobId}`)
  job = await statusRes.json()
  
  if (job.status === 'failed') {
    console.error('Job failed:', job.error)
    break
  }
  
  console.log(`Progress: ${job.progress}%`)
  await new Promise(r => setTimeout(r, 2000)) // Poll every 2s
}

// 4. Download
window.location.href = `/api/download/${jobId}`
```

### cURL (Testing)

```bash
# Upload
UPLOAD_RES=$(curl -s -X POST http://localhost:8787/upload \
  -F "file=@test-video.mp4")
UPLOAD_ID=$(echo $UPLOAD_RES | jq -r '.uploadId')

# Submit job
JOB_RES=$(curl -s -X POST http://localhost:8787/jobs \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"$UPLOAD_ID\",
    \"workflow\": {
      \"removeSilence\": true,
      \"chunkSize\": 5,
      \"enableUpscale\": false
    }
  }")
JOB_ID=$(echo $JOB_RES | jq -r '.jobId')

# Check status
curl -s http://localhost:8787/jobs/$JOB_ID | jq .

# Download when complete
curl -O http://localhost:8787/download/$JOB_ID
```

---

## Webhooks (Future)

Planned for v2.0:

```javascript
POST /webhooks/subscribe
{
  "event": "job.completed",
  "url": "https://your-app.com/callback",
  "secret": "your-webhook-secret"
}
```

---

## Versioning

Current API version: **v1**

Future versions will support:
```
GET /v2/jobs/:jobId
```

Backwards compatibility maintained for v1 endpoints.

---

**Last Updated**: March 2024  
**API Version**: 1.0
