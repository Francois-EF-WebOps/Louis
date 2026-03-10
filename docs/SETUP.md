# Setup Guide - Louis Video Processing Pipeline

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org))
- Git
- Free accounts:
  - Cloudflare ([https://dash.cloudflare.com](https://dash.cloudflare.com))
  - Google Cloud ([https://console.cloud.google.com](https://console.cloud.google.com))
  - (Optional) Replicate for AI upscaling ([https://replicate.com](https://replicate.com))

## 1. Local Development Setup

### Step 1.1: Clone & Install Dependencies

```bash
cd /workspaces/Louis
npm install

# Install subproject dependencies
npm --prefix frontend install
npm --prefix backend install
```

### Step 1.2: Configure Environment Variables

Copy the template and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys (see sections below).

### Step 1.3: Start Development Servers

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8787 (Cloudflare Workers)

---

## 2. Cloud Services Setup

### 2.1 Google Cloud Video Intelligence (Scene Analysis)

1. **Create GCP Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project (name: "louis-video-processing")
   - Enable billing (free tier: up to $1600/month credits for new users)

2. **Enable Video Intelligence API**
   ```bash
   gcloud services enable videointelligence.googleapis.com
   ```

3. **Create Service Account**
   - Go to: Console → APIs & Services → Credentials
   - Click "Create Credentials" → "Service Account"
   - Name: `louis-backend`
   - Grant role: `Video Intelligence User`
   - Create JSON key and download

4. **Add to `.env.local`**
   ```bash
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_CREDENTIALS=/path/to/service-account-key.json
   ```

5. **Test**
   ```bash
   # Backend console should show successful auth
   npm run dev
   ```

**Free Tier**: 1,000 minutes of analysis per month ✅

---

### 2.2 Cloudinary (Transform & Compress)

1. **Sign Up**
   - Create free account: [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)

2. **Get Credentials**
   - Dashboard → Settings → API Keys
   - Copy: `Cloud Name`, `API Key`, `API Secret`

3. **Add to `.env.local`**
   ```bash
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Test**
   ```bash
   # This will be called during job processing
   npm run dev
   ```

**Free Tier**: 20,000 transform operations/month ✅

---

### 2.3 Cloudflare (Storage & Serverless)

1. **Create Account**
   - Sign up: [https://dash.cloudflare.com](https://dash.cloudflare.com)
   - Free tier includes: 3,000 request/day for Workers, 10GB R2 storage

2. **Create R2 Bucket**
   - Dashboard → Storage → R2 → Create bucket
   - Name: `louis-videos`
   - Keep other settings default

3. **Generate API Token**
   - Dashboard → Account Settings → API Tokens
   - Create Custom Token with permissions:
     - `Account.R2 Bucket Item CUD` (read/write)
     - `Account.R2 Bucket Contents Read`
   - Get: `Account ID`, `Access Key ID`, `Secret Access Key`

4. **Update Backend Config**
   - Edit `backend/wrangler.toml`:
     ```toml
     account_id = "your-account-id"
     [r2_buckets]
     binding = "VIDEO_BUCKET"
     bucket_name = "louis-videos"
     
     [[kv_namespaces]]
     binding = "JOB_STATE"
     id = "your-kv-namespace-id"
     ```

5. **Update `.env.local`**
   ```bash
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   CLOUDFLARE_ACCESS_KEY_ID=your-access-key
   CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key
   CLOUDFLARE_BUCKET_NAME=louis-videos
   ```

---

### 2.4 Replicate API (Optional - AI Upscaling)

Only needed if enabling AI upscaling feature.

1. **Sign Up**
   - Create account: [https://replicate.com](https://replicate.com)
   - Free trial includes $20 credit

2. **Get API Token**
   - Settings → API → Copy token

3. **Add to `.env.local`**
   ```bash
   ENABLE_AI_UPSCALE=true
   REPLICATE_API_TOKEN=your-replicate-token
   ```

**Pricing**: ~$0.027 per minute of video at 720p

---

## 3. Local Testing

### Test Upload

```bash
# Start dev server
npm run dev

# Open browser: http://localhost:5173

# Upload a small test video (< 100MB)
# → Should show upload progress

# Check backend logs:
# → Should see upload success message
```

### Test Job Processing

```bash
# Submit a job through the UI
# → Should see job queued

# Check job status:
curl http://localhost:8787/jobs/job-id

# Should show:
# {
#   "status": "processing",
#   "progress": 20,
#   "logs": [{ "timestamp": "...", "message": "..." }]
# }
```

### Test with Docker Compose

```bash
# Start all services locally (with mock APIs)
docker-compose up -d

# Frontend: http://localhost:3000
# Backend: http://localhost:8787
# Mock APIs: http://localhost:4000
```

---

## 4. Production Deployment

### 4.1 Deploy Frontend (Cloudflare Pages)

1. **Build**
   ```bash
   cd frontend
   npm run build
   ```

2. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Deploy via Cloudflare Pages**
   - Cloudflare Dashboard → Pages → Create project
   - Connect GitHub repo
   - Build command: `npm run build`
   - Build output directory: `frontend/dist`
   - Deploy! 🚀

### 4.2 Deploy Backend (Cloudflare Workers)

1. **Authenticate with Wrangler**
   ```bash
   npm --prefix backend install -g @cloudflare/wrangler
   wrangler login
   ```

2. **Deploy**
   ```bash
   cd backend
   npm run deploy
   ```

3. **Verify**
   ```bash
   curl https://louis.your-domain.workers.dev/health
   # → { "status": "ok" }
   ```

### 4.3 Configure Environment Variables (Production)

In Cloudflare Dashboard:

1. **Workers → Settings → Variables**
   - Add all keys from `.env.local` (but NOT API secrets on client side)

2. **R2 Buckets**
   - Create production bucket: `louis-videos-prod`
   - Generate new API tokens with restricted access

3. **KV Namespaces**
   - Create: `job-state`
   - Create: `upload-metadata`

---

## 5. Monitoring & Troubleshooting

### Check Logs

```bash
# Frontend build errors
cd frontend && npm run build

# Backend logs
# Cloudflare Dashboard → Workers → Logs

# Google Cloud API
# GCP Console → Logs → Cloud Functions
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Missing API key" | Check `.env.local` has all required vars, restart dev server |
| Upload fails with 403 | Verify R2 bucket credentials & permissions |
| Job stuck on "processing" | Check backend logs, may need to restart Workers |
| Video too large (>10GB) | Split video locally, upload parts separately |

### Performance Tuning

- **Frontend**: Check Vite bundle size: `npm --prefix frontend run build -- --report`
- **Backend**: Monitor Cloudflare Workers logs for slow endpoints
- **Storage**: R2 analytics at Cloudflare Dashboard → R2 → Buckets

---

## 6. Next Steps

1. ✅ Local development ready: `npm run dev`
2. 📤 Test uploads with sample videos
3. 🔧 Configure production secrets in Cloudflare
4. 🚀 Deploy frontend to Cloudflare Pages
5. 🚀 Deploy backend to Cloudflare Workers
6. 📊 Monitor costs in [COST-CALCULATOR.md](COST-CALCULATOR.md)
7. 🔐 Review privacy settings in [PRIVACY.md](PRIVACY.md)

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Google Cloud Video Intelligence](https://cloud.google.com/video-intelligence/docs)
- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Replicate Docs](https://replicate.com/docs)

---

**Need help?** Check [API.md](API.md) for endpoint details or open a GitHub issue.
