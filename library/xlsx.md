# xlsx.js (SheetJS) Documentation

**Version**: 0.18.5 + xlsx-js-style 1.2.0

Fork of SheetJS combined with [sheetjs-style](https://www.npmjs.com/package/sheetjs-style) and [sheetjs-style-v2](https://www.npmjs.com/package/sheetjs-style-v2) — supports **cell styling** (colors, fonts, borders, alignment, number formats).

## Installation

### Local File (in `library/` folder)

```html
<script src="library/xlsx.js"></script>
```

### CDN

```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
```

### npm

```bash
npm install xlsx
```

```javascript
var XLSX = require("xlsx");
// or
import * as XLSX from "xlsx";
```

---

## Core Functions

### Reading Files

```javascript
// Parse from array buffer
const workbook = XLSX.read(data, { type: "array" });

// Parse from base64 string
const workbook = XLSX.read(data, { type: "base64" });

// Parse from binary string
const workbook = XLSX.read(data, { type: "binary" });

// Node.js: read from file
const workbook = XLSX.readFile("file.xlsx");
```

**Read Options:**
- `type`: `"base64"`, `"binary"`, `"buffer"`, `"array"`, `"file"`
- `cellFormula`: include formulae (default: true)
- `cellHTML`: parse HTML in cells (default: true)
- `cellNF`: include number format string
- `cellStyles`: include cell styles
- `sheetStubs`: create cells for stubs
- `sheetRows`: max rows to parse (0 = all)
- `dateNF`: date format string

---

### Writing Files

```javascript
// Write to binary string
const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "binary" });

// Force download in browser
XLSX.writeFile(workbook, "SheetJSExport.xlsx");

// Write XLSX specifically
XLSX.writeFileXLSX(workbook, "Export.xlsx");
```

**Write Options:**
- `bookType`: `"xlsx"`, `"xlsm"`, `"xlsb"`, `"xls"`, `"csv"`, `"txt"`
- `type`: `"base64"`, `"binary"`, `"buffer"`, `"array"`
- `compression`: true/false (for xlsx/xlsm)

---

## Workbook Structure

```javascript
// Access sheet names
const sheetNames = workbook.SheetNames; // ["Sheet1", "Sheet2"]

// Get worksheet
const worksheet = workbook.Sheets["Sheet1"];

// Get worksheet by index
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
```

---

## Utilities

### Create Workbook

```javascript
// Create new workbook
const workbook = XLSX.utils.book_new();

// Create worksheet from array of arrays
const ws = XLSX.utils.aoa_to_sheet([
  ["Name", "Age", "City"],
  ["John", 30, "NYC"],
  ["Jane", 25, "LA"]
]);

// Create worksheet from array of objects
const ws = XLSX.utils.json_to_sheet([
  { Name: "John", Age: 30, City: "NYC" },
  { Name: "Jane", Age: 25, City: "LA" }
]);

// Append sheet to workbook
XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");
```

---

### Export Data

```javascript
// Sheet to array of objects (JSON)
const jsonData = XLSX.utils.sheet_to_json(worksheet);
// [{ Name: "John", Age: 30 }, { Name: "Jane", Age: 25 }]

// With options
const jsonData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,        // use first row as headers
  range: 2,         // start from row 3 (0-indexed)
  defval: "",       // default value for empty cells
  blankrows: false  // skip blank rows
});

// Sheet to array of arrays
const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Sheet to CSV
const csv = XLSX.utils.sheet_to_csv(worksheet);

// Sheet to HTML
const html = XLSX.utils.sheet_to_html(worksheet);

// Sheet to formulae
const formulae = XLSX.utils.sheet_to_formulae(worksheet);
```

---

### HTML Table Operations

```javascript
// Convert HTML table element to worksheet
const ws = XLSX.utils.table_to_sheet(document.getElementById("myTable"));

// Convert HTML table to full workbook
const wb = XLSX.utils.table_to_book(document.getElementById("myTable"));

// Add DOM table data to existing worksheet
XLSX.utils.sheet_add_dom(ws, document.getElementById("myTable"));
```

---

### Add Data to Existing Sheet

```javascript
// Add array of arrays starting at cell A1
XLSX.utils.sheet_add_aoa(ws, [
  ["New", "Data"],
  [1, 2]
], { origin: "A1" });

// Add JSON data starting at cell B2
XLSX.utils.sheet_add_json(ws, [
  { A: "X", B: "Y" }
], { origin: "B2" });
```

---

## Cell Address Utilities

```javascript
// Convert column index to letter (0 = A)
XLSX.utils.encode_col(0);     // "A"
XLSX.utils.encode_col(27);    // "AB"

// Convert column letter to index
XLSX.utils.decode_col("A");   // 0
XLSX.utils.decode_col("AB");  // 27

// Convert row index to 1-based number
XLSX.utils.encode_row(0);     // "1"

// Convert row number to 0-based index
XLSX.utils.decode_row("1");   // 0

// Encode cell address
XLSX.utils.encode_cell({ c: 0, r: 0 });  // "A1"

// Decode cell address
XLSX.utils.decode_cell("A1");  // { c: 0, r: 0 }

// Encode range
XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 2, r: 5 } });
// "A1:C6"

// Decode range
XLSX.utils.decode_range("A1:C6");
// { s: { c: 0, r: 0 }, e: { c: 2, r: 5 } }
```

---

## Complete Examples

### Export Table to Excel

```html
<table id="TableToExport">
  <tr><th>Name</th><th>Age</th></tr>
  <tr><td>John</td><td>30</td></tr>
  <tr><td>Jane</td><td>25</td></tr>
</table>

<button id="exportBtn">Export XLSX</button>

<script src="library/xlsx.js"></script>
<script>
document.getElementById("exportBtn").addEventListener("click", function() {
  const wb = XLSX.utils.table_to_book(document.getElementById("TableToExport"));
  XLSX.writeFile(wb, "Export.xlsx");
});
</script>
```

---

### Generate Excel from JSON

```javascript
const data = [
  { Name: "John", Age: 30, City: "NYC" },
  { Name: "Jane", Age: 25, City: "LA" },
  { Name: "Bob", Age: 35, City: "Chicago" }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Users");

XLSX.writeFile(wb, "Users.xlsx");
```

---

### Read Excel File

```javascript
// Browser with File input
const fileInput = document.getElementById("file");

fileInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    
    console.log(jsonData);
  };

  reader.readAsArrayBuffer(file);
});
```

---

### Parse CSV String

```javascript
const csv = `Name,Age,City
John,30,NYC
Jane,25,LA`;

const workbook = XLSX.read(csv, { type: "string" });
const ws = workbook.Sheets.Sheet1;
const data = XLSX.utils.sheet_to_json(ws);
```

---

## Cell Styling (xlsx-js-style)

This version supports cell styling via the `s` property on cell objects.

### Style Properties

```javascript
{
  font: {
    name: "Arial",
    sz: 14,
    bold: true,
    italic: false,
    underline: true,
    color: { rgb: "FF0000" }
  },
  fill: {
    fgColor: { rgb: "FFFF00" },
    patternType: "solid"
  },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "medium", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  },
  alignment: {
    horizontal: "center",   // "left", "center", "right"
    vertical: "middle",     // "top", "center", "bottom"
    wrapText: true,
    textRotation: 45
  },
  numFmt: "0.00%"          // Number format string
}
```

### Apply Style to Cell

```javascript
ws["A1"] = {
  v: "Header",
  t: "s",
  s: {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center" }
  }
};
```

### Style Helper Function

```javascript
function styledCell(value, style) {
  return { v: value, t: typeof value === "number" ? "n" : "s", s: style };
}

// Usage
ws["A1"] = styledCell("Total", {
  font: { bold: true, sz: 14 },
  fill: { fgColor: { rgb: "D9E1F2" }, patternType: "solid" },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } }
  }
});
```

### Full Styled Example

```javascript
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["Product", "Qty", "Price", "Total"],
  ["Apple", 10, 1.5, 15],
  ["Banana", 20, 0.8, 16]
]);

// Header row styling
["A1", "B1", "C1", "D1"].forEach(cell => {
  ws[cell].s = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
    alignment: { horizontal: "center" }
  };
});

// Data row styling
["A2", "B2", "C2", "D2"].forEach(cell => {
  ws[cell].s = {
    border: {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } }
    }
  };
});

XLSX.utils.book_append_sheet(wb, ws, "Sales");
XLSX.writeFile(wb, "Styled.xlsx");
```

---

## Worksheet Object Structure

```javascript
{
  "!ref": "A1:C3",           // Sheet range
  "!merges": [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }], // Merged cells
  "A1": {                    // Cell object
    v: "Hello",              // Raw value
    w: "Hello",              // Formatted text
    t: "s",                  // Type: "s"=string, "n"=number, "b"=boolean, "d"=date
    f: "SUM(A1:A10)",       // Formula
    r: "<t>Hello</t>",      // Rich text
    h: "<b>Hello</b>",      // HTML
    c: [{ a: "Author", t: "Comment" }], // Comments
    z: "0.00%",             // Number format
    s: {                    // Style (if parsed)
      font: { name: "Arial", sz: 14 },
      fill: { fgColor: { rgb: "FFFF00" } }
    }
  }
}
```

---

## Resources

- **Documentation**: https://docs.sheetjs.com/
- **GitHub**: https://github.com/SheetJS/sheetjs
- **npm**: https://www.npmjs.com/package/xlsx
- **Playground**: https://docs.sheetjs.com/docs/
