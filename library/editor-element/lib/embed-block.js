/**
 * Multi-Service Embed Block for Editor.js
 * Supports Twitter/X, Instagram, TikTok, Spotify, SoundCloud, Vimeo, Google Maps, CodePen
 */

class EmbedBlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Embed',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 15l-2-2 2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 11l2 2-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8l-4 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      service: {},
      source: {},
      embed: {},
      width: {},
      height: {},
      caption: { br: true }
    };
  }

  static get pasteConfig() {
    return {
      patterns: {
        twitter: /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/,
        instagram: /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/,
        tiktok: /https?:\/\/(www\.|vm\.)?tiktok\.com\/[\w@/-]+/,
        spotify: /https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/[\w]+/,
        soundcloud: /https?:\/\/soundcloud\.com\/[\w-]+\/[\w-]+/,
        vimeo: /https?:\/\/(www\.)?vimeo\.com\/\d+/,
        youtube: /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/,
        maps: /https?:\/\/(www\.)?google\.(com|co\.[a-z]+)\/maps/,
        codepen: /https?:\/\/(?:www\.)?codepen\.io\/(?:editor\/)?[a-zA-Z0-9_-]+\/(?:pen|embed|full|details)\/[a-zA-Z0-9-]+/
      }
    };
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      service: data.service || '',
      source: data.source || '',
      embed: data.embed || '',
      width: data.width || 580,
      height: data.height || 320,
      caption: data.caption || ''
    };

    this.wrapper = null;
    this.input = null;
    this.embedContainer = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-embed-block');

    if (this.data.embed) {
      this.renderEmbed();
    } else {
      this.renderInput();
    }

    return this.wrapper;
  }

  renderInput() {
    this.input = document.createElement('input');
    this.input.type = 'url';
    this.input.placeholder = 'Paste a link (Twitter, Instagram, TikTok, Spotify, YouTube, CodePen, etc.)';
    this.input.value = this.data.source;
    this.input.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    `;

    this.input.addEventListener('paste', (e) => {
      setTimeout(() => this.handleUrlInput(this.input.value), 100);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleUrlInput(this.input.value);
      }
    });

    this.wrapper.appendChild(this.input);
  }

  renderEmbed() {
    this.wrapper.innerHTML = '';

    this.embedContainer = document.createElement('div');
    this.embedContainer.style.cssText = `
      position: relative;
      padding-bottom: ${(this.data.height / this.data.width) * 100}%;
      height: 0;
      overflow: hidden;
      border-radius: 8px;
      background: #f5f5f5;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = this.data.embed;
    iframe.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    `;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;

    this.embedContainer.appendChild(iframe);

    // Caption
    const caption = document.createElement('div');
    caption.contentEditable = !this.readOnly;
    caption.innerHTML = this.data.caption;
    caption.style.cssText = `
      margin-top: 8px;
      padding: 8px;
      font-size: 14px;
      color: #666;
      outline: none;
      text-align: center;
    `;
    caption.dataset.placeholder = 'Add caption...';
    caption.addEventListener('input', (e) => {
      this.data.caption = e.target.innerHTML;
    });

    // Service badge
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0,0,0,0.6);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      z-index: 10;
    `;
    badge.textContent = this.data.service;

    this.embedContainer.appendChild(badge);
    this.wrapper.appendChild(this.embedContainer);
    this.wrapper.appendChild(caption);
  }

  handleUrlInput(url) {
    const service = this.detectService(url);
    
    if (!service) {
      alert('Unsupported URL. Please use Twitter, Instagram, TikTok, Spotify, SoundCloud, YouTube, Vimeo, Google Maps, or CodePen.');
      return;
    }

    this.data.service = service.name;
    this.data.source = url;
    this.data.embed = this.getEmbedUrl(url, service);
    this.data.height = service.height || 320;

    this.renderEmbed();
  }

  detectService(url) {
    const services = [
      { name: 'Twitter', pattern: /twitter\.com|x\.com/, height: 480 },
      { name: 'Instagram', pattern: /instagram\.com/, height: 550 },
      { name: 'TikTok', pattern: /tiktok\.com/, height: 580 },
      { name: 'Spotify', pattern: /spotify\.com/, height: 380 },
      { name: 'SoundCloud', pattern: /soundcloud\.com/, height: 380 },
      { name: 'Vimeo', pattern: /vimeo\.com/, height: 360 },
      { name: 'YouTube', pattern: /youtube\.com|youtu\.be/, height: 315 },
      { name: 'Maps', pattern: /google\.(com|co\.[a-z]+)\/maps/, height: 450 },
      { name: 'CodePen', pattern: /codepen\.io/, height: 400 }
    ];

    for (const service of services) {
      if (service.pattern.test(url)) {
        return service;
      }
    }
    return null;
  }

  getEmbedUrl(url, service) {
    const serviceEmbeds = {
      'Twitter': () => {
        // Twitter/X oEmbed - use iframe with data URL
        return `https://platform.twitter.com/embed/Tweet.html?url=${encodeURIComponent(url)}`;
      },
      'Instagram': () => {
        const match = url.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/);
        return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed` : url;
      },
      'TikTok': () => {
        const match = url.match(/tiktok\.com\/(@[\w]+\/video\/\d+|[\w]+)/);
        return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : url;
      },
      'Spotify': () => {
        const match = url.match(/spotify\.com\/(track|album|playlist|artist)\/([\w]+)/);
        if (match) {
          return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
        }
        return url;
      },
      'SoundCloud': () => {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`;
      },
      'Vimeo': () => {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match ? `https://player.vimeo.com/video/${match[1]}` : url;
      },
      'YouTube': () => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        return match ? `https://www.youtube.com/embed/${match[1]}` : url;
      },
      'Maps': () => {
        // Google Maps embed
        return url.replace('maps/', 'maps/embed?origin=&q=');
      },
      'CodePen': () => {
        // CodePen embed - support both old and new URL formats
        // Old format: codepen.io/USER/pen/PEN_ID
        // New format: codepen.io/editor/USER/pen/PEN_ID
        const newFormatMatch = url.match(/codepen\.io\/editor\/([a-zA-Z0-9_-]+)\/(?:pen|embed|full|details)\/([a-zA-Z0-9-]+)/);
        if (newFormatMatch) {
          return `https://codepen.io/editor/${newFormatMatch[1]}/embed/${newFormatMatch[2]}?height=400&default-tab=result&theme-id=dark`;
        }
        const oldFormatMatch = url.match(/codepen\.io\/([a-zA-Z0-9_-]+)\/(?:pen|embed|full|details)\/([a-zA-Z0-9-]+)/);
        if (oldFormatMatch) {
          return `https://codepen.io/${oldFormatMatch[1]}/embed/${oldFormatMatch[2]}?height=400&default-tab=result&theme-id=dark`;
        }
        return url;
      }
    };

    const generator = serviceEmbeds[service.name];
    return generator ? generator() : url;
  }

  onPaste(event) {
    const url = event.detail.data;
    this.handleUrlInput(url);
  }

  save(blockContent) {
    return {
      service: this.data.service,
      source: this.data.source,
      embed: this.data.embed,
      width: this.data.width,
      height: this.data.height,
      caption: this.data.caption
    };
  }
}

// Expose to window for Editor.js
window.EmbedBlock = EmbedBlock;

// Export for ES modules
export { EmbedBlock };
