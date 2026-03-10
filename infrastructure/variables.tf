variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "dev"
}

variable "google_cloud_project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "cloudinary_cloud_name" {
  description = "Cloudinary Cloud Name"
  type        = string
}

variable "cloudinary_api_key" {
  description = "Cloudinary API Key"
  type        = string
  sensitive   = true
}

variable "replicate_api_token" {
  description = "Replicate API Token (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_region" {
  description = "AWS Region (for Lambda)"
  type        = string
  default     = "us-east-1"
}
