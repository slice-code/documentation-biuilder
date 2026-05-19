# pdfmake v0.1.53 Documentation

Client/server side PDF printing in pure JavaScript.

## Installation

### Local Files (in `library/` folder)

```html
<script src="library/makepdf.js"></script>
<script src="library/vfs_fonts.js"></script>
```

### CDN (v0.1)

```html
<script src="https://unpkg.com/pdfmake@0.1/build/pdfmake.min.js"></script>
<script src="https://unpkg.com/pdfmake@0.1/build/vfs_fonts.js"></script>
```

Or via jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.1/build/pdfmake.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.1/build/vfs_fonts.js"></script>
```

### npm

```bash
npm install pdfmake@0.1.53
```

```javascript
var pdfMake = require('pdfmake/build/pdfmake.js');
var pdfFonts = require('pdfmake/build/vfs_fonts.js');
pdfMake.addVirtualFileSystem(pdfFonts);
```

Or using local files from `library/`:

```javascript
var pdfMake = require('./library/makepdf.js');
var pdfFonts = require('./library/vfs_fonts.js');
pdfMake.addVirtualFileSystem(pdfFonts);
```

---

## Basic Usage

```javascript
var docDefinition = {
  content: 'This is a sample PDF printed with pdfmake'
};

pdfMake.createPdf(docDefinition).download('sample.pdf');
```

---

## Document Definition Object

### Content

The `content` property accepts a string, object, or array:

```javascript
var docDefinition = {
  content: [
    'Simple string paragraph',
    { text: 'Styled paragraph', fontSize: 15 },
    {
      text: [
        'Mixed ',
        { text: 'styled', bold: true },
        ' content'
      ]
    }
  ]
};
```

### Page Properties

```javascript
var docDefinition = {
  pageSize: 'A4',        // 'A3', 'A4', 'A5', 'LETTER', 'LEGAL' or { width: number, height: number }
  pageOrientation: 'portrait', // 'portrait' or 'landscape'
  pageMargins: [40, 60, 40, 60], // [left, top, right, bottom]
  content: [...]
};
```

---

## Styling

### Inline Styles

```javascript
{
  text: 'Hello World',
  fontSize: 15,
  bold: true,
  color: '#333'
}
```

### Style Dictionaries

```javascript
var docDefinition = {
  content: [
    { text: 'Header', style: 'header' },
    { text: 'Subheader', style: ['header', 'subheader'] }
  ],
  styles: {
    header: {
      fontSize: 22,
      bold: true,
      alignment: 'center'
    },
    subheader: {
      fontSize: 16,
      color: '#666'
    }
  }
};
```

### Default Style

```javascript
var docDefinition = {
  content: ['Default styled text'],
  defaultStyle: {
    fontSize: 12,
    font: 'Roboto'
  }
};
```

### Style Properties

| Property | Type | Description |
|----------|------|-------------|
| `font` | `string` | Font name |
| `fontSize` | `number` | Font size in pt |
| `lineHeight` | `number` | Line height multiplier (default: 1) |
| `bold` | `boolean` | Bold text |
| `italics` | `boolean` | Italic text |
| `alignment` | `string` | `'left'`, `'center'`, `'right'`, `'justify'` |
| `characterSpacing` | `number` | Letter spacing in pt |
| `color` | `string` | Text color (name or hex) |
| `background` | `string` | Background color |
| `markerColor` | `string` | Bullet color for lists |
| `decoration` | `string`/`string[]` | `'underline'`, `'lineThrough'`, `'overline'` |
| `decorationStyle` | `string` | `'dashed'`, `'dotted'`, `'double'`, `'wavy'` |
| `decorationColor` | `string` | Decoration color |

---

## Tables

```javascript
{
  layout: 'lightHorizontalLines',
  table: {
    headerRows: 1,
    widths: ['*', 'auto', 100, '*'],
    body: [
      ['First', 'Second', 'Third', 'Last'],
      ['Value 1', 'Value 2', 'Value 3', 'Value 4'],
      [{ text: 'Bold', bold: true }, 'Val 2', 'Val 3', 'Val 4']
    ]
  }
}
```

### Table Layouts

- `noBorders`
- `headerLineOnly`
- `lightHorizontalLines`

### Custom Table Layout

```javascript
pdfMake.tableLayouts = {
  customLayout: {
    hLineWidth: function(i, node) { return 1; },
    vLineWidth: function(i) { return 1; },
    hLineColor: function(i) { return '#aaa'; },
    vLineColor: function(i) { return '#aaa'; },
    paddingLeft: function(i) { return 8; },
    paddingRight: function(i, node) { return 8; },
    paddingTop: function(i) { return 6; },
    paddingBottom: function(i) { return 6; }
  }
};
```

### Cell Properties

- `fillColor`: Cell background color
- `fillOpacity`: Cell background opacity
- `colSpan`: Number of columns to span
- `rowSpan`: Number of rows to span

---

## Images

```javascript
{
  image: 'data:image/jpeg;base64,...',
  width: 150,
  height: 100,
  fit: [100, 100],
  cover: { width: 100, height: 100, valign: 'bottom', align: 'right' }
}
```

### Image Dictionary

```javascript
var docDefinition = {
  content: [
    { image: 'myImage' }
  ],
  images: {
    myImage: 'data:image/jpeg;base64,...',
    remoteImage: 'https://example.com/image.jpg'
  }
};
```

---

## Columns

```javascript
{
  columns: [
    { width: '*', text: 'Column 1' },
    { width: 'auto', text: 'Column 2' },
    { width: 100, text: 'Column 3' }
  ],
  columnGap: 10
}
```

Column width types:
- `*` - fills remaining space
- `auto` - sized to content
- `number` - fixed width in pt

---

## Lists

### Unordered (Bulleted)

```javascript
{
  ul: [
    'Item 1',
    'Item 2',
    { text: 'Item 3', bold: true }
  ]
}
```

### Ordered (Numbered)

```javascript
{
  ol: [
    'First',
    'Second',
    'Third'
  ]
}
```

---

## Headers and Footers

### Static

```javascript
var docDefinition = {
  header: 'Header text',
  footer: 'Footer text',
  content: '...'
};
```

### Dynamic

```javascript
var docDefinition = {
  header: function(currentPage, pageCount, pageSize) {
    return {
      text: 'Page ' + currentPage + ' of ' + pageCount,
      alignment: 'center',
      margin: [0, 10]
    };
  },
  footer: function(currentPage, pageCount) {
    return {
      columns: [
        'Left text',
        { text: currentPage + ' / ' + pageCount, alignment: 'right' }
      ],
      margin: [40, 0]
    };
  },
  content: '...'
};
```

---

## Page Breaks

```javascript
[
  'Content on page 1',
  { text: 'Content on page 2', pageBreak: 'before' },
  { text: 'Keep together', pageBreak: 'after' }
]
```

---

## Stack

```javascript
{
  stack: [
    'Paragraph 1',
    'Paragraph 2',
    { text: 'Paragraph 3', fontSize: 20 }
  ],
  margin: [0, 20]
}
```

---

## QR Code

```javascript
{
  qr: 'text to encode',
  fit: 100,
  foreground: '#000',
  background: '#fff',
  alignment: 'center'
}
```

---

## Vector Graphics (SVG)

```javascript
{
  svg: '<svg>...</svg>',
  width: 200,
  height: 200
}
```

---

## Links

```javascript
{
  text: 'Click here',
  link: 'https://example.com',
  color: 'blue',
  decoration: 'underline'
}
```

---

## Table of Contents

```javascript
var docDefinition = {
  content: [
    { toc: { title: { text: 'Table of Contents', style: 'header' } } },
    { text: 'Chapter 1', style: 'header', tocItem: true },
    'Chapter 1 content...',
    { text: 'Chapter 2', style: 'header', tocItem: true },
    'Chapter 2 content...'
  ]
};
```

---

## Metadata

```javascript
var docDefinition = {
  info: {
    title: 'Document Title',
    author: 'Author Name',
    subject: 'Subject',
    keywords: 'pdf, javascript',
    creator: 'pdfmake',
    producer: 'pdfmake',
    creationDate: new Date()
  },
  content: '...'
};
```

---

## Client-Side Methods

```javascript
var pdfDocGenerator = pdfMake.createPdf(docDefinition);

// Download
pdfDocGenerator.download('filename.pdf');

// Open in new tab
pdfDocGenerator.open();

// Print
pdfDocGenerator.print();

// Get data URL
pdfDocGenerator.getDataUrl(function(dataUrl) {
  console.log(dataUrl);
});

// Get base64
pdfDocGenerator.getBase64(function(base64) {
  console.log(base64);
});

// Get buffer
pdfDocGenerator.getBuffer(function(buffer) {
  console.log(buffer);
});

// Get blob
pdfDocGenerator.getBlob(function(blob) {
  console.log(blob);
});
```

---

## Server-Side (Node.js)

```javascript
var PdfPrinter = require('pdfmake');
var fs = require('fs');

var fonts = {
  Roboto: {
    normal: 'fonts/Roboto-Regular.ttf',
    bold: 'fonts/Roboto-Medium.ttf',
    italics: 'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-MediumItalic.ttf'
  }
};

var printer = new PdfPrinter(fonts);
var docDefinition = {
  content: 'Hello from server'
};

var pdfDoc = printer.createPdfKitDocument(docDefinition);
pdfDoc.pipe(fs.createWriteStream('document.pdf'));
pdfDoc.end();
```

---

## Custom Fonts

```javascript
var docDefinition = {
  content: 'Custom font text',
  defaultStyle: {
    font: 'CustomFont'
  }
};

pdfMake.fonts = {
  CustomFont: {
    normal: 'https://example.com/font.ttf',
    bold: 'https://example.com/font-bold.ttf',
    italics: 'https://example.com/font-italic.ttf',
    bolditalics: 'https://example.com/font-bolditalic.ttf'
  }
};
```

---

## Examples

### Invoice

```javascript
var docDefinition = {
  content: [
    { text: 'INVOICE', style: 'header' },
    {
      columns: [
        { text: 'From:\nCompany Name\nAddress' },
        { text: 'To:\nClient Name\nAddress', alignment: 'right' }
      ]
    },
    { text: '\n' },
    {
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          ['Item', 'Quantity', 'Price'],
          ['Product A', '2', '$100'],
          ['Product B', '1', '$50']
        ]
      }
    }
  ],
  styles: {
    header: {
      fontSize: 22,
      bold: true,
      alignment: 'center',
      margin: [0, 0, 0, 20]
    }
  }
};
```

---

## Resources

- **Playground**: http://pdfmake.org/playground.html
- **GitHub**: https://github.com/bpampuch/pdfmake
- **Documentation**: https://pdfmake.github.io/docs/0.1/
- **npm**: https://www.npmjs.com/package/pdfmake
