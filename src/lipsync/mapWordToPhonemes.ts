/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

const nonLetterPattern = /[^a-z]/g;
const phonemeClusterPattern = /[aeiouy]+|[^aeiouy]+/g;

/**
 * Splits a word into naive phoneme-like clusters by alternating vowel and
 * consonant groups. This is a placeholder heuristic standing in for a
 * proper grapheme-to-phoneme model, such as a CMU-dictionary-backed G2P
 * library, and should be swapped out before this drives anything beyond
 * a rough first pass at lip sync.
 * @param word - The word to split, as spoken in the Flux TTS transcript.
 * @returns The word's phoneme-like clusters, in speaking order.
 */
const mapWordToPhonemes = (word: string): Array<string> => {
  const normalisedWord = word.toLowerCase().replaceAll(nonLetterPattern, "");

  if (normalisedWord.length === 0) {
    return [];
  }

  /*
   * The phonemeClusterPattern always matches on a non-empty string
   * (every character is either a vowel run or a non-vowel run), so
   * match() can never actually return null here; the fallback only
   * exists to satisfy the RegExpMatchArray | null return type.
   */
  // eslint-disable-next-line capitalized-comments -- v8 ignore directive must stay lowercase
  /* v8 ignore next -- @preserve */
  return normalisedWord.match(phonemeClusterPattern) ?? [ normalisedWord ];
};

export { mapWordToPhonemes };
