/**
 * A script line, turned into what should actually be said.
 *
 * The line on the teacher's tablet is written to be READ: "2 + 3 = 5", "A से
 * Apple — सेब", "Together they make नल". A voice model handed that skips
 * whatever is not in its own alphabet, and skips it silently — the clip is
 * simply short, and nobody finds out until a child hears a sum with no numbers
 * in it. So the text is rewritten first, and anything left over that the voice
 * cannot say is reported rather than swallowed.
 *
 * The lesson file is never changed. What the teacher reads and what the child
 * hears stay the same sentence; only its spelling differs.
 */

import { LETTERS, NUMBERS, SIGNS, WORDS } from './spoken-data.js';

const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ' ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');

function numberWords(n, lang) {
  if (lang !== 'en') {
    const table = NUMBERS[lang];
    if (n <= 100) return table[n];
    // Past a hundred the curriculum never goes, but a wrong number is worse
    // than a clumsy one: say the hundreds, then the rest.
    const hundreds = Math.floor(n / 100), rest = n % 100;
    return `${table[hundreds]} ${table[100]}${rest ? ` ${table[rest]}` : ''}`;
  }

  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberWords(rest, 'en')}` : ''}`;
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const ODIA_DIGITS = '୦୧୨୩୪୫୬୭୮୯';

/** Devanagari → a rough Latin spelling, for the English voice meeting a Hindi letter. */
const CONSONANTS = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l',
  व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h', ळ: 'l', ङ: 'ng', ञ: 'ny',
};
const VOWELS = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऋ: 'ri' };
const MATRAS = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri' };

function romanise(word) {
  const chars = [...word];
  let out = '';

  chars.forEach((c, i) => {
    const next = chars[i + 1];
    if (CONSONANTS[c]) {
      out += CONSONANTS[c];
      // The inherent "a": there unless a matra or a virama follows, and dropped
      // at the end of a word of more than one letter — नल is "nal", न is "na".
      const bare = !MATRAS[next] && next !== '्';
      const last = i === chars.length - 1 || (next === 'ं' && i === chars.length - 2);
      if (bare && !(last && chars.length > 1)) out += 'a';
    } else if (VOWELS[c]) out += VOWELS[c];
    else if (MATRAS[c]) out += MATRAS[c];
    else if (c === 'ं' || c === 'ँ') out += 'n';
  });

  return out;
}

/** A matra on its own — "यह ा मात्रा है" — cannot be said; its vowel can. */
const MATRA_VOWEL = { 'ा': 'आ', 'ि': 'इ', 'ी': 'ई', 'ु': 'उ', 'ू': 'ऊ', 'ृ': 'ऋ', 'े': 'ए', 'ै': 'ऐ', 'ो': 'ओ', 'ौ': 'औ' };

/**
 * Devanagari → Odia, letter for letter. The two scripts are laid out in step
 * in Unicode, 0x200 apart, which is what makes this a subtraction and not a
 * table. It is there for the Hindi-subject lessons narrated in Odia: the word
 * being taught is Hindi, and the Odia voice can only read Odia letters.
 */
function devanagariToOdia(text) {
  return text.replace(/[\u0900-\u097f]/g, (c) => {
    const odia = String.fromCodePoint(c.codePointAt(0) + 0x200);
    return /\p{Script=Oriya}/u.test(odia) ? odia : '';
  });
}

/**
 * @param {string} text  the script line, as written
 * @param {'en'|'hi'|'mr'|'or'} lang
 * @returns {{text: string, leftover: string[]}} the spoken form, and anything
 *   in it the voice for this language still cannot say
 */
export function spoken(text, lang) {
  let s = text.normalize('NFC');

  // A lone matra becomes the vowel it stands for, before anything else reads it.
  s = s.replace(/(^|[\s—–-])([\u093e-\u094c])(?=[\s.,।]|$)/g, (m, lead, matra) => `${lead}${MATRA_VOWEL[matra] ?? matra}`);

  // Native digits are digits.
  s = s.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS.indexOf(d)).replace(/[୦-୯]/g, (d) => ODIA_DIGITS.indexOf(d));

  // A hyphen between two numbers is a minus; anywhere else it is a hyphen.
  s = s.replace(/(\d)\s*[-–]\s*(\d)/g, '$1 − $2');
  for (const [sign, word] of Object.entries(SIGNS[lang])) s = s.split(sign).join(` ${word} `);
  s = s.replace(/\d+/g, (n) => ` ${numberWords(Number(n), lang)} `);

  if (lang === 'en') {
    // A run of capitals — "C, A, T", "I and N" — is letters being spelt out, so
    // even A and I are letters there. And a whole word in capitals ("CAT", "ON")
    // is a word being shown, not shouted: say it as the word.
    s = s.replace(/\b[A-Z]\b(?:\s*(?:,|and)\s*\b[A-Z]\b)+/g, (run) => run.replace(/\b[A-Z]\b/g, (c) => LETTERS.en[c.charCodeAt(0) - 65]));
    s = s.replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase());

    // A capital on its own is a letter being named. "A" is the exception that
    // is also a word, so it is only a letter where the sentence treats it as one.
    s = s.replace(/\b([B-HJ-Z])\b(?!')/g, (m, c) => LETTERS.en[c.charCodeAt(0) - 65]);
    s = s.replace(/\b(capital|small|letter) ([a-zA-Z])\b/g, (m, w, c) => `${w} ${LETTERS.en[c.toUpperCase().charCodeAt(0) - 65]}`);
    s = s.replace(/\b([AI]) (says|for|is for)\b/g, (m, c, w) => `${LETTERS.en[c.charCodeAt(0) - 65]} ${w}`);
    s = s.replace(/[ऀ-ॿ]+/g, (w) => romanise(w));
    // The English voice was trained without a capital X — it says "ylophone".
    s = s.replace(/X/g, 'x');
  } else {
    s = s.replace(/[A-Za-z]+/g, (w) => {
      const known = WORDS[lang]?.[w.toLowerCase()];
      if (known && w.length > 1) return known;
      if (w.length === 1) return /[a-z]/.test(w) && WORDS[lang]?.[w] ? WORDS[lang][w] : LETTERS[lang][w.toUpperCase().charCodeAt(0) - 65];
      // An unknown word: spell it, which is wrong but audible — and reported.
      return known ?? w;
    });
  }

  // The danda is shared by both scripts and lives in the Devanagari block, so
  // it goes first or the sentence loses its full stops.
  if (lang === 'or') s = devanagariToOdia(s.replace(/[।॥]/g, '.')).replace(/\s+ଟି/g, 'ଟି');

  // Punctuation the models know: . , ? ! and little else.
  s = s
    .replace(/[।॥]/g, '.')
    .replace(/[—–…:;]/g, ',')
    .replace(/[“”"‘’'()\[\]]/g, '')
    .replace(/\s+([.,?!])/g, '$1')
    .replace(/,\s*([.?!])/g, '$1')
    .replace(/([.,?!])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const own = { en: /[A-Za-z]/, hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, or: /[଀-୿]/ }[lang];
  const leftover = [...new Set([...s].filter((c) => !own.test(c) && !/[\s.,?!-]/.test(c)))];

  return { text: s, leftover };
}
