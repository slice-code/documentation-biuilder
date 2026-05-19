function generateUUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

// Auto-save variables
let autoSaveInterval = null;
let lastAutoSaveTime = null;
let hasUnsavedChanges = false; // Track if there are unsaved changes

const editor = async ({el, onClose, onSave, categories = [], type = 'newsletter', storage = { type: 'indexedDB' }, initialData = null, enableDraft = true, customSidebar = null, editorTitle = 'Newsletter'}) => {
  // Store config for later use
  const editorConfig = {
    type: type,
    storage: {
      type: storage.type || 'indexedDB',
      apiEndpoint: storage.apiEndpoint || null
    },
    initialData: initialData,
    enableDraft: enableDraft
  };
  
  console.log('🔧 Editor config:', { type, enableDraft, storageType: storage.type });
  
  // Track current draft ID (for auto-save)
  // This ID is used to save/update the draft in IndexedDB
  let currentDraftId = null;
  
  // Only manage draft ID if draft feature is enabled
  if (enableDraft) {
    // Priority: initialData._draftId > localStorage > generate new
    if (initialData && initialData._draftId) {
      // User chose to recover existing draft
      currentDraftId = initialData._draftId;
      console.log('📄 Recovering draft with ID:', currentDraftId);
    } else if (localStorage.getItem('current_draft_id')) {
      // There's an existing draft ID in localStorage
      currentDraftId = localStorage.getItem('current_draft_id');
      console.log('📝 Found draft ID in localStorage:', currentDraftId);
    } else {
      // Start fresh - will generate new ID when auto-save starts
      console.log('🆕 Starting fresh - no draft ID yet');
    }
  } else {
    console.log('⚠️ Draft feature is disabled');
  }
  
  // ============================================
  // CLEANUP: Remove corrupt autosave data
  // ============================================
  try {
    const oldAutosave = localStorage.getItem('newsletter_autosave');
    if (oldAutosave) {
      const parsed = JSON.parse(oldAutosave);
      // Check if data has valid content
      if (parsed?.data?.content?.blocks) {
        const validBlocks = parsed.data.content.blocks.filter(block => {
          // Validate block structure
          return block && block.type && block.data;
        });
        if (validBlocks.length !== parsed.data.content.blocks.length) {
          console.log('Cleaning up corrupt autosave data...');
          parsed.data.content.blocks = validBlocks;
          localStorage.setItem('newsletter_autosave', JSON.stringify(parsed));
        }
      }
    }
  } catch (e) {
    console.warn('Could not check autosave data:', e);
  }
  
  const { datepicker } = await import('./lib/datepicker.js');
  const { timepicker } = await import('./lib/timepicker.js');
  
  await Promise.all([
    import('./lib/editorjs.umd.min.js'),
    import('./lib/editorjs-list.umd.min.js'),
    import('./lib/custom-image.js'),
    import('./lib/custom-header.js'),
    import('./lib/code-block.js'),
    import('./lib/image-slider.js'),
    import('./lib/youtube-embed.js'),
    import('./lib/block-quote.js'),
    import('./lib/divider.js'),
    import('./lib/drag-drop.min.js'),
    import('./lib/cta-block.js'),
    import('./lib/group-button-block.js'),
    import('./lib/table-block.js'),
    import('./lib/embed-block.js'),
    import('./lib/raw-html-block.js')
  ]);
  
  const EditorJS = window.EditorJS;
  const EditorjsList = window.EditorjsList;
  const CustomImage = window.CustomImage;
  const CustomHeader = window.CustomHeader;
  const CodeBlock = window.CodeBlock;
  const YouTubeEmbed = window.YouTubeEmbed;
  const BlockQuote = window.BlockQuote;
  const Divider = window.Divider;
  const CTABlock = window.CTABlock;
  const GroupButtonBlock = window.GroupButtonBlock;
  const TableBlock = window.TableBlock;
  const EmbedBlock = window.EmbedBlock;
  const RawHtmlBlock = window.RawHtmlBlock;
  const ImageSliderBlock = window.ImageSliderBlock;

  const idEditor = 'el-editor-' + generateUUID();

  const connection = {}
  const editorData = {}
  
  // ============================================
  // DRAFT RECOVERY SYSTEM
  // ============================================
  const DraftStorage = {
    STORAGE_KEY: 'newsletter_drafts',
    DB_NAME: 'NewsletterEditor',
    DB_VERSION: 1,
    STORE_NAME: 'drafts',
    useIndexedDB: true,
    db: null,
    config: null,
    
    // Initialize IndexedDB
    async init(config = null) {
      this.config = config;
      
      // Check storage type from config
      if (config?.storage?.type === 'localStorage') {
        this.useIndexedDB = false;
        console.log('Using localStorage for draft storage');
        return;
      }
      
      if (config?.storage?.type === 'api' && config?.storage?.apiEndpoint) {
        this.useIndexedDB = false;
        this.apiEndpoint = config.storage.apiEndpoint;
        console.log('Using API for draft storage:', this.apiEndpoint);
        return;
      }
      
      if (!this.useIndexedDB) return;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onerror = () => {
          console.warn('IndexedDB error, falling back to localStorage');
          this.useIndexedDB = false;
          resolve();
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('IndexedDB initialized');
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          }
        };
      });
    },
    
    // Save draft
    async save(draftId, data) {
      // Helper to safely serialize data (remove DOM references)
      const safeSerialize = (obj) => {
        if (!obj) return obj;
        if (typeof obj === 'object' && obj.nodeType) return null; // DOM element
        if (obj instanceof HTMLElement) return null;
        if (obj instanceof Element) return null;
        return obj;
      };
      
      const draft = {
        id: draftId,
        content: data.content,
        metadata: {
          title: safeSerialize(data.title),
          status: safeSerialize(data.status),
          author: safeSerialize(data.author),
          category: safeSerialize(data.category),
          metaDescription: safeSerialize(data.metaDescription),
          tags: safeSerialize(data.tags),
          slug: safeSerialize(data.slug),
          featuredImage: safeSerialize(data.featuredImage),
          featuredImageAlt: safeSerialize(data.featuredImageAlt),
          publishDate: safeSerialize(data.publishDate),
          publishTime: safeSerialize(data.publishTime)
        },
        updatedAt: new Date().toISOString()
      };
      
      try {
        // Deep clone and stringify to ensure it's serializable
        const serializedDraft = JSON.parse(JSON.stringify(draft));
        
        if (this.useIndexedDB && this.db) {
          await this.saveToIndexedDB(serializedDraft);
        } else {
          await this.saveToLocalStorage(serializedDraft);
        }
        console.log(`Draft saved successfully (${this.useIndexedDB ? 'IndexedDB' : 'localStorage'})`);
      } catch (error) {
        console.error('Error saving draft:', error);
        // Fallback to localStorage if IndexedDB fails
        if (this.useIndexedDB) {
          console.log('Falling back to localStorage...');
          this.useIndexedDB = false;
          const serializedDraft = JSON.parse(JSON.stringify(draft));
          await this.saveToLocalStorage(serializedDraft);
        }
      }
    },
    
    saveToIndexedDB(draft) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(draft);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    
    saveToLocalStorage(draft) {
      const drafts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      drafts[draft.id] = draft;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
      return Promise.resolve();
    },
    
    // Load draft
    async load(draftId) {
      try {
        let draft = null;
        
        if (this.useIndexedDB && this.db) {
          console.log("load dari index db" , draftId)
          draft = await this.loadFromIndexedDB(draftId);
          console.log(draft)
        } else {
          draft = await this.loadFromLocalStorage(draftId);
        }
        
        if (draft) {
          console.log(`Draft loaded successfully (${this.useIndexedDB ? 'IndexedDB' : 'localStorage'})`);
          return draft;
        }
        
        return null;
      } catch (error) {
        console.error('Error loading draft:', error);
        return null;
      }
    },
    
    loadFromIndexedDB(draftId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(draftId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    
    loadFromLocalStorage(draftId) {
      const drafts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      return Promise.resolve(drafts[draftId] || null);
    },
    
    // Get all drafts
    async getAll() {
      try {
        if (this.useIndexedDB && this.db) {
          return await this.getAllFromIndexedDB();
        } else {
          return await this.getAllFromLocalStorage();
        }
      } catch (error) {
        console.error('Error getting drafts:', error);
        return [];
      }
    },
    
    getAllFromIndexedDB() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const drafts = request.result.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          resolve(drafts);
        };
        request.onerror = () => reject(request.error);
      });
    },
    
    getAllFromLocalStorage() {
      const drafts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      const draftArray = Object.values(drafts).sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      return Promise.resolve(draftArray);
    },
    
    // Delete draft
    async delete(draftId) {
      try {
        if (this.useIndexedDB && this.db) {
          await this.deleteFromIndexedDB(draftId);
        } else {
          await this.deleteFromLocalStorage(draftId);
        }
        console.log(`Draft deleted (${this.useIndexedDB ? 'IndexedDB' : 'localStorage'})`);
      } catch (error) {
        console.error('Error deleting draft:', error);
      }
    },
    
    deleteFromIndexedDB(draftId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(draftId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    
    deleteFromLocalStorage(draftId) {
      const drafts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      delete drafts[draftId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
      return Promise.resolve();
    },
    
    // Clear all drafts
    async clear() {
      try {
        if (this.useIndexedDB && this.db) {
          await this.clearIndexedDB();
        } else {
          await this.clearLocalStorage();
        }
        console.log('All drafts cleared');
      } catch (error) {
        console.error('Error clearing drafts:', error);
      }
    },
    
    clearIndexedDB() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    
    clearLocalStorage() {
      localStorage.removeItem(this.STORAGE_KEY);
      return Promise.resolve();
    },
    
    // Custom API Storage (can be overridden by user)
    apiEndpoint: null,
    
    setApiEndpoint(endpoint) {
      this.apiEndpoint = endpoint;
      this.useIndexedDB = false;
      console.log('Using custom API endpoint:', endpoint);
    },
    
    async saveToApi(draft) {
      if (!this.apiEndpoint) throw new Error('API endpoint not configured');
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      
      if (!response.ok) throw new Error('API request failed');
      return await response.json();
    },
    
    async loadFromApi(draftId) {
      if (!this.apiEndpoint) throw new Error('API endpoint not configured');
      
      const response = await fetch(`${this.apiEndpoint}/${draftId}`, {
        method: 'GET'
      });
      
      if (!response.ok) throw new Error('API request failed');
      return await response.json();
    }
  };

  // ============================================
  // PHASE 1.1: UNDO/REDO TOOLBAR
  // ============================================
  
  // Store history for undo/redo functionality
  const editorHistory = {
    stack: [],
    currentIndex: -1,
    maxHistory: 50,
    
    async saveState(editorInstance) {
      if (!editorInstance) return;
      try {
        const content = await editorInstance.save();
        // Remove any future states if we're not at the end
        this.stack = this.stack.slice(0, this.currentIndex + 1);
        // Add new state
        this.stack.push(JSON.stringify(content));
        // Limit stack size
        if (this.stack.length > this.maxHistory) {
          this.stack.shift();
        } else {
          this.currentIndex++;
        }
      } catch (e) {
        console.error('Failed to save history state:', e);
      }
    },
    
    async undo(editorInstance) {
      if (this.currentIndex > 0 && editorInstance) {
        this.currentIndex--;
        const content = JSON.parse(this.stack[this.currentIndex]);
        await editorInstance.render(content);
        return true;
      }
      return false;
    },
    
    async redo(editorInstance) {
      if (this.currentIndex < this.stack.length - 1 && editorInstance) {
        this.currentIndex++;
        const content = JSON.parse(this.stack[this.currentIndex]);
        await editorInstance.render(content);
        return true;
      }
      return false;
    },
    
    canUndo() {
      return this.currentIndex > 0;
    },
    
    canRedo() {
      return this.currentIndex < this.stack.length - 1;
    }
  };
  
  const editorToolbar = el('div')
    .class('flex items-center gap-2 p-2 border-b bg-white')
    .child([
      el('div').class('flex-1 flex items-center gap-2').child([
        el('button')
          .class('px-3 py-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed')
          .attr('title', 'Undo (Ctrl+Z)')
          .html('<i class="fas fa-undo"></i>')
          .link(connection, 'undoBtn')
          .on('click', async () => {
            if (connection.ej) {
              await editorHistory.undo(connection.ej);
              updateUndoRedoButtons();
            }
          }),
        el('button')
          .class('px-3 py-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed')
          .attr('title', 'Redo (Ctrl+Shift+Z)')
          .html('<i class="fas fa-redo"></i>')
          .link(connection, 'redoBtn')
          .on('click', async () => {
            if (connection.ej) {
              await editorHistory.redo(connection.ej);
              updateUndoRedoButtons();
            }
          }),
      ]),
      el('div').class('text-xs text-gray-400').link(connection, 'autoSaveIndicator'),
    ]);

  // Function to update undo/redo button states
  function updateUndoRedoButtons() {
    if (connection.undoBtn && connection.redoBtn) {
      const canUndo = editorHistory.canUndo();
      const canRedo = editorHistory.canRedo();
      
      // Update disabled state
      connection.undoBtn.disabled = !canUndo;
      connection.redoBtn.disabled = !canRedo;
      
      // Update opacity for visual feedback
      if (!canUndo) {
        connection.undoBtn.style.opacity = '0.5';
        connection.undoBtn.style.cursor = 'not-allowed';
      } else {
        connection.undoBtn.style.opacity = '1';
        connection.undoBtn.style.cursor = 'pointer';
      }
      
      if (!canRedo) {
        connection.redoBtn.style.opacity = '0.5';
        connection.redoBtn.style.cursor = 'not-allowed';
      } else {
        connection.redoBtn.style.opacity = '1';
        connection.redoBtn.style.cursor = 'pointer';
      }
    }
  }

  const saveButton = el('button')
    .text('Save')
    .class('px-2 py-[4px] rounded-sm cursor-pointer bg-black text-white')
    .on('click', async () => {
      const content = await connection.ej.save();
      
      // Get actual values from editorData (not DOM elements)
      const editorValues = getEditorDataValues();
      console.log('💾 Saving:', editorValues.title || 'Untitled', '- blocks:', content.blocks?.length || 0);
      
      const newsletterData = {
        // Metadata
        title: editorValues.title,
        status: editorValues.status,
        author: editorValues.author,
        category: editorValues.category,
        // SEO
        metaDescription: editorValues.metaDescription,
        tags: editorValues.tags,
        slug: editorValues.slug,
        // Featured Image
        featuredImage: editorValues.featuredImage,
        featuredImageAlt: editorValues.featuredImageAlt,
        // Publish
        publishDate: editorValues.publishDate,
        publishTime: editorValues.publishTime,
        // Content
        content: content
      };
      
      // PHASE 1.2: Clear autosave on manual save
      clearAutoSave();
      
      // Call onSave callback if provided
      if (onSave && typeof onSave === 'function') {
        onSave(newsletterData);
      } else {
        console.log('Newsletter data:', newsletterData);
      }
    });
  
  // ============================================
  // PHASE 3.2: EXPORT BUTTON
  // ============================================
  const exportButton = el('button')
    .html('<i class="fas fa-download"></i>')
    .class('px-2 py-[4px] mr-1 rounded-sm cursor-pointer bg-gray-600 text-white')
    .attr('title', 'Export')
    .on('click', () => {
      openExportModal();
    });
  
  // ============================================
  // DRAFT RECOVERY BUTTON
  // ============================================
  const recoverDraftButton = el('button')
    .html('<i class="fas fa-history"></i>')
    .class('px-2 py-[4px] mr-1 rounded-sm cursor-pointer bg-blue-600 text-white')
    .attr('title', 'Recover Draft')
    .on('click', () => {
      showDraftRecoveryUI();
    });

  const closeButton = el('button')
    .text('Close')
    .class('px-2 py-[4px] cursor-pointer rounded-sm ')
    .on('click', async () => {
      // PHASE 1.2: Stop auto-save on close
      stopAutoSave();
      if (onClose && typeof onClose === 'function') onClose();
    });

  const containerButton = el('div')
    .class('p-2 shadow-md z-10 flex h-[50px] items-center')
    .borderBottom('1px solid #ccc')
    .child([
      el('div').class('text-lg flex-1').text(editorTitle),
      el('div'),
      closeButton,
      enableDraft ? recoverDraftButton : null,
      exportButton,
      saveButton
    ]);

  // Helper function for input field with label
  const inputField = (label, key, placeholder, isTextarea = false) => {
    const input = isTextarea 
      ? el('textarea').class('w-full p-2 border border-gray-300 rounded text-sm resize-none').attr('rows', '2')
      : el('input').class('w-full p-2 border border-gray-300 rounded text-sm');
    
    return el('div').class('mb-3').child([
      el('label').class('block text-xs font-medium text-gray-500 mb-1').text(label),
      input
        .link(editorData, key)
        .hold(placeholder)
        .css({ outline: 'none' })
        .on('input', () => { hasUnsavedChanges = true; })
    ]);
  };

  // Status dropdown
  const statusSelect = el('select')
    .class('w-full p-2 border border-gray-300 rounded text-sm')
    .link(editorData, 'status')
    .on('change', () => { hasUnsavedChanges = true; })
    .child([
      el('option').value('draft').text('Draft'),
      el('option').value('published').text('Published'),
      el('option').value('scheduled').text('Scheduled')
    ]);

  // Category dropdown
  const categorySelect = el('select')
    .class('w-full p-2 border border-gray-300 rounded text-sm')
    .link(editorData, 'category')
    .on('change', () => { hasUnsavedChanges = true; });
  
  // Add default option
  categorySelect.child(el('option').value('').text('Select category...'));
  
  // Add categories from parameter or use defaults
  const categoryOptions = categories.length > 0 ? categories : [
    { value: 'technology', text: 'Technology' },
    { value: 'business', text: 'Business' },
    { value: 'lifestyle', text: 'Lifestyle' },
    { value: 'tutorial', text: 'Tutorial' },
    { value: 'news', text: 'News' }
  ];
  
  categoryOptions.forEach(cat => {
    const value = typeof cat === 'string' ? cat : cat.value;
    const text = typeof cat === 'string' ? cat : cat.text;
    categorySelect.child(el('option').value(value).text(text));
  });

  // Sidebar content
  const sidebarContent = el('div').class('p-3 space-y-4').child([
    // Status Section
    el('div').class('border-b pb-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Status'),
      el('div').class('mb-3').child([
        el('label').class('block text-xs font-medium text-gray-500 mb-1').text('Status'),
        statusSelect
      ]),
      inputField('Author', 'author', 'Author name'),
      el('div').class('mb-3').child([
        el('label').class('block text-xs font-medium text-gray-500 mb-1').text('Category'),
        categorySelect
      ]),
    ]),

    // SEO Section
    el('div').class('border-b pb-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('SEO'),
      // PHASE 3.3: SEO Score Display
      el('div').class('mb-3 p-3 bg-gray-50 rounded').child([
        el('div').class('flex items-center justify-between mb-2').child([
          el('span').class('text-xs font-medium text-gray-600').text('SEO Score'),
          el('span').class('text-lg font-bold text-green-600').link(connection, 'seoScoreDisplay').text('--'),
        ]),
        el('div').class('w-full bg-gray-200 rounded-full h-2').child([
          el('div').class('bg-green-500 h-2 rounded-full transition-all').link(connection, 'seoScoreBar').css({ width: '0%' })
        ]),
        el('button')
          .class('mt-2 w-full px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100')
          .text('Check SEO Score')
          .on('click', async () => {
            if (!connection.ej) return;
            const content = await connection.ej.save();
            // Extract actual values from editorData (which may contain DOM elements)
            const editorValues = getEditorDataValues();
            const score = calculateSEOScore(editorValues, content);
            
            // Update display
            if (connection.seoScoreDisplay) {
              connection.seoScoreDisplay.textContent = `${score.score}/100`;
              connection.seoScoreDisplay.className = `text-lg font-bold ${score.score >= 70 ? 'text-green-600' : score.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`;
            }
            if (connection.seoScoreBar) {
              connection.seoScoreBar.style.width = `${score.score}%`;
              connection.seoScoreBar.className = `h-2 rounded-full transition-all ${score.score >= 70 ? 'bg-green-500' : score.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`;
            }
            
            // Show recommendations
            if (score.recommendations.length > 0) {
              alert('SEO Recommendations:\n\n' + score.recommendations.join('\n'));
            } else {
              alert('Great! Your content is well optimized for SEO.');
            }
          })
      ]),
      inputField('Meta Description', 'metaDescription', 'Brief description for SEO...', true),
      inputField('Tags', 'tags', 'tech, news, tutorial'),
      inputField('Slug', 'slug', 'my-blog-post'),
    ]),

    // Featured Image Section
    el('div').class('border-b pb-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Featured Image'),
      // Hidden file input
      el('input')
        .type('file')
        .attr('accept', 'image/*')
        .css({ display: 'none' })
        .link(editorData, 'featuredImageInput')
        .on('change', async (e) => {
          const file = e.target.files[0];
          if (file) {
            // Show loader
            const previewContainer = document.getElementById('featured-image-preview');
            if (previewContainer) {
              previewContainer.innerHTML = '<div class="text-gray-500 text-sm">Uploading...</div>';
            }
            
            try {
              // Upload file to server
              const formData = new FormData();
              formData.append('image', file);
              
              const response = await fetch('/admin/api/upload/featured-image', {
                method: 'POST',
                body: formData,
                credentials: 'include'
              });
              
              const result = await response.json();
              
              if (result.status === 'success' && result.data && result.data.path) {
                // Store the file path (not base64)
                editorData.featuredImage = result.data.path;
                hasUnsavedChanges = true;
                
                // Update preview with uploaded image URL
                const imageUrl = '/storage/uploads/posts/' + result.data.filename;
                window.updateFeaturedImagePreview(imageUrl);
              } else {
                throw new Error(result.message || 'Upload failed');
              }
            } catch (error) {
              console.error('Upload error:', error);
              alert('Failed to upload image: ' + error.message);
              // Reset to placeholder on error
              if (previewContainer) {
                previewContainer.innerHTML = '<div class="text-gray-400 text-sm upload-placeholder">Click to upload image</div>';
              }
            }
          }
        }),
      // Upload area / Preview container
      el('div')
        .id('featured-image-preview')
        .class('border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:border-gray-400 transition-colors relative')
        .child([
          el('div').class('text-gray-400 text-sm upload-placeholder').text('Click to upload image'),
        ])
        .on('click', (e) => {
          // Don't trigger upload if clicking on delete button
          if (e.target.closest('.delete-featured-image')) return;
          if (editorData.featuredImageInput) {
            editorData.featuredImageInput.click();
          }
        }),
      inputField('Image Alt Text', 'featuredImageAlt', 'Describe image...'),
    ]),

    // Helper function to update featured image preview
    window.updateFeaturedImagePreview = function(imageSrc) {
      const previewContainer = document.getElementById('featured-image-preview');
      if (!previewContainer) return;
      
      if (imageSrc) {
        // Show image with delete button
        previewContainer.innerHTML = '';
        
        // Create image wrapper
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'relative inline-block';
        
        // Create image
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = 'max-width: 100%; max-height: 150px; border-radius: 4px; object-fit: cover;';
        imgWrapper.appendChild(img);
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-featured-image absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center text-sm font-bold shadow-md';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove image';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          editorData.featuredImage = null;
          if (editorData.featuredImageInput) {
            editorData.featuredImageInput.value = '';
          }
          // Reset to upload placeholder
          previewContainer.innerHTML = '';
          const placeholder = document.createElement('div');
          placeholder.className = 'text-gray-400 text-sm upload-placeholder';
          placeholder.textContent = 'Click to upload image';
          previewContainer.appendChild(placeholder);
          hasUnsavedChanges = true;
        };
        imgWrapper.appendChild(deleteBtn);
        
        previewContainer.appendChild(imgWrapper);
      } else {
        // Reset to upload placeholder
        previewContainer.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'text-gray-400 text-sm upload-placeholder';
        placeholder.textContent = 'Click to upload image';
        previewContainer.appendChild(placeholder);
      }
    },

    // Publish Settings
    el('div').class('pb-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Publish'),
      el('div').class('space-y-3 mb-3').child([
        el('div').child([
          el('label').class('block text-xs font-medium text-gray-500 mb-1').text('Date'),
          el('div')
            .css({ width: '100%' })
            .link(editorData, 'datePickerContainer')
        ]),
        el('div').child([
          el('label').class('block text-xs font-medium text-gray-500 mb-1').text('Time'),
          el('div')
            .css({ width: '100%' })
            .link(editorData, 'timePickerContainer')
        ]),
      ]),
    ]),
    
    // ============================================
    // PHASE 1.3: WORD COUNT & READING TIME
    // ============================================
    el('div').class('border-t pt-3 mt-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Content Stats'),
      el('div')
        .class('text-sm text-gray-600')
        .link(connection, 'wordCountDisplay')
        .text('Calculating...')
        .loopFunc(async (element) => {
          try {
            if (!connection.ej) return;
            const content = await connection.ej.save();
            
            // Extract all text from blocks
            const allText = content.blocks
              .map(block => {
                if (block.data.text) return block.data.text;
                if (block.data.caption) return block.data.caption;
                if (block.data.title) return block.data.title;
                return '';
              })
              .join(' ');
            
            // Count words (strip HTML tags first)
            const plainText = allText.replace(/<[^>]*>/g, '');
            const words = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
            const readTime = Math.max(1, Math.ceil(words / 200)); // 200 words per minute
            const charCount = plainText.length;
            
            // element is a raw DOM element, use textContent not .text()
            element.textContent = `${words.toLocaleString()} words • ${readTime} min read • ${charCount.toLocaleString()} chars`;
          } catch (error) {
            element.textContent = '0 words • 0 min read';
          }
        }, 2000),
    ]),
  ]);

  const documentationSidebarContent = el('div').class('p-3 space-y-4').child([
    el('div').class('border-b pb-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Dokumentasi'),
      inputField('Slug', 'slug', 'contoh-dokumentasi'),
      el('div').class('mb-3').child([
        el('label').class('block text-xs font-medium text-gray-500 mb-1').text('Kategori'),
        categorySelect
      ]),
      inputField('Deskripsi', 'metaDescription', 'Ringkasan singkat dokumentasi...', true)
    ]),
    el('div').class('border-t pt-3 mt-3').child([
      el('div').class('text-xs font-semibold text-gray-400 uppercase mb-2').text('Statistik Konten'),
      el('div')
        .class('text-sm text-gray-600')
        .link(connection, 'wordCountDisplay')
        .text('Menghitung...')
        .loopFunc(async (element) => {
          try {
            if (!connection.ej) return;
            const content = await connection.ej.save();
            const allText = content.blocks
              .map(block => block.data.text || block.data.caption || block.data.title || '')
              .join(' ');
            const plainText = allText.replace(/<[^>]*>/g, '');
            const words = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
            const readTime = Math.max(1, Math.ceil(words / 200));
            element.textContent = `${words.toLocaleString()} kata • ${readTime} menit baca`;
          } catch (error) {
            element.textContent = '0 kata';
          }
        }, 2000)
    ])
  ]);
  
  // Create container for Editor.js
  const editorContainer = el('div')
    .child([
      el('style').text(`
        .cdx-simple-image{
          border : 1px solid #ccc;
          padding : 4px 10px;
        }
        .cdx-simple-image input{
          cursor : pointer;
          width : 100%;
        }
      `),
      el('div')
      .class('flex-1 flex flex-col bg-gray-200 overflow-auto max-h-[100vh] min-h-[100vh]')
      .child([
        // PHASE 1.1: Editor Toolbar
        editorToolbar,
        el('div')
        .class('flex-1 p-[20px] overflow-auto')
        .child([
          el('div')
          .class('shadow-md mx-auto min-h-[calc(100vh-120px)] px-[40px] py-[20px] w-full max-w-[768px] bg-white rounded-md')
          .child([
            el('div').class("flex justify-center").child([
              el('input')
              .css({
                outline: 'none',
              })
              .link(editorData, 'title')
              .hold(type === 'documentation' ? 'Judul dokumentasi...' : 'Type title here...')
              .class('mx-auto mb-2 w-full max-w-[650px] text-2xl')
              .on('input', (e) => {
                hasUnsavedChanges = true;
                if (type === 'documentation' && editorData.slug && !editorData.slug.value) {
                  editorData.slug.value = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                }
              }),
            ]),
            el('div')
              .link(connection, editor)
              .id(idEditor),
          ]),
        ]),
      ]),
      el('div')
      .class('shadow-md w-[360px] overflow-auto max-h-[100vh] min-h-[100vh] bg-white')
      .child([
        containerButton,
        el('div').class('max-h-[calc(100vh-50px)] overflow-auto').child([
          customSidebar || (type === 'documentation' ? documentationSidebarContent : sidebarContent)
        ])
      ]),
    ])
    .class('flex')
    .load(async ()=>{
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const wait = () => {
          if (document.getElementById(idEditor)) {
            resolve();
            return;
          }
          attempts += 1;
          if (attempts > 60) {
            reject(new Error(`Editor holder "${idEditor}" tidak ditemukan di DOM.`));
            return;
          }
          requestAnimationFrame(wait);
        };
        wait();
      });

      // Initialize datepicker and timepicker first (they are async)
      if (editorData.datePickerContainer) {
        const dp = await datepicker({
          el,
          placeholder: 'MM/DD/YYYY',
          format: 'MM/DD/YYYY',
          theme: 'light',
          onChange: (date) => {
            if (date) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              editorData.publishDate = `${year}-${month}-${day}`;
            } else {
              editorData.publishDate = '';
            }
          }
        });
        editorData.publishDatePicker = dp;
        editorData.datePickerContainer.appendChild(dp);
      }
      
      if (editorData.timePickerContainer) {
        const tp = await timepicker({
          el,
          placeholder: 'HH:MM',
          format: '24',
          step: 30,
          theme: 'light',
          onChange: (time) => {
            editorData.publishTime = time;
          }
        });
        editorData.publishTimePicker = tp;
        editorData.timePickerContainer.appendChild(tp);
      }
      
      const ej = new EditorJS({
        holder: idEditor,
        placeholder: 'Type something...',
        autofocus: true,
        tools: {
          header: {
            class: CustomHeader,
            inlineToolbar: true
          },
          list: {
            class: EditorjsList,
            inlineToolbar: true,
            config: {
              defaultStyle: 'unordered',
              maxLevel: 4  // Allow up to 4 levels of nesting
            }
          },
          image: {
            class: CustomImage,
            inlineToolbar: true
          },
          code: {
            class: CodeBlock
          },
          youtube: {
            class: YouTubeEmbed
          },
          quote: {
            class: BlockQuote,
            inlineToolbar: true
          },
          divider: {
            class: Divider
          },
          cta: {
            class: CTABlock
          },
          groupButton: {
            class: GroupButtonBlock
          },
          table: {
            class: TableBlock
          },
          embed: {
            class: EmbedBlock
          },
          imageSlider: {
            class: ImageSliderBlock
          },
          rawHtml: {
            class: RawHtmlBlock
          }
        },
        onReady: async () => {
          console.log('✅ Editor.js is ready!');
          
          // Enable drag-and-drop block reordering
          new DragDrop(ej);
          
          // ============================================
          // LOAD INITIAL DATA (from draft recovery)
          // ============================================
          if (editorConfig.initialData) {
            console.log('📂 Loading recovered draft...');
            console.log('   Draft ID:', editorConfig.initialData._draftId);
            console.log('   Blocks:', editorConfig.initialData.content?.blocks?.length || 0);
            
            try {
              const initialData = editorConfig.initialData;
              
              // Load content into editor
              if (initialData.content && initialData.content.blocks) {
                await ej.render(initialData.content);
              } else {
                console.warn('⚠️ No content blocks to render');
              }
              
              // Restore metadata to sidebar - set VALUE on input elements
              if (initialData.title !== undefined && editorData.title) {
                editorData.title.value = initialData.title;
              }
              if (initialData.status !== undefined && editorData.status) {
                editorData.status.value = initialData.status;
              }
              if (initialData.author !== undefined && editorData.author) {
                editorData.author.value = initialData.author;
              }
              if (initialData.category !== undefined && editorData.category) {
                editorData.category.value = initialData.category;
              }
              if (initialData.metaDescription !== undefined && editorData.metaDescription) {
                editorData.metaDescription.value = initialData.metaDescription;
              }
              if (initialData.description !== undefined && editorData.metaDescription) {
                editorData.metaDescription.value = initialData.description;
              }
              if (initialData.tags !== undefined && editorData.tags) {
                editorData.tags.value = initialData.tags;
              }
              if (initialData.slug !== undefined && editorData.slug) {
                editorData.slug.value = initialData.slug;
              }
              // Featured image - stored as string, not input element
              if (initialData.featuredImage !== undefined && initialData.featuredImage) {
                editorData.featuredImage = initialData.featuredImage;
                // Update preview with delete button
                window.updateFeaturedImagePreview(initialData.featuredImage);
              }
              if (initialData.featuredImageAlt !== undefined && editorData.featuredImageAlt) {
                editorData.featuredImageAlt.value = initialData.featuredImageAlt;
              }
              if (initialData.publishDate !== undefined && editorData.publishDatePicker) {
                editorData.publishDatePicker.datepicker.setValue(initialData.publishDate);
              }
              if (initialData.publishTime !== undefined && editorData.publishTimePicker) {
                editorData.publishTimePicker.timepicker.setValue(initialData.publishTime);
              }
              
              // Update draft ID if provided
              if (initialData._draftId) {
                localStorage.setItem('current_draft_id', initialData._draftId);
                currentDraftId = initialData._draftId;
              }
              
              console.log('✅ Draft recovered successfully');
              // Reset unsaved changes flag after recovery
              hasUnsavedChanges = false;
            } catch (error) {
              console.error('Error loading initial data:', error);
            }
          }
          
          // Initialize first state in history
          setTimeout(() => {
            editorHistory.saveState(ej);
            updateUndoRedoButtons();
            // Reset unsaved changes flag after initial load
            hasUnsavedChanges = false;
          }, 500);
          
          // ============================================
          // PHASE 1.2: START AUTO-SAVE (Every 30 seconds)
          // ============================================
          if (editorConfig.enableDraft) {
            startAutoSave();
          }
          
          // ============================================
          // PHASE 1.4: LISTEN FOR DRAFT RECOVERY
          // ============================================
          if (editorConfig.enableDraft) {
            window.addEventListener('recover-draft', async (event) => {
              try {
                const recoveredData = event.detail;
                console.log('Recovering draft:', recoveredData);
              
              // Load content into editor
              if (recoveredData.content && recoveredData.content.blocks) {
                await ej.render(recoveredData.content);
              }
              
              // Restore metadata to sidebar - set VALUE on input elements
              if (recoveredData.title !== undefined && editorData.title) {
                editorData.title.value = recoveredData.title;
              }
              if (recoveredData.status !== undefined && editorData.status) {
                editorData.status.value = recoveredData.status;
              }
              if (recoveredData.author !== undefined && editorData.author) {
                editorData.author.value = recoveredData.author;
              }
              if (recoveredData.category !== undefined && editorData.category) {
                editorData.category.value = recoveredData.category;
              }
              if (recoveredData.metaDescription !== undefined && editorData.metaDescription) {
                editorData.metaDescription.value = recoveredData.metaDescription;
              }
              if (recoveredData.tags !== undefined && editorData.tags) {
                editorData.tags.value = recoveredData.tags;
              }
              if (recoveredData.slug !== undefined && editorData.slug) {
                editorData.slug.value = recoveredData.slug;
              }
              // Featured image - stored as string, not input element
              if (recoveredData.featuredImage !== undefined && recoveredData.featuredImage) {
                editorData.featuredImage = recoveredData.featuredImage;
                // Update preview with delete button
                window.updateFeaturedImagePreview(recoveredData.featuredImage);
              }
              if (recoveredData.featuredImageAlt !== undefined && editorData.featuredImageAlt) {
                editorData.featuredImageAlt.value = recoveredData.featuredImageAlt;
              }
              if (recoveredData.publishDate !== undefined && editorData.publishDatePicker) {
                editorData.publishDatePicker.datepicker.setValue(recoveredData.publishDate);
              }
              if (recoveredData.publishTime !== undefined && editorData.publishTimePicker) {
                editorData.publishTimePicker.timepicker.setValue(recoveredData.publishTime);
              }
              
              // Update draft ID if provided
              if (recoveredData._draftId) {
                localStorage.setItem('current_draft_id', recoveredData._draftId);
                currentDraftId = recoveredData._draftId;
                console.log('Draft ID updated:', currentDraftId);
              }
              
              // Save history state after recovery
              setTimeout(() => {
                editorHistory.saveState(ej);
                updateUndoRedoButtons();
              }, 500);
              
              console.log('Draft recovery completed');
              // Reset unsaved changes flag after recovery
              hasUnsavedChanges = false;
            } catch (error) {
              console.error('Error during draft recovery:', error);
            }
          });
          } // end if enableDraft
        },
        onChange: (api, event) => {
          console.log('Content changed:', event);
          // Mark as having unsaved changes
          hasUnsavedChanges = true;
          // Save state to history after a short delay
          clearTimeout(editorHistory.saveTimeout);
          editorHistory.saveTimeout = setTimeout(() => {
            editorHistory.saveState(ej);
            updateUndoRedoButtons();
          }, 500);
        }
      });

      connection.ej = ej;
      
      document.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          const data = await ej.save();
          console.log('Saved data:', data);
        }
        
        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          await editorHistory.undo(ej);
          updateUndoRedoButtons();
        }
        
        // Redo: Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          await editorHistory.redo(ej);
          updateUndoRedoButtons();
        }
      });

    });
  
  // ============================================
  // PHASE 1.2: AUTO-SAVE FUNCTIONS
  // ============================================
  
  // Helper function to get actual values from editorData (which contains DOM elements)
  function getEditorDataValues() {
    const getValue = (element) => {
      if (!element) return null;
      
      // If it's a DOM element
      if (element instanceof HTMLElement || element instanceof Element) {
        // Input, textarea, select - use .value
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
          return element.value || null;
        }
        // Other elements - use innerText or textContent
        return element.innerText || element.textContent || null;
      }
      
      // If it's already a primitive value
      return element;
    };
    
    return {
      title: getValue(editorData.title),
      status: getValue(editorData.status),
      author: getValue(editorData.author),
      category: getValue(editorData.category),
      metaDescription: getValue(editorData.metaDescription),
      tags: getValue(editorData.tags),
      slug: getValue(editorData.slug),
      featuredImage: getValue(editorData.featuredImage),
      featuredImageAlt: getValue(editorData.featuredImageAlt),
      publishDate: getValue(editorData.publishDate),
      publishTime: getValue(editorData.publishTime)
    };
  }
  
  async function startAutoSave() {
    if (autoSaveInterval) return; // Already running
    
    // Initialize Draft Storage with config
    await DraftStorage.init(editorConfig);
    
    // Set or generate draft ID
    if (currentDraftId) {
      console.log('Using existing draft ID:', currentDraftId);
    } else {
      currentDraftId = 'draft_' + Date.now();
      console.log('Generated new draft ID:', currentDraftId);
    }
    // Save to localStorage for persistence across refreshes
    localStorage.setItem('current_draft_id', currentDraftId);
    
    console.log('🔄 Auto-save active for draft:', currentDraftId);
    
    autoSaveInterval = setInterval(async () => {
      try {
        // Skip if no unsaved changes
        if (!hasUnsavedChanges) {
          return;
        }
        
        if (!connection.ej) return;
        
        const content = await connection.ej.save();
        
        // Get actual values from editorData (not DOM elements)
        const editorValues = getEditorDataValues();
        
        const autoSaveData = {
          lastSaved: new Date().toISOString(),
          data: {
            ...editorValues,
            content: content
          }
        };
        
        console.log('💾 Saving draft:', currentDraftId, '- blocks:', content.blocks?.length);
        
        // Save to Draft Storage (IndexedDB by default)
        await DraftStorage.save(currentDraftId, autoSaveData.data);
        
        // Reset unsaved changes flag
        hasUnsavedChanges = false;
        
        lastAutoSaveTime = new Date();
        
        // Update auto-save indicator
        if (connection.autoSaveIndicator) {
          const timeStr = lastAutoSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          connection.autoSaveIndicator.textContent = `Auto-saved at ${timeStr}`;
        }
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('autosave-complete', {
          detail: { time: lastAutoSaveTime }
        }));
        
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 30000); // 30 seconds
  }
  
  function stopAutoSave() {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  }
  
  // ============================================
  // DRAFT RECOVERY FUNCTIONS
  // ============================================
  async function loadDraft(draftId) {
    try {
      const draft = await DraftStorage.load(draftId);
      
      if (draft) {
        // Flatten structure for event listener
        const recoveryData = {
          content: draft.content,
          ...(draft.metadata || {})
        };
        
        console.log('Loading draft:', draftId, recoveryData);
        
        // Dispatch event to load data into editor
        window.dispatchEvent(new CustomEvent('recover-draft', {
          detail: recoveryData
        }));
        
        // Update current draft ID
        localStorage.setItem('current_draft_id', draftId);
        currentDraftId = draftId;
        
        console.log('Draft loaded:', draftId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading draft:', error);
      return false;
    }
  }
  
  async function showDraftRecoveryUI() {
    const drafts = await DraftStorage.getAll();
    
    if (drafts.length === 0) {
      alert('No saved drafts found.');
      return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; background: rgba(0, 0, 0, 0.2);';
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 class="text-xl font-semibold">Recover Draft</h2>
          <button class="text-gray-500 hover:text-gray-700 text-2xl modal-close">&times;</button>
        </div>
        
        <div class="p-4 overflow-auto max-h-[60vh]">
          ${drafts.length > 0 ? `
            <table class="w-full">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2 px-3 text-sm font-semibold text-gray-700">Title</th>
                  <th class="text-left py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
                  <th class="text-left py-2 px-3 text-sm font-semibold text-gray-700">Last Saved</th>
                  <th class="text-right py-2 px-3 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${drafts.map(draft => `
                  <tr class="border-b hover:bg-gray-50">
                    <td class="py-3 px-3 text-sm">
                      <div class="font-medium">${draft.metadata?.title || 'Untitled'}</div>
                      <div class="text-xs text-gray-500">${draft.id}</div>
                    </td>
                    <td class="py-3 px-3 text-sm">
                      <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">${draft.metadata?.status || 'Draft'}</span>
                    </td>
                    <td class="py-3 px-3 text-sm text-gray-600">
                      ${new Date(draft.updatedAt).toLocaleString()}
                    </td>
                    <td class="py-3 px-3 text-sm text-right">
                      <button class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2 btn-load">Load</button>
                      <button class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 btn-delete">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="text-center py-8 text-gray-500">No drafts found</div>'}
        </div>
        
        <div class="p-4 border-t flex justify-end gap-2">
          <button class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 modal-close">Close</button>
          <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 btn-clear-all">Clear All Drafts</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.addEventListener('click', (e) => {
      const target = e.target;
      
      // Close modal
      if (target.classList.contains('modal-close') || target === modal) {
        modal.remove();
        return;
      }
      
      // Load draft
      if (target.classList.contains('btn-load')) {
        const row = target.closest('tr');
        const draftIdElement = row.querySelector('.text-xs.text-gray-500');
        const draftId = draftIdElement.textContent.trim();
        
        loadDraft(draftId).then(() => {
          modal.remove();
        });
        return;
      }
      
      // Delete draft
      if (target.classList.contains('btn-delete')) {
        const row = target.closest('tr');
        const draftIdElement = row.querySelector('.text-xs.text-gray-500');
        const draftId = draftIdElement.textContent.trim();
        
        if (confirm(`Delete this draft?`)) {
          DraftStorage.delete(draftId).then(() => {
            row.remove();
          });
        }
        return;
      }
      
      // Clear all drafts
      if (target.classList.contains('btn-clear-all')) {
        if (confirm('Are you sure you want to delete all drafts? This cannot be undone.')) {
          DraftStorage.clear().then(() => {
            modal.remove();
          });
        }
      }
    });
  }
  
  // Export functions for external use
  window.DraftStorage = DraftStorage;
  
  // ============================================
  // CUSTOM API CONFIGURATION
  // ============================================
  window.configureDraftAPI = (endpoint) => {
    DraftStorage.setApiEndpoint(endpoint);
    console.log('Draft storage configured to use API:', endpoint);
  };
  
  // Export functions for external use (draft recovery)
  function getAutoSaveData() {
    const data = localStorage.getItem('newsletter_autosave');
    return data ? JSON.parse(data) : null;
  }
  
  function clearAutoSave() {
    localStorage.removeItem('newsletter_autosave');
    lastAutoSaveTime = null;
    hasUnsavedChanges = false;
  }

  // ============================================
  // PHASE 3.2: EXPORT MODAL
  // ============================================
  async function openExportModal() {
    if (!connection.ej) return;
    
    const content = await connection.ej.save();
    const fullData = {
      ...editorData,
      content
    };
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; background: rgba(0, 0, 0, 0.2);';
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 class="text-xl font-semibold">Export Newsletter</h2>
          <button class="text-gray-500 hover:text-gray-700 text-2xl modal-close">&times;</button>
        </div>
        
        <div class="p-4 space-y-3">
          <button class="w-full p-4 border rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3 export-btn" data-format="json">
            <div class="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center text-yellow-600">
              <i class="fas fa-file-code"></i>
            </div>
            <div class="text-left">
              <div class="font-semibold">JSON</div>
              <div class="text-sm text-gray-500">For backup & restore</div>
            </div>
          </button>
          
          <button class="w-full p-4 border rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3 export-btn" data-format="html">
            <div class="w-10 h-10 bg-orange-100 rounded flex items-center justify-center text-orange-600">
              <i class="fas fa-file-alt"></i>
            </div>
            <div class="text-left">
              <div class="font-semibold">HTML Email</div>
              <div class="text-sm text-gray-500">Ready for email clients</div>
            </div>
          </button>
          
          <button class="w-full p-4 border rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3 export-btn" data-format="markdown">
            <div class="w-10 h-10 bg-blue-100 rounded flex items-center justify-center text-blue-600">
              <i class="fab fa-markdown"></i>
            </div>
            <div class="text-left">
              <div class="font-semibold">Markdown</div>
              <div class="text-sm text-gray-500">For blogs & documentation</div>
            </div>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      const target = e.target;
      
      // Close modal
      if (target.classList.contains('modal-close') || target === modal) {
        modal.remove();
        return;
      }
      
      // Export buttons
      const btn = target.closest('.export-btn');
      if (btn) {
        const format = btn.dataset.format;
        exportContent(format, fullData);
        modal.remove();
      }
    });
  }
  
  function exportContent(format, data) {
    let content, filename, mimeType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = `newsletter-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
        
      case 'html':
        const htmlContent = convertEditorContentToHTML(data.content);
        content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title || 'Newsletter'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">${data.title || 'Newsletter'}</h1>
  ${htmlContent}
</body>
</html>`;
        filename = `newsletter-${Date.now()}.html`;
        mimeType = 'text/html';
        break;
        
      case 'markdown':
        content = convertToMarkdown(data);
        filename = `newsletter-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
    }
    
    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function convertToMarkdown(data) {
    if (!data.content || !data.content.blocks) return '';
    
    let md = `# ${data.title || 'Newsletter'}\n\n`;
    
    if (data.metaDescription) md += `> ${data.metaDescription}\n\n`;
    
    data.content.blocks.forEach(block => {
      switch (block.type) {
        case 'header':
          const level = block.data.level || 2;
          md += `${'#'.repeat(level)} ${block.data.text}\n\n`;
          break;
        case 'paragraph':
          md += `${block.data.text}\n\n`;
          break;
        case 'list':
          block.data.items.forEach((item, i) => {
            if (block.data.style === 'ordered') {
              md += `${i + 1}. ${item}\n`;
            } else {
              md += `- ${item}\n`;
            }
          });
          md += '\n';
          break;
        case 'quote':
          md += `> ${block.data.text}\n`;
          if (block.data.caption) md += `> — ${block.data.caption}\n`;
          md += '\n';
          break;
        case 'image':
          md += `![${block.data.caption || 'Image'}](${block.data.url || ''})\n\n`;
          break;
        case 'code':
          md += `\`\`\`
${block.data.code}
\`\`\`

`;
          break;
        case 'divider':
          md += '---\n\n';
          break;
        case 'cta':
          md += `**${block.data.title || ''}**\n\n${block.data.text || ''}\n\n[${block.data.buttonText || 'Click Here'}](${block.data.buttonUrl || '#'})\n\n`;
          break;
        case 'groupButton':
          if (block.data.buttons && block.data.buttons.length > 0) {
            const buttons = block.data.buttons.map(btn => {
              const icon = btn.icon ? `[${btn.icon}] ` : '';
              const text = btn.text || 'Button';
              if (btn.iconPosition === 'right') {
                return `[${text}](${btn.url || '#'}) ${icon}`;
              }
              return `${icon}[${text}](${btn.url || '#'})`;
            }).join(' | ');
            md += `${buttons}\n\n`;
          }
          break;
      }
    });
    
    return md;
  }

  // ============================================
  // PHASE 3.3: SEO SCORE CALCULATOR
  // ============================================
  function calculateSEOScore(data, content) {
    let score = 0;
    const recommendations = [];
    
    // Check title (15 points)
    if (data.title && data.title.trim().length > 0) {
      score += 10;
      if (data.title.length >= 30 && data.title.length <= 60) {
        score += 5;
      } else if (data.title.length < 30) {
        recommendations.push('• Title is too short. Aim for 30-60 characters.');
      } else {
        recommendations.push('• Title is too long. Keep it under 60 characters.');
      }
    } else {
      recommendations.push('• Add a title to your newsletter.');
    }
    
    // Check meta description (15 points)
    if (data.metaDescription && data.metaDescription.trim().length > 0) {
      score += 10;
      if (data.metaDescription.length >= 50 && data.metaDescription.length <= 160) {
        score += 5;
      } else if (data.metaDescription.length < 50) {
        recommendations.push('• Meta description is too short. Aim for 50-160 characters.');
      } else {
        recommendations.push('• Meta description is too long. Keep it under 160 characters.');
      }
    } else {
      recommendations.push('• Add a meta description for better SEO.');
    }
    
    // Check slug (10 points)
    if (data.slug && data.slug.trim().length > 0) {
      score += 10;
    } else {
      recommendations.push('• Add a URL slug for better search visibility.');
    }
    
    // Check category (10 points)
    if (data.category && data.category.trim().length > 0) {
      score += 10;
    } else {
      recommendations.push('• Select a category for your newsletter.');
    }
    
    // Check tags (10 points)
    if (data.tags && data.tags.trim().length > 0) {
      score += 10;
    } else {
      recommendations.push('• Add relevant tags to improve discoverability.');
    }
    
    // Check featured image (10 points)
    if (data.featuredImage) {
      score += 10;
    } else {
      recommendations.push('• Add a featured image to make your content more engaging.');
    }
    
    // Check content length (20 points - increased from 10)
    if (content && content.blocks) {
      const wordCount = content.blocks.reduce((count, block) => {
        if (block.data.text) {
          return count + block.data.text.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w).length;
        }
        return count;
      }, 0);
      
      if (wordCount >= 300) {
        score += 20;
      } else {
        recommendations.push(`• Content is too short (${wordCount} words). Aim for at least 300 words.`);
        score += Math.floor((wordCount / 300) * 20);
      }
    }
    
    // Check headings in content (10 points)
    if (content && content.blocks) {
      const hasHeadings = content.blocks.some(b => b.type === 'header');
      if (hasHeadings) {
        score += 10;
      } else {
        recommendations.push('• Add headings to structure your content.');
      }
    }
    
    return { score: Math.min(100, score), recommendations };
  }

  return editorContainer;
};

export {editor}
