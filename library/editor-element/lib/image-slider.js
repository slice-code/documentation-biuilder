/**
 * Image Slider Block Tool for Editor.js
 */
class ImageSliderBlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Slider',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 4L12 8L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20L12 16L16 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      images: true
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      images: Array.isArray(data?.images) ? data.images.filter(Boolean) : [],
      ...data
    };
    this.wrapper = null;
    this.textarea = null;
    this.preview = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-image-slider', 'rounded-xl', 'border', 'border-slate-200', 'bg-slate-50', 'p-4');

    const title = document.createElement('div');
    title.className = 'mb-3 text-sm font-semibold text-slate-700';
    title.textContent = 'Image Slider';
    this.wrapper.appendChild(title);

    const info = document.createElement('div');
    info.className = 'mb-4 text-sm text-slate-500';
    info.textContent = this.readOnly ? 'Image slider preview' : 'Add one image URL per line or upload images to build the slider.';
    this.wrapper.appendChild(info);

    if (!this.readOnly) {
      this.textarea = document.createElement('textarea');
      this.textarea.className = 'w-full min-h-[120px] resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-brand-200 focus:ring-2';
      this.textarea.placeholder = 'https://example.com/image1.jpg\nhttps://example.com/image2.jpg';
      this.textarea.value = this.data.images.join('\n');
      this.textarea.addEventListener('input', () => {
        this.updatePreview();
      });
      this.wrapper.appendChild(this.textarea);

      const uploadRow = document.createElement('div');
      uploadRow.className = 'mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4';

      const uploadText = document.createElement('div');
      uploadText.className = 'mb-3 text-sm text-slate-600';
      uploadText.textContent = 'Upload one or more images and they will be added to the slider list automatically.';
      uploadRow.appendChild(uploadText);

      this.uploadButton = document.createElement('button');
      this.uploadButton.type = 'button';
      this.uploadButton.className = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition';
      this.uploadButton.style.backgroundColor = '#2563EB';
      this.uploadButton.style.border = '1px solid #1D4ED8';
      this.uploadButton.style.color = '#FFFFFF';
      this.uploadButton.textContent = 'Upload slider image';
      this.uploadButton.addEventListener('click', () => {
        if (this.fileInput) {
          this.fileInput.click();
        }
      });
      uploadRow.appendChild(this.uploadButton);

      this.uploadHint = document.createElement('div');
      this.uploadHint.className = 'mt-2 text-xs text-slate-500';
      this.uploadHint.textContent = 'Uploaded images will appear as URLs in the slider list below.';
      uploadRow.appendChild(this.uploadHint);

      this.wrapper.appendChild(uploadRow);

      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = 'image/*';
      this.fileInput.multiple = true;
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', async (event) => {
        await this.uploadFiles(event.target.files);
      });
      this.wrapper.appendChild(this.fileInput);
    }

    this.preview = document.createElement('div');
    this.preview.className = 'slider-preview mt-4 grid gap-3';
    this.wrapper.appendChild(this.preview);

    this.updatePreview();

    return this.wrapper;
  }

  async uploadFiles(files) {
    if (!files || files.length === 0) {
      return;
    }

    const uploadedUrls = [];
    for (let file of files) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch('/admin/api/upload/featured-image', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.path) {
          uploadedUrls.push(result.data.path);
        } else {
          console.warn('Image upload failed', result);
          alert('Upload failed: ' + (result.message || 'Unknown error'));
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
      }
    }

    if (uploadedUrls.length > 0) {
      const currentText = String(this.textarea.value || '').trim();
      const existingLines = currentText ? currentText.split('\n').map(line => line.trim()).filter(Boolean) : [];
      const newLines = existingLines.concat(uploadedUrls);
      this.textarea.value = newLines.join('\n');
      this.updatePreview();

      if (this.uploadHint) {
        this.uploadHint.textContent = `${uploadedUrls.length} image(s) uploaded and added to the slider.`;
      }
    }

    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  updatePreview() {
    if (!this.preview) return;
    const images = this.readOnly
      ? this.data.images
      : String(this.textarea?.value || '').split('\n').map(url => url.trim()).filter(Boolean);

    this.preview.innerHTML = '';

    if (images.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500 text-center';
      empty.textContent = 'No slider images added yet.';
      this.preview.appendChild(empty);
      return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'grid gap-3 grid-cols-2 sm:grid-cols-3';

    images.forEach((imageUrl) => {
      const slide = document.createElement('div');
      slide.className = 'overflow-hidden rounded-2xl border border-slate-200 bg-slate-100';
      slide.style.width = '100%';
      slide.style.height = '150px';
      slide.style.display = 'flex';
      slide.style.alignItems = 'center';
      slide.style.justifyContent = 'center';
      slide.style.backgroundColor = '#f8fafc';

      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = 'Slider image';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      slide.appendChild(img);

      gallery.appendChild(slide);
    });

    this.preview.appendChild(gallery);
  }

  save(blockContent) {
    const text = this.readOnly ? (this.data.images || []).join('\n') : (this.textarea?.value || '');
    const images = String(text || '')
      .split('\n')
      .map(url => url.trim())
      .filter(Boolean);

    return {
      images
    };
  }
}

window.ImageSliderBlock = ImageSliderBlock;
export { ImageSliderBlock };
