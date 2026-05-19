/**
 * Custom Image Block for EditorJS
 * Converts images to base64 for persistent storage
 */
class CustomImage {
    static get toolbox() {
        return {
            title: 'Image',
            icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
        };
    }

    static get sanitize() {
        return {
            url: {},
            caption: { br: true },
            withBorder: {},
            withBackground: {},
            stretched: {}
        };
    }

    static get pasteConfig() {
        return {
            patterns: {
                image: /https?:\/\/\S+\.(gif|jpe?g|tiff|png|webp)$/i
            },
            tags: ['img'],
            files: {
                mimeTypes: ['image/*']
            }
        };
    }

    constructor({ data, config, api }) {
        this.api = api;
        this.data = {
            url: data.url || '',
            caption: data.caption || '',
            withBorder: data.withBorder !== undefined ? data.withBorder : false,
            withBackground: data.withBackground !== undefined ? data.withBackground : false,
            stretched: data.stretched !== undefined ? data.stretched : false
        };
        
        this.nodes = {
            wrapper: null,
            imageHolder: null,
            image: null,
            caption: null,
            loader: null
        };

        this.settings = [
            { name: 'withBorder', icon: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.8 10.592v2.043h2.35v2.138H15.8v2.232h-2.25v-2.232h-2.4v-2.138h2.4v-2.28h2.25v.237h1.15-1.15zM1.9 8.455v-3.42c0-1.154.985-2.09 2.2-2.09h4.2v2.137H4.15v3.373H1.9zm0 2.137h2.25v3.325H8.3v2.138H4.1c-1.215 0-2.2-.936-2.2-2.09v-3.373zm15.05-2.137H14.7V5.082h-4.15V2.945h4.2c1.215 0 2.2.936 2.2 2.09v3.42z"/></svg>' },
            { name: 'stretched', icon: '<svg width="17" height="10" viewBox="0 0 17 10" xmlns="http://www.w3.org/2000/svg"><path d="M13.568 5.925H4.056l1.703 1.703a1.125 1.125 0 0 1-1.59 1.591L.962 6.014A1.069 1.069 0 0 1 .588 4.26L4.38.469a1.069 1.069 0 0 1 1.512 1.511L4.084 3.787h9.606l-1.85-1.85a1.069 1.069 0 1 1 1.512-1.51l3.792 3.791a1.069 1.069 0 0 1-.475 1.788L13.514 9.16a1.125 1.125 0 0 1-1.59-1.591l1.644-1.644z"/></svg>' },
            { name: 'withBackground', icon: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.043 8.265l3.183-3.183h-2.924L4.75 10.636v2.923l4.15-4.15v2.351l-2.158 2.159H8.9v2.137H4.7c-1.215 0-2.2-.936-2.2-2.09v-8.93c0-1.154.985-2.09 2.2-2.09h10.663l.033-.033.034.034c1.178.04 2.12.96 2.12 2.089v3.23H15.3V5.359l-2.906 2.906h-2.35zM7.951 5.082H4.75v3.201l3.201-3.2zm5.099 7.078v3.04h4.15v-3.04h-4.15zm-1.1-2.137h6.35c.635 0 1.15.489 1.15 1.092v5.13c0 .603-.515 1.092-1.15 1.092h-6.35c-.635 0-1.15-.489-1.15-1.092v-5.13c0-.603.515-1.092 1.15-1.092z"/></svg>' }
        ];
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-simple-image', this.api.styles.block);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const loader = document.createElement('div');
        loader.classList.add(this.api.styles.loader);
        loader.style.minHeight = '200px';

        const imageHolder = document.createElement('div');
        imageHolder.classList.add('cdx-simple-image__picture');

        const image = document.createElement('img');
        image.style.maxWidth = '100%';

        const caption = document.createElement('div');
        caption.classList.add(this.api.styles.input, 'cdx-simple-image__caption');
        caption.contentEditable = true;
        caption.innerHTML = this.data.caption || '';
        caption.dataset.placeholder = 'Enter a caption';

        this.nodes.wrapper = wrapper;
        this.nodes.imageHolder = imageHolder;
        this.nodes.image = image;
        this.nodes.caption = caption;
        this.nodes.loader = loader;

        image.onerror = (e) => {
            console.error('Failed to load image', e);
        };

        if (this.data.url) {
            wrapper.classList.add(this.api.styles.loader);
            wrapper.appendChild(loader);
            image.src = this.data.url;
            
            // Add delete button for existing images
            image.onload = () => {
                wrapper.classList.remove(this.api.styles.loader);
                if (loader.parentNode) loader.remove();
                
                // Add delete button
                const deleteBtn = this._createDeleteButton(wrapper);
                imageHolder.style.position = 'relative';
                imageHolder.appendChild(deleteBtn);
                
                imageHolder.appendChild(image);
                wrapper.appendChild(imageHolder);
                wrapper.appendChild(caption);
                this._acceptTuneView();
            };
        } else {
            // Show file picker
            const uploadArea = document.createElement('div');
            uploadArea.className = 'image-upload-area';
            uploadArea.style.cssText = 'border: 2px dashed #ccc; padding: 40px; text-align: center; cursor: pointer; border-radius: 4px;';
            uploadArea.innerHTML = '<div style="color: #999;">Click to upload image</div>';
            
            uploadArea.addEventListener('click', () => fileInput.click());
            
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Show loader while converting
                    wrapper.classList.add(this.api.styles.loader);
                    wrapper.appendChild(loader);
                    
                    this._convertToBase64(file).then(base64 => {
                        this.data = { url: base64, caption: file.name };
                        image.src = base64;
                        
                        // Remove upload area after image loads
                        image.onload = () => {
                            wrapper.classList.remove(this.api.styles.loader);
                            if (uploadArea.parentNode) uploadArea.remove();
                            if (loader.parentNode) loader.remove();
                            if (fileInput.parentNode) fileInput.remove();
                            
                            // Add delete button
                            const deleteBtn = this._createDeleteButton(wrapper, uploadArea, fileInput);
                            imageHolder.style.position = 'relative';
                            imageHolder.appendChild(deleteBtn);
                            
                            imageHolder.appendChild(image);
                            wrapper.appendChild(imageHolder);
                            wrapper.appendChild(caption);
                            this._acceptTuneView();
                        };
                    });
                }
            };
            
            wrapper.appendChild(uploadArea);
            wrapper.appendChild(fileInput);
        }

        return wrapper;
    }

    /**
     * Convert and compress image to WebP base64
     * Target file size: 100KB - 300KB
     */
    _convertToBase64(file) {
        return new Promise((resolve, reject) => {
            // First read the file as data URL
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Compress to WebP
                    this._compressToWebP(img)
                        .then(resolve)
                        .catch(reject);
                };
                img.onerror = () => {
                    // If image fails to load, fall back to original
                    resolve(e.target.result);
                };
                img.src = e.target.result;
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Compress image to WebP format with target size 100KB-300KB
     */
    _compressToWebP(img) {
        return new Promise((resolve, reject) => {
            // Calculate dimensions - maintain aspect ratio
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            
            // Max dimensions for reasonable quality
            const maxDimension = 1920;
            
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height / width) * maxDimension);
                    width = maxDimension;
                } else {
                    width = Math.round((width / height) * maxDimension);
                    height = maxDimension;
                }
            }
            
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Draw image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Target sizes in bytes
            const maxSize = 300 * 1024;  // 300KB max
            
            // Binary search for optimal quality
            let quality = 0.8;
            let minQuality = 0.1;
            let maxQuality = 0.95;
            let attempts = 0;
            const maxAttempts = 10;
            
            const tryCompress = (q) => {
                return new Promise((res) => {
                    canvas.toBlob((blob) => {
                        res(blob);
                    }, 'image/webp', q);
                });
            };
            
            const findOptimalQuality = async () => {
                let blob = await tryCompress(quality);
                
                while (attempts < maxAttempts) {
                    const size = blob.size;
                    
                    // If within target range or smaller than min (small images are OK), we're done
                    if (size <= maxSize) {
                        return blob;
                    }
                    
                    // Too big, reduce quality
                    maxQuality = quality;
                    quality = (quality + minQuality) / 2;
                    
                    attempts++;
                    blob = await tryCompress(quality);
                }
                
                // Return best effort (might still be larger than maxSize for very large images)
                return blob;
            };
            
            findOptimalQuality().then((blob) => {
                // Convert blob to base64
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log(`Image compressed: ${img.naturalWidth}x${img.naturalHeight} → ${width}x${height}, Size: ${(blob.size / 1024).toFixed(1)}KB`);
                    resolve(e.target.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }).catch(reject);
        });
    }

    save(blockContent) {
        const image = blockContent.querySelector('img');
        const caption = blockContent.querySelector('.' + this.api.styles.input);
        
        return {
            url: image ? image.src : this.data.url,
            caption: caption ? caption.innerHTML : this.data.caption,
            withBorder: this.data.withBorder,
            withBackground: this.data.withBackground,
            stretched: this.data.stretched
        };
    }

    onPaste(event) {
        switch (event.type) {
            case 'tag': {
                const img = event.detail.data;
                this.data = { url: img.src };
                break;
            }
            case 'pattern': {
                const url = event.detail.data;
                this.data = { url: url };
                break;
            }
            case 'file': {
                const file = event.detail.file;
                this._convertToBase64(file).then(base64 => {
                    this.data = { url: base64, caption: file.name };
                    if (this.nodes.image) {
                        this.nodes.image.src = base64;
                    }
                });
                break;
            }
        }
    }

    renderSettings() {
        const wrapper = document.createElement('div');

        this.settings.forEach(tune => {
            const button = document.createElement('div');
            button.classList.add(this.api.styles.settingsButton);
            button.innerHTML = tune.icon;
            button.classList.toggle(this.api.styles.settingsButtonActive, this.data[tune.name]);
            
            button.addEventListener('click', () => {
                this._toggleTune(tune.name);
                button.classList.toggle(this.api.styles.settingsButtonActive);
            });
            
            wrapper.appendChild(button);
        });

        return wrapper;
    }

    /**
     * Create delete button for removing image
     */
    _createDeleteButton(wrapper, uploadArea = null, fileInput = null) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove image';
        deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10; transition: background 0.2s;';
        
        deleteBtn.onmouseenter = () => {
            deleteBtn.style.background = 'rgba(220, 38, 38, 1)';
        };
        deleteBtn.onmouseleave = () => {
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        };
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Clear image data
            this.data = {
                url: '',
                caption: '',
                withBorder: false,
                withBackground: false,
                stretched: false
            };
            
            // Clear the wrapper
            wrapper.innerHTML = '';
            
            // Recreate upload area
            const newUploadArea = document.createElement('div');
            newUploadArea.className = 'image-upload-area';
            newUploadArea.style.cssText = 'border: 2px dashed #ccc; padding: 40px; text-align: center; cursor: pointer; border-radius: 4px;';
            newUploadArea.innerHTML = '<div style="color: #999;">Click to upload image</div>';
            
            // Create new file input
            const newFileInput = document.createElement('input');
            newFileInput.type = 'file';
            newFileInput.accept = 'image/*';
            newFileInput.style.display = 'none';
            
            newUploadArea.addEventListener('click', () => newFileInput.click());
            
            newFileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    wrapper.classList.add(this.api.styles.loader);
                    const loader = document.createElement('div');
                    loader.classList.add(this.api.styles.loader);
                    loader.style.minHeight = '200px';
                    wrapper.appendChild(loader);
                    
                    this._convertToBase64(file).then(base64 => {
                        this.data = { url: base64, caption: file.name };
                        
                        // Create new image
                        const newImg = document.createElement('img');
                        newImg.style.maxWidth = '100%';
                        newImg.src = base64;
                        
                        newImg.onload = () => {
                            wrapper.classList.remove(this.api.styles.loader);
                            if (newUploadArea.parentNode) newUploadArea.remove();
                            if (loader.parentNode) loader.remove();
                            if (newFileInput.parentNode) newFileInput.remove();
                            
                            // Recreate nodes
                            const newImageHolder = document.createElement('div');
                            newImageHolder.classList.add('cdx-simple-image__picture');
                            newImageHolder.style.position = 'relative';
                            
                            // Add delete button
                            const newDeleteBtn = this._createDeleteButton(wrapper);
                            newImageHolder.appendChild(newDeleteBtn);
                            
                            newImageHolder.appendChild(newImg);
                            this.nodes.image = newImg;
                            this.nodes.imageHolder = newImageHolder;
                            
                            // Create new caption
                            const newCaption = document.createElement('div');
                            newCaption.classList.add(this.api.styles.input, 'cdx-simple-image__caption');
                            newCaption.contentEditable = true;
                            newCaption.innerHTML = file.name;
                            newCaption.dataset.placeholder = 'Enter a caption';
                            this.nodes.caption = newCaption;
                            
                            wrapper.appendChild(newImageHolder);
                            wrapper.appendChild(newCaption);
                            this._acceptTuneView();
                        };
                    });
                }
            };
            
            wrapper.appendChild(newUploadArea);
            wrapper.appendChild(newFileInput);
        });
        
        return deleteBtn;
    }

    _toggleTune(name) {
        this.data[name] = !this.data[name];
        this._acceptTuneView();
    }

    _acceptTuneView() {
        this.settings.forEach(tune => {
            const className = 'cdx-simple-image__picture--' + tune.name.replace(/([A-Z])/g, (g) => '-' + g[0].toLowerCase());
            
            if (this.nodes.imageHolder) {
                this.nodes.imageHolder.classList.toggle(className, !!this.data[tune.name]);
            }

            if (tune.name === 'stretched' && this.api.blocks) {
                const blockIndex = this.api.blocks.getCurrentBlockIndex();
                this.api.blocks.stretchBlock(blockIndex, !!this.data.stretched);
            }
        });
    }
}

// Export for EditorJS
window.CustomImage = CustomImage;
