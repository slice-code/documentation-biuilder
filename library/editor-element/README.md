# UI Maker Editor

A block-based WYSIWYG editor built on top of Editor.js with a modern UI and draft management features.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuration Options](#configuration-options)
- [Storage Options](#storage-options)
- [Draft Management](#draft-management)
- [Available Blocks](#available-blocks)
- [Output Format](#output-format)
- [Events](#events)
- [Theming](#theming)

---

## Quick Start

```javascript
import { editor } from './editor-element/editor.js';
import { el } from './el.js';

// Initialize editor
const editorInstance = await editor({
  el,
  onSave: (data) => {
    console.log('Saved data:', data);
  },
  onClose: () => {
    console.log('Editor closed');
  }
});
```

---

## Installation

### Prerequisites

Include Tailwind CSS in your HTML:

```html
<!-- Tailwind CSS (required for styling) -->
<script src="./tailwind.js"></script>
```

> **Note**: Editor.js and all block tools are dynamically loaded by `editor.js`. No need to include script tags for them.

### File Structure

```
editor-element/
├── editor.js          # Main editor component
├── README.md          # This documentation
└── lib/               # Block tools & dependencies
    ├── editorjs.umd.min.js
    ├── editorjs-list.umd.min.js
    ├── custom-header.js
    ├── simple-image.js
    ├── datepicker.js
    ├── timepicker.js
    └── ... (other tools)
```

---

## Basic Usage

### Minimal Setup

```javascript
const { el } = await import('./el.js');
const { default: Init } = await import('./main.js');

new Init(document.getElementById('app'));
```

### With Custom Configuration

```javascript
const editorInstance = await editor({
  el: el,                          // DOM helper function (required)
  type: 'newsletter',              // Editor type
  enableDraft: true,               // Enable draft auto-save
  storage: {                       // Storage configuration
    type: 'indexedDB'              // 'indexedDB' | 'api'
  },
  categories: ['News', 'Blog'],    // Available categories
  initialData: null,               // Load existing data
  onSave: (data) => {              // Save callback
    console.log('Save triggered:', data);
  },
  onClose: () => {                 // Close callback
    console.log('Editor closed');
  }
});
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `el` | `Function` | **required** | DOM helper function from `el.js` |
| `onClose` | `Function` | `null` | Callback when editor modal closes |
| `onSave` | `Function` | `null` | Callback when user clicks save |
| `categories` | `Array` | `[]` | List of categories for content |
| `type` | `String` | `'newsletter'` | Content type identifier |
| `storage` | `Object` | `{type: 'indexedDB'}` | Storage configuration |
| `initialData` | `Object` | `null` | Pre-loaded editor data |
| `enableDraft` | `Boolean` | `true` | Enable/disable draft feature |

---

## Storage Options

### IndexedDB (Default)

Drafts are stored locally in the browser:

```javascript
storage: {
  type: 'indexedDB'
}
```

### Custom API

Store drafts on your server:

```javascript
storage: {
  type: 'api',
  apiEndpoint: 'https://your-api.com/drafts'
}
```

---

## Draft Management

The editor includes automatic draft management to prevent data loss.

### Enable Draft

```javascript
await editor({
  el,
  enableDraft: true,  // Enable auto-save
  storage: { type: 'indexedDB' }
});
```

### Disable Draft

```javascript
await editor({
  el,
  enableDraft: false  // Disable auto-save
});
```

### Draft Recovery Flow

1. **Page Load**: Editor checks for existing drafts in storage
2. **Prompt**: If draft exists, user can choose to:
   - **Recover**: Continue editing the draft
   - **Discard**: Start fresh
3. **Auto-save**: Drafts are saved periodically (if enabled)

### Manual Draft Operations

```javascript
// Access draft API through editor instance
const draftId = editorInstance.currentDraftId;
```

---

## Available Blocks

The editor supports various block types:

| Block | Description | Usage |
|-------|-------------|-------|
| **Header** | H1-H6 headings | Click "+" or type "/" |
| **List** | Ordered/unordered lists | Click "+" or type "/" |
| **Image** | Image upload (URL or file) | Click "+" or type "/" |
| **Quote** | Blockquote text | Click "+" or type "/" |
| **Code** | Code block with syntax highlighting | Click "+" or type "/" |
| **Divider** | Horizontal rule | Click "+" or type "/" |
| **Embed** | YouTube, CodePen embeds | Click "+" or type "/" |
| **Table** | Table block | Click "+" or type "/" |
| **CTA** | Call-to-action button | Click "+" or type "/" |

### Block Actions

- **Add Block**: Click "+" button or type "/"
- **Delete Block**: Click trash icon or press Backspace on empty block
- **Move Block**: Drag and drop using the handle
- **Block Settings**: Click the settings icon on the right

---

## Output Format

### Save Data Structure

```javascript
{
  title: "Newsletter Title",
  category: "News",
  publishDate: "2026-03-27",
  publishTime: "14:30",
  content: {
    time: 1711507200000,
    blocks: [
      {
        id: "abc123",
        type: "header",
        data: {
          text: "Hello World",
          level: 1
        }
      },
      {
        id: "def456",
        type: "paragraph",
        data: {
          text: "This is a paragraph."
        }
      }
    ]
  }
}
```

### HTML Output

The editor can convert blocks to HTML for rendering:

```javascript
// Access Editor.js instance
const editorData = await editorInstance.save();

// Convert to HTML (implement your own converter or use a library)
```

---

## Events

### onSave

Triggered when user clicks the save button:

```javascript
onSave: (data) => {
  // data contains the full editor state
  console.log('Title:', data.title);
  console.log('Content blocks:', data.content.blocks);
  
  // Send to your backend
  fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

### onClose

Triggered when editor modal closes:

```javascript
onClose: () => {
  // Clean up resources
  // Navigate away, etc.
}
```

---

## Theming

The editor uses **Tailwind CSS** for styling. Customize by:

1. **Override Tailwind classes** in your project
2. **Modify colors** in `tailwind.js` configuration
3. **Custom CSS** for specific components

### Dark/Light Mode

The editor supports both themes. Components like `datepicker` and `timepicker` accept a `theme` option:

```javascript
datepicker({
  theme: 'light',  // 'light' | 'dark'
  // ...
});

timepicker({
  theme: 'light',  // 'light' | 'dark'
  // ...
});
```

---

## Component Dependencies

Some components require `el` to be passed as a parameter:

### DatePicker

```javascript
datepicker({
  el,                    // Required: DOM helper
  mode: 'single',        // 'single' | 'range'
  placeholder: 'MM/DD/YYYY',
  format: 'MM/DD/YYYY',
  theme: 'light',
  onChange: (date) => {
    console.log('Selected:', date);
  }
});
```

### TimePicker

```javascript
timepicker({
  el,                    // Required: DOM helper
  placeholder: 'HH:MM',
  format: '24',          // '12' | '24'
  step: 30,              // Minute step
  theme: 'light',
  onChange: (time) => {
    console.log('Selected:', time);
  }
});
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `el is required in options` | Missing `el` parameter | Pass `el` from `el.js` |
| `404 editorjs.umd.min.js` | Wrong script path | Check `index.html` script src |
| Drafts not saving | Draft disabled | Set `enableDraft: true` |
| Styles not applied | Missing Tailwind | Include `tailwind.js` |

### Debug Mode

Open browser console to see debug logs:

```
🔧 Editor config: { type: 'newsletter', enableDraft: true }
📄 Recovering draft with ID: abc-123-def
```

---

## License

MIT License
