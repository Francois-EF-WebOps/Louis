# Getting Started - Quick Reference

Welcome to **Louis**: Cloud-native video preprocessing for low-resource machines! 🎬

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Copy Environment Template
```bash
cp .env.example .env.local
# Open and fill in with API credentials (see docs/SETUP.md)
```

### 3. Start Development
```bash
npm run dev
```

**Frontend**: http://localhost:5173  
**Backend**: http://localhost:8787

### 4. Test Upload
1. Open http://localhost:5173 in browser
2. Upload a small test video (<100MB)
3. Configure workflow options
4. Watch processing live

---

## 📚 Full Documentation

- **[README.md](README.md)** — Project overview & features
- **[docs/SETUP.md](docs/SETUP.md)** — Detailed setup guide with all API keys
- **[docs/API.md](docs/API.md)** — Complete API reference with examples
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System design & data flow
- **[docs/PRIVACY.md](docs/PRIVACY.md)** — Data handling & privacy policy

---

## 🏗️ Project Structure

```
louis/
├── frontend/              # Svelte PWA (~5MB bundle)
├── backend/               # Cloudflare Workers API
├── infrastructure/        # Terraform IaC
├── docs/                  # Complete documentation
├── cost-calculator.js     # Cost estimation tool
├── docker-compose.yml     # Local dev environment
├── deploy.sh              # Deployment script
└── README.md              # This repository
```

---

## 💰 Estimated Costs (Your 1-hour video)

**Without AI Upscaling**: ~$0.06  
**With AI Upscaling**: ~$0.70

Uses Google Cloud & Cloudinary free tiers by default.

See [docs/COST-CALCULATOR.md](docs/COST-CALCULATOR.md) for details.

---

## 🔧 Key Features

✅ Detects & removes silent/static scenes (Google Video Intelligence)  
✅ Chunks into 5-minute segments (lossless FFmpeg)  
✅ Optional AI upscaling to 720p (Replicate/Topaz)  
✅ Resumable uploads (handles network interrupts)  
✅ Real-time cost tracking  
✅ 24-hour auto-expire (privacy)  
✅ Works on 6GB RAM / Intel i3  

---

## 📋 API Quick Reference

### Upload Video
```bash
curl -F "file=@video.mp4" http://localhost:8787/upload
# → { uploadId, fileName, fileSize }
```

### Submit Job
```bash
curl -X POST http://localhost:8787/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "abc123",
    "workflow": {
      "removeSilence": true,
      "chunkSize": 5,
      "enableUpscale": false
    }
  }'
# → { jobId, status: "queued", costEstimate: 0.05 }
```

### Check Status
```bash
curl http://localhost:8787/jobs/job_xyz
# → { status, progress, logs, downloadUrl }
```

Full API docs: [docs/API.md](docs/API.md)

---

## 🚀 Deployment

### Development
```bash
npm run dev                    # Local dev
docker-compose up -d          # With mock APIs
npm run test                  # Run tests
```

### Production
```bash
./deploy.sh frontend          # Deploy frontend to Cloudflare Pages
./deploy.sh backend           # Deploy backend to Cloudflare Workers
# or
./deploy.sh both              # Both at once
```

See [docs/SETUP.md](docs/SETUP.md) for detailed deployment.

---

## 🔑 Required API Keys

Before deployment, get these (all offer free tiers):

1. **Google Cloud** → [Video Intelligence API](https://cloud.google.com/video-intelligence)
2. **Cloudinary** → [Free account](https://cloudinary.com)
3. **Cloudflare** → [Workers + R2](https://workers.cloudflare.com)
4. **Replicate** (optional) → [AI upscaling](https://replicate.com)

See [docs/SETUP.md](docs/SETUP.md) for step-by-step configuration.

---

## 💡 Tips

- **Local testing first**: `npm run dev` before deploying
- **Check costs**: Run `node cost-calculator.js` to estimate
- **Monitor usage**: Check Cloudflare Dashboard for real-time metrics
- **Enable Private Mode**: For sensitive content (no analytics)
- **Use free tiers first**: App defaults to free APIs

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing API key" | Fill `.env.local` with credentials |
| Upload fails | Check R2 bucket permissions |
| Job stuck on "processing" | Check backend logs for errors |
| Video too large | Split locally, upload chunks separately |

---

## 📞 Support

- 📖 Full docs: [docs/](docs/)
- 🔍 API reference: [docs/API.md](docs/API.md)
- 🏗️ Architecture details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 💬 GitHub Issues: Report bugs here

---

## 📜 License

MIT License — See LICENSE file

---

**Ready to process videos?** Start with [docs/SETUP.md](docs/SETUP.md) → [docs/API.md](docs/API.md) → Deploy! 🚀
