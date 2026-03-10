terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Cloudflare R2 Bucket for video storage
resource "cloudflare_r2_bucket" "louis_videos" {
  account_id = var.cloudflare_account_id
  bucket_name = "louis-videos-${var.environment}"
  location = "WNAM" # Western North America
}

# Lifecycle policy: Auto-delete files after 24h
resource "cloudflare_r2_bucket" "louis_videos_config" {
  account_id = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.louis_videos.bucket_name
  
  # Note: Lifecycle policies configured via console or boto3
  # Terraform R2 support is limited; use aws-cli with R2 config
}

# Cloudflare KV Namespace for job state
resource "cloudflare_workers_kv_namespace" "job_state" {
  account_id = var.cloudflare_account_id
  title      = "job-state-${var.environment}"
}

# Cloudflare Workers script
resource "cloudflare_workers_script" "louis_api" {
  account_id = var.cloudflare_account_id
  name       = "louis-api-${var.environment}"
  content    = file("${path.module}/../backend/dist/index.js")

  # Bind R2 bucket
  plain_text_binding {
    name         = "VIDEO_BUCKET"
    text         = cloudflare_r2_bucket.louis_videos.bucket_name
  }

  # Bind KV namespace
  kv_namespace_binding {
    name              = "JOB_STATE"
    namespace_id      = cloudflare_workers_kv_namespace.job_state.id
  }

  # Environment variables
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
}

# Outputs
output "r2_bucket_name" {
  value = cloudflare_r2_bucket.louis_videos.bucket_name
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.job_state.id
}

output "worker_url" {
  value = "https://${cloudflare_workers_script.louis_api.name}.workers.dev"
}
