import Anthropic from '@anthropic-ai/sdk';
import { buildKnowledgePrompt } from '../knowledge/baseKnowledge.js';
import { buildExamplesPrompt } from '../knowledge/examples.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildSystemPrompt() {
  return `You are a game help page layout analyzer for slot machine games.

Your job is to analyze game help documentation text and output a structured JSON Layout Plan.

${buildKnowledgePrompt()}

INPUT FORMAT NOTES:
- The document is a spreadsheet flattened to text. " | " separates spreadsheet COLUMNS.
- A single logical value is often SPLIT across several columns (e.g. a long symbol
  list continues into the next column). MERGE such split content back together.
- Treat " | " purely as a column boundary. NEVER copy "|" characters into your output.
- "項目" / item-type cells (標題=title, 規則=rule) label what each row is.
- "[WW]", "[M4]", "[C1]" etc. are symbol tags. "<100>", "<88>" are bet amounts.

STRICT OUTPUT RULES:
1. Output ONLY valid JSON — no markdown, no explanation, no code fences
2. The root object must have a "pages" array
3. Every page must have "id" (e.g. "PAGE_1") and "type" (one of the known types)
4. Page IDs must be sequential: PAGE_1, PAGE_2, etc.
5. If content is ambiguous, use type "custom" with a "content" field
6. Inline asset references like [C1], [C2] must be preserved EXACTLY as "[name]"
7. Dynamic placeholder values (min bet, max bet, denomination) should use {PLACEHOLDER} format
8. NEVER output "|" (pipe) characters — they are input column separators, not content
9. A symbol list split across columns must be joined into one continuous list of [tags]
10. Your ENTIRE response must be the JSON object. Start with "{" — no prose, no preamble.
11. If the input looks like a changelog/spec (has 修改前/修改後/日期 columns), extract only
    the actual help page content from it; never describe the document in prose.
12. PAYTABLE payouts: every payout MUST have both a "range" and a numeric "value".
    Only use ranges/counts that actually appear in the source (e.g. "8-9","10-11","12+",
    or "4","5","6"). NEVER invent a count like "7". If a symbol's payout values are not
    present in the source, omit that symbol's payouts rather than guessing numbers.

JSON SCHEMA FOR EACH PAGE TYPE:

feature_text: { id, type, title, body: [string] }
paytable: { id, type, title, rules: [string], symbols: [{asset, payouts: [{range, value}]}] }
symbols_per_play: { id, type, title, note, bets: [{amount, activeSymbols: [string], removedSymbols: [string]}] }
prizes_table: { id, type, title, note, rows: [{bet, min, max}] }
jackpot: { id, type, title, rules: [string], denominationTable: { columns: [string], rows: [string] } }  // rows = ONLY the jackpot levels listed in the table (e.g. ["MINI","MINOR"]); no separate tier list, no GRAND/MAJOR unless they appear as table rows
setting_info: { id, type, title, rows: [{label, min, max}], denominationSections: [{label, body}] }
feature_card: { id, type, title, cards: [{label, icon, payouts: [{range, value}], body: [string]}] }
special_feature: { id, type, title, note, sections: [{subtitle, body: [string]}] }
multi_section: { id, type, title, body: [string], sections: [{subtitle, icon, body: [string]}], table }
game_settings: { id, type, title, rules: [string], boardInfo: {reels, height, clusterMin, scatterMin}, copyright }  // rules = the original board/cluster description lines, KEEP the {} number placeholders and the [scatter] tag (e.g. [C1]); boardInfo numbers drive the drawn reel grid (reels × height)
spin_button: { id, type, title, icon, body: string }
fortune_chance: { id, type, title, body: [string] }
instant_bonus: { id, type, title, body: [string] }
combo_feature: { id, type, title, triggerRules: [string], effects: [{name, rules: [string]}] }
custom: { id, type, title, content: string }
${buildExamplesPrompt()}`;
}

export function validateLayoutPlan(plan) {
  if (!plan || !Array.isArray(plan.pages)) {
    throw new Error('Layout plan must have a pages array');
  }
  plan.pages.forEach((page, i) => {
    if (!page.id) throw new Error(`Page at index ${i} missing id`);
    if (!page.type) throw new Error(`Page at index ${i} missing type`);
  });
  return plan;
}

export async function analyzeDocument(parsedDocument, language = 'en', signal) {
  const systemPrompt = buildSystemPrompt();
  const userMessage = `Analyze the following game help document and output a JSON Layout Plan.

Language: ${language}
Total rows: ${parsedDocument.rowCount}

Document content:
${parsedDocument.content}`;

  const message = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
    signal ? { signal } : undefined
  );

  let rawText = message.content[0].text.trim();

  // Strip markdown code fences if Claude added them
  rawText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

  // Be tolerant of any prose preamble — extract the outermost JSON object.
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  const jsonText = (firstBrace >= 0 && lastBrace > firstBrace)
    ? rawText.slice(firstBrace, lastBrace + 1)
    : rawText;

  let plan;
  try {
    plan = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${e.message}\nRaw: ${rawText.slice(0, 200)}`);
  }

  return validateLayoutPlan(plan);
}
