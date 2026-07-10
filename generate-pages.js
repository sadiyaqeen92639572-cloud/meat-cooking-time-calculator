/* Meat Cooking Time Calculator — page generator
 * Emits Tier 1 (meat hubs), Tier 2 (cuts), Tier 3 (weight pages), Tier 4 (informational)
 * + rebuilds sitemap.xml. Homepage index.html is hand-written (shares the same MEATS model).
 * Run:  node generate-pages.js
 */
const fs = require('fs');
const path = require('path');

// ── Change this one line when the real domain is bought (also add a CNAME file) ──
const SITE_URL = 'https://cookingmeatcalculator.com';
const AMAZON_TAG = 'YOURTAG-21'; // TODO: replace before going live
const TODAY = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────
// COOKING DATA MODEL — guidance from standard UK roasting guides
// (BBC Good Food / Waitrose / butchers'). Guidance, NOT a food-safety
// authority — a meat thermometer is the final check.
// per500 = minutes per 500 g · base = fixed offset min · range = [lo,hi] per 500 g
// ─────────────────────────────────────────────────────────────
const MEATS = {
  beef: {
    label: 'Beef', dishLabel: 'roast beef', slug: 'roast-beef-cooking-time-calculator', emoji: '🥩',
    mode: 'doneness', defaultDoneness: 'medium',
    ovenC: 180, ovenConvC: 190, ovenF: 350, restMin: 15,
    sear: { tempC: 220, tempF: 425, min: 20 },
    doneness: {
      rare:   { label: 'Rare',        per500: 20, base: 20, range: [15, 20], internalC: 52, internalF: 126 },
      medium: { label: 'Medium',      per500: 25, base: 25, range: [20, 25], internalC: 60, internalF: 140 },
      well:   { label: 'Well done',   per500: 30, base: 30, range: [25, 30], internalC: 70, internalF: 158 },
    },
    note: 'Sear at 220°C for 20 min, then reduce to 180°C for the rest. Rest loosely covered 15–20 min before carving.',
  },
  lamb: {
    label: 'Lamb', dishLabel: 'leg of lamb', slug: 'leg-of-lamb-cooking-time-calculator', emoji: '🐑',
    mode: 'doneness', defaultDoneness: 'medium',
    ovenC: 180, ovenConvC: 190, ovenF: 350, restMin: 15,
    sear: { tempC: 220, tempF: 425, min: 20 },
    doneness: {
      rare:   { label: 'Pink / rare', per500: 20, base: 20, range: [15, 20], internalC: 55, internalF: 131 },
      medium: { label: 'Medium',      per500: 25, base: 25, range: [20, 25], internalC: 60, internalF: 140 },
      well:   { label: 'Well done',   per500: 30, base: 30, range: [25, 30], internalC: 70, internalF: 158 },
    },
    note: 'Sear hot then reduce to 180°C. Lamb is best pink (60°C). Rest 15 min before carving.',
  },
  pork: {
    label: 'Pork', dishLabel: 'roast pork', slug: 'roast-pork-cooking-time-calculator', emoji: '🐖',
    mode: 'single', restMin: 15,
    ovenC: 180, ovenConvC: 190, ovenF: 350,
    sear: { tempC: 220, tempF: 425, min: 25 },
    single: { label: 'Cooked through', per500: 30, base: 30, range: [30, 35], internalC: 71, internalF: 160 },
    note: 'For crackling: blast at 220°C for 25 min, then 180°C. Internal 71°C. Rest 15 min.',
  },
  chicken: {
    label: 'Chicken', dishLabel: 'chicken', slug: 'roast-chicken-cooking-time-calculator', emoji: '🐔',
    mode: 'single', restMin: 15,
    ovenC: 180, ovenConvC: 200, ovenF: 375,
    single: { label: 'Cooked through', per500: 20, base: 20, range: [18, 22], internalC: 74, internalF: 165 },
    note: 'Roast at 180°C fan. Juices must run clear and the thickest part reach 74°C. Rest 15 min.',
  },
  gammon: {
    label: 'Gammon', dishLabel: 'gammon', slug: 'roast-pork-cooking-time-calculator', emoji: '🍖',
    mode: 'single', restMin: 15,
    ovenC: 180, ovenConvC: 190, ovenF: 350,
    single: { label: 'Cooked through', per500: 20, base: 20, range: [18, 22], internalC: 68, internalF: 154 },
    note: 'Simmer 20 min per 500 g, or roast in foil then glaze uncovered at 200°C for the last 20 min.',
  },
};

// ─────────────────────────────────────────────────────────────
// TIER 1 — meat hubs (built from MEATS)
// ─────────────────────────────────────────────────────────────
const HUBS = [
  { key: 'beef', title: 'Roast Beef Cooking Time Calculator', h1: 'Roast Beef Cooking Time Calculator',
    keywords: 'roast beef cooking time calculator, beef roast time calculator, beef roasting times calculator, roast beef roasting time calculator, beef roast calculator, roast beef cooking time per kg, roast beef cooking time chart',
    intro: 'Enter the weight of your beef joint and how you like it done — get the exact roasting time, oven temperature and internal target temperature. Based on standard UK roasting times.' },
  { key: 'lamb', title: 'Leg of Lamb Cooking Time Calculator', h1: 'Leg of Lamb Cooking Time Calculator',
    keywords: 'leg of lamb cooking time calculator, leg of lamb cooking times calculator, lamb leg cooking time calculator, lamb cooking time calculator, leg of lamb cooking time per kg, calculate lamb cooking time',
    intro: 'Enter the weight of your leg of lamb and doneness — get the exact cooking time, oven temperature and resting time. Covers bone-in, boneless, half-leg and slow-roast.' },
  { key: 'pork', title: 'Roast Pork Cooking Time Calculator', h1: 'Roast Pork Cooking Time Calculator',
    keywords: 'roast pork cooking time calculator, pork roast cooking time calculator, pork cooking time calculator, roast pork cooking time per kg, pork loin cooking time, roast pork loin cooking time',
    intro: 'Enter the weight of your pork joint — get the exact roasting time, crackling method, oven temperature and internal target temperature.' },
  { key: 'chicken', title: 'Roast Chicken Cooking Time Calculator', h1: 'Roast Chicken Cooking Time Calculator',
    keywords: 'chicken cooking time calculator, chicken cooking times calculator, roast chicken cooking time calculator, whole chicken cooking time calculator, chicken cooking time calculator kg, how long to cook a 2kg chicken',
    intro: 'Enter the weight of your whole chicken — get the exact roasting time, oven temperature and the safe internal temperature. Works for any size bird.' },
];

// ─────────────────────────────────────────────────────────────
// TIER 2 — cut-specific pages. mode 'inherit' uses the meat doneness model;
// otherwise a single explicit `cook` block (slow / pulled / fast cuts).
// ─────────────────────────────────────────────────────────────
const CUTS = [
  // LAMB
  { meat: 'lamb', slug: 'boneless-leg-of-lamb-cooking-time-calculator', cut: 'Boneless leg of lamb',
    kw: 'boneless leg of lamb cooking time calculator', mode: 'inherit',
    note: 'A boneless (rolled) leg cooks slightly faster than bone-in and is far easier to carve. Sear then 180°C.' },
  { meat: 'lamb', slug: 'slow-roast-leg-of-lamb-cooking-time-calculator', cut: 'Slow-roast leg of lamb',
    kw: 'slow roast leg of lamb cooking time calculator',
    cook: { label: 'Falling-off-the-bone', per500: 60, base: 30, range: [55, 70], ovenC: 150, ovenConvC: 160, ovenF: 300, internalC: 92, internalF: 198, restMin: 20 },
    note: 'Low & slow at 150°C for meltingly tender lamb — around 1 hour per 500 g. Internal 90°C+ so it pulls apart.' },
  { meat: 'lamb', slug: 'shoulder-of-lamb-cooking-time-calculator', cut: 'Shoulder of lamb',
    kw: 'shoulder of lamb cooking time calculator, lamb shoulder cooking time calculator',
    cook: { label: 'Slow-roasted, pulls apart', per500: 60, base: 30, range: [55, 70], ovenC: 160, ovenConvC: 170, ovenF: 325, internalC: 90, internalF: 194, restMin: 20 },
    note: 'Shoulder is fattier than leg — slow-roast at 160°C until it pulls apart with a fork.' },
  { meat: 'lamb', slug: 'half-leg-of-lamb-cooking-time-calculator', cut: 'Half leg of lamb',
    kw: 'half leg of lamb cooking time calculator', mode: 'inherit',
    weights: [0.8, 1, 1.2, 1.5], note: 'A half leg is typically 0.8–1.5 kg. Same times per 500 g as a full leg.' },
  { meat: 'lamb', slug: 'roast-leg-of-lamb-cooking-time-calculator', cut: 'Roast leg of lamb',
    kw: 'roast leg of lamb cooking time calculator, roast lamb cooking time calculator, lamb roast cooking time calculator', mode: 'inherit',
    note: 'The classic bone-in roast leg of lamb. Best served pink at 60°C.' },
  { meat: 'lamb', slug: 'rack-of-lamb-cooking-time-calculator', cut: 'Rack of lamb',
    kw: 'rack of lamb cooking time by weight',
    cook: { label: 'Pink', per500: 25, base: 8, range: [20, 30], ovenC: 200, ovenConvC: 210, ovenF: 400, internalC: 58, internalF: 136, restMin: 8 },
    weights: [0.4, 0.5, 0.6, 0.8], note: 'Small and quick — sear the fat, then roast hot at 200°C. Best pink.' },
  { meat: 'lamb', slug: 'butterflied-leg-of-lamb-cooking-time-calculator', cut: 'Butterflied leg of lamb',
    kw: 'butterflied leg of lamb cooking time calculator',
    cook: { label: 'Pink', per500: 15, base: 10, range: [12, 20], ovenC: 200, ovenConvC: 210, ovenF: 400, internalC: 58, internalF: 136, restMin: 10 },
    weights: [1, 1.5, 2], note: 'Boned and opened flat, it cooks much faster — great for the BBQ or a hot oven.' },
  // BEEF
  { meat: 'beef', slug: 'beef-brisket-cooking-time-calculator', cut: 'Beef brisket',
    kw: 'beef brisket cooking time calculator, brisket calculator',
    cook: { label: 'Low & slow, tender', per500: 75, base: 30, range: [60, 90], ovenC: 150, ovenConvC: 160, ovenF: 300, internalC: 90, internalF: 194, restMin: 30 },
    weights: [1.5, 2, 2.5, 3, 4], note: 'Brisket needs long, low cooking (150°C) to break down — around 1¼ hours per 500 g. Rest 30 min.' },
  { meat: 'beef', slug: 'silverside-beef-cooking-time-calculator', cut: 'Silverside beef',
    kw: 'temperature for silverside beef, silverside cooking time',
    cook: { label: 'Medium, pot-roast', per500: 30, base: 30, range: [25, 35], ovenC: 160, ovenConvC: 170, ovenF: 325, internalC: 65, internalF: 149, restMin: 20 },
    note: 'A lean pot-roasting joint — cook covered with a little liquid at 160°C to keep it moist.' },
  { meat: 'beef', slug: 'fore-rib-of-beef-cooking-time-calculator', cut: 'Fore rib of beef',
    kw: 'fore rib of beef cooking times calculator, rib of beef cooking time', mode: 'inherit',
    weights: [1.5, 2, 2.5, 3, 4], note: 'The king of roasts. Sear at 220°C, then 180°C. On the bone it stays juicier.' },
  { meat: 'beef', slug: 'topside-beef-cooking-time-calculator', cut: 'Topside beef',
    kw: 'topside beef cooking time, roast beef cooking time', mode: 'inherit',
    note: 'A lean, affordable roasting joint — do not overcook. Best medium-rare, rested well.' },
  // PORK
  { meat: 'pork', slug: 'pork-loin-cooking-time-calculator', cut: 'Pork loin',
    kw: 'pork loin cooking time calculator, roast pork loin cooking time, 2kg pork loin cooking time, pork loin joint cooking time calculator', mode: 'inherit',
    note: 'Roast pork loin: blast for crackling, then 180°C. Internal 71°C, rest 15 min.' },
  { meat: 'pork', slug: 'pork-shoulder-cooking-time-calculator', cut: 'Pork shoulder',
    kw: 'pork shoulder cooking time calculator',
    cook: { label: 'Slow-roasted, pulls apart', per500: 65, base: 30, range: [55, 75], ovenC: 160, ovenConvC: 170, ovenF: 325, internalC: 90, internalF: 194, restMin: 20 },
    weights: [1.5, 2, 2.5, 3], note: 'Slow-roast at 160°C for pulled pork. Around 1 hour+ per 500 g until it shreds.' },
  { meat: 'pork', slug: 'pork-belly-cooking-time-calculator', cut: 'Pork belly',
    kw: 'pork belly cooking time calculator, cooking time for pork belly by weight',
    cook: { label: 'Slow then crisp', per500: 60, base: 30, range: [50, 70], ovenC: 160, ovenConvC: 170, ovenF: 325, internalC: 85, internalF: 185, restMin: 15 },
    weights: [1, 1.5, 2], note: 'Slow at 160°C to render the fat, then blast at 220°C to crisp the crackling.' },
  { meat: 'pork', slug: 'pork-tenderloin-cooking-time-calculator', cut: 'Pork tenderloin',
    kw: 'pork tenderloin cooking time calculator',
    cook: { label: 'Just cooked, juicy', per500: 25, base: 8, range: [20, 30], ovenC: 200, ovenConvC: 210, ovenF: 400, internalC: 63, internalF: 145, restMin: 8 },
    weights: [0.4, 0.5, 0.6, 0.8], note: 'The leanest, fastest pork cut — sear then hot-roast to 63°C and rest. Do not overcook.' },
  { meat: 'pork', slug: 'pulled-pork-cooking-time-calculator', cut: 'Pulled pork',
    kw: 'pulled pork cooking time calculator',
    cook: { label: 'Shreds with a fork', per500: 90, base: 30, range: [80, 100], ovenC: 150, ovenConvC: 160, ovenF: 300, internalC: 92, internalF: 198, restMin: 30 },
    weights: [1.5, 2, 2.5, 3], note: 'Very low & slow at 150°C — around 1½ hours per 500 g until it pulls apart at 90°C+.' },
  { meat: 'pork', slug: 'pork-joint-cooking-time-calculator', cut: 'Pork joint',
    kw: 'pork joint cooking time calculator, roast pork cooking time calculator oven', mode: 'inherit',
    note: 'Any boned or rolled pork joint — blast for crackling, then 180°C to 71°C internal.' },
  { meat: 'pork', slug: 'leg-of-pork-cooking-time-calculator', cut: 'Leg of pork',
    kw: 'leg of pork cooking time calculator, pork leg cooking time calculator, roast leg of pork cooking time calculator', mode: 'inherit',
    note: 'A large lean joint — great crackling. Blast then 180°C, internal 71°C.' },
  { meat: 'gammon', slug: 'gammon-cooking-times-calculator', cut: 'Gammon',
    kw: 'gammon cooking times, ham cooking calculator, gammon cooking time calculator', mode: 'inherit',
    note: 'Simmer 20 min per 500 g, or foil-roast then glaze uncovered. Internal 68°C.' },
  { meat: 'pork', slug: 'slow-roast-pork-cooking-time-calculator', cut: 'Slow roast pork',
    kw: 'slow roast pork cooking time calculator',
    cook: { label: 'Meltingly tender', per500: 60, base: 30, range: [55, 70], ovenC: 150, ovenConvC: 160, ovenF: 300, internalC: 88, internalF: 190, restMin: 20 },
    weights: [1.5, 2, 2.5, 3], note: 'Low & slow at 150°C for tender pork — finish hot for crackling.' },
  // CHICKEN
  { meat: 'chicken', slug: 'whole-chicken-cooking-time-calculator', cut: 'Whole chicken',
    kw: 'whole chicken cooking time calculator, how long to cook whole chicken', mode: 'inherit',
    note: 'Roast at 180°C fan — 20 min per 500 g plus 20 min. Internal 74°C in the thickest part.' },
  { meat: 'chicken', slug: 'spatchcock-chicken-cooking-time-calculator', cut: 'Spatchcock chicken',
    kw: 'spatchcock chicken cooking time calculator',
    cook: { label: 'Cooked through', per500: 15, base: 10, range: [12, 18], ovenC: 200, ovenConvC: 210, ovenF: 400, internalC: 74, internalF: 165, restMin: 10 },
    weights: [1.2, 1.5, 1.8, 2], note: 'Flattened, it cooks ~30% faster and more evenly — roast hot at 200°C.' },
  { meat: 'chicken', slug: 'chicken-crown-cooking-time-calculator', cut: 'Chicken crown',
    kw: 'chicken crown cooking time calculator',
    cook: { label: 'Cooked through', per500: 20, base: 20, range: [18, 22], ovenC: 190, ovenConvC: 200, ovenF: 375, internalC: 74, internalF: 165, restMin: 15 },
    weights: [0.8, 1, 1.2, 1.5], note: 'A crown is the breast on the bone (legs removed) — cooks a little faster than a whole bird.' },
  { meat: 'chicken', slug: 'stuffed-chicken-cooking-time-calculator', cut: 'Stuffed chicken',
    kw: 'stuffed chicken cooking time calculator',
    cook: { label: 'Cooked through', per500: 20, base: 30, range: [18, 24], ovenC: 180, ovenConvC: 190, ovenF: 350, internalC: 74, internalF: 165, restMin: 15 },
    weights: [1.5, 1.8, 2, 2.5], note: 'Stuffing adds weight and slows heat — add ~30 min and check the stuffing reaches 74°C too.' },
];

// ─────────────────────────────────────────────────────────────
// TIER 3 — weight pages per hub
// ─────────────────────────────────────────────────────────────
const WEIGHT_STEPS = {
  beef: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
  lamb: [1, 1.5, 2, 2.5, 3],
  pork: [1, 1.5, 2, 2.5, 3],
  chicken: [1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.5],
};

// US market — pound-based weight steps per hub (mirrors WEIGHT_STEPS, common lb sizes)
const LB_STEPS = {
  beef: [3, 4, 5, 6, 7, 8],
  lamb: [3, 4, 5, 6, 7],
  pork: [3, 4, 5, 6, 7, 8],
  chicken: [3, 4, 5, 6, 7, 8],
};

// ─────────────────────────────────────────────────────────────
// LOCALES — UK (root, kg/°C) and US (/us/, lb/°F). One data model,
// two fully separate mirror sites. No unit mixing on any page.
// ─────────────────────────────────────────────────────────────
const LB_PER_KG = 2.20462;
const LOCALES = {
  uk: { id: 'uk', prefix: '', lang: 'en-GB', currency: 'GBP', amazon: 'amazon.co.uk',
        unit: 'kg', tempF: false, steps: WEIGHT_STEPS, guideSrc: 'UK roasting guides', region: 'UK' },
  us: { id: 'us', prefix: 'us/', lang: 'en-US', currency: 'USD', amazon: 'amazon.com',
        unit: 'lb', tempF: true, steps: LB_STEPS, guideSrc: 'US roasting guides', region: 'US' },
};
// weight (in locale unit) → kilograms for the underlying formula
function toKg(w, loc) { return loc.unit === 'lb' ? w / LB_PER_KG : w; }
// temperature pair rendered locale-first
function tempPair(c, f, loc) { return loc.tempF ? `${f}°F / ${c}°C` : `${c}°C / ${f}°F`; }
// primary oven temp for a locale (used in prose)
function ovenPrimary(m, loc) { return loc.tempF ? `${m.ovenF}°F` : `${m.ovenC}°C fan`; }
// minutes-per-unit label
function perUnit(per500, loc) { return loc.unit === 'lb' ? `${fmtTime(per500 * 2 / LB_PER_KG)}/lb` : `${fmtTime(per500 * 2)}/kg`; }
// integer minutes per single unit (kg or lb)
function unitMin(per500, loc) { return loc.unit === 'lb' ? Math.round(per500 * 2 / LB_PER_KG) : per500 * 2; }
// internal temp value in the locale's primary unit
function internalPrimary(c, f, loc) { return loc.tempF ? `${f}°F` : `${c}°C`; }

// ─────────────────────────────────────────────────────────────
// TIER 4 — informational pages (content + reference tables + funnel to a calculator)
// ─────────────────────────────────────────────────────────────
const INFO = [
  {
    slug: 'how-long-to-cook-chicken-breast-in-the-oven', h1: 'How Long to Cook a Chicken Breast in the Oven',
    kw: 'how long to cook a chicken breast in the oven, how long to cook chicken breast, baked chicken breast time',
    desc: 'Boneless chicken breasts take 18–22 minutes at 200°C (fan 180°C). Full oven times by temperature, plus the safe internal temperature (74°C).',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'A boneless, skinless chicken breast (around 180 g) takes <strong>18–22 minutes at 200°C</strong> (fan 180°C / 400°F). It is done when the thickest part reaches <strong>74°C</strong> and the juices run clear. Bone-in breasts take a little longer.',
    table: { title: 'Chicken breast oven times by temperature', head: ['Oven temp', 'Boneless breast (~180 g)', 'Bone-in breast'],
      rows: [['160°C / 325°F', '30–35 min', '40–45 min'], ['180°C / 350°F (fan 160°C)', '22–26 min', '30–35 min'], ['200°C / 400°F (fan 180°C)', '18–22 min', '25–30 min'], ['220°C / 425°F', '15–18 min', '22–26 min']] },
    faq: [
      ['What temperature should a chicken breast be inside?', 'A cooked chicken breast must reach an internal temperature of <strong>74°C (165°F)</strong> at its thickest point. Use a meat thermometer — colour is not a reliable guide.'],
      ['How long to bake a chicken breast at 180°C?', 'A boneless chicken breast takes about <strong>22–26 minutes at 180°C</strong> (fan 160°C). Bone-in breasts take 30–35 minutes.'],
      ['How do I stop chicken breast drying out?', 'Do not overcook — pull it at 74°C and rest 5 minutes. Brining, or cooking at a slightly lower temperature, also helps keep it juicy.'],
    ],
  },
  {
    slug: 'roast-chicken-internal-temperature', h1: 'Roast Chicken Internal Temperature',
    kw: 'roast chicken internal temperature, chicken internal temp, safe chicken temperature',
    desc: 'Roast chicken is safely cooked at an internal temperature of 74°C (165°F) in the thickest part of the thigh. Full temperature guide in °C and °F.',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'Chicken is safely cooked when the thickest part of the thigh (not touching bone) reaches <strong>74°C (165°F)</strong>. The UK Food Standards Agency advises 70°C held for 2 minutes as equivalent. A meat thermometer is the only reliable check.',
    table: { title: 'Chicken doneness temperatures', head: ['Check', 'Temperature', 'Notes'],
      rows: [['Safe (FSA equivalent)', '70°C for 2 min', 'Minimum safe cooking'], ['Recommended target', '74°C / 165°F', 'Thickest part of thigh'], ['Breast, juicy', '72–74°C', 'Rest to carry over'], ['Overcooked / dry', '82°C+', 'Avoid']] },
    faq: [
      ['What temp is chicken done in Celsius?', 'Chicken is done at <strong>74°C (165°F)</strong>. In the UK, 70°C held for 2 minutes is considered equivalent for safety.'],
      ['Where do I put the thermometer in a chicken?', 'Into the thickest part of the thigh, close to but not touching the bone. This is the slowest part to cook.'],
      ['Is chicken safe at 70°C?', 'Yes — 70°C held for 2 minutes kills harmful bacteria. Many cooks aim for 74°C for a safety margin without drying the bird.'],
    ],
  },
  {
    slug: 'chicken-temperature-celsius', h1: 'Chicken Temperature in Celsius — Safe Cooking Guide',
    kw: 'chicken temperature celsius, cooked chicken temp celsius, chicken done temperature c',
    desc: 'Cooked chicken should reach 74°C in Celsius (165°F). Simple °C temperature guide for whole birds, breasts, thighs and drumsticks.',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'In Celsius, cooked chicken should reach <strong>74°C</strong> in the thickest part (165°F). The UK FSA accepts <strong>70°C held for 2 minutes</strong> as equivalent. Always measure with a thermometer rather than judging by colour.',
    table: { title: 'Chicken cut temperatures (°C)', head: ['Cut', 'Target °C', 'Target °F'],
      rows: [['Whole chicken (thigh)', '74°C', '165°F'], ['Breast', '72–74°C', '162–165°F'], ['Thigh / drumstick', '75–80°C', '167–176°F'], ['Minced chicken', '74°C', '165°F']] },
    faq: [
      ['What is cooked chicken temperature in Celsius?', 'Cooked chicken should reach <strong>74°C</strong> (165°F) in the thickest part.'],
      ['Is 75°C ok for chicken?', 'Yes — 75°C is safely cooked. Thighs are often taken to 75–80°C as they stay moist and become more tender.'],
    ],
  },
  {
    slug: 'what-temp-to-cook-chicken-in-the-oven', h1: 'What Temperature to Cook Chicken in the Oven',
    kw: 'what temp to cook chicken in oven, oven temperature for chicken, best temp to roast chicken',
    desc: 'Roast a whole chicken at 180°C fan (200°C conventional / 375–400°F). Chicken breasts do best at 200°C. Full oven temperature guide.',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'Roast a whole chicken at <strong>180°C fan (200°C conventional / 400°F)</strong> — about 20 minutes per 500 g plus 20 minutes. Chicken pieces and breasts do best a little hotter at 200°C fan. Whatever the temperature, cook to <strong>74°C</strong> internal.',
    table: { title: 'Oven temperature guide for chicken', head: ['What', 'Fan', 'Conventional', 'Fahrenheit'],
      rows: [['Whole chicken', '180°C', '200°C', '400°F'], ['Chicken breast', '180°C', '200°C', '400°F'], ['Chicken thighs', '190°C', '210°C', '410°F'], ['Crispy skin blast (last 10 min)', '200°C', '220°C', '425°F']] },
    faq: [
      ['Is it better to roast chicken at 180 or 200?', 'A whole chicken roasts well at 180°C fan (200°C conventional). 200°C fan gives crisper skin but watch it does not dry out — always cook to 74°C internal.'],
      ['What temperature for crispy chicken skin?', 'Finish at 200–220°C for the last 10 minutes, or start high then reduce. Dry the skin first for the best crisp.'],
    ],
  },
  {
    slug: 'how-to-prepare-pork', h1: 'How to Prepare Pork for Roasting',
    kw: 'how to prepare pork, how to prepare pork for roasting, preparing pork joint',
    desc: 'How to prepare a pork joint for roasting: scoring the rind, drying and salting for crackling, seasoning and the right internal temperature (71°C).',
    funnel: 'roast-pork-cooking-time-calculator', funnelLabel: 'Roast Pork Calculator',
    lead: 'Great roast pork starts with preparation. Score the rind, dry it well, salt it for crackling, and bring the joint to room temperature before roasting. Cook to an internal temperature of <strong>71°C</strong>.',
    table: { title: 'Pork preparation steps', head: ['Step', 'What to do', 'Why'],
      rows: [['1. Score the rind', 'Deep cuts ~1 cm apart, not into the meat', 'Lets fat render → crackling'], ['2. Dry the skin', 'Pat dry, leave uncovered in the fridge', 'Dry skin crisps up'], ['3. Salt', 'Rub salt into the rind before roasting', 'Draws out moisture, seasons'], ['4. Come to room temp', 'Rest out of the fridge 30–60 min', 'Even cooking'], ['5. Blast then roast', '220°C for 25 min, then 180°C', 'Crackling + tender meat']] },
    faq: [
      ['How do I get good crackling?', 'Score the rind, dry it thoroughly, rub with salt, and start roasting at a high heat (220°C) for 25 minutes before reducing to 180°C.'],
      ['What temperature should pork be cooked to?', 'Pork should reach an internal temperature of <strong>71°C (160°F)</strong>. A little pink is fine for whole cuts once rested.'],
      ['Should I cover pork when roasting?', 'Leave it uncovered so the crackling can crisp. Only cover if the meat is browning too fast, and never cover the rind.'],
    ],
  },
  {
    slug: 'best-way-to-roast-pork-loin', h1: 'The Best Way to Roast a Pork Loin',
    kw: 'best way to roast pork loin, roast pork loin cooking time, pork loin roast',
    desc: 'The best way to roast a pork loin: high-heat blast for crackling, then 180°C at 30 min per 500 g to an internal temperature of 71°C.',
    funnel: 'pork-loin-cooking-time-calculator', funnelLabel: 'Pork Loin Calculator',
    lead: 'Roast a pork loin by blasting it at <strong>220°C for 25 minutes</strong> for crackling, then reducing to <strong>180°C for the remaining time</strong> — about 30 minutes per 500 g total. Pull it at <strong>71°C</strong> internal and rest 15 minutes.',
    table: { title: 'Pork loin roasting times (180°C after the blast)', head: ['Weight', 'Approx total time', 'Internal temp'],
      rows: [['1 kg', '1 hr 5 min', '71°C'], ['1.5 kg', '1 hr 35 min', '71°C'], ['2 kg', '2 hr 5 min', '71°C'], ['2.5 kg', '2 hr 35 min', '71°C']] },
    faq: [
      ['How long to roast a pork loin per kg?', 'About 60 minutes per kg (30 min per 500 g) at 180°C after an initial high-heat blast, to an internal temperature of 71°C.'],
      ['Do you roast pork loin covered or uncovered?', 'Uncovered, so the crackling crisps. Cover loosely with foil only if the meat browns too quickly.'],
    ],
  },
  {
    slug: 'how-long-to-cook-roast-potatoes', h1: 'How Long to Cook Roast Potatoes',
    kw: 'how long to cook roast potatoes, roast potato cooking time, crispy roast potatoes time',
    desc: 'Roast potatoes take 45–60 minutes at 200°C fan. Parboil first, roughen the edges and use hot fat for maximum crispiness. Full timing guide.',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Dinner Calculators',
    lead: 'Roast potatoes take <strong>45–60 minutes at 200°C fan (220°C conventional)</strong>. Parboil for 8–10 minutes, drain and rough up the edges, then roast in hot fat, turning once, until deep golden and crisp.',
    table: { title: 'Roast potato timing', head: ['Stage', 'Time', 'Temp'],
      rows: [['Parboil', '8–10 min', 'Boiling water'], ['Roast (first side)', '25–30 min', '200°C fan'], ['Turn & roast', '20–30 min', '200°C fan'], ['Total in oven', '45–60 min', '200°C fan']] },
    faq: [
      ['What temperature for crispy roast potatoes?', '200°C fan (220°C conventional). The fat must be hot before the potatoes go in.'],
      ['Should I parboil roast potatoes?', 'Yes — parboiling for 8–10 minutes then roughening the edges is the key to a crisp, fluffy roast potato.'],
    ],
  },
  {
    slug: 'ingredients-for-a-roast-dinner', h1: 'Ingredients for a Roast Dinner',
    kw: 'ingredients for a roast dinner, roast dinner ingredients list, sunday roast ingredients',
    desc: 'A complete ingredients list for a classic Sunday roast dinner: the meat, roast potatoes, Yorkshire puddings, vegetables, gravy and trimmings.',
    funnel: 'roast-beef-cooking-time-calculator', funnelLabel: 'Meat Cooking Calculators',
    lead: 'A classic roast dinner brings together the roast, potatoes, Yorkshires, seasonal veg and gravy. Here is the full ingredients list to plan your Sunday roast — then use our calculators to time the meat perfectly.',
    table: { title: 'Roast dinner ingredients', head: ['Component', 'Ingredients'],
      rows: [['The roast', 'Beef, lamb, pork or chicken joint'], ['Roast potatoes', 'Maris Piper potatoes, goose fat or oil, salt'], ['Yorkshire puddings', 'Plain flour, eggs, milk, oil'], ['Vegetables', 'Carrots, parsnips, broccoli, peas, cabbage'], ['Gravy', 'Meat juices, stock, flour, red wine (optional)'], ['Trimmings', 'Stuffing, pigs in blankets, horseradish / mint / apple sauce']] },
    faq: [
      ['What do you need for a roast dinner?', 'A roasting joint, potatoes for roasting, vegetables, Yorkshire pudding batter, and stock for gravy — plus condiments to match the meat.'],
      ['What sauce goes with each roast?', 'Horseradish with beef, mint sauce with lamb, apple sauce with pork, and bread sauce or gravy with chicken.'],
    ],
  },
  {
    slug: 'roast-chicken-covered-or-uncovered', h1: 'Roast Chicken: Covered or Uncovered?',
    kw: 'roast chicken covered or uncovered, cover chicken when roasting, foil on roast chicken',
    desc: 'Roast chicken uncovered for crispy skin. Cover with foil only if it browns too fast, and uncover for the last 20 minutes. Full guide.',
    funnel: 'roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'Roast chicken <strong>uncovered</strong> so the skin crisps and browns. If it colours too quickly before it is cooked through, tent it loosely with foil, then remove the foil for the last 20 minutes to re-crisp the skin.',
    table: { title: 'Covered vs uncovered', head: ['Method', 'Result', 'When to use'],
      rows: [['Uncovered', 'Crispy, golden skin', 'Most of the roast'], ['Foil tent', 'Stops over-browning', 'If skin browns too early'], ['Uncover last 20 min', 'Re-crisps skin', 'After any covering']] },
    faq: [
      ['Should I cover a chicken with foil when roasting?', 'Start uncovered for crispy skin. Only add a loose foil tent if the skin is browning before the bird is cooked, then remove it for the last 20 minutes.'],
      ['Does covering chicken make it cook faster?', 'Covering traps steam and can speed cooking slightly, but it softens the skin. For crisp skin, roast uncovered.'],
    ],
  },
  {
    slug: 'roast-beef-cooking-time-chart', h1: 'Roast Beef Cooking Time Chart',
    kw: 'roast beef cooking time chart, roast beef cooking times, beef roasting chart, roast beef cooking times fan assisted oven',
    desc: 'Roast beef cooking time chart by weight and doneness — rare, medium and well done, in a fan-assisted oven, with internal temperatures.',
    funnel: 'roast-beef-cooking-time-calculator', funnelLabel: 'Roast Beef Calculator',
    lead: 'This roast beef cooking time chart is based on a <strong>fan oven at 180°C</strong> (after an initial 220°C sear): rare 20 min per 500 g, medium 25 min, well done 30 min — each plus a 20–30 min base. Always confirm with a thermometer.',
    table: { title: 'Roast beef times (fan 180°C)', head: ['Weight', 'Rare (52°C)', 'Medium (60°C)', 'Well (70°C)'],
      rows: [['1 kg', '1 hr', '1 hr 15 min', '1 hr 30 min'], ['1.5 kg', '1 hr 20 min', '1 hr 40 min', '2 hr'], ['2 kg', '1 hr 40 min', '2 hr 5 min', '2 hr 30 min'], ['2.5 kg', '2 hr', '2 hr 30 min', '3 hr'], ['3 kg', '2 hr 20 min', '2 hr 55 min', '3 hr 30 min']] },
    faq: [
      ['How long to cook roast beef per kg?', 'In a fan oven: about 40 min/kg for rare, 50 min/kg for medium and 60 min/kg for well done, plus a base of 20–30 minutes.'],
      ['Do fan ovens cook roast beef faster?', 'Yes — a fan oven cooks roughly 20°C hotter than conventional. Use 180°C fan (200°C conventional) for these times.'],
    ],
  },
  {
    slug: 'cooking-time-vs-temperature', h1: 'Cooking Time vs Temperature — How Roasting Works',
    kw: 'cooking time vs temperature, oven time vs temperature, how oven temperature affects cooking time',
    desc: 'How oven temperature and cooking time trade off when roasting meat — the science of low-and-slow vs hot-and-fast, and why internal temperature is what matters.',
    funnel: 'roast-beef-cooking-time-calculator', funnelLabel: 'Meat Cooking Calculators',
    lead: 'Time and temperature are two levers for the same goal: bringing the centre of the meat to a target internal temperature. A hotter oven cooks faster but risks a dry, overcooked outer layer; a lower oven cooks slowly and evenly. The <strong>internal temperature</strong>, not the clock, tells you when it is done.',
    table: { title: 'Hot-and-fast vs low-and-slow', head: ['Approach', 'Oven temp', 'Best for', 'Trade-off'],
      rows: [['Hot & fast', '200–230°C', 'Small tender cuts, crackling, crisp skin', 'Overcooked edges if left too long'], ['Standard roast', '180°C', 'Most joints', 'Balanced'], ['Low & slow', '150–160°C', 'Brisket, shoulder, pulled pork', 'Takes hours, needs planning']] },
    faq: [
      ['Is it better to cook meat low and slow or hot and fast?', 'Tender cuts (loin, breast, fillet) suit hot and fast; tough, collagen-rich cuts (brisket, shoulder) need low and slow to become tender. Both aim for a target internal temperature.'],
      ['Does a higher oven temperature always cook faster?', 'Yes, but not proportionally — too hot and the outside overcooks before the centre is done. That is why internal temperature is the reliable guide.'],
    ],
  },
  // US Fahrenheit cluster
  {
    slug: 'us/how-long-to-roast-a-chicken-at-350', h1: 'How Long to Roast a Chicken at 350°F',
    kw: 'how long to roast a chicken at 350, bake chicken at 350, chicken at 350 degrees',
    desc: 'At 350°F, roast a whole chicken about 20 minutes per pound plus 15 minutes. A 4 lb chicken takes roughly 1 hour 20 minutes to an internal 165°F.',
    funnel: '../roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'At <strong>350°F (175°C)</strong>, roast a whole chicken for about <strong>20 minutes per pound plus 15 minutes</strong>. A 4 lb bird takes roughly 1 hour 20 minutes; a 5 lb bird about 1 hour 40 minutes. Cook to an internal temperature of <strong>165°F</strong>.',
    table: { title: 'Chicken roasting times at 350°F', head: ['Weight', 'Time at 350°F', 'Internal temp'],
      rows: [['3 lb (1.4 kg)', '1 hr', '165°F'], ['4 lb (1.8 kg)', '1 hr 20 min', '165°F'], ['5 lb (2.3 kg)', '1 hr 40 min', '165°F'], ['6 lb (2.7 kg)', '2 hr', '165°F']] },
    faq: [
      ['How long to bake a whole chicken at 350?', 'About 20 minutes per pound plus 15 minutes — a 4 lb chicken takes roughly 1 hour 20 minutes at 350°F, to 165°F internal.'],
      ['Is 350°F hot enough to roast a chicken?', 'Yes. 350°F gives even cooking. For crisper skin, finish the last 10 minutes at 425°F.'],
    ],
  },
  {
    slug: 'us/how-long-to-roast-a-chicken-at-325', h1: 'How Long to Roast a Chicken at 325°F',
    kw: 'how long to roast a chicken at 325, bake chicken at 325 for how long, chicken at 325',
    desc: 'At 325°F, roast a whole chicken about 22–25 minutes per pound. A 4 lb chicken takes roughly 1 hour 30 minutes to an internal 165°F.',
    funnel: '../roast-chicken-cooking-time-calculator', funnelLabel: 'Roast Chicken Calculator',
    lead: 'At <strong>325°F (160°C)</strong>, roast a whole chicken for about <strong>22–25 minutes per pound</strong>. It cooks more gently than at 350°F, staying moist. A 4 lb bird takes roughly 1 hour 30 minutes; always cook to <strong>165°F</strong> internal.',
    table: { title: 'Chicken roasting times at 325°F', head: ['Weight', 'Time at 325°F', 'Internal temp'],
      rows: [['3 lb (1.4 kg)', '1 hr 10 min', '165°F'], ['4 lb (1.8 kg)', '1 hr 30 min', '165°F'], ['5 lb (2.3 kg)', '1 hr 55 min', '165°F'], ['6 lb (2.7 kg)', '2 hr 15 min', '165°F']] },
    faq: [
      ['How long to bake chicken at 325?', 'About 22–25 minutes per pound — a 4 lb chicken takes roughly 1 hour 30 minutes at 325°F, to 165°F internal.'],
      ['Is it better to roast chicken at 325 or 350?', '325°F cooks more gently and keeps the bird moist; 350°F is a little faster with crisper skin. Both must reach 165°F inside.'],
    ],
  },
];

// ═════════════════════════════════════════════════════════════
// SHARED RENDERING
// ═════════════════════════════════════════════════════════════
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --brand:#b3541e; --brand-dark:#7a3410; --brand-light:#fbeee4; --accent:#c0392b; --text:#241a12; --muted:#7a6a5c; --border:#eaded3; --bg:#faf6f1; --radius:12px; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--text); background:var(--bg); font-size:16px; line-height:1.65; }
header { background:linear-gradient(135deg,var(--brand-dark) 0%,var(--brand) 100%); color:#fff; padding:52px 20px 88px; text-align:center; }
header .badge { display:inline-block; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); border-radius:20px; padding:4px 14px; font-size:.78rem; font-weight:600; letter-spacing:.4px; margin-bottom:16px; }
header h1 { font-size:clamp(1.4rem,4vw,2.1rem); font-weight:800; margin-bottom:12px; }
header p { color:rgba(255,255,255,.92); font-size:1rem; max-width:600px; margin:0 auto; }
.container { max-width:840px; margin:0 auto; padding:0 20px; }
.tool-wrapper { margin:-56px auto 48px; }
.tool-card { background:#fff; border-radius:var(--radius); box-shadow:0 8px 40px rgba(122,52,16,.14); border:1px solid var(--border); padding:32px 28px; }
@media (max-width:580px){ .tool-card{ padding:22px 16px; } }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:580px){ .form-grid{ grid-template-columns:1fr; } }
.form-group { display:flex; flex-direction:column; gap:6px; }
.form-group.full { grid-column:1 / -1; }
label { font-size:.79rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; }
select, input[type=number] { border:2px solid var(--border); border-radius:8px; padding:12px 14px; font-size:1rem; color:var(--text); background:#fff; width:100%; }
select:focus, input[type=number]:focus { outline:none; border-color:var(--brand); }
.seg { display:flex; gap:8px; flex-wrap:wrap; }
.seg button { flex:1; min-width:70px; padding:10px 8px; border:2px solid var(--border); background:#fff; border-radius:8px; font-size:.9rem; font-weight:600; cursor:pointer; color:var(--text); }
.seg button.active { background:var(--brand); color:#fff; border-color:var(--brand); }
.calc-btn { width:100%; margin-top:22px; padding:17px; background:var(--brand); color:#fff; border:none; border-radius:10px; font-size:1.08rem; font-weight:700; cursor:pointer; letter-spacing:.2px; }
.calc-btn:hover { background:var(--brand-dark); }
.result { display:none; margin-top:26px; }
.result-hero { background:linear-gradient(135deg,var(--brand-dark),var(--brand)); border-radius:10px; padding:26px; color:#fff; text-align:center; margin-bottom:14px; }
.result-hero .rl { font-size:.76rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; opacity:.85; margin-bottom:4px; }
.result-hero .ra { font-size:2.5rem; font-weight:900; line-height:1.1; }
.result-hero .rs { font-size:.9rem; opacity:.9; margin-top:6px; }
.result-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
@media (max-width:480px){ .result-grid{ grid-template-columns:1fr 1fr; } }
.r-stat { background:var(--brand-light); border-radius:8px; padding:14px; text-align:center; }
.r-stat .sv { font-size:1.2rem; font-weight:800; color:var(--brand-dark); }
.r-stat .sl { font-size:.72rem; color:var(--muted); margin-top:2px; }
.therm-notice { background:#fff8ec; border:1px solid #f4d999; border-radius:8px; padding:11px 14px; font-size:.82rem; color:#7a4a10; }
.content { padding-bottom:64px; }
h2.st { font-size:1.3rem; font-weight:800; margin:48px 0 16px; }
h3.sub { font-size:1rem; font-weight:700; margin:24px 0 10px; }
p { color:#3d2f24; margin-bottom:14px; line-height:1.75; }
.data-table { width:100%; border-collapse:collapse; margin:18px 0; font-size:.88rem; }
.data-table th { background:var(--brand); color:#fff; padding:10px 14px; text-align:left; font-weight:600; }
.data-table td { padding:10px 14px; border-bottom:1px solid var(--border); }
.data-table tr:nth-child(even) td { background:#fdf8f3; }
.hl { font-weight:700; color:var(--brand-dark); }
.link-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin:18px 0; }
.link-card { display:block; background:#fff; border:1px solid var(--border); border-radius:8px; padding:12px 14px; text-decoration:none; color:var(--text); font-size:.88rem; font-weight:600; }
.link-card:hover { border-color:var(--brand); color:var(--brand-dark); }
.link-card .sub { font-size:.72rem; color:var(--muted); font-weight:400; margin-top:2px; }
.cta-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:44px 0; }
@media (max-width:580px){ .cta-grid{ grid-template-columns:1fr; } }
.cta-card { background:var(--brand-dark); color:#fff; border-radius:var(--radius); padding:26px 22px; }
.cta-card h3 { color:#fff; font-size:1.05rem; margin-bottom:10px; }
.cta-card p { color:rgba(255,255,255,.88); font-size:.86rem; margin-bottom:16px; }
.cta-btn-white { display:block; background:#fff; color:var(--brand-dark); text-align:center; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:700; font-size:.9rem; }
.cta-btn-gold { display:block; background:#f0a020; color:#241a12; text-align:center; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:700; font-size:.9rem; }
.method { background:#fff; border:1px solid var(--border); border-radius:12px; padding:26px 26px 18px; margin:0 0 36px; font-size:.9rem; }
.method .code { background:#2c1c10; color:#f2e3d5; border-radius:8px; padding:16px 18px; font-family:'Courier New',monospace; font-size:.82rem; line-height:1.9; margin:14px 0; overflow-x:auto; }
.method .code .k { color:#f5b971; }
.method .code .c { color:#9db98c; }
.faq-item { border-bottom:1px solid var(--border); }
.faq-q { width:100%; background:none; border:none; text-align:left; padding:17px 0; font-size:.92rem; font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center; color:var(--text); }
.faq-q::after { content:'+'; font-size:1.3rem; color:var(--brand); flex-shrink:0; margin-left:12px; }
.faq-q.open::after { content:'−'; }
.faq-a { display:none; padding:0 0 16px; font-size:.88rem; color:#4b3a2c; line-height:1.75; }
.faq-a.open { display:block; }
.back-link { display:inline-flex; align-items:center; gap:6px; color:var(--brand-dark); text-decoration:none; font-weight:600; font-size:.88rem; margin-bottom:28px; }
.adslot { border:1px dashed var(--border); border-radius:8px; padding:18px; text-align:center; color:#b3a595; font-size:.78rem; margin:32px 0; }
footer { background:#2c1c10; color:#c9b7a6; text-align:center; padding:30px 20px; font-size:.8rem; }
footer p { color:#c9b7a6; }
footer a { color:#e9d8c6; }
.disc { background:#3a2818; border-radius:8px; padding:13px 18px; margin-bottom:16px; font-size:.78rem; color:#c9b7a6; line-height:1.6; }
.locale-switch { position:sticky; top:0; z-index:200; display:flex; justify-content:center; gap:6px; padding:7px 10px; background:#2c1c10; border-bottom:1px solid rgba(255,255,255,.08); }
.ls-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 14px; border-radius:20px; font-size:.8rem; font-weight:600; text-decoration:none; color:#e9d8c6; border:1px solid rgba(255,255,255,.14); transition:all .15s; white-space:nowrap; }
.ls-btn:hover { background:rgba(255,255,255,.10); }
.ls-btn.active { background:#fff; color:#2c1c10; border-color:#fff; }
`;

// Flag switch bar (UK ↔ US) + auto-detect. Injected on every page via pageShell.
const LOCALE_SWITCH_HTML = `<div class="locale-switch"><a href="/" class="ls-btn" data-loc="uk">🇬🇧 UK · kg/°C</a><a href="/us/" class="ls-btn" data-loc="us">🇺🇸 US · lb/°F</a></div>`;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function jstr(s) { return String(s).replace(/"/g, '\\"'); }

// minutes → "1 hr 40 min"
function fmtTime(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
function total(per500, base, kg) { return per500 * (kg * 1000 / 500) + base; }

// resolve a cut's cooking config into a normalized {mode, doneness|single, oven..., internal, rest}
function cookOf(entry) {
  const m = MEATS[entry.meat];
  if (entry.cook) {
    const c = entry.cook;
    return { mode: 'single', single: { label: c.label, per500: c.per500, base: c.base, range: c.range, internalC: c.internalC, internalF: c.internalF },
      ovenC: c.ovenC, ovenConvC: c.ovenConvC, ovenF: c.ovenF, restMin: c.restMin, sear: m.sear, note: entry.note };
  }
  // inherit meat model
  return { mode: m.mode, doneness: m.doneness, single: m.single, ovenC: m.ovenC, ovenConvC: m.ovenConvC, ovenF: m.ovenF, restMin: m.restMin, sear: m.sear, defaultDoneness: m.defaultDoneness, note: entry.note || m.note };
}

// Build the interactive calculator widget markup + embedded PAGE data + shared script.
// loc drives the single display unit (kg/°C for UK, lb/°F for US) — no toggle.
function calcWidget(cfg, loc) {
  const isLb = loc.unit === 'lb';
  const defW = cfg.defaultWeight != null ? cfg.defaultWeight : (isLb ? 4 : 2);
  const PAGE = {
    mode: cfg.mode, doneness: cfg.doneness || null, single: cfg.single || null,
    ovenC: cfg.ovenC, ovenConvC: cfg.ovenConvC, ovenF: cfg.ovenF, restMin: cfg.restMin,
    defaultDoneness: cfg.defaultDoneness || (cfg.doneness ? Object.keys(cfg.doneness)[0] : null),
    fixedWeight: cfg.fixedWeight || null,
    unit: loc.unit, tempF: loc.tempF,
  };
  const donenessButtons = cfg.mode === 'doneness'
    ? `<div class="form-group full"><label>Doneness</label><div class="seg" id="doneSeg">${Object.keys(cfg.doneness).map(k => `<button type="button" data-done="${k}"${k === PAGE.defaultDoneness ? ' class="active"' : ''} onclick="pickDone(this)">${esc(cfg.doneness[k].label)}</button>`).join('')}</div></div>`
    : '';
  const weightField = cfg.fixedWeight
    ? `<input type="hidden" id="wNum" value="${cfg.fixedWeight}">`
    : `<div class="form-group"><label>Weight (${loc.unit})</label><input type="number" id="wNum" min="${isLb ? 0.5 : 0.2}" max="${isLb ? 26 : 12}" step="0.1" value="${defW}" placeholder="${isLb ? 'e.g. 4' : 'e.g. 2'}"></div>
       <div class="form-group"><label>Oven type</label><select id="ovenType"><option value="fan">Fan / convection</option><option value="conv">Conventional</option></select></div>`;
  const ovenTypeOnly = cfg.fixedWeight
    ? `<div class="form-group full"><label>Oven type</label><select id="ovenType"><option value="fan">Fan / convection</option><option value="conv">Conventional</option></select></div>`
    : '';
  return `
  <div class="tool-card">
    <div class="form-grid">
      ${weightField}
      ${ovenTypeOnly}
      ${donenessButtons}
    </div>
    <button class="calc-btn" onclick="calculate()">Calculate Cooking Time →</button>
    <div class="result" id="result">
      <div class="result-hero">
        <div class="rl">Total cooking time</div>
        <div class="ra" id="r-time"></div>
        <div class="rs" id="r-sub"></div>
      </div>
      <div class="result-grid">
        <div class="r-stat"><div class="sv" id="r-oven"></div><div class="sl">Oven temperature</div></div>
        <div class="r-stat"><div class="sv" id="r-internal"></div><div class="sl">Internal target</div></div>
        <div class="r-stat"><div class="sv" id="r-rest"></div><div class="sl">Resting time</div></div>
      </div>
      <div class="result-grid" style="margin-bottom:14px;">
        <div class="r-stat"><div class="sv" id="r-range"></div><div class="sl">Guidance range</div></div>
        <div class="r-stat"><div class="sv" id="r-ready"></div><div class="sl">Ready if in now</div></div>
        <div class="r-stat"><div class="sv" id="r-perkg"></div><div class="sl">Per ${loc.unit}</div></div>
      </div>
      <div class="therm-notice">🌡️ <strong>Always confirm with a meat thermometer.</strong> Times are guidance — the internal temperature is what makes it safe and perfect.</div>
    </div>
  </div>
  <script>
  const PAGE = ${JSON.stringify(PAGE)};
  let DONE = PAGE.defaultDoneness;
  const LB_PER_KG = 2.20462;
  function pickDone(b){ document.querySelectorAll('#doneSeg button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); DONE = b.dataset.done; }
  function fmtTime(min){ min=Math.round(min); const h=Math.floor(min/60), m=min%60; if(h===0)return m+' min'; if(m===0)return h+' hr'; return h+' hr '+m+' min'; }
  function calculate(){
    const wRaw = parseFloat(document.getElementById('wNum').value)||0;
    if(wRaw<=0){ alert('Please enter a weight in '+PAGE.unit+'.'); return; }
    const kg = PAGE.unit==='lb' ? wRaw/LB_PER_KG : wRaw;
    const oven = (document.getElementById('ovenType')||{}).value || 'fan';
    const d = PAGE.mode==='doneness' ? PAGE.doneness[DONE] : PAGE.single;
    const mid = d.per500*(kg*2)+d.base;
    const lo = d.range[0]*(kg*2)+d.base, hi = d.range[1]*(kg*2)+d.base;
    const ovenC = oven==='conv' ? PAGE.ovenConvC : PAGE.ovenC;
    const ovenF = Math.round((ovenC*9/5+32)/5)*5;
    document.getElementById('r-time').textContent = fmtTime(mid);
    document.getElementById('r-sub').textContent = (PAGE.mode==='doneness'? d.label+' · ' : '') + wRaw+' '+PAGE.unit+' · '+(oven==='conv'?'conventional':'fan')+' oven';
    document.getElementById('r-oven').textContent = PAGE.tempF ? ovenF+'°F / '+ovenC+'°C' : ovenC+'°C / '+ovenF+'°F';
    document.getElementById('r-internal').textContent = PAGE.tempF ? d.internalF+'°F / '+d.internalC+'°C' : d.internalC+'°C / '+d.internalF+'°F';
    document.getElementById('r-rest').textContent = PAGE.restMin+' min';
    document.getElementById('r-range').textContent = fmtTime(lo)+' – '+fmtTime(hi);
    document.getElementById('r-perkg').textContent = PAGE.unit==='lb' ? fmtTime((d.per500*2)/LB_PER_KG)+'/lb' : fmtTime(d.per500*2)+'/kg';
    const ready = new Date(Date.now()+mid*60000);
    document.getElementById('r-ready').textContent = ready.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    document.getElementById('result').style.display='block';
    document.getElementById('result').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function toggleFaq(b){ b.classList.toggle('open'); b.nextElementSibling.classList.toggle('open'); }
  <\/script>`;
}

// Methodology / formula block (GEO citability). cfg = resolved cook config + labels. loc = locale.
function methodBlock(cfg, label, loc) {
  const unitG = loc.unit === 'lb' ? 'lb' : '500 g';
  const perU = (per500) => loc.unit === 'lb' ? `${(per500 * 2 / LB_PER_KG).toFixed(0)} min/lb` : `${per500} min per 500 g`;
  const d = cfg.mode === 'doneness' ? cfg.doneness[cfg.defaultDoneness || Object.keys(cfg.doneness)[0]] : cfg.single;
  const searLine = cfg.sear
    ? (loc.tempF ? `${Math.round((cfg.sear.tempC * 9 / 5 + 32) / 5) * 5}°F sear for ${cfg.sear.min} min, then ${cfg.ovenF}°F` : `${cfg.sear.tempC}°C sear for ${cfg.sear.min} min, then ${cfg.ovenC}°C`)
    : (loc.tempF ? `${cfg.ovenF}°F` : `${cfg.ovenC}°C fan`);
  const rows = [];
  if (cfg.mode === 'doneness') {
    Object.keys(cfg.doneness).forEach(k => { const x = cfg.doneness[k];
      rows.push([`${x.label} — time per ${loc.unit}`, `${perU(x.per500)} (range ${x.range[0]}–${x.range[1]}/500 g)`, loc.guideSrc]);
      rows.push([`${x.label} — internal temp`, tempPair(x.internalC, x.internalF, loc), 'USDA / thermometer']);
    });
  } else {
    rows.push([`Time per ${loc.unit}`, `${perU(cfg.single.per500)} (range ${cfg.single.range[0]}–${cfg.single.range[1]}/500 g)`, loc.guideSrc]);
    rows.push([`Internal target`, tempPair(cfg.single.internalC, cfg.single.internalF, loc), 'USDA / thermometer']);
  }
  rows.push(['Base offset', `${d.base} min`, 'Standard']);
  rows.push(['Oven', searLine, 'Method']);
  rows.push(['Resting', `${cfg.restMin} min`, 'Best practice']);
  const weightExpr = loc.unit === 'lb' ? 'weight_lb × 453.592' : 'weight_g';
  const tempLine = loc.tempF ? 'derived table from °F' : 'derived table from °C';
  return `
  <h2 class="st">How This Calculator Works — Formula &amp; Method</h2>
  <div class="method">
    <p style="color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:6px;">Source: standard ${loc.region} roasting guidance · applied deterministically · verify with a thermometer</p>
    <table class="data-table"><thead><tr><th>Constant</th><th>Value</th><th>Source</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="hl">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}
    </tbody></table>
    <div class="code">
<span class="c">— ${esc(label)} cooking time —</span><br>
<span class="k">total_min</span> = min_per_500g × (${weightExpr} / 500) + base_offset<br>
<span class="k">range</span>     = [lo_per_500g … hi_per_500g] × (weight / 500) + base_offset<br>
<span class="k">conventional_oven</span> = fan_temp + 10–20°C (same time)<br>
<span class="k">${loc.tempF ? 'celsius' : 'fahrenheit'}</span> = ${tempLine}<br>
<span class="c">— algorithm —</span><br>
lookup(meat, cut, doneness) → point_estimate → guidance_range<br>
→ internal_target_temp → <span class="k">verify_with_thermometer()</span>
    </div>
    <p style="font-size:.78rem;color:var(--muted);margin:0;">Public roasting guidance applied deterministically — this is not a food-safety authority. Always cook to the stated internal temperature, measured with a meat thermometer.</p>
  </div>`;
}

function ctaBlock(loc) {
  const store = loc.amazon;
  return `
  <div class="cta-grid">
    <div class="cta-card">
      <h3>🌡️ Stop guessing — check the real temperature</h3>
      <p>A fast digital meat thermometer is the only way to know your roast is safely and perfectly cooked. Pull it at the exact internal temperature, every time.</p>
      <a href="https://www.${store}/s?k=meat+thermometer&tag=${AMAZON_TAG}" class="cta-btn-white" target="_blank" rel="noopener sponsored">See top meat thermometers →</a>
    </div>
    <div class="cta-card">
      <h3>🍳 Roasting kit that gets results</h3>
      <p>A heavy roasting pan, a leave-in probe and a sharp carving knife make a real difference to your roast.</p>
      <a href="https://www.${store}/s?k=roasting+pan+set&tag=${AMAZON_TAG}" class="cta-btn-gold" target="_blank" rel="noopener sponsored">Shop roasting equipment →</a>
    </div>
  </div>
  <div class="adslot">Advertisement</div>`;
}

function faqBlock(faq) {
  return `
  <h2 class="st">Frequently Asked Questions</h2>
  ${faq.map(f => `<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)">${esc(f[0])}</button><div class="faq-a">${f[1]}</div></div>`).join('\n  ')}`;
}

function faqJsonLd(faq) {
  return { '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1].replace(/<[^>]+>/g, '') } })) };
}
function howToJsonLd(name, loc) {
  const unitWord = loc.unit === 'lb' ? 'pounds' : 'kilograms';
  return { '@type': 'HowTo', name: `How to calculate ${name} cooking time`, step: [
    { '@type': 'HowToStep', position: 1, name: 'Enter the weight', text: `Enter the weight of your joint in ${unitWord}.` },
    { '@type': 'HowToStep', position: 2, name: 'Choose doneness and oven', text: 'Select how you like it done and whether your oven is fan or conventional.' },
    { '@type': 'HowToStep', position: 3, name: 'Read the time and temperature', text: 'The calculator shows the total time, oven temperature, internal target temperature and resting time.' },
    { '@type': 'HowToStep', position: 4, name: 'Verify with a thermometer', text: 'Cook to the stated internal temperature, confirmed with a meat thermometer.' },
  ] };
}
function webAppJsonLd(name, url, loc) {
  return { '@type': 'WebApplication', name, url, applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: loc.lang, offers: { '@type': 'Offer', price: '0', priceCurrency: loc.currency } };
}

// Slugs that exist in BOTH locales (hubs + cuts) → deep-link maps 1:1 across the switch.
const MIRROR_SLUGS_JSON = JSON.stringify([...new Set([...HUBS.map(h => MEATS[h.key].slug), ...CUTS.map(c => c.slug)])]);
const LOCALE_SWITCH_JS = `<script>(function(){
var MIRROR=${MIRROR_SLUGS_JSON};
var p=location.pathname; if(p.charAt(p.length-1)!=='/') p+='/';
var isUS=(p.indexOf('/us/')===0);
var base=(isUS?p.substring(3):p).replace(/\\/(\\d+(?:-\\d+)?)(kg|lb)\\/$/,'/');
var m=base.match(/^\\/([^\\/]+)\\/$/); var slug=m?m[1]:null;
var mapped=(base==='/')||(slug&&MIRROR.indexOf(slug)>=0);
var ukUrl=isUS?(mapped?base:'/'):p;
var usUrl=isUS?p:(mapped?'/us'+base:'/us/');
var uk=document.querySelector('.ls-btn[data-loc="uk"]');
var us=document.querySelector('.ls-btn[data-loc="us"]');
if(uk){uk.setAttribute('href',ukUrl); uk.addEventListener('click',function(){try{localStorage.setItem('mctc_loc','uk')}catch(e){}});}
if(us){us.setAttribute('href',usUrl); us.addEventListener('click',function(){try{localStorage.setItem('mctc_loc','us')}catch(e){}});}
(isUS?us:uk).classList.add('active');
try{
  var onHome=(p==='/'||p==='/us/');
  if(onHome&&!sessionStorage.getItem('mctc_geo')){
    sessionStorage.setItem('mctc_geo','1');
    var pref=null; try{pref=localStorage.getItem('mctc_loc')}catch(e){}
    var wantUS;
    if(pref){ wantUS=(pref==='us'); }
    else {
      var tz=''; try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
      wantUS=/^America\\/(New_York|Detroit|Chicago|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Nome|Adak|Menominee|Indiana|Kentucky|North_Dakota)/.test(tz)||tz==='Pacific/Honolulu';
    }
    if(wantUS&&!isUS){ location.replace('/us/'); }
    else if(!wantUS&&isUS){ location.replace('/'); }
  }
}catch(e){}
})();<\/script>`;

function pageShell({ title, desc, keywords, canonical, jsonld, body, loc }) {
  const L = loc || LOCALES.uk;
  return `<!DOCTYPE html>
<html lang="${L.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="${esc(keywords)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" type="image/png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_URL}/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld }, null, 1)}
<\/script>
<style>${CSS}</style>
</head>
<body>
${LOCALE_SWITCH_HTML}
${body}
${LOCALE_SWITCH_JS}
</body>
</html>`;
}

function footerBlock(links, loc) {
  const L = loc || LOCALES.uk;
  return `<footer><div class="container">
    <div class="disc">Cooking times are guidance compiled from standard ${L.region} roasting guides and applied deterministically — not a food-safety authority. Always cook meat to a safe internal temperature, checked with a meat thermometer.</div>
    <p>${links}</p>
  </div></footer>`;
}

// link grids — all prefixed by locale (UK = root, US = /us/)
function hubLinks(exceptKey, loc) {
  return HUBS.filter(h => h.key !== exceptKey).map(h => {
    const m = MEATS[h.key];
    return `<a class="link-card" href="/${loc.prefix}${m.slug}/">${m.emoji} ${esc(m.label)}<div class="sub">Cooking time calculator</div></a>`;
  }).join('');
}
function cutLinksFor(meatKey, loc) {
  return CUTS.filter(c => c.meat === meatKey).map(c =>
    `<a class="link-card" href="/${loc.prefix}${c.slug}/">${esc(c.cut)}<div class="sub">${esc(c.kw.split(',')[0])}</div></a>`).join('');
}
function weightLinksFor(meatKey, slug, loc, current) {
  return (loc.steps[meatKey] || []).map(w =>
    `<a class="link-card" href="/${loc.prefix}${slug}/${wSlug(w, loc)}/"${w === current ? ' style="border-color:var(--brand)"' : ''}>${w} ${loc.unit}<div class="sub">cooking time</div></a>`).join('');
}
function wSlug(w, loc) { return String(w).replace('.', '-') + (loc.unit === 'lb' ? 'lb' : 'kg'); }

// ═════════════════════════════════════════════════════════════
// EMITTERS
// ═════════════════════════════════════════════════════════════
const OUT = __dirname;
const urls = ['/']; // homepage
let count = 0;
function emit(relDir, html) {
  const dir = path.join(OUT, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  urls.push('/' + relDir.replace(/\\/g, '/') + '/');
  count++;
}

// ═════════════════════════════════════════════════════════════
// buildLocale(loc) — emits Tier 1 (hubs), Tier 3 (weight pages) and Tier 2
// (cuts) for one locale. UK renders kg/°C at root; US renders lb/°F under /us/.
// ═════════════════════════════════════════════════════════════
function buildLocale(loc) {
  const homeHref = `/${loc.prefix}`;
  const regBadge = loc.tempF ? '°F · US' : '°C · UK';

  // ── Tier 1: hubs ──
  HUBS.forEach(hub => {
    const m = MEATS[hub.key];
    const cfg = { mode: m.mode, doneness: m.doneness, single: m.single, ovenC: m.ovenC, ovenConvC: m.ovenConvC, ovenF: m.ovenF, restMin: m.restMin, defaultDoneness: m.defaultDoneness, sear: m.sear, defaultWeight: loc.unit === 'lb' ? 4 : 2 };
    const canonical = `${SITE_URL}/${loc.prefix}${m.slug}/`;
    const chartW = loc.steps[hub.key];
    const chartHead = m.mode === 'doneness'
      ? ['Weight', ...Object.keys(m.doneness).map(k => m.doneness[k].label)]
      : ['Weight', 'Cooking time', 'Internal temp'];
    const chartRows = chartW.map(w => m.mode === 'doneness'
      ? `<tr><td class="hl">${w} ${loc.unit}</td>${Object.keys(m.doneness).map(k => `<td>${fmtTime(total(m.doneness[k].per500, m.doneness[k].base, toKg(w, loc)))}</td>`).join('')}</tr>`
      : `<tr><td class="hl">${w} ${loc.unit}</td><td>${fmtTime(total(m.single.per500, m.single.base, toKg(w, loc)))}</td><td>${internalPrimary(m.single.internalC, m.single.internalF, loc)}</td></tr>`).join('');
    const faq = [
      [`How long to cook ${hub.key === 'chicken' ? 'a chicken' : hub.key === 'beef' ? 'roast beef' : hub.key === 'lamb' ? 'a leg of lamb' : 'roast pork'} per ${loc.unit}?`,
        m.mode === 'doneness'
          ? `About ${unitMin(m.doneness.medium.per500, loc)} minutes per ${loc.unit} for medium (${unitMin(m.doneness.rare.per500, loc)}/${loc.unit} rare, ${unitMin(m.doneness.well.per500, loc)}/${loc.unit} well done), plus a base of ${m.doneness.medium.base} minutes, at ${ovenPrimary(m, loc)}.`
          : `About ${unitMin(m.single.per500, loc)} minutes per ${loc.unit} plus ${m.single.base} minutes, at ${ovenPrimary(m, loc)}, to an internal temperature of ${internalPrimary(m.single.internalC, m.single.internalF, loc)}.`],
      [`What temperature should ${m.label.toLowerCase()} be cooked to inside?`,
        m.mode === 'doneness'
          ? `${m.label} internal temperatures: ${Object.keys(m.doneness).map(k => `${m.doneness[k].label} ${internalPrimary(m.doneness[k].internalC, m.doneness[k].internalF, loc)}`).join(', ')}. Measure with a meat thermometer.`
          : `${m.label} should reach an internal temperature of <strong>${internalPrimary(m.single.internalC, m.single.internalF, loc)}</strong> (${tempPair(m.single.internalC, m.single.internalF, loc)}). ${m.note}`],
      [`Does a fan oven cook ${m.label.toLowerCase()} faster?`,
        `Yes. A fan (convection) oven runs about 20°C / 35°F hotter than conventional — use ${tempPair(m.ovenC, m.ovenF, loc)} for the times shown. ${m.note}`],
    ];
    const jsonld = [webAppJsonLd(hub.title, canonical, loc), faqJsonLd(faq), howToJsonLd(m.label, loc),
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + homeHref },
        { '@type': 'ListItem', position: 2, name: hub.h1, item: canonical }] }];
    const otherVersion = loc.id === 'uk'
      ? `<p style="margin-top:24px;"><a href="/us/${m.slug}/" class="back-link">🇺🇸 Cooking in pounds &amp; °F? Use the US ${esc(m.label.toLowerCase())} calculator →</a></p>`
      : `<p style="margin-top:24px;"><a href="/${m.slug}/" class="back-link">🇬🇧 Cooking in kg &amp; °C? Use the UK ${esc(m.label.toLowerCase())} calculator →</a></p>`;
    const body = `
<header><div class="container">
  <div class="badge">${m.emoji} ${esc(m.label)} · ${regBadge}</div>
  <h1>${esc(hub.h1)}</h1>
  <p>${esc(hub.intro)}</p>
</div></header>
<div class="container">
<div class="tool-wrapper">${calcWidget(cfg, loc)}</div>
<div class="content">
  <a href="${homeHref}" class="back-link">← All meat calculators</a>
  <h2 class="st">${esc(m.label)} Cooking Time Chart (by weight)</h2>
  <p>${m.note}</p>
  <table class="data-table"><thead><tr>${chartHead.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${chartRows}</tbody></table>
  <h2 class="st">${esc(m.label)} Cooking Times by Weight</h2>
  <p>Jump to a pre-filled calculator for your exact joint size:</p>
  <div class="link-grid">${weightLinksFor(hub.key, m.slug, loc)}</div>
  ${cutLinksFor(hub.key, loc) ? `<h2 class="st">${esc(m.label)} Cuts</h2><div class="link-grid">${cutLinksFor(hub.key, loc)}</div>` : ''}
  ${ctaBlock(loc)}
  ${methodBlock(cfg, m.label, loc)}
  ${faqBlock(faq)}
  ${otherVersion}
  <h2 class="st">Other Meat Calculators</h2>
  <div class="link-grid">${hubLinks(hub.key, loc)}</div>
</div></div>
${footerBlock(`${esc(m.label)} cooking time calculator · <a href="${homeHref}">Home</a> · Guidance only — verify with a thermometer`, loc)}`;
    emit(`${loc.prefix}${m.slug}`, pageShell({ title: `${hub.title} — Time by Weight & Doneness`, desc: `${hub.intro} Times in ${loc.tempF ? '°F and °C' : '°C and °F'}, fan or conventional oven.`, keywords: hub.keywords, canonical, jsonld, body, loc }));

    // ── Tier 3: weight pages for this hub ──
    (loc.steps[hub.key] || []).forEach(w => {
      const kg = toKg(w, loc);
      const wcfg = Object.assign({}, cfg, { fixedWeight: w });
      const wcanon = `${SITE_URL}/${loc.prefix}${m.slug}/${wSlug(w, loc)}/`;
      const dish = m.dishLabel;
      const Dish = dish.charAt(0).toUpperCase() + dish.slice(1);
      const wtimeMain = m.mode === 'doneness' ? fmtTime(total(m.doneness.medium.per500, m.doneness.medium.base, kg)) : fmtTime(total(m.single.per500, m.single.base, kg));
      const wtitle = `How Long to Cook a ${w}${loc.unit} ${Dish} — Cooking Time`;
      const wdesc = `A ${w} ${loc.unit} ${dish} takes about ${wtimeMain}${m.mode === 'doneness' ? ' for medium' : ''} at ${ovenPrimary(m, loc)}. Exact time, temperature and resting time.`;
      const wfaq = [
        [`How long to cook a ${w}${loc.unit} ${dish}?`,
          m.mode === 'doneness'
            ? `A ${w} ${loc.unit} ${dish} takes about <strong>${fmtTime(total(m.doneness.medium.per500, m.doneness.medium.base, kg))}</strong> for medium (${fmtTime(total(m.doneness.rare.per500, m.doneness.rare.base, kg))} rare, ${fmtTime(total(m.doneness.well.per500, m.doneness.well.base, kg))} well done) at ${ovenPrimary(m, loc)}.`
            : `A ${w} ${loc.unit} ${dish} takes about <strong>${wtimeMain}</strong> at ${ovenPrimary(m, loc)}, to an internal temperature of ${internalPrimary(m.single.internalC, m.single.internalF, loc)}.`],
        [`What temperature for a ${w}${loc.unit} ${dish}?`, `Roast at ${tempPair(m.ovenC, m.ovenF, loc)}. ${m.note}`],
      ];
      const wjson = [webAppJsonLd(wtitle, wcanon, loc), faqJsonLd(wfaq),
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + homeHref },
          { '@type': 'ListItem', position: 2, name: hub.h1, item: canonical },
          { '@type': 'ListItem', position: 3, name: `${w} ${loc.unit}`, item: wcanon }] }];
      const wbody = `
<header><div class="container">
  <div class="badge">${m.emoji} ${w} ${loc.unit} ${esc(Dish)}</div>
  <h1>How Long to Cook a ${w}${loc.unit} ${esc(Dish)}?</h1>
  <p>A ${w} ${loc.unit} ${esc(dish)} takes about <strong>${wtimeMain}</strong>${m.mode === 'doneness' ? ' for medium' : ''}. Adjust oven type${m.mode === 'doneness' ? ' and doneness' : ''} below.</p>
</div></header>
<div class="container">
<div class="tool-wrapper">${calcWidget(wcfg, loc)}</div>
<div class="content">
  <a href="/${loc.prefix}${m.slug}/" class="back-link">← ${esc(m.label)} calculator</a>
  <h2 class="st">Cooking Times for a ${w}${loc.unit} ${esc(Dish)}</h2>
  <table class="data-table"><thead><tr>${chartHead.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
  ${m.mode === 'doneness'
          ? `<tr><td class="hl">${w} ${loc.unit}</td>${Object.keys(m.doneness).map(k => `<td>${fmtTime(total(m.doneness[k].per500, m.doneness[k].base, kg))}</td>`).join('')}</tr>`
          : `<tr><td class="hl">${w} ${loc.unit}</td><td>${wtimeMain}</td><td>${internalPrimary(m.single.internalC, m.single.internalF, loc)}</td></tr>`}
  </tbody></table>
  ${ctaBlock(loc)}
  <h2 class="st">Other Weights</h2>
  <div class="link-grid">${weightLinksFor(hub.key, m.slug, loc, w)}</div>
  ${methodBlock(cfg, m.label, loc)}
  ${faqBlock(wfaq)}
</div></div>
${footerBlock(`${w} ${loc.unit} ${esc(m.label)} · <a href="/${loc.prefix}${m.slug}/">${esc(m.label)} calculator</a> · <a href="${homeHref}">Home</a>`, loc)}`;
      emit(`${loc.prefix}${m.slug}/${wSlug(w, loc)}`, pageShell({ title: wtitle, desc: wdesc, keywords: `how long to cook a ${w}${loc.unit} ${dish}, ${w}${loc.unit} ${dish} cooking time, ${w} ${loc.unit} ${dish} roasting time`, canonical: wcanon, jsonld: wjson, body: wbody, loc }));
    });
  });

  // ── Tier 2: cut pages ──
  CUTS.forEach(entry => {
    const m = MEATS[entry.meat];
    const cook = cookOf(entry);
    // weight steps for this cut in the locale unit
    const wsteps = loc.unit === 'lb'
      ? (entry.weights ? entry.weights.map(kg => Math.round(kg * LB_PER_KG * 2) / 2) : (LB_STEPS[entry.meat] || [3, 4, 5, 6]))
      : (entry.weights || WEIGHT_STEPS[entry.meat] || [1, 1.5, 2, 2.5]);
    const cfg = { mode: cook.mode, doneness: cook.doneness, single: cook.single, ovenC: cook.ovenC, ovenConvC: cook.ovenConvC, ovenF: cook.ovenF, restMin: cook.restMin, defaultDoneness: cook.defaultDoneness, sear: cook.sear, defaultWeight: wsteps[Math.floor(wsteps.length / 2)] };
    const canonical = `${SITE_URL}/${loc.prefix}${entry.slug}/`;
    const title = entry.cut + ' Cooking Time Calculator';
    const chartHead = cook.mode === 'doneness' ? ['Weight', ...Object.keys(cook.doneness).map(k => cook.doneness[k].label)] : ['Weight', 'Cooking time', 'Internal temp'];
    const chartRows = wsteps.map(w => cook.mode === 'doneness'
      ? `<tr><td class="hl">${w} ${loc.unit}</td>${Object.keys(cook.doneness).map(k => `<td>${fmtTime(total(cook.doneness[k].per500, cook.doneness[k].base, toKg(w, loc)))}</td>`).join('')}</tr>`
      : `<tr><td class="hl">${w} ${loc.unit}</td><td>${fmtTime(total(cook.single.per500, cook.single.base, toKg(w, loc)))}</td><td>${internalPrimary(cook.single.internalC, cook.single.internalF, loc)}</td></tr>`).join('');
    const d0 = cook.mode === 'doneness' ? cook.doneness[cook.defaultDoneness || Object.keys(cook.doneness)[0]] : cook.single;
    const faq = [
      [`How long to cook ${entry.cut.toLowerCase()}?`,
        cook.mode === 'doneness'
          ? `Roughly ${cook.doneness.medium ? unitMin(cook.doneness.medium.per500, loc) : unitMin(d0.per500, loc)} minutes per ${loc.unit} plus a base offset. ${entry.note}`
          : `About ${unitMin(cook.single.per500, loc)} minutes per ${loc.unit} plus ${cook.single.base} minutes at ${loc.tempF ? cook.ovenF + '°F' : cook.ovenC + '°C fan'}, to ${internalPrimary(cook.single.internalC, cook.single.internalF, loc)} internal. ${entry.note}`],
      [`What oven temperature for ${entry.cut.toLowerCase()}?`, `Cook at ${tempPair(cook.ovenC, cook.ovenF, loc)}. Internal target ${internalPrimary(d0.internalC, d0.internalF, loc)}. Rest ${cook.restMin} minutes.`],
    ];
    const jsonld = [webAppJsonLd(title, canonical, loc), faqJsonLd(faq), howToJsonLd(entry.cut, loc),
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + homeHref },
        { '@type': 'ListItem', position: 2, name: MEATS[entry.meat].label, item: `${SITE_URL}/${loc.prefix}${MEATS[entry.meat].slug}/` },
        { '@type': 'ListItem', position: 3, name: entry.cut, item: canonical }] }];
    const body = `
<header><div class="container">
  <div class="badge">${m.emoji} ${esc(entry.cut)} · ${regBadge}</div>
  <h1>${esc(title)}</h1>
  <p>${esc(entry.note)}</p>
</div></header>
<div class="container">
<div class="tool-wrapper">${calcWidget(cfg, loc)}</div>
<div class="content">
  <a href="/${loc.prefix}${MEATS[entry.meat].slug}/" class="back-link">← ${esc(MEATS[entry.meat].label)} calculator</a>
  <h2 class="st">${esc(entry.cut)} Cooking Time Chart</h2>
  <table class="data-table"><thead><tr>${chartHead.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${chartRows}</tbody></table>
  ${ctaBlock(loc)}
  ${methodBlock(cfg, entry.cut, loc)}
  ${faqBlock(faq)}
  <h2 class="st">More ${esc(MEATS[entry.meat].label)} Cuts</h2>
  <div class="link-grid">${cutLinksFor(entry.meat, loc)}</div>
  <h2 class="st">Other Meat Calculators</h2>
  <div class="link-grid">${hubLinks(entry.meat, loc)}</div>
</div></div>
${footerBlock(`${esc(entry.cut)} cooking time · <a href="/${loc.prefix}${MEATS[entry.meat].slug}/">${esc(MEATS[entry.meat].label)} calculator</a> · <a href="${homeHref}">Home</a>`, loc)}`;
    emit(`${loc.prefix}${entry.slug}`, pageShell({ title: `${title} — Time, Temperature & Method`, desc: `${entry.note} Enter the weight for the exact cooking time, oven temperature and internal target.`, keywords: entry.kw, canonical, jsonld, body, loc }));
  });
}

buildLocale(LOCALES.uk);
buildLocale(LOCALES.us);

// ═════════════════════════════════════════════════════════════
// US HOMEPAGE — generated mirror of the hand-written UK homepage (lb/°F).
// (UK homepage index.html is hand-written and lives at the repo root.)
// ═════════════════════════════════════════════════════════════
function buildHomepage(loc) {
  const model = {};
  Object.keys(MEATS).forEach(k => { const m = MEATS[k];
    model[k] = { label: m.label, mode: m.mode, ovenC: m.ovenC, ovenConvC: m.ovenConvC, ovenF: m.ovenF, restMin: m.restMin };
    if (m.mode === 'doneness') { model[k].doneness = {}; Object.keys(m.doneness).forEach(d => { const x = m.doneness[d]; model[k].doneness[d] = { label: x.label, per500: x.per500, base: x.base, range: x.range, internalC: x.internalC, internalF: x.internalF }; }); model[k].defaultDoneness = m.defaultDoneness; }
    else { const s = m.single; model[k].single = { label: s.label, per500: s.per500, base: s.base, range: s.range, internalC: s.internalC, internalF: s.internalF }; }
  });
  const canonical = `${SITE_URL}/${loc.prefix}`;
  const glanceRows = Object.keys(MEATS).map(k => { const m = MEATS[k];
    const d = m.mode === 'doneness' ? m.doneness.medium : m.single;
    return `<tr><td class="hl">${m.label}${m.mode === 'doneness' ? ' (medium)' : ''}</td><td>${unitMin(d.per500, loc)} min/lb + ${d.base} min base</td><td>${m.ovenF}°F</td><td>${d.internalF}°F</td></tr>`;
  }).join('');
  const faq = [
    ['How do I calculate meat cooking time by weight?', `Multiply the minutes per pound for your meat and doneness by the weight, then add the base offset. For example, medium roast beef is about ${unitMin(MEATS.beef.doneness.medium.per500, loc)} minutes per pound plus 25 minutes, so a 4 lb joint takes roughly <strong>${fmtTime(total(MEATS.beef.doneness.medium.per500, MEATS.beef.doneness.medium.base, toKg(4, loc)))}</strong> at 350°F. Always confirm with a meat thermometer.`],
    ['What internal temperature should meat reach?', 'Beef and lamb: <strong>125°F rare, 140°F medium, 158°F well done</strong>. Pork: <strong>160°F</strong>. Chicken: <strong>165°F</strong>. Ham/gammon: <strong>154°F</strong>. Measure the thickest part with a meat thermometer.'],
    ['Does a convection oven cook meat faster?', 'Yes. A convection (fan) oven runs about 25–35°F hotter than a conventional oven, so set it lower for the same cooking time. This calculator lets you choose fan or conventional.'],
    ['How long should meat rest after roasting?', 'Rest small cuts 8–10 minutes and large roasts 15–30 minutes, loosely tented with foil. Resting lets the juices redistribute so the meat stays moist when carved.'],
  ];
  const jsonld = [
    webAppJsonLd('Meat Cooking Time Calculator', canonical, loc),
    howToJsonLd('meat', loc),
    faqJsonLd(faq),
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: canonical }] },
  ];
  const hubGrid = HUBS.map(h => { const m = MEATS[h.key];
    return `<a class="link-card" href="/us/${m.slug}/"><div class="t">${m.emoji} ${esc(h.h1.replace(' Cooking Time Calculator', ''))}</div><div class="sub">by weight, °F</div></a>`;
  }).join('');
  const body = `
<header><div class="container">
  <div class="badge">🍖 Beef · Lamb · Pork · Chicken · Ham · °F · US</div>
  <h1>Meat Cooking Time Calculator</h1>
  <p>Choose your meat, enter the weight in pounds and doneness — get the exact roasting time, oven temperature (°F), internal target temperature and resting time.</p>
</div></header>
<div class="container">
<div class="tool-wrapper">
  <div class="tool-card">
    <div class="form-grid">
      <div class="form-group"><label>Meat</label><select id="meat" onchange="onMeatChange()"></select></div>
      <div class="form-group"><label>Weight (lb)</label><input type="number" id="wNum" min="0.5" max="26" step="0.1" value="4" placeholder="e.g. 4"></div>
      <div class="form-group"><label>Oven type</label><select id="ovenType"><option value="fan">Convection / fan</option><option value="conv">Conventional</option></select></div>
      <div class="form-group" id="doneWrap"><label>Doneness</label><div class="seg" id="doneSeg"></div></div>
    </div>
    <button class="calc-btn" onclick="calculate()">Calculate Cooking Time →</button>
    <div class="result" id="result">
      <div class="result-hero"><div class="rl">Total cooking time</div><div class="ra" id="r-time"></div><div class="rs" id="r-sub"></div></div>
      <div class="result-grid">
        <div class="r-stat"><div class="sv" id="r-oven"></div><div class="sl">Oven temperature</div></div>
        <div class="r-stat"><div class="sv" id="r-internal"></div><div class="sl">Internal target</div></div>
        <div class="r-stat"><div class="sv" id="r-rest"></div><div class="sl">Resting time</div></div>
      </div>
      <div class="result-grid" style="margin-bottom:14px;">
        <div class="r-stat"><div class="sv" id="r-range"></div><div class="sl">Guidance range</div></div>
        <div class="r-stat"><div class="sv" id="r-ready"></div><div class="sl">Ready if in now</div></div>
        <div class="r-stat"><div class="sv" id="r-perkg"></div><div class="sl">Per lb</div></div>
      </div>
      <div class="therm-notice">🌡️ <strong>Always confirm with a meat thermometer.</strong> Times are guidance — the internal temperature is what makes it safe and perfect.</div>
    </div>
  </div>
</div>
<div class="content">
  <h2 class="st">Choose Your Meat Calculator</h2>
  <p>Dedicated calculators with cooking charts, cut variations and per-weight pages:</p>
  <div class="link-grid">${hubGrid}</div>

  <h2 class="st">Meat Cooking Times at a Glance (per pound, convection)</h2>
  <table class="data-table"><thead><tr><th>Meat</th><th>Time per pound</th><th>Oven</th><th>Internal temp</th></tr></thead><tbody>${glanceRows}</tbody></table>

  ${ctaBlock(loc)}
  ${faqBlock(faq)}
  <p style="margin-top:24px;"><a href="/" class="back-link">🇬🇧 Cooking in kilograms &amp; °C? Use the UK version →</a></p>
</div></div>
${footerBlock(`Meat Cooking Time Calculator · Beef · Lamb · Pork · Chicken · Ham`, loc)}
<script>
const MEATS = ${JSON.stringify(model)};
let DONE = 'medium';
const LB_PER_KG = 2.20462;
const meatSel = document.getElementById('meat');
Object.keys(MEATS).forEach(k => { const o=document.createElement('option'); o.value=k; o.textContent=MEATS[k].label; meatSel.appendChild(o); });
function onMeatChange(){
  const m = MEATS[meatSel.value]; const wrap = document.getElementById('doneWrap'); const seg = document.getElementById('doneSeg');
  if(m.mode==='doneness'){ wrap.style.display='flex'; seg.innerHTML = Object.keys(m.doneness).map(k=>\`<button type="button" data-done="\${k}"\${k===m.defaultDoneness?' class="active"':''} onclick="pickDone(this)">\${m.doneness[k].label}</button>\`).join(''); DONE = m.defaultDoneness; }
  else { wrap.style.display='none'; }
}
function pickDone(b){ document.querySelectorAll('#doneSeg button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); DONE=b.dataset.done; }
function fmtTime(min){ min=Math.round(min); const h=Math.floor(min/60), m=min%60; if(h===0)return m+' min'; if(m===0)return h+' hr'; return h+' hr '+m+' min'; }
function calculate(){
  const m = MEATS[meatSel.value];
  const lb = parseFloat(document.getElementById('wNum').value)||0;
  if(lb<=0){ alert('Please enter a weight in lb.'); return; }
  const kg = lb/LB_PER_KG;
  const oven = document.getElementById('ovenType').value;
  const d = m.mode==='doneness' ? m.doneness[DONE] : m.single;
  const mid = d.per500*(kg*2)+d.base;
  const lo = d.range[0]*(kg*2)+d.base, hi = d.range[1]*(kg*2)+d.base;
  const ovenC = oven==='conv' ? m.ovenConvC : m.ovenC;
  const ovenF = Math.round((ovenC*9/5+32)/5)*5;
  document.getElementById('r-time').textContent = fmtTime(mid);
  document.getElementById('r-sub').textContent = (m.mode==='doneness'? d.label+' · ':'') + m.label+' · '+lb+' lb · '+(oven==='conv'?'conventional':'convection')+' oven';
  document.getElementById('r-oven').textContent = ovenF+'°F / '+ovenC+'°C';
  document.getElementById('r-internal').textContent = d.internalF+'°F / '+d.internalC+'°C';
  document.getElementById('r-rest').textContent = m.restMin+' min';
  document.getElementById('r-range').textContent = fmtTime(lo)+' – '+fmtTime(hi);
  document.getElementById('r-perkg').textContent = fmtTime((d.per500*2)/LB_PER_KG)+'/lb';
  const ready = new Date(Date.now()+mid*60000);
  document.getElementById('r-ready').textContent = ready.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  document.getElementById('result').style.display='block';
  document.getElementById('result').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function toggleFaq(b){ b.classList.toggle('open'); b.nextElementSibling.classList.toggle('open'); }
onMeatChange();
<\/script>`;
  emit(loc.prefix.replace(/\/$/, ''), pageShell({ title: 'Meat Cooking Time Calculator (US) — Roast Beef, Lamb, Pork & Chicken by the Pound', desc: 'Free US meat cooking time calculator. Choose beef, lamb, pork or chicken, enter the weight in pounds and doneness → exact roasting time, oven temperature (°F), internal temperature and resting time.', keywords: 'meat cooking time calculator, cooking time calculator by pound, roast beef cooking time per pound, how long to cook a roast, meat roasting time calculator', canonical, jsonld, body, loc }));
}
buildHomepage(LOCALES.us);

// ── Tier 4: informational pages (UK content; the 2 us/ °F pages funnel to the US hub) ──
INFO.forEach(info => {
  const loc = LOCALES.uk;
  const canonical = `${SITE_URL}/${info.slug}/`;
  const jsonld = [
    { '@type': 'Article', headline: info.h1, description: info.desc, inLanguage: 'en-GB', author: { '@type': 'Organization', name: 'Meat Cooking Time Calculator' } },
    faqJsonLd(info.faq),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: info.h1, item: canonical }] }];
  const tbl = info.table
    ? `<h2 class="st">${esc(info.table.title)}</h2><table class="data-table"><thead><tr>${info.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${info.table.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<td class="hl">${esc(c)}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '';
  const body = `
<header><div class="container">
  <div class="badge">🍽️ Cooking guide</div>
  <h1>${esc(info.h1)}</h1>
</div></header>
<div class="container">
<div class="tool-wrapper"><div class="tool-card">
  <p style="margin:0;">${info.lead}</p>
  <a href="/${info.funnel}/" class="cta-btn-white" style="background:var(--brand);color:#fff;margin-top:18px;">Open the ${esc(info.funnelLabel)} →</a>
</div></div>
<div class="content">
  ${tbl}
  <div class="therm-notice" style="margin:20px 0;">🌡️ Whatever the time, doneness is decided by the <strong>internal temperature</strong> — check it with a meat thermometer.</div>
  ${ctaBlock(loc)}
  ${faqBlock(info.faq)}
  <h2 class="st">Meat Cooking Calculators</h2>
  <div class="link-grid">${hubLinks(null, loc)}</div>
</div></div>
${footerBlock(`<a href="/">Meat Cooking Time Calculator</a> · Guidance only — verify with a thermometer`, loc)}
<script>function toggleFaq(b){b.classList.toggle('open');b.nextElementSibling.classList.toggle('open');}<\/script>`;
  emit(info.slug, pageShell({ title: `${info.h1} — Times & Temperatures`, desc: info.desc, keywords: info.kw, canonical, jsonld, body, loc }));
});

// ── sitemap ──
const uniq = [...new Set(urls)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniq.map(u => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${u === '/' ? '1.0' : u.split('/').length > 3 ? '0.6' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

console.log(`\n✅ Generated ${count} pages + sitemap.xml (${uniq.length} URLs incl. homepage).`);
