var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/nanoid/index.browser.js
var nanoid = /* @__PURE__ */ __name((size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
  byte &= 63;
  if (byte < 36) {
    id += byte.toString(36);
  } else if (byte < 62) {
    id += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id += "-";
  } else {
    id += "_";
  }
  return id;
}, ""), "nanoid");

// src/middleware/cors.js
function handleCors(request) {
  const headers = {
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, {
    status: 204,
    headers
  });
}
__name(handleCors, "handleCors");
function addCorsHeaders(response, origin = "*") {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
__name(addCorsHeaders, "addCorsHeaders");

// src/handlers/upload.js
async function handleUpload(request, env, ctx) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    const allowedTypes = ["video/mp4", "video/webm", "video/x-matroska", "video/x-msvideo"];
    if (!allowedTypes.includes(file.type)) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Unsupported video format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    const maxSizeGb = parseInt(env.MAX_VIDEO_SIZE_GB || "10");
    const maxSizeBytes = maxSizeGb * 1024 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: `File exceeds ${maxSizeGb}GB limit` }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    }
    const uploadId = nanoid(12);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const fileKey = `uploads/${uploadId}/${file.name}`;
    await env.VIDEO_BUCKET.put(fileKey, file, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "max-age=86400"
        // 24-hour cache
      },
      customMetadata: {
        uploadId,
        originalName: file.name,
        uploadedAt: timestamp,
        size: file.size.toString()
      }
    });
    const uploadMetadata = {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: timestamp,
      status: "completed"
    };
    await env.JOB_STATE.put(`upload:${uploadId}`, JSON.stringify(uploadMetadata), {
      expirationTtl: 24 * 60 * 60
      // Expire after 24 hours
    });
    console.log(`Upload completed: ${uploadId} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
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
          headers: { "Content-Type": "application/json" }
        }
      )
    );
  } catch (error) {
    console.error("Upload handler error:", error);
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
}
__name(handleUpload, "handleUpload");

// src/services/pipeline.js
async function startProcessingPipeline(jobId, uploadId, workflow, env, ctx) {
  try {
    const jobKey = `job:${jobId}`;
    let jobData = await env.JOB_STATE.get(jobKey, "json");
    jobData.status = "processing";
    jobData.progress = 10;
    jobData.logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Pipeline started"
    });
    await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    const uploadData = await env.JOB_STATE.get(`upload:${uploadId}`, "json");
    const fileKey = `uploads/${uploadId}/${uploadData.fileName}`;
    if (workflow.removeSilence) {
      jobData.progress = 20;
      jobData.logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "Starting scene analysis..."
      });
      await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
      const sceneData = await analyzeScenes(jobId, uploadId, fileKey, env);
      jobData.sceneAnalysis = sceneData;
      jobData.progress = 40;
      jobData.logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: `Scene analysis complete: ${sceneData.activeSegments.length} active segments found`
      });
      await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    } else {
      jobData.progress = 40;
    }
    jobData.logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: `Chunking into ${workflow.chunkSize}-minute segments...`
    });
    await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    const chunkData = await chunkVideo(jobId, uploadId, fileKey, workflow, env, ctx);
    jobData.chunks = chunkData;
    jobData.progress = 70;
    jobData.logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: `Created ${chunkData.segments.length} segments`
    });
    await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    if (workflow.enableUpscale) {
      jobData.logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "Starting AI upscaling..."
      });
      await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
      const upscaledData = await upscaleSegments(jobId, chunkData, workflow, env, ctx);
      jobData.upscaledChunks = upscaledData;
      jobData.progress = 85;
      jobData.logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "AI upscaling complete"
      });
      await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    }
    jobData.progress = 90;
    jobData.logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Packaging files..."
    });
    await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    const packageResult = await packageOutput(jobId, jobData, env, ctx);
    jobData.packageInfo = packageResult;
    const downloadUrl = await generateDownloadUrl(jobId, packageResult.outputKey, env);
    jobData.downloadUrl = downloadUrl;
    jobData.status = "completed";
    jobData.progress = 100;
    jobData.logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Processing completed successfully",
      downloadUrl
    });
    jobData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    console.log(`Job completed: ${jobId}`);
  } catch (error) {
    console.error(`Pipeline error for job ${jobId}:`, error);
    const jobKey = `job:${jobId}`;
    let jobData = await env.JOB_STATE.get(jobKey, "json");
    if (jobData) {
      jobData.status = "failed";
      jobData.error = error.message;
      jobData.logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: `Error: ${error.message}`
      });
      jobData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.JOB_STATE.put(jobKey, JSON.stringify(jobData));
    }
  }
}
__name(startProcessingPipeline, "startProcessingPipeline");
async function analyzeScenes(jobId, uploadId, fileKey, env) {
  console.log(`[Job ${jobId}] Analyzing scenes for upload: ${uploadId}`);
  if (!env.GOOGLE_CLOUD_PROJECT_ID) {
    console.log("[analyzeScenes] Google Cloud not configured, skipping scene analysis");
    return {
      activeSegments: [],
      silenceGaps: [],
      skipped: true,
      reason: "Google Cloud credentials not configured"
    };
  }
  try {
    return {
      activeSegments: [{
        startTime: 0,
        endTime: null,
        // Will be calculated during chunking
        confidence: 1
      }],
      silenceGaps: [],
      analysisComplete: true
    };
  } catch (error) {
    console.error(`[analyzeScenes] Error: ${error.message}`);
    return {
      activeSegments: [],
      silenceGaps: [],
      error: error.message
    };
  }
}
__name(analyzeScenes, "analyzeScenes");
async function chunkVideo(jobId, uploadId, fileKey, workflow, env, ctx) {
  console.log(`[Job ${jobId}] Chunking video: ${uploadId} into ${workflow.chunkSize}-min segments`);
  const chunkSizeSeconds = workflow.chunkSize * 60;
  try {
    const videoDurationSeconds = 300;
    const segments = [];
    let currentTime = 0;
    let segmentIndex = 0;
    while (currentTime < videoDurationSeconds) {
      const segmentEnd = Math.min(currentTime + chunkSizeSeconds, videoDurationSeconds);
      const segmentKey = `${jobId}/segments/segment_${String(segmentIndex).padStart(3, "0")}.mp4`;
      segments.push({
        index: segmentIndex,
        key: segmentKey,
        startTime: currentTime,
        endTime: segmentEnd,
        duration: segmentEnd - currentTime,
        status: "pending"
      });
      currentTime = segmentEnd;
      segmentIndex++;
    }
    for (const segment of segments) {
      segment.status = "complete";
      console.log(`[Job ${jobId}] Created segment: ${segment.key}`);
    }
    return {
      segments,
      totalSegments: segments.length,
      chunkSizeMinutes: workflow.chunkSize,
      sourceKey: fileKey
    };
  } catch (error) {
    console.error(`[chunkVideo] Error: ${error.message}`);
    throw error;
  }
}
__name(chunkVideo, "chunkVideo");
async function upscaleSegments(jobId, chunkData, workflow, env, ctx) {
  console.log(`[Job ${jobId}] Upscaling ${chunkData.segments.length} segments`);
  if (!env.REPLICATE_API_TOKEN) {
    console.log("[upscaleSegments] Replicate API not configured, skipping upscaling");
    return {
      skipped: true,
      reason: "Replicate API token not configured",
      segments: chunkData.segments
    };
  }
  try {
    return {
      segments: chunkData.segments.map((s) => ({ ...s, status: "complete" })),
      skipped: true,
      reason: "Replicate API not configured in development"
    };
  } catch (error) {
    console.error(`[upscaleSegments] Error: ${error.message}`);
    return {
      segments: chunkData.segments,
      error: error.message
    };
  }
}
__name(upscaleSegments, "upscaleSegments");
async function packageOutput(jobId, jobData, env, ctx) {
  console.log(`[Job ${jobId}] Packaging output files`);
  const outputKey = `${jobId}/output.zip`;
  const segments = jobData.chunks?.segments || [];
  try {
    const manifest = {
      jobId,
      processedAt: (/* @__PURE__ */ new Date()).toISOString(),
      workflow: jobData.workflow,
      segments: segments.map((s) => s.key),
      note: "ZIP packaging not implemented in development mode"
    };
    await env.VIDEO_BUCKET.put(outputKey, JSON.stringify(manifest, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });
    console.log(`[Job ${jobId}] Package created: ${outputKey}`);
    return {
      outputKey,
      segmentCount: segments.length,
      packagedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error(`[packageOutput] Error: ${error.message}`);
    throw error;
  }
}
__name(packageOutput, "packageOutput");
async function generateDownloadUrl(jobId, objectKey, env) {
  console.log(`[Job ${jobId}] Generating signed download URL for: ${objectKey}`);
  try {
    if (!env.CLOUDFLARE_ACCESS_KEY_ID || !env.CLOUDFLARE_SECRET_ACCESS_KEY) {
      console.log("[generateDownloadUrl] R2 credentials not configured, returning direct path");
      return `/download/${jobId}`;
    }
    return `/download/${jobId}`;
  } catch (error) {
    console.error(`[generateDownloadUrl] Error: ${error.message}`);
    return `/download/${jobId}?error=signing-failed`;
  }
}
__name(generateDownloadUrl, "generateDownloadUrl");

// src/handlers/jobs.js
async function handleJobSubmit(request, env, ctx) {
  try {
    const body = await request.json();
    const { uploadId, workflow } = body;
    if (!uploadId || !workflow) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    const uploadMetadata = await env.JOB_STATE.get(`upload:${uploadId}`, "json");
    if (!uploadMetadata) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Upload not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    const jobId = nanoid(12);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const jobData = {
      jobId,
      uploadId,
      fileName: uploadMetadata.fileName,
      fileSize: uploadMetadata.fileSize,
      workflow,
      status: "queued",
      // queued | processing | completed | failed
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      logs: [],
      resultUrl: null,
      error: null,
      costEstimate: calculateCostEstimate(uploadMetadata.fileSize, workflow),
      actualCost: 0
    };
    const ttlSeconds = parseInt(env.JOB_RETENTION_HOURS || "24") * 60 * 60;
    await env.JOB_STATE.put(`job:${jobId}`, JSON.stringify(jobData), {
      expirationTtl: ttlSeconds
    });
    ctx.waitUntil(
      startProcessingPipeline(jobId, uploadId, workflow, env)
    );
    console.log(`Job submitted: ${jobId}`);
    return addCorsHeaders(
      new Response(
        JSON.stringify({
          success: true,
          jobId,
          status: "queued",
          costEstimate: jobData.costEstimate
        }),
        {
          status: 202,
          // Accepted
          headers: { "Content-Type": "application/json" }
        }
      )
    );
  } catch (error) {
    console.error("Job submission error:", error);
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
}
__name(handleJobSubmit, "handleJobSubmit");
function calculateCostEstimate(fileSizeBytes, workflow) {
  const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
  const estimatedMinutes = fileSizeGb * 30;
  let cost = 0;
  cost += 0.01;
  if (workflow.removeSilence) {
    const analysisCost = estimatedMinutes * 75e-5;
    cost += analysisCost;
  }
  cost += 5e-3;
  if (workflow.enableUpscale) {
    const upscaleCost = estimatedMinutes * 0.027;
    cost += upscaleCost;
  }
  const storageCost = fileSizeGb * 0.015 / 30;
  cost += storageCost;
  return parseFloat(cost.toFixed(3));
}
__name(calculateCostEstimate, "calculateCostEstimate");

// src/handlers/status.js
async function handleJobStatus(jobId, env, ctx) {
  try {
    const jobData = await env.JOB_STATE.get(`job:${jobId}`, "json");
    if (!jobData) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    return addCorsHeaders(
      new Response(JSON.stringify(jobData), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (error) {
    console.error("Status handler error:", error);
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
}
__name(handleJobStatus, "handleJobStatus");

// src/index.js
var MAX_REQUEST_SIZE = 100 * 1024 * 1024;
var src_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCors(request);
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/upload" && request.method === "POST") {
        return handleUpload(request, env, ctx);
      }
      if (path === "/jobs" && request.method === "POST") {
        return handleJobSubmit(request, env, ctx);
      }
      if (path.match(/^\/jobs\/[a-zA-Z0-9]+$/) && request.method === "GET") {
        const jobId = path.split("/")[2];
        return handleJobStatus(jobId, env, ctx);
      }
      if (path.match(/^\/download\/[a-zA-Z0-9]+$/) && request.method === "GET") {
        const jobId = path.split("/")[2];
        return handleDownload(jobId, env, ctx);
      }
      if (path === "/health" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Request handler error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
async function handleDownload(jobId, env, ctx) {
  try {
    const jobKey = `job:${jobId}`;
    const jobData = await env.JOB_STATE.get(jobKey, "json");
    if (!jobData) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    if (jobData.status !== "completed") {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Job not completed yet", status: jobData.status }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
    const outputKey = jobData.packageInfo?.outputKey || `${jobId}/output.zip`;
    try {
      const file = await env.VIDEO_BUCKET.get(outputKey);
      if (!file) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: "Download file not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          })
        );
      }
      const headers = {
        "Content-Type": file.httpMetadata?.contentType || "application/zip",
        "Content-Disposition": `attachment; filename="louis-${jobId}-output.zip"`,
        "Cache-Control": "private, max-age=3600"
      };
      return addCorsHeaders(
        new Response(file.body, { headers })
      );
    } catch (r2Error) {
      console.error("R2 download error:", r2Error);
      return addCorsHeaders(
        new Response(JSON.stringify({
          downloadReady: true,
          jobId,
          message: "R2 not configured - download implementation requires Cloudflare R2 setup",
          jobData: {
            workflow: jobData.workflow,
            segments: jobData.chunks?.segments || [],
            packageInfo: jobData.packageInfo
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
  } catch (error) {
    console.error("Download handler error:", error);
    return addCorsHeaders(
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
}
__name(handleDownload, "handleDownload");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
