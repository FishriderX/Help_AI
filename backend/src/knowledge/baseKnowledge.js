// Page type descriptions extracted from 83 reference images.
// Used as part of Claude's system prompt to recognize content types.

export const PAGE_TYPES = {
  paytable: {
    description: 'Symbol payout table showing winning combinations and their values',
    recognition: [
      'Contains symbol names (M1, M2, C1, C2, A, K, Q, J, 10)',
      'Has numeric payout values with count ranges (e.g. "8-9: 400", "5: 125")',
      'Mentions BET MULTIPLIER',
      'May group gold/base symbols separately',
    ],
    requiredFields: ['title', 'rules', 'symbols'],
    optionalFields: ['groups'],
  },
  symbols_per_play: {
    description: 'Table showing which symbols are active per bet level',
    recognition: [
      'Has BET column with numeric values',
      'Has SYMBOLS column with symbol names',
      'Some symbols marked as removed (X marks or strikethrough)',
      'Title: "SYMBOLS PER PLAY" or "游戏中标志"',
    ],
    requiredFields: ['title', 'bets'],
    optionalFields: ['note'],
  },
  prizes_table: {
    description: 'Two-column table showing bet amounts and prize ranges',
    recognition: [
      'Has BET column with amounts',
      'Has prize range column (e.g. "19 ~ 128" or "28 ~ 888")',
      'Many rows of bet/prize pairs',
      'Title like "NEW APPEARED PRIZES" or "PRIZES (CONTINUED)"',
    ],
    requiredFields: ['title', 'rows'],
    optionalFields: ['note'],
  },
  feature_text: {
    description: 'Simple page with title and bullet-point rules',
    recognition: [
      'Single title (e.g. "CASCADING REELS FEATURE", "GAME RULES", "FREE GAMES FEATURE")',
      'Bullet points with game rules',
      'No complex table structure',
      'May include inline symbol references like [C1]',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  jackpot: {
    description: 'Jackpot feature page: trigger rules + a DENOMINATION table',
    recognition: [
      'Title contains "JACKPOT FEATURE"',
      'Rules about how the jackpot is triggered and awarded',
      'Has a DENOMINATION table; its left-column rows are ONLY the jackpot levels whose value changes with denomination (e.g. MINI, MINOR — this set varies per game). Do NOT add levels that are not listed in the table (e.g. GRAND/MAJOR may be progressive and absent from the table).',
      'Empty table cells = dynamic values filled in later',
    ],
    requiredFields: ['title', 'rules', 'denominationTable'],
    optionalFields: [],
  },
  setting_info: {
    description: 'Setting information table with min/max values',
    recognition: [
      'Title: "SETTING INFORMATION"',
      'Table with MINIMUM and MAXIMUM columns',
      'Rows: WAYS, TOTAL BET, etc. — the MIN/MAX values are DYNAMIC, so output them as empty strings ("") even when the sheet shows numbers (they are filled in at runtime)',
      'May have a denomination section; the denomination and bet-button IMAGES are added by the frontend later, so do NOT list [DENOM*] or [BET *] tags — keep ONLY the instruction text (e.g. "PRESSING BUTTON BELOW TO START GAME.") as the section body',
    ],
    requiredFields: ['title', 'rows'],
    optionalFields: ['denominationSections'],
  },
  feature_card: {
    description: 'Special symbol detail card(s): a big icon + payouts on the LEFT, rules on the RIGHT (SCATTER, WILD, etc.)',
    recognition: [
      'One or a few special symbols (SCATTER, WILD) each shown with its own icon',
      'Each symbol has a small payout list (e.g. 4=150, 5=250, 6=5000)',
      'Each symbol has descriptive rules/bullets about how it works',
      'Title is the symbol name like "SCATTER" or "WILD" (not a multi-section feature)',
    ],
    requiredFields: ['title', 'cards'],
    optionalFields: [],
  },
  special_feature: {
    description: 'Feature page with sub-feature sections and inline icons',
    recognition: [
      'Title describes a special game feature (GOLDEN SYMBOL, WILD FEATURE, etc.)',
      'Has sub-sections with dash bullets',
      'Inline symbol references embedded in text',
      'More complex layout than feature_text',
    ],
    requiredFields: ['title', 'sections'],
    optionalFields: ['note'],
  },
  multi_section: {
    description: 'Page with main title, body text, sub-titles, and optional table',
    recognition: [
      'Has a main title and main body text',
      'Has 2+ sub-sections each with their own sub-title',
      'Sub-sections may have icons/assets',
      'May include a value table at the bottom',
    ],
    requiredFields: ['title', 'body', 'sections'],
    optionalFields: ['table'],
  },
  game_settings: {
    description: 'Game board layout page showing reel grid',
    recognition: [
      'Title: "GAME SETTINGS"',
      'States the board size, e.g. "BOARD OF {6} REELS, EACH WITH A HEIGHT OF {5}" → reels=6, height=5. Read these numbers from the sentence whatever they are (5×4, 6×5, …) so the reel grid can be drawn.',
      'Keep the original board/cluster description sentences in "rules" — preserve the {} number placeholders and any [scatter] tag (e.g. [C1]) so the renderer can colour the numbers and show the scatter icon.',
      'Also extract the numbers into boardInfo (reels, height, clusterMin, scatterMin)',
      'The intellectual property announcement (title + body) merges into "copyright", heading kept on the first line',
    ],
    requiredFields: ['title', 'rules', 'boardInfo'],
    optionalFields: ['copyright'],
  },
  spin_button: {
    description: 'Spin button description with icon',
    recognition: [
      'Title: "SPIN BUTTON"',
      'Has spin button icon/asset reference',
      'Short description of button functions',
    ],
    requiredFields: ['title', 'icon', 'body'],
    optionalFields: [],
  },
  fortune_chance: {
    description: 'Fortune Chance feature description',
    recognition: [
      'Title: "FORTUNE CHANCE"',
      'Describes what happens when credit balance is low',
      'References CURRENCY DISPLAY MODE',
      'Has button icon references',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  instant_bonus: {
    description: 'Instant Bonus purchase feature description',
    recognition: [
      'Title: "INSTANT BONUS"',
      'Describes purchasing free games',
      'Mentions cost (100X total bet)',
      'Has button icon reference',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  combo_feature: {
    description: 'Combo feature with two distinct effects',
    recognition: [
      'Title: "COMBO FEATURE"',
      'Has exactly two sub-effects: MULTIPLIER DROP and SYMBOL CONVERSION',
      'Each effect has its own sub-title and rules',
    ],
    requiredFields: ['title', 'triggerRules', 'effects'],
    optionalFields: [],
  },
  custom: {
    description: 'Fallback for unrecognized page types',
    recognition: ['Does not clearly match any known type'],
    requiredFields: ['title', 'content'],
    optionalFields: [],
  },
};

export function buildKnowledgePrompt() {
  let prompt = 'KNOWN PAGE TYPES:\n\n';
  for (const [type, info] of Object.entries(PAGE_TYPES)) {
    prompt += `TYPE: ${type}\n`;
    prompt += `Description: ${info.description}\n`;
    prompt += `Recognition signals:\n`;
    info.recognition.forEach(r => { prompt += `  - ${r}\n`; });
    prompt += `Required JSON fields: ${info.requiredFields.join(', ')}\n\n`;
  }
  return prompt;
}
