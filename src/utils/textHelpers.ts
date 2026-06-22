/**
 * Text processing utilities — used by the DEV assistant intent engine.
 * Extracted here so devAssistantService.ts stays focused on query logic.
 */

/** English stop words that carry no intent signal. */
export const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','need','dare','ought','used',
  'i','me','my','we','our','you','your','he','she','it','they','them',
  'this','that','these','those','what','which','who','whom','how','when','where','why',
  'all','any','both','each','few','more','most','other','some','such',
  'no','not','only','same','so','than','too','very','just','but','and','or',
  'for','of','with','at','by','from','up','about','into','through','during',
  'show','tell','give','get','display','list','find','check','report',
  'me','us','please','can','could','would','like','want','need','see',
  'in','on','to','as','if','then','there','here','much','many','number','count',
]);

/**
 * Tokenizes a query string:
 * lowercases, strips punctuation, splits on whitespace,
 * removes stop words and single-character tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Levenshtein edit distance between two strings.
 * Used for fuzzy keyword matching in the intent engine.
 */
export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
