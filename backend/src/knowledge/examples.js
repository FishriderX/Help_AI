// Few-shot learning examples — the heart of the "learning model".
//
// Each example pairs a representative slice of PARSED spreadsheet input (the
// flattened text, with " | " column separators, exactly as the document parser
// produces it) with the CORRECT Layout Plan page it should become.
//
// Claude reads these examples in its system prompt and learns the user's exact
// data format and layout conventions. This list is meant to GROW: every page the
// user confirms as correct becomes a new example here, so the model gets more
// accurate over time (the "skill that keeps learning").
//
// IMPORTANT: only add examples you are confident are correct — a wrong example
// teaches Claude the wrong mapping.

export const EXAMPLES = [
  {
    label: 'feature_text — title + bullet rules (項目 column drives the structure)',
    input: [
      '標題 | GAME RULES',
      '規則 | ·SELECT THE BET OPTION YOU WISH TO PLAY.',
      '規則 | ·ALL WINS ARE MULTIPLIED BY BET MULTIPLIER, PROGRESSIVE WINS (WHERE AVAILABLE) AND BONUS PRIZES.',
      '規則 | ·ONLY THE HIGHEST WIN IS PAID FOR EACH WINNING COMBINATION.',
      '規則 | ·MALFUNCTION VOIDS ALL PAYS AND PLAYS.',
    ].join('\n'),
    output: {
      id: 'PAGE_1',
      type: 'feature_text',
      title: 'GAME RULES',
      body: [
        '·SELECT THE BET OPTION YOU WISH TO PLAY.',
        '·ALL WINS ARE MULTIPLIED BY BET MULTIPLIER, PROGRESSIVE WINS (WHERE AVAILABLE) AND BONUS PRIZES.',
        '·ONLY THE HIGHEST WIN IS PAID FOR EACH WINNING COMBINATION.',
        '·MALFUNCTION VOIDS ALL PAYS AND PLAYS.',
      ],
    },
  },

  {
    // RULE: the highest bet's row gives the full symbol set (active + removed).
    // A bet's listed symbols are the REMOVED ones; HIGHER bet removes MORE.
    // activeSymbols = full set minus that bet's removedSymbols. <N> = bet amount.
    label: 'symbols_per_play — <bet> rows; HIGHER bet removes MORE symbols (removed are the ✕ ones)',
    input: [
      '標題 | SYMBOLS PER PLAY',
      '規則 | ·CERTAIN SYMBOLS WILL BE REMOVED DURING THE GAME WITH DIFFERENT BET.',
      '規則 | 投注 | 标志 | BET | SYMBOLS',
      '<100> | [WW] [M4] [C1] [M5] [M1] [A] [M2] [K] [M3] [Q] | [J] [TE] [NI]',
      '<58> | [TE] [NI]',
      '<28> |',
    ].join('\n'),
    output: {
      id: 'PAGE_1',
      type: 'symbols_per_play',
      title: 'SYMBOLS PER PLAY',
      note: '·CERTAIN SYMBOLS WILL BE REMOVED DURING THE GAME WITH DIFFERENT BET.',
      bets: [
        { amount: 100, activeSymbols: ['WW','M4','C1','M5','M1','A','M2','K','M3','Q'], removedSymbols: ['J','TE','NI'] },
        { amount: 58, activeSymbols: ['WW','M4','C1','M5','M1','A','M2','K','M3','Q','J'], removedSymbols: ['TE','NI'] },
        { amount: 28, activeSymbols: ['WW','M4','C1','M5','M1','A','M2','K','M3','Q','J','TE','NI'], removedSymbols: [] },
      ],
    },
  },

  {
    // RULE: the header labels the FIRST counts (4 5 6). Each symbol row then has
    // a value per column; "—" means NO payout for that count (skip it). For these
    // cluster games the THREE columns after 4/5/6 are the ranges 8-9, 10-11, 12+.
    // So a regular symbol row "[M1] — — — 400 1000 2000" → 8-9:400, 10-11:1000, 12+:2000.
    label: 'paytable — "—" = no payout; the 3 columns after 4/5/6 are ranges 8-9/10-11/12+',
    input: [
      'PAGE 1 | TITLE | PAYTABLE',
      'PAGE 1 | RULE | ·ALL WINS SHOWN FOR BET MULTIPLIER {1X}.',
      'PAGE 1 | TABLE | SYMBOL | 4 | 5 | 6',
      '[M1] | — | — | — | 400 | 1000 | 2000',
      '[M2] | — | — | — | 100 | 400 | 1000',
      '[K] | — | — | — | 32 | 48 | 320',
      '[TE] | — | — | — | 10 | 30 | 80',
    ].join('\n'),
    output: {
      id: 'PAGE_1',
      type: 'paytable',
      title: 'PAYTABLE',
      rules: ['·ALL WINS SHOWN FOR BET MULTIPLIER {1X}.'],
      symbols: [
        { asset: 'M1', payouts: [{ range: '8-9', value: 400 }, { range: '10-11', value: 1000 }, { range: '12+', value: 2000 }] },
        { asset: 'M2', payouts: [{ range: '8-9', value: 100 }, { range: '10-11', value: 400 }, { range: '12+', value: 1000 }] },
        { asset: 'K', payouts: [{ range: '8-9', value: 32 }, { range: '10-11', value: 48 }, { range: '12+', value: 320 }] },
        { asset: 'TE', payouts: [{ range: '8-9', value: 10 }, { range: '10-11', value: 30 }, { range: '12+', value: 80 }] },
      ],
    },
  },

  {
    // A special symbol page (SCATTER/WILD): one card per symbol. The title's
    // [tag] is the icon; strip it to get the label. The symbol's row gives the
    // payouts (here counts 4/5/6). The bullet rules become the card body.
    label: 'feature_card — SCATTER symbol: icon + payouts on the left, rules on the right',
    input: [
      'PAGE 2 | TITLE | SCATTER [C1]',
      'PAGE 2 | SYMBOL | 4 | 5 | 6',
      '[C1] (SCATTER) | 150 | 250 | 5000',
      'PAGE 2 | RULE | ·[C1] PAYS ANYWHERE ON THE BOARD WHEN {4} OR MORE APPEAR.',
      'PAGE 2 | RULE | ·AT MOST {1} [C1] CAN APPEAR PER REEL.',
      'PAGE 2 | RULE | ·DURING THE BASE GAME, THE FREE GAMES FEATURE IS TRIGGERED WHEN {4} OR MORE [C1] APPEAR. {15} FREE GAMES WILL BE AWARDED.',
    ].join('\n'),
    output: {
      id: 'PAGE_2',
      type: 'feature_card',
      title: 'SCATTER',
      cards: [
        {
          label: 'SCATTER',
          icon: 'C1',
          payouts: [{ range: '4', value: 150 }, { range: '5', value: 250 }, { range: '6', value: 5000 }],
          body: [
            '·[C1] PAYS ANYWHERE ON THE BOARD WHEN {4} OR MORE APPEAR.',
            '·AT MOST {1} [C1] CAN APPEAR PER REEL.',
            '·DURING THE BASE GAME, THE FREE GAMES FEATURE IS TRIGGERED WHEN {4} OR MORE [C1] APPEAR. {15} FREE GAMES WILL BE AWARDED.',
          ],
        },
      ],
    },
  },

  {
    // JACKPOT: trigger rules (merge | -split phrases, drop the pipes) + a
    // DENOMINATION table. The table's rows are ONLY the levels listed in the
    // source table (here MINI, MINOR) — NOT every tier named in the rules.
    // Grand/Major are progressive (named in rules) but are NOT table rows.
    // Do NOT emit a separate tier list.
    label: 'jackpot — trigger rules + DENOMINATION table whose rows = ONLY the listed levels (MINI, MINOR)',
    input: [
      'PAGE 7 | TITLE | JACKPOT FEATURE',
      'PAGE 7 | RULE | ．JACKPOT FEATURE IS TRIGGERED RANDOMLY BY {1} OR MORE [C1] ON THE REELS DURING THE BASE GAME AND FREE GAME.',
      '．DURING JACKPOT FEATURE | THERE ARE {12} [金幣] WHICH CONSIST OF [Grand] | [Major] | [Minor] AND [Mini].',
      '．[Grand] AND [Major] ARE PROGRESSIVE WINS.',
      '．THE PRIZE VALUES OF [MINOR] AND [MINI] WILL CHANGE IF THE PLAYER SELECTS DIFFERENT BET OPTIONS AND DENOMINATIONS.',
      'PAGE 7 | TABLE | DENOMINATION | <DENOM1> | <DENOM2> | <DENOM3>',
      '[MINI] |',
      '[MINOR] |',
    ].join('\n'),
    output: {
      id: 'PAGE_7',
      type: 'jackpot',
      title: 'JACKPOT FEATURE',
      rules: [
        '．JACKPOT FEATURE IS TRIGGERED RANDOMLY BY {1} OR MORE [C1] ON THE REELS DURING THE BASE GAME AND FREE GAME.',
        '．DURING JACKPOT FEATURE, THERE ARE {12} [金幣] WHICH CONSIST OF [Grand], [Major], [Minor] AND [Mini].',
        '．[Grand] AND [Major] ARE PROGRESSIVE WINS.',
        '．THE PRIZE VALUES OF [MINOR] AND [MINI] WILL CHANGE IF THE PLAYER SELECTS DIFFERENT BET OPTIONS AND DENOMINATIONS.',
      ],
      denominationTable: { columns: ['DENOMINATION'], rows: ['MINI', 'MINOR'] },
    },
  },

  {
    // GAME SETTINGS: keep the description sentences in "rules" (preserve {}
    // number placeholders + the [C1] scatter tag so the renderer colours the
    // numbers and draws the icon), AND extract the numbers into boardInfo (the
    // renderer draws a reels×height grid from them). The IP announcement TITLE +
    // body merge into one "copyright" string, heading kept on the first line.
    // {COMPANY NAME}/{YEAR} stay as placeholders.
    label: 'game_settings — rules (kept, with {} + [scatter]) + boardInfo numbers + IP copyright (heading kept)',
    input: [
      'PAGE 11 | TITLE | GAME SETTINGS',
      'PAGE 11 | RULE | ．THE GAME IS PLAYED ON A BOARD OF {6} REELS, EACH WITH A HEIGHT OF {5}.',
      '．WINS ARE EVALUATED USING THE CLUSTER PAY MODEL: GROUPS OF {8} OR MORE IDENTICAL SYMBOLS | AND {4} OR MORE [C1].',
      'PAGE 11 | TITLE | INTELLECTUAL PROPERTY RIGHT ANNOUNCEMENT',
      'PAGE 11 | RULE | THE PRODUCT AND THE COMPONENTS CONTAINED HEREIN ARE PROTECTED BY INTELLECTUAL PROPERTY RIGHTS INCLUDING PATENT / COPYRIGHT / TRADEMARK OWNED BY AND/OR LICENSED TO {COMPANY NAME}. © {YEAR} {COMPANY NAME}. ALL RIGHTS RESERVED.',
    ].join('\n'),
    output: {
      id: 'PAGE_11',
      type: 'game_settings',
      title: 'GAME SETTINGS',
      rules: [
        '．THE GAME IS PLAYED ON A BOARD OF {6} REELS, EACH WITH A HEIGHT OF {5}.',
        '．WINS ARE EVALUATED USING THE CLUSTER PAY MODEL: GROUPS OF {8} OR MORE IDENTICAL SYMBOLS, AND {4} OR MORE [C1].',
      ],
      boardInfo: { reels: 6, height: 5, clusterMin: 8, scatterMin: 4 },
      copyright: 'INTELLECTUAL PROPERTY RIGHT ANNOUNCEMENT:\nTHE PRODUCT AND THE COMPONENTS CONTAINED HEREIN ARE PROTECTED BY INTELLECTUAL PROPERTY RIGHTS INCLUDING PATENT / COPYRIGHT / TRADEMARK OWNED BY AND/OR LICENSED TO {COMPANY NAME}. © {YEAR} {COMPANY NAME}. ALL RIGHTS RESERVED.',
    },
  },

  {
    // SETTING INFORMATION: MINIMUM/MAXIMUM table where the values are DYNAMIC —
    // leave min/max BLANK (they are filled in at runtime), even if the sheet
    // shows numbers. Plus a denomination section whose bet-button/denomination
    // IMAGES are placed by the frontend later, so DROP every [DENOM*]/[BET *]
    // tag; the section body keeps only the instruction text.
    label: 'setting_info — min/max left BLANK (dynamic) + denomination section with tags stripped (frontend adds images)',
    input: [
      'PAGE 12 | TITLE | SETTING INFORMATION',
      'PAGE 12 | TABLE |  | MINIMUM | MAXIMUM',
      'PAGE 12 |  | TOTAL BET | 50 | 250',
      'PAGE 12 | RULE | ．DENOMINATION: [DENOM1] [DENOM2] [DENOM3] [DENOM4] [DENOM5]',
      '．PRESSING BUTTON BELOW TO START GAME. [BET X1] [BET X1.5] [BET X2] [BET X3] [BET X5]',
    ].join('\n'),
    output: {
      id: 'PAGE_12',
      type: 'setting_info',
      title: 'SETTING INFORMATION',
      rows: [{ label: 'TOTAL BET', min: '', max: '' }],
      denominationSections: [
        { label: 'DENOMINATION', body: '．PRESSING BUTTON BELOW TO START GAME.' },
      ],
    },
  },

  {
    // SPIN BUTTON: the title carries a trailing [tag] that is the button icon —
    // move it into "icon" (brackets stripped) and keep the title clean. The
    // rule becomes the body. When no image is uploaded for that icon name the
    // Bridge reserves a placeholder box, so the layout never collapses.
    label: 'spin_button — trailing [tag] in the title becomes the icon; rule becomes body',
    input: [
      'PAGE 13 | TITLE | SPIN BUTTON [SPIN BUTTON]',
      'PAGE 13 | RULE | ．PRESS SPIN BUTTON CAN BE USED TO START THE BASE GAME, START THE FREE GAMES FEATURE AND RANDOMLY SELECT A [金幣] IN THE JACKPOT FEATURE.',
    ].join('\n'),
    output: {
      id: 'PAGE_13',
      type: 'spin_button',
      title: 'SPIN BUTTON',
      icon: 'SPIN BUTTON',
      body: '．PRESS SPIN BUTTON CAN BE USED TO START THE BASE GAME, START THE FREE GAMES FEATURE AND RANDOMLY SELECT A [金幣] IN THE JACKPOT FEATURE.',
    },
  },
];

// Renders the examples into a prompt section. Returns '' when there are none.
export function buildExamplesPrompt() {
  if (!EXAMPLES.length) return '';
  let p = '\nLEARNED EXAMPLES — reproduce this exact input→output mapping for similar pages:\n\n';
  for (const ex of EXAMPLES) {
    p += `--- ${ex.label} ---\n`;
    p += `INPUT (parsed spreadsheet text):\n${ex.input}\n`;
    p += `CORRECT OUTPUT (one page object, no "|" characters):\n${JSON.stringify(ex.output)}\n\n`;
  }
  return p;
}
