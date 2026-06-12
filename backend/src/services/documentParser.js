import fetch from 'node-fetch';

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Pull a tab's numeric gid out of a sheet URL (#gid=… or &gid=…).
function extractGid(url) {
  const m = String(url || '').match(/[#&?]gid=(\d+)/);
  return m ? m[1] : null;
}

function parseCSV(csvText) {
  return csvText
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
      row.push(current.trim());
      return row;
    });
}

function parseTSV(text) {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.split('\t').map(cell => cell.trim()));
}

function rowsToContent(rows) {
  return rows.map(row => row.join(' | ')).join('\n');
}

export async function parseDocument(input) {
  if (input.type === 'text') {
    const rows = parseTSV(input.value);
    return {
      type: 'text',
      content: rowsToContent(rows),
      rows,
      rowCount: rows.length,
    };
  }

  if (input.type === 'sheets_url') {
    const sheetId = extractSheetId(input.value);
    if (!sheetId) throw new Error('Invalid Google Sheets URL');

    // Tab selection. A numeric gid (from the URL #gid=… or the tab field) reads
    // an EXACT tab via the reliable export endpoint. A tab NAME falls back to
    // gviz &sheet= (Google's name lookup is unreliable, so gid is preferred).
    const tab = input.sheet ? String(input.sheet).trim() : '';
    const gid = extractGid(input.value) || (/^\d+$/.test(tab) ? tab : null);
    let csvUrl;
    if (gid) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    } else if (tab) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    } else {
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    }
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    return {
      type: 'sheets',
      content: rowsToContent(rows),
      rows,
      rowCount: rows.length,
    };
  }

  throw new Error(`Unsupported document type: ${input.type}`);
}
