<script>
  import { onMount } from 'svelte'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let jobId = null

  let jobStatus = 'queued'
  let progress = 0
  let logs = []
  let downloadUrl = null
  let error = null
  let pollInterval

  onMount(async () => {
    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/${jobId}`)
        const data = await response.json()

        jobStatus = data.status
        progress = data.progress || 0
        logs = data.logs || []

        if (data.status === 'completed') {
          downloadUrl = data.downloadUrl
          clearInterval(pollInterval)
          dispatch('complete', data)
        } else if (data.status === 'failed') {
          error = data.error
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  })

  function getStatusColor() {
    switch (jobStatus) {
      case 'queued': return '#666'
      case 'processing': return '#2a5298'
      case 'completed': return '#27ae60'
      case 'failed': return '#e74c3c'
      default: return '#666'
    }
  }

  function getStatusLabel() {
    switch (jobStatus) {
      case 'queued': return 'Queued'
      case 'processing': return 'Processing'
      case 'completed': return 'Completed'
      case 'failed': return 'Failed'
      default: return 'Unknown'
    }
  }
</script>

<div class="monitor-container">
  <div class="status-section">
    <h2>Step 3: Processing Video</h2>

    <div class="status-display" style="color: {getStatusColor()}">
      <h3>{getStatusLabel()}</h3>
      <p>Job ID: <code>{jobId}</code></p>
    </div>

    <div class="progress-section">
      <div class="progress-label">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    </div>

    {#if error}
      <div class="error-message">
        <h4>❌ Processing Failed</h4>
        <p>{error}</p>
        <button on:click={() => window.location.reload()}>Retry</button>
      </div>
    {/if}

    {#if jobStatus === 'completed' && downloadUrl}
      <div class="success-message">
        <h4>✅ Processing Complete!</h4>
        <p>Your processed video segments are ready.</p>
        <a href={downloadUrl} class="download-button">
          📥 Download Results (ZIP)
        </a>
      </div>
    {/if}

    <div class="logs-section">
      <h3>Processing Logs</h3>
      <div class="logs-display">
        {#each logs as log (log.timestamp)}
          <div class="log-entry">
            <span class="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span class="message">{log.message}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .monitor-container {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 700px;
    margin: 0 auto;
  }

  h2 {
    margin-top: 0;
    color: #1e3c72;
  }

  .status-display {
    text-align: center;
    padding: 1.5rem;
    background: #f9f9f9;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .status-display h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  .status-display code {
    background: #e0e0e0;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-family: monospace;
  }

  .progress-section {
    margin-bottom: 2rem;
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .progress-bar {
    background: #e0e0e0;
    height: 24px;
    border-radius: 12px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2a5298, #1e3c72);
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .error-message {
    background: #fee;
    border-left: 4px solid #e74c3c;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 2rem;
  }

  .error-message h4 {
    margin-top: 0;
    color: #c0392b;
  }

  .error-message button {
    background: #e74c3c;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .success-message {
    background: #f0fff4;
    border-left: 4px solid #27ae60;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 2rem;
  }

  .success-message h4 {
    margin-top: 0;
    color: #27ae60;
  }

  .download-button {
    display: inline-block;
    background: #27ae60;
    color: white;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.3s;
  }

  .download-button:hover {
    background: #229954;
  }

  .logs-section {
    margin-top: 2rem;
    border-top: 1px solid #eee;
    padding-top: 2rem;
  }

  .logs-section h3 {
    margin-top: 0;
    color: #1e3c72;
  }

  .logs-display {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    max-height: 300px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
  }

  .log-entry {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .log-entry:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .timestamp {
    color: #999;
    white-space: nowrap;
    font-weight: 600;
  }

  .message {
    color: #333;
    flex: 1;
  }

  @media (max-width: 768px) {
    .monitor-container {
      padding: 1rem;
    }

    .logs-display {
      max-height: 200px;
    }

    .log-entry {
      flex-direction: column;
      gap: 0;
    }
  }
</style>
