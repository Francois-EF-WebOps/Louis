<script>
  import UppyUploader from './components/UppyUploader.svelte'
  import WorkflowConfig from './components/WorkflowConfig.svelte'
  import JobMonitor from './components/JobMonitor.svelte'
  
  let stage = 'upload' // 'upload' | 'config' | 'processing' | 'complete'
  let uploadedFile = null
  let jobId = null
  let workflowConfig = null

  function handleUploadComplete(event) {
    uploadedFile = event.detail.file
    stage = 'config'
  }

  function handleWorkflowSubmit(event) {
    workflowConfig = event.detail
    jobId = event.detail.jobId
    stage = 'processing'
  }

  function handleJobComplete(event) {
    stage = 'complete'
  }
</script>

<div class="app">
  <header>
    <h1>📹 Louis - Cloud Video Processor</h1>
    <p>Preprocess long videos for low-resource machines (6GB RAM, Intel i3)</p>
  </header>

  <main>
    {#if stage === 'upload'}
      <UppyUploader on:complete={handleUploadComplete} />
    {:else if stage === 'config'}
      <WorkflowConfig 
        file={uploadedFile} 
        on:submit={handleWorkflowSubmit} 
      />
    {:else if stage === 'processing'}
      <JobMonitor 
        {jobId} 
        on:complete={handleJobComplete}
      />
    {:else if stage === 'complete'}
      <div class="complete-message">
        <h2>✅ Processing Complete!</h2>
        <p>Your processed segments are ready for download.</p>
        <button on:click={() => { stage = 'upload'; uploadedFile = null; jobId = null; }}>
          Process Another Video
        </button>
      </div>
    {/if}
  </main>

  <footer>
    <p>🔒 Privacy-first • 💰 Cost-managed • ⚡ Fast & Reliable</p>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: #333;
    min-height: 100vh;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  header h1 {
    margin: 0 0 0.5rem 0;
    color: #1e3c72;
  }

  header p {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
  }

  main {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }

  .complete-message {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .complete-message h2 {
    color: #27ae60;
    margin-top: 0;
  }

  button {
    background: #2a5298;
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s;
  }

  button:hover {
    background: #1e3c72;
  }

  footer {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    text-align: center;
    padding: 1rem;
    font-size: 0.9rem;
  }

  footer p {
    margin: 0;
  }

  @media (max-width: 768px) {
    header {
      padding: 1rem;
    }

    header h1 {
      font-size: 1.5rem;
    }

    main {
      padding: 1rem;
    }
  }
</style>
