<script>
  import { onMount } from 'svelte'
  import Uppy from '@uppy/core'
  import XHRUpload from '@uppy/xhr-upload'
  import StatusBar from '@uppy/status-bar'
  import '@uppy/core/dist/style.min.css'
  import '@uppy/status-bar/dist/style.min.css'

  let container
  let uppy

  onMount(() => {
    const maxSize = (parseInt(import.meta.env.VITE_MAX_UPLOAD_SIZE_GB || '5')) * 1024 * 1024 * 1024

    uppy = new Uppy({
      autoProceed: false,
      allowMultipleUploads: false,
      restrictions: {
        maxFileSize: maxSize,
        maxNumberOfFiles: 1,
        allowedFileTypes: ['video/*']
      }
    })

    uppy.use(XHRUpload, {
      endpoint: `${import.meta.env.VITE_API_BASE_URL}/upload`,
      fieldName: 'file',
      limit: 1
    })

    uppy.use(StatusBar, {
      target: container,
      hideUploadButton: false,
      hideRetryButton: false,
      hidePauseResumeButton: false,
      hideAfterFinish: false
    })

    uppy.on('upload-success', (file, response) => {
      dispatch('complete', {
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadId: response.body.uploadId
        }
      })
    })

    uppy.on('upload-error', (file, error) => {
      console.error('Upload error:', error)
    })

    return () => {
      uppy.close()
    }
  })

  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
</script>

<div class="uploader-container">
  <div class="upload-section">
    <h2>Step 1: Upload Your Video</h2>
    <p class="subtitle">Supported formats: MP4, WebM, MKV, AVI (up to {import.meta.env.VITE_MAX_UPLOAD_SIZE_GB || '5'}GB)</p>
    
    <div bind:this={container} class="uppy-area"></div>

    <div class="help-text">
      <h3>💡 Tips for Best Results:</h3>
      <ul>
        <li>Videos with long inactive sections will benefit most from preprocessing</li>
        <li>Resumes automatically if upload is interrupted</li>
        <li>For videos >10GB, consider splitting locally and uploading in parts</li>
        <li>Estimated cloud processing cost will be shown in the next step</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .uploader-container {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  h2 {
    margin-top: 0;
    color: #1e3c72;
  }

  .subtitle {
    color: #666;
    font-size: 0.95rem;
    margin: 0.5rem 0 1rem 0;
  }

  .uppy-area {
    min-height: 300px;
    border: 2px dashed #ccc;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    background: #f9f9f9;
  }

  .help-text {
    margin-top: 2rem;
    padding: 1rem;
    background: #f0f7ff;
    border-left: 4px solid #2a5298;
    border-radius: 4px;
  }

  .help-text h3 {
    margin-top: 0;
    color: #1e3c72;
  }

  .help-text ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .help-text li {
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  @media (max-width: 768px) {
    .uploader-container {
      padding: 1rem;
    }

    .uppy-area {
      min-height: 200px;
      padding: 1rem;
    }
  }
</style>
