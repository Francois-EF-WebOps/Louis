<script>
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let file = null

  let removeSilence = true
  let chunkSize = 5
  let enableUpscale = false
  let upscaleQuality = 'balanced'
  let estimatedCost = 0.05
  let isSubmitting = false

  function formatFileSize(bytes) {
    const gb = bytes / (1024 * 1024 * 1024)
    return gb.toFixed(2) + ' GB'
  }

  function calculateEstimatedCost() {
    // Rough estimation: $0.00075 per minute for analysis + $0.01 for transformations
    const durationMinutes = (file?.size / (1024 * 1024)) * 0.5 // Rough estimate
    let cost = durationMinutes * 0.00075 + 0.01

    if (enableUpscale) {
      cost += durationMinutes * 0.027 // Replicate upscale cost estimate
    }

    estimatedCost = Math.max(0.01, cost).toFixed(2)
  }

  async function handleSubmit() {
    isSubmitting = true
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId: file.uploadId,
          workflow: {
            removeSilence,
            chunkSize,
            enableUpscale,
            upscaleQuality
          }
        })
      })

      const data = await response.json()

      dispatch('submit', {
        jobId: data.jobId,
        ...data
      })
    } catch (error) {
      console.error('Job submission error:', error)
      isSubmitting = false
    }
  }

  $: if (file) calculateEstimatedCost()
</script>

<div class="config-container">
  <div class="config-section">
    <h2>Step 2: Configure Processing Workflow</h2>

    <div class="file-info">
      <p><strong>File:</strong> {file.name}</p>
      <p><strong>Size:</strong> {formatFileSize(file.size)}</p>
    </div>

    <div class="workflow-options">
      <div class="option">
        <label>
          <input type="checkbox" bind:checked={removeSilence} />
          <span><strong>Remove Inactive Scenes</strong></span>
        </label>
        <p class="description">
          Uses AI to detect and remove silent/static sections. Recommended for videos with long inactive parts.
        </p>
      </div>

      <div class="option">
        <label>
          <strong>Chunk Duration:</strong>
        </label>
        <select bind:value={chunkSize}>
          <option value={3}>3 minutes</option>
          <option value={5}>5 minutes (Recommended)</option>
          <option value={10}>10 minutes</option>
          <option value={15}>15 minutes</option>
        </select>
        <p class="description">
          Segments active content into chunks for easier editing.
        </p>
      </div>

      <div class="option">
        <label>
          <input type="checkbox" bind:checked={enableUpscale} />
          <span><strong>AI Upscaling (Optional)</strong></span>
        </label>
        <p class="description">
          Enhance video quality up to 720p using Topaz AI. This adds cost (~$0.03 per minute) but significantly improves quality.
        </p>
        {#if enableUpscale}
          <div class="suboption">
            <label>
              <strong>Quality Level:</strong>
            </label>
            <select bind:value={upscaleQuality}>
              <option value="balanced">Balanced (Recommended)</option>
              <option value="high">High Quality</option>
              <option value="max">Maximum Quality</option>
            </select>
          </div>
        {/if}
      </div>
    </div>

    <div class="cost-estimate">
      <h3>💰 Estimated Cost</h3>
      <div class="cost-display">
        <span class="amount">${estimatedCost}</span>
        <span class="note">Using free tier first, optional paid features enabled</span>
      </div>
      <p class="cost-note">
        ✅ <strong>Google Video Intelligence:</strong> Free (1,000 min/month)<br />
        ✅ <strong>Cloudinary Transform:</strong> Free (20,000 operations/month)<br />
        {#if enableUpscale}
          💳 <strong>Replicate Upscale:</strong> ~${(estimatedCost * 0.8).toFixed(2)}<br />
        {/if}
      </p>
    </div>

    <button 
      on:click={handleSubmit}
      disabled={isSubmitting}
      class="submit-button"
    >
      {isSubmitting ? 'Submitting...' : 'Start Processing'}
    </button>
  </div>
</div>

<style>
  .config-container {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    margin: 0 auto;
  }

  h2 {
    margin-top: 0;
    color: #1e3c72;
  }

  .file-info {
    background: #f0f7ff;
    border-left: 4px solid #2a5298;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 2rem;
  }

  .file-info p {
    margin: 0.5rem 0;
  }

  .workflow-options {
    margin-bottom: 2rem;
  }

  .option {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #eee;
  }

  .option:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    margin-bottom: 0.5rem;
  }

  input[type='checkbox'] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }

  .description {
    margin: 0.5rem 0 0 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .suboption {
    margin-left: 2rem;
    margin-top: 1rem;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 4px;
  }

  .cost-estimate {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .cost-estimate h3 {
    margin-top: 0;
    color: #22543d;
  }

  .cost-display {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .amount {
    font-size: 2rem;
    font-weight: bold;
    color: #27ae60;
  }

  .note {
    font-size: 0.85rem;
    color: #666;
  }

  .cost-note {
    margin: 0;
    font-size: 0.85rem;
    color: #22543d;
    line-height: 1.6;
  }

  .submit-button {
    width: 100%;
    background: #2a5298;
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background 0.3s;
  }

  .submit-button:hover:not(:disabled) {
    background: #1e3c72;
  }

  .submit-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .config-container {
      padding: 1rem;
    }

    .cost-display {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
