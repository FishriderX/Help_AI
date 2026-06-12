import { parseDocument } from '../src/services/documentParser.js';

test('parseDocument passthrough for plain text', async () => {
  const result = await parseDocument({ type: 'text', value: 'PAGE 1\tPAYTABLE\tSome rule' });
  expect(result.type).toBe('text');
  expect(result.content).toContain('PAGE 1');
  expect(result.rowCount).toBeGreaterThan(0);
});

test('parseDocument rejects unknown type', async () => {
  await expect(parseDocument({ type: 'unknown', value: '' }))
    .rejects.toThrow('Unsupported document type');
});

test('parseDocument extracts rows from TSV text', async () => {
  const tsv = 'PAGE 1\tPAYTABLE\tRule 1\nPAGE 2\tSCATTER\tRule 2';
  const result = await parseDocument({ type: 'text', value: tsv });
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0][0]).toBe('PAGE 1');
  expect(result.rows[0][1]).toBe('PAYTABLE');
});

test('parseDocument handles sheets_url with valid sheet id', async () => {
  const url = 'https://docs.google.com/spreadsheets/d/1IEOyYtRHQn3Go1CAzV1UdWco54YySdZ7-sLHlMoyhzw/edit';
  const result = await parseDocument({ type: 'sheets_url', value: url });
  expect(result.type).toBe('sheets');
  expect(result.rows.length).toBeGreaterThan(0);
}, 15000);
