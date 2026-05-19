/**
 * Custom YouTube Embed Block Tool for Editor.js
 * Supports YouTube video embedding with preview
 */
class YouTubeEmbed {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'YouTube',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor"/></svg>'
    };
  }

  static get sanitize() {
    return {
      videoId: {},
      url: {},
      caption: {
        br: true
      }
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      videoId: data.videoId || '',
      url: data.url || '',
      caption: data.caption || ''
    };
    
    this._isDestroyed = false;
  }

  render() {
    // Main wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('youtube-embed-wrapper');
    this.wrapper.style.margin = '16px 0';
    this.wrapper.style.borderRadius = '8px';
    this.wrapper.style.overflow = 'hidden';
    this.wrapper.style.background = '#1e1e1e';
    
    if (!this.readOnly) {
      // Input container
      const inputContainer = document.createElement('div');
      inputContainer.style.padding = '16px';
      inputContainer.style.background = '#2d2d2d';
      inputContainer.style.display = 'flex';
      inputContainer.style.gap = '8px';
      inputContainer.style.alignItems = 'center';
      
      // YouTube icon
      const ytIcon = document.createElement('div');
      ytIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#ff0000"/></svg>';
      inputContainer.appendChild(ytIcon);
      
      // URL input
      this.urlInput = document.createElement('input');
      this.urlInput.type = 'text';
      this.urlInput.placeholder = 'Paste YouTube URL...';
      this.urlInput.value = this.data.url;
      this.urlInput.style.flex = '1';
      this.urlInput.style.padding = '8px 12px';
      this.urlInput.style.border = 'none';
      this.urlInput.style.borderRadius = '4px';
      this.urlInput.style.fontSize = '14px';
      this.urlInput.style.background = '#3d3d3d';
      this.urlInput.style.color = '#d4d4d4';
      this.urlInput.style.outline = 'none';
      
      // Apply button
      this.applyBtn = document.createElement('button');
      this.applyBtn.textContent = 'Embed';
      this.applyBtn.style.padding = '8px 16px';
      this.applyBtn.style.border = 'none';
      this.applyBtn.style.borderRadius = '4px';
      this.urlInput.style.fontSize = '14px';
      this.applyBtn.style.background = '#ff0000';
      this.applyBtn.style.color = '#fff';
      this.applyBtn.style.cursor = 'pointer';
      this.applyBtn.style.fontWeight = '500';
      
      this.applyBtn.addEventListener('click', () => {
        this._handleUrlInput();
      });
      
      this.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._handleUrlInput();
        }
      });
      
      inputContainer.appendChild(this.urlInput);
      inputContainer.appendChild(this.applyBtn);
      this.wrapper.appendChild(inputContainer);
    }
    
    // Preview container
    this.previewContainer = document.createElement('div');
    this.previewContainer.style.position = 'relative';
    this.previewContainer.style.width = '100%';
    this.previewContainer.style.paddingTop = '56.25%'; // 16:9 aspect ratio
    this.previewContainer.style.background = '#000';
    this.previewContainer.style.display = 'none';
    
    // Iframe for YouTube
    this.iframe = document.createElement('iframe');
    this.iframe.style.position = 'absolute';
    this.iframe.style.top = '0';
    this.iframe.style.left = '0';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.setAttribute('allowfullscreen', 'true');
    this.iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    
    this.previewContainer.appendChild(this.iframe);
    this.wrapper.appendChild(this.previewContainer);
    
    // Caption input
    if (!this.readOnly) {
      this.captionInput = document.createElement('div');
      this.captionInput.contentEditable = 'true';
      this.captionInput.innerHTML = this.data.caption;
      this.captionInput.style.padding = '12px 16px';
      this.captionInput.style.color = '#9ca3af';
      this.captionInput.style.fontSize = '14px';
      this.captionInput.style.fontStyle = 'italic';
      this.captionInput.style.outline = 'none';
      this.captionInput.style.background = '#1e1e1e';
      this.captionInput.setAttribute('data-placeholder', 'Add caption (optional)');
      
      // Placeholder styles
      const placeholderStyle = document.createElement('style');
      placeholderStyle.textContent = `
        .youtube-embed-wrapper [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
        }
      `;
      this.wrapper.appendChild(placeholderStyle);
      this.wrapper.appendChild(this.captionInput);
    } else if (this.data.caption) {
      const captionDiv = document.createElement('div');
      captionDiv.textContent = this.data.caption;
      captionDiv.style.padding = '12px 16px';
      captionDiv.style.color = '#9ca3af';
      captionDiv.style.fontSize = '14px';
      captionDiv.style.fontStyle = 'italic';
      captionDiv.style.textAlign = 'center';
      this.wrapper.appendChild(captionDiv);
    }
    
    // Show preview if videoId exists
    if (this.data.videoId) {
      this._showPreview(this.data.videoId);
    }
    
    return this.wrapper;
  }

  /**
   * Handle URL input and extract video ID
   */
  _handleUrlInput() {
    const url = this.urlInput.value.trim();
    if (!url) return;
    
    const videoId = this._extractVideoId(url);
    if (videoId) {
      this.data.url = url;
      this.data.videoId = videoId;
      this._showPreview(videoId);
    } else {
      // Show error feedback
      this.urlInput.style.border = '1px solid #ef4444';
      setTimeout(() => {
        this.urlInput.style.border = 'none';
      }, 2000);
    }
  }

  /**
   * Extract YouTube video ID from various URL formats
   */
  _extractVideoId(url) {
    if (!url) return null;
    
    // Patterns for different YouTube URL formats
    const patterns = [
      // Standard watch URL: youtube.com/watch?v=VIDEO_ID
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      // Short URL: youtu.be/VIDEO_ID
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      // Embed URL: youtube.com/embed/VIDEO_ID
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      // Shorts URL: youtube.com/shorts/VIDEO_ID
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      // Live URL: youtube.com/live/VIDEO_ID
      /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
      // Just the video ID (11 characters)
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Show video preview
   */
  _showPreview(videoId) {
    if (!videoId) return;
    
    this.iframe.src = `https://www.youtube.com/embed/${videoId}`;
    this.previewContainer.style.display = 'block';
    
    // Hide input container after successful embed
    const inputContainer = this.wrapper.querySelector('div');
    if (inputContainer && !this.readOnly) {
      inputContainer.style.display = 'none';
    }
  }

  save() {
    return {
      videoId: this.data.videoId,
      url: this.data.url,
      caption: this.captionInput ? this.captionInput.innerHTML : this.data.caption
    };
  }

  /**
   * Clean up when block is destroyed
   */
  destroy() {
    this._isDestroyed = true;
    // Remove iframe to stop video
    if (this.iframe) {
      this.iframe.src = '';
    }
  }

  static get pasteConfig() {
    return {
      patterns: {
        youtube: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      }
    };
  }

  onPaste(event) {
    if (event.type === 'pattern') {
      const url = event.detail.data;
      const videoId = this._extractVideoId(url);
      if (videoId) {
        this.data.url = url;
        this.data.videoId = videoId;
        if (this.urlInput) {
          this.urlInput.value = url;
        }
        this._showPreview(videoId);
      }
    }
  }
}

// Expose to window for Editor.js
window.YouTubeEmbed = YouTubeEmbed;

// Export for ES modules
export { YouTubeEmbed };
