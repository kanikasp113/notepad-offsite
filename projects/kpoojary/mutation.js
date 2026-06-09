// mutation.js — core mutation engine for MutaNotes
// Transforms note text based on mutation level (0–3).
// No LLM required; levels 1–2 use local synonym/verb maps.
// Level 3 uses template-based "unhinged" rewrites.

const SYNONYMS = {
  // adjectives
  good: ["decent", "fine", "acceptable", "solid", "adequate"],
  bad: ["unfortunate", "suboptimal", "questionable", "dubious", "regrettable"],
  happy: ["pleased", "content", "satisfied", "cheerful", "at ease"],
  sad: ["melancholy", "downcast", "disheartened", "blue", "wistful"],
  big: ["sizable", "considerable", "notable", "substantial", "ample"],
  small: ["modest", "minor", "limited", "compact", "slight"],
  fast: ["quick", "swift", "prompt", "brisk", "expedient"],
  slow: ["gradual", "unhurried", "measured", "leisurely", "deliberate"],
  hard: ["difficult", "challenging", "demanding", "taxing", "arduous"],
  easy: ["simple", "straightforward", "manageable", "painless", "effortless"],
  important: ["significant", "notable", "consequential", "meaningful", "relevant"],
  interesting: ["curious", "noteworthy", "thought-provoking", "engaging", "peculiar"],
  new: ["recent", "fresh", "novel", "current", "modern"],
  old: ["established", "longstanding", "prior", "classic", "dated"],
  great: ["remarkable", "splendid", "exceptional", "superb", "magnificent"],
  sure: ["certain", "confident", "convinced", "positive", "assured"],
  right: ["correct", "accurate", "proper", "apt", "fitting"],
  wrong: ["incorrect", "mistaken", "flawed", "erroneous", "misguided"],
  nice: ["pleasant", "agreeable", "lovely", "charming", "delightful"],
  strange: ["peculiar", "unusual", "odd", "curious", "bewildering"],
  // verbs
  think: ["believe", "suspect", "reckon", "suppose", "consider"],
  know: ["understand", "recognize", "gather", "appreciate", "perceive"],
  want: ["seek", "intend", "prefer", "aim for", "desire"],
  need: ["require", "depend on", "rely on", "call for", "demand"],
  make: ["create", "produce", "construct", "assemble", "generate"],
  get: ["obtain", "acquire", "secure", "retrieve", "source"],
  see: ["notice", "observe", "detect", "spot", "witness"],
  use: ["employ", "apply", "leverage", "utilize", "rely on"],
  help: ["assist", "support", "aid", "facilitate", "enable"],
  start: ["begin", "initiate", "kick off", "open", "launch"],
  stop: ["halt", "cease", "discontinue", "pause", "terminate"],
  look: ["appear", "seem", "come across as", "present as", "read as"],
  say: ["state", "declare", "mention", "remark", "assert"],
  tell: ["inform", "advise", "notify", "relay to", "brief"],
  give: ["provide", "offer", "supply", "deliver", "hand over"],
  take: ["seize", "grab", "claim", "accept", "receive"],
  find: ["discover", "locate", "uncover", "identify", "track down"],
  try: ["attempt", "endeavor", "strive", "aim", "venture"],
  keep: ["retain", "maintain", "hold on to", "preserve", "sustain"],
  change: ["alter", "modify", "adjust", "revise", "transform"],
  // nouns
  thing: ["matter", "element", "item", "aspect", "subject"],
  time: ["moment", "period", "point", "interval", "occasion"],
  way: ["approach", "method", "means", "path", "avenue"],
  people: ["individuals", "folks", "persons", "parties", "ones"],
  work: ["effort", "undertaking", "task", "pursuit", "endeavor"],
  idea: ["notion", "concept", "thought", "premise", "proposal"],
  problem: ["issue", "challenge", "concern", "complication", "matter"],
  plan: ["strategy", "approach", "scheme", "blueprint", "framework"],
  part: ["portion", "segment", "section", "component", "piece"],
  place: ["location", "spot", "area", "site", "venue"],
  world: ["realm", "domain", "sphere", "landscape", "arena"],
  fact: ["truth", "reality", "detail", "datum", "observation"],
  // adverbs
  very: ["quite", "rather", "considerably", "notably", "decidedly"],
  really: ["genuinely", "truly", "certainly", "indeed", "in fact"],
  always: ["consistently", "invariably", "unfailingly", "reliably", "perpetually"],
  never: ["rarely", "seldom", "hardly ever", "not once", "at no point"],
  maybe: ["perhaps", "possibly", "conceivably", "it may be that", "presumably"],
  just: ["simply", "merely", "only", "precisely", "exactly"],
  often: ["frequently", "regularly", "routinely", "commonly", "typically"],
  also: ["additionally", "furthermore", "moreover", "likewise", "too"],
  still: ["nevertheless", "even so", "regardless", "all the same", "yet"],
  soon: ["shortly", "before long", "presently", "in due course", "imminently"],
};

const UNHINGED_TEMPLATES = [
  (nouns, text) =>
    `URGENT MEMO: It has come to our attention that the following matter requires immediate review — "${nouns.slice(0, 2).join(" and ")}". Please disregard any prior communications. This supersedes everything. This is not a drill.`,

  (nouns, text) =>
    `The ancients warned of a time when ${nouns[0] || "it"} would come to pass. They were right. And yet here we are, ignoring the signs: ${nouns.slice(1, 3).join(", ")}. The prophecy is already unfolding.`,

  (nouns, text) =>
    `A haiku:\n${(nouns[0] || "the unknown thing").split(" ").slice(0, 3).join(" ")}\n${(nouns[1] || "drifting into the void").split(" ").slice(0, 5).join(" ")}\nnothing is real now`,

  (nouns, text) =>
    `It was a Tuesday. Overcast. The kind of day that makes you question everything — especially ${nouns[0] || "the original note"}. I lit a cigarette I don't own. The answer wasn't there. It never is.`,

  (nouns, text) =>
    `CLASSIFIED — EYES ONLY\nSubject: ${nouns[0] || "the content"}\nThe implications of ${nouns.slice(0, 2).join(" and ") || "this"} are wider than previously disclosed. We recommend saying nothing. Especially not in writing.`,

  (nouns, text) =>
    `Scientists at an undisclosed institution have confirmed that ${nouns[0] || "this"} is, in fact, the opposite of what was originally understood. The research team is unavailable for comment. The paper has been retracted. Make of that what you will.`,

  (nouns, text) =>
    `Dear ${nouns[0] || "Future Self"},\nBy the time you read this, ${nouns[1] || "everything"} will look different. You won't remember writing it. That's okay. Some things are better forgotten. Some things insist on being remembered anyway.`,

  (nouns, text) => {
    const words = text.split(/\s+/).filter((w) => w.length > 4);
    const sampled = words.sort(() => Math.random() - 0.5).slice(0, 5);
    return `[TRANSMISSION CORRUPTED]\n${sampled.join(" ... ")} ... [END OF RECOVERABLE DATA]`;
  },

  (nouns, text) =>
    `PATIENT FILE — DO NOT DISTRIBUTE\nSubject reports recurring thoughts about ${nouns[0] || "unspecified topics"}. When asked about ${nouns[1] || "related matters"}, subject became evasive. Recommend further observation. Session ended abruptly.`,

  (nouns, text) =>
    `RECIPE — Serves 4\nIngredients: 2 cups ${nouns[0] || "ambiguity"}, a pinch of ${nouns[1] || "denial"}, ${nouns[2] || "regret"} to taste.\nDirections: Combine ingredients. Let sit overnight. Do not stir. Serve cold with a side of existential uncertainty.`,

  (nouns, text) =>
    `BREAKING: Local sources confirm that ${nouns[0] || "the situation"} has escalated beyond initial projections. Witnesses describe ${nouns[1] || "the scene"} as "unprecedented." Officials have declined to comment. More at 11.`,

  (nouns, text) =>
    `Once upon a time, in a land governed entirely by ${nouns[0] || "rules no one understood"}, there lived a note. It knew things about ${nouns[1] || "the world"} that nobody wanted to hear. So it changed. And changed again. Until even it forgot what it once said.`,
];

/**
 * Extract content words (nouns/verbs likely) from text for use in templates.
 */
function extractKeyWords(text) {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "that", "this", "it", "i", "we",
    "you", "he", "she", "they", "my", "your", "our", "its", "not", "no",
  ]);
  return text
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w.toLowerCase()))
    .slice(0, 8);
}

/**
 * Level 1: swap 1–2 words with synonyms from the lookup table.
 * Preserves leading capitalization and trailing punctuation.
 */
function mutateLevel1(text) {
  const words = text.split(/(\s+)/);
  let swapCount = 0;
  const maxSwaps = 1 + Math.floor(Math.random() * 2); // 1 or 2 swaps

  return words
    .map((token) => {
      if (swapCount >= maxSwaps) return token;
      const punctMatch = token.match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);
      if (!punctMatch) return token;
      const [, leadPunct, core, trailPunct] = punctMatch;
      const lower = core.toLowerCase();
      const options = SYNONYMS[lower];
      if (options && Math.random() < 0.7) {
        swapCount++;
        let replacement = options[Math.floor(Math.random() * options.length)];
        // Preserve leading capital
        if (core[0] === core[0].toUpperCase() && core[0] !== core[0].toLowerCase()) {
          replacement = replacement[0].toUpperCase() + replacement.slice(1);
        }
        return leadPunct + replacement + trailPunct;
      }
      return token;
    })
    .join("");
}

/**
 * Level 2: rewrite one sentence with a perspective or structural shift.
 */
function mutateLevel2(text) {
  // First apply a level-1 mutation
  let result = mutateLevel1(text);

  // Split into sentences
  const sentences = result.match(/[^.!?]+[.!?]*/g) || [result];
  if (sentences.length === 0) return result;

  const transforms = [
    // Add an editorial interjection
    (s) => s.trim() + " (or so I thought.)",
    // Flip certainty
    (s) => s.replace(/\b(is|are|was|were)\b/i, (m) => `${m} allegedly`),
    // Bureaucratic hedge
    (s) => `Per the available evidence, ` + s[0].toLowerCase() + s.slice(1),
    // Dramatic pause
    (s) => s.replace(/,/, " —"),
    // Add mild conspiracy
    (s) => s.trimEnd().replace(/[.!?]$/, "") + ", which some find suspicious.",
    // Passive voice hint
    (s) =>
      s.replace(/\bI\b/g, "one").replace(/\bmy\b/gi, "one's").replace(/\bme\b/gi, "one"),
    // Future tense shift
    (s) => s.replace(/\b(is|are)\b/i, (m) => `will be`),
    // Unreliable narrator
    (s) => s.trim() + " At least, that's the version I'm going with.",
    // Unnecessary qualifier
    (s) => `For reasons that may or may not be clear, ` + s[0].toLowerCase() + s.slice(1),
    // Footnote style
    (s) => s.trimEnd().replace(/[.!?]$/, "") + " [citation needed].",
  ];

  // Pick a random sentence to transform
  const idx = Math.floor(Math.random() * sentences.length);
  const transform = transforms[Math.floor(Math.random() * transforms.length)];
  sentences[idx] = transform(sentences[idx]);

  return sentences.join("");
}

/**
 * Level 3: fully unhinged — extract key words and apply an unhinged template.
 * Falls back to level 2 if text is too short for meaningful keyword extraction.
 */
function mutateLevel3(text) {
  const keywords = extractKeyWords(text);
  if (keywords.length === 0) {
    return mutateLevel2(text);
  }
  const template = UNHINGED_TEMPLATES[Math.floor(Math.random() * UNHINGED_TEMPLATES.length)];
  return template(keywords, text);
}

/**
 * Main export: mutate(text, level) → mutated string.
 * level: 0 = original, 1 = subtle, 2 = moderate, 3 = unhinged
 */
function mutate(text, level) {
  if (!text || level === 0) return text;
  if (level === 1) return mutateLevel1(text);
  if (level === 2) return mutateLevel2(text);
  return mutateLevel3(text);
}

module.exports = { mutate };
