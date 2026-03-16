# Phase 1 Setup Guide - Louis Video Processing Pipeline

This guide will get you from zero to a working local development environment in ~15 minutes.

## 📋 Phase 1 Goals

- ✅ Local development environment running
- ✅ Video upload to R2 storage working
- ✅ Job submission and status tracking functional
- ✅ Basic video chunking (simulated in dev mode)
- ✅ Download endpoint ready

---

## Step 1: Prerequisites Check

```bash
# Verify Node.js 18+
node --version  # Should be v18.x or higher

# Verify npm
npm --version

# Install Wrangler (Cloudflare Workers CLI)
npm install -g wrangler

# Verify Wrangler
wrangler --version
```

---

## Step 2: Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install

# Install backend dependencies
npm --prefix backend install
```

---

## Step 3: Cloudflare Setup (Required)

### 3.1 Create Cloudflare Account

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up for a free account
3. Verify your email

### 3.2 Create R2 Bucket

1. Go to **Storage** → **R2** → **Create Bucket**
2. Bucket name: `louis-videos`
3. Region: Choose closest to you (e.g., `WNAM` for Western North America)
4. Click **Create Bucket**

### 3.3 Create API Token for R2

1. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**
2. Token name: `louis-dev`
3. Permissions: **Object Read & Write**
4. Bucket: Select `louis-videos`
5. Click **Create API Token**
6. **Copy the credentials** (you won't see them again):
   - Access Key ID
   - Secret Access Key

### 3.4 Get Account ID

1. Go to your profile (top right) → **Account Details**
2. Copy your **Account ID**

### 3.5 Create KV Namespace

1. Go to **Workers & Pages** → **KV** → **Create a namespace**
2. Name: `job-state`
3. Click **Add**
4. Copy the **Namespace ID**

---

## Step 4: Configure Environment Variables

Edit `.env.local` with your Cloudflare credentials:

```bash
# Required - Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id-from-step-3.4
CLOUDFLARE_ACCESS_KEY_ID=your-access-key-from-step-3.3
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key-from-step-3.3
CLOUDFLARE_BUCKET_NAME=louis-videos
```

Leave other fields empty for now (they're for Phase 2 features).

---

## Step 5: Configure Wrangler

Edit `backend/wrangler.toml` and update the KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "JOB_STATE"
id = "your-kv-namespace-id-from-step-3.5"
preview_id = "your-kv-namespace-id-from-step-3.5"
```

---

## Step 6: Authenticate Wrangler

```bash
wrangler login
```

This will open a browser window. Log in with your Cloudflare account.

---

## Step 7: Start Development Server

```bash
# From project root
npm run dev
```

You should see:
```
Frontend: http://localhost:5173
Backend: http://localhost:8787
```

---

## Step 8: Test the Flow

### 8.1 Health Check

```bash
curl http://localhost:8787/health
# Expected: {"status":"ok"}
```

### 8.2 Upload a Test Video

```bash
# Use a small test video (< 50MB for quick testing)
curl -X POST http://localhost:8787/upload \
  -F "file=@/path/to/your/test-video.mp4"
```

Expected response:
```json
{
  "success": true,
  "uploadId": "abc123xyz",
  "fileName": "test-video.mp4",
  "fileSize": 12345678,
  "uploadedAt": "2024-03-16T10:00:00.000Z"
}
```

### 8.3 Submit a Processing Job

```bash
curl -X POST http://localhost:8787/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "YOUR_UPLOAD_ID_FROM_PREVIOUS_STEP",
    "workflow": {
      "removeSilence": false,
      "chunkSize": 5,
      "enableUpscale": false
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "jobId": "job_xyz789",
  "status": "queued",
  "costEstimate": 0.01
}
```

### 8.4 Check Job Status

```bash
curl http://localhost:8787/jobs/YOUR_JOB_ID
```

Expected response (initially):
```json
{
  "jobId": "job_xyz789",
  "status": "processing",
  "progress": 10,
  "logs": [
    { "timestamp": "...", "message": "Pipeline started" }
  ]
}
```

After processing completes:
```json
{
  "jobId": "job_xyz789",
  "status": "completed",
  "progress": 100,
  "downloadUrl": "/download/job_xyz789",
  "logs": [
    { "timestamp": "...", "message": "Processing completed successfully" }
  ]
}
```

### 8.5 Download Results

```bash
curl http://localhost:8787/download/YOUR_JOB_ID
```

In development mode (without full R2 setup), this returns a JSON manifest. In production, it downloads the ZIP file.

---

## 🎉 Phase 1 Complete!

You now have a working local development environment with:
- ✅ Video upload working
- ✅ Job processing pipeline functional
- ✅ Status tracking via polling
- ✅ Download endpoint ready

---

## Troubleshooting

### "KV namespace not found"

Make sure you:
1. Created the KV namespace in Cloudflare dashboard
2. Updated `backend/wrangler.toml` with the correct namespace ID
3. Ran `wrangler login`

### "R2 bucket not found"

Verify:
1. Bucket name matches exactly (`louis-videos`)
2. R2 API token has correct permissions
3. Account ID is correct

### Upload fails with 413 error

Check file size limits:
- Default: 100MB in `backend/src/index.js`
- Adjust `MAX_REQUEST_SIZE` if needed

### Frontend can't connect to backend

Ensure:
- `VITE_API_BASE_URL=http://localhost:8787` in `.env.local`
- Both servers are running (`npm run dev`)

---

## Next Steps: Phase 2

Once Phase 1 is working, you can add:

1. **Google Cloud Video Intelligence** - Scene analysis & silence detection
2. **Replicate AI Upscaling** - Video quality enhancement
3. **Real FFmpeg chunking** - Via AWS Lambda or Docker

See the main [docs/SETUP.md](docs/SETUP.md) for Phase 2 configuration.

---

## Architecture Reference

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Frontend   │ ───▶ │   Backend    │ ───▶ │  Cloudflare │
│  (Svelte)   │      │   (Workers)  │      │  R2 Storage │
│  :5173      │      │   :8787      │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  KV Storage  │
                     │  (Job State) │
                     └──────────────┘
```

---

**Questions?** Check [docs/API.md](docs/API.md) for API details or open a GitHub issue.
