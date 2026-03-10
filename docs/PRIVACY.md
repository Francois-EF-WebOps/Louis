# Privacy & Data Handling Policy - Louis

## 1. Data Collection

Louis is designed with **privacy-first** principles. We minimize data collection and provide full transparency.

### What Data We Collect

**Required for Processing**
- ✅ Your uploaded video file (temporary)
- ✅ Video metadata: filename, size, duration, codec
- ✅ Processing workflow configuration: options you select
- ✅ Job logs: timestamps and processing steps

**Optional (if enabled)**
- 📊 Analytics: page views, button clicks (opt-in via "Analytics Mode")
- 📍 Error tracking: crash reports with stack traces
- 📧 Email: only if you subscribe to notifications

**Never Collected**
- ❌ Personal information (name, email, IP address) unless you provide it
- ❌ Device hardware details
- ❌ Browser fingerprinting
- ❌ Geographic location

---

## 2. Data Storage & Retention

### Video Files

| Type | Retention | Location | Encryption |
|------|-----------|----------|------------|
| **Raw Upload** | 1 hour | R2/S3 | SSE-S3 (AES-256) |
| **Processed Output** | 24 hours | R2/S3 | SSE-S3 (AES-256) |
| **Deleted After** | Auto-purged | — | — |

### Processing Logs

| Data | Retention | Purpose |
|------|-----------|---------|
| Job logs | 7 days | Debugging, error reporting |
| API requests | 30 days | Billing, rate limiting |
| User sessions | 1 hour | Load balancing |

### How to Permanently Delete

Want your data removed immediately?

```bash
# Manual deletion via API (future)
curl -X DELETE https://api.louis.workers.dev/jobs/job_id/purge \
  -H "X-Purge-Secret: your-secret-key"

# Or contact us for manual cleanup
```

---

## 3. Data Security

### In Transit
- ✅ **HTTPS/TLS 1.3**: All data encrypted during upload/download
- ✅ **Certificate Pinning**: Optional for mobile apps
- ✅ **Resumable Upload Protocol**: Secure chunk verification

### At Rest
- ✅ **Server-Side Encryption**: R2/S3 AES-256 by default
- ✅ **KV Encryption**: Cloudflare KV encrypted at rest
- ✅ **No Cleartext Credentials**: API keys hashed before storage

### Access Control
- ✅ **IAM Roles**: Service accounts with minimal permissions
- ✅ **Signed URLs**: Time-limited download links
- ✅ **CORS Restrictions**: Frontend-only origin allowed
- ✅ **Rate Limiting**: Prevent brute force attacks

---

## 4. Third-Party Services & Data Sharing

We use the following cloud services. Data is only shared as necessary for processing.

| Service | Data Shared | Purpose | Terms |
|---------|------------|---------|-------|
| **Google Cloud** | Video file (compressed) | Scene analysis | [Google Cloud Terms](https://cloud.google.com/terms) |
| **Cloudinary** | Video segments | Transformation/compression | [Cloudinary Terms](https://cloudinary.com/terms) |
| **Replicate** | Video segments | AI upscaling | [Replicate Terms](https://replicate.com/terms) |
| **Cloudflare** | Logs, metrics | Hosting & CDN | [Cloudflare Terms](https://www.cloudflare.com/terms/) |

**None of these services use your data for training, advertising, or other purposes without consent.**

### Data Processing Agreements

We maintain **Data Processing Agreements (DPAs)** with all service providers. These include:
- ✅ GDPR compliance
- ✅ CCPA compliance
- ✅ Standard Contractual Clauses (SCCs)

---

## 5. Your Rights

### GDPR (EU Residents)

You have the right to:

| Right | How to Exercise | Response Time |
|------|-----------------|----------------|
| **Access** | Email support@louis.com | 30 days |
| **Rectification** | Request correction of data | 30 days |
| **Erasure** | Submit "right to be forgotten" | 30 days |
| **Portability** | Request data export (JSON) | 30 days |
| **Objection** | Opt-out of processing | Immediate |

### CCPA (California Residents)

You have the right to:
- Know what data we collect
- Delete personal data
- Opt-out of "sale" of personal data (we don't sell data)
- Non-discrimination for exercising privacy rights

### PIPEDA (Canadian Residents)

You have the right to:
- Access your personal information
- Request correction
- Request deletion
- Withdraw consent

---

## 6. Cookies & Tracking

### Cookies Used

| Cookie | Purpose | Expires |
|--------|---------|---------|
| `session_id` | User session tracking | 1 hour |
| `job_history` | Remember recent jobs (browser-only) | 30 days |
| `theme_preference` | Dark/light mode preference | Never |

### Opt-Out

All tracking can be disabled:

```javascript
// Option 1: Browser Privacy Mode (Recommended)
// Use your browser's "Private" or "Incognito" mode

// Option 2: Disable in settings
// Toggle "Analytics Mode" OFF in app settings

// Option 3: Do Not Track header
// Browser will send: DNT: 1 (we respect this)
```

---

## 7. Privacy Controls

### In-App Settings

```
Settings → Privacy
  ☐ Enable Analytics & Error Reporting
  ☑ Enable Auto-Purge (delete files after 24h) [ALWAYS ON]
  ☐ Store Job History (browser cache)
  ☐ Send Improvement Suggestions
  [Save Preferences]
```

### Private Mode

Enable for sensitive content:

```
☑ Enable Private Mode
  • No analytics collected
  • No job history saved
  • No crash reports
  • Automatic purge after job completes
```

---

## 8. Compliance

### Standards & Certifications

- ✅ **GDPR**: EU General Data Protection Regulation
- ✅ **CCPA**: California Consumer Privacy Act
- ✅ **PIPEDA**: Personal Information Protection & Electronic Documents Act
- ✅ **FedRAMP**: (In progress for government customers)
- ✅ **SOC 2 Type II**: (Pending audit)

### Audit Trail

All data access is logged:

```json
{
  "timestamp": "2024-03-10T14:30:00Z",
  "action": "video_upload",
  "jobId": "job_xyz",
  "source": "frontend_ui",
  "status": "success"
}
```

Logs retained for 30 days for compliance & security.

---

## 9. Contact & Complaints

### Questions or Concerns?

**Email**: privacy@louis.com  
**Response Time**: 7 business days

**Regulatory Complaints**:

| Region | Authority | How to Complain |
|--------|-----------|-----------------|
| **EU** | Your local Data Protection Authority | [GDPR Supervisor Listing](https://edpb.ec.europa.eu/about-edpb/about-edpb_en) |
| **US-CA** | California Privacy Protection Agency | [CPPA Website](https://cppa.ca.gov) |
| **Canada** | Office of the Privacy Commissioner | [OPC Website](https://www.priv.gc.ca) |

---

## 10. Policy Changes

This policy may be updated. When changes occur:

- 📧 Email notification (if applicable)
- 📍 Updated date shown below
- 🔔 In-app notification for material changes

Your continued use of Louis after updates indicates acceptance.

---

## 11. Appendix: Data Flowchart

```
┌─────────────────────────────┐
│  Your Computer              │
│  (Video File)               │
└──────────┬──────────────────┘
           │ HTTPS+TLS
           ▼
┌─────────────────────────────┐
│  Cloudflare R2              │
│  (Enc: SSE-S3)              │
│  TTL: 1 hour                │
└──────────┬──────────────────┘
           │
      ┌────┴────┐
      │          │
      ▼          ▼
┌──────────┐ ┌──────────────────────┐
│ Google   │ │ Cloudinary           │
│ Video    │ │ (Transform)          │
│ Intell.  │ │ TTL: 24h             │
└──────────┘ └──────────┬───────────┘
             │ (Optional)
             ▼
        ┌──────────────┐
        │ Replicate    │
        │ (Upscale)    │
        └──────────────┘
             │
             ▼
    ┌─────────────────────────┐
    │ Output ZIP              │
    │ (Signed URL, 24h TTL)   │
    └────────┬────────────────┘
             │ HTTPS
             ▼
    ┌─────────────────────────┐
    │ Your Download           │
    │ (Auto-delete after 24h) │
    └─────────────────────────┘
```

---

**Last Updated**: March 10, 2024  
**Version**: 1.0  
**Next Review**: June 10, 2024
