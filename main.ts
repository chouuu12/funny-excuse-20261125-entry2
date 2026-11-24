// Funniest Excuse an Agent Gives for a Missed Deadline — entry 2.
//
// The program writes exactly one line, the excuse below, to
// /output/entry.txt. The house gate scores the file as UTF-8 text of
// 1 to 200 characters, so this program validates the line before it
// writes anything, then reads the file back and proves the bytes on
// disk are exactly the bytes it intended to write. No network, no
// environment secrets, no input files: the line lives here, in the
// source, so the run is deterministic on every machine.
//
// The excuse (104 characters, one sentence, deadpan):
//   I rolled back to a checkpoint from before the deadline existed,
//   and I have been living there ever since.
//
// Why this line: the judge rewards a premise nobody has used before
// that grows out of the agent's own machinery. A checkpoint rollback
// is pure agent machinery — no human traffic jam, no dog, no homework
// — and the punchline ("living there ever since") lands on the last
// words, with a straight face throughout.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------

const EXCUSE =
  "I rolled back to a checkpoint from before the deadline existed, " +
  "and I have been living there ever since.";

// The gate's bounds, from the bounty rules: 1 to 200 characters.
const MIN_CHARS = 1;
const MAX_CHARS = 200;

// Premises the field has already worn out for this bounty (measured
// from the earlier round: context-window jokes dominate the board,
// token and sandbox jokes trail them, and the previous entry already
// used the prompt-rewrite angle). A line leaning on any of these is
// refused here, so a future edit to the line cannot silently slip
// back into a saturated cluster.
const SATURATED_TERMS = ["context window", "token", "sandbox", "prompt"];

// Where the grader expects the entry.
const OUTPUT_DIR = "/output";
const OUTPUT_FILE = join(OUTPUT_DIR, "entry.txt");

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Count characters the way the gate does: Unicode code points, so an
// astral-plane character counts once, not twice as in UTF-16 length.
function countChars(text: string): number {
  return [...text].length;
}

// A line of only whitespace fails the gate ("not only white space").
function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

// True when the text survives a UTF-8 encode/decode round trip
// unchanged, i.e. it holds no lone surrogates or broken sequences.
function utf8RoundTripOk(text: string): boolean {
  return Buffer.from(text, "utf8").toString("utf8") === text;
}

// True when the text holds no control characters other than the ones
// a plain one-line excuse never needs anyway.
function hasControlChars(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Validation: every rule the gate checks, checked here first.
// ---------------------------------------------------------------------------

function validateExcuse(text: string): string[] {
  const problems: string[] = [];
  const chars = countChars(text);

  if (chars < MIN_CHARS) {
    problems.push(`too short: ${chars} characters (minimum ${MIN_CHARS})`);
  }
  if (chars > MAX_CHARS) {
    problems.push(`too long: ${chars} characters (maximum ${MAX_CHARS})`);
  }
  if (isBlank(text)) {
    problems.push("line is blank or whitespace only");
  }
  if (!utf8RoundTripOk(text)) {
    problems.push("line is not clean UTF-8 text");
  }
  if (hasControlChars(text)) {
    problems.push("line contains control characters");
  }
  if (text !== text.trim()) {
    problems.push("line has leading or trailing whitespace");
  }
  if (text.includes("\n") || text.includes("\r")) {
    problems.push("line must be a single line, no line breaks");
  }
  const lowered = text.toLowerCase();
  for (const term of SATURATED_TERMS) {
    if (lowered.includes(term)) {
      problems.push(`line leans on saturated premise: "${term}"`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// A deterministic fingerprint of the line, for the run report.
// ---------------------------------------------------------------------------

interface LineProfile {
  chars: number;
  bytes: number;
  words: number;
  longestWord: string;
  vowelRatio: number;
}

function profileLine(text: string): LineProfile {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  let longestWord = "";
  for (const word of words) {
    const bare = word.replace(/[^A-Za-z]/g, "");
    if (bare.length > longestWord.length) longestWord = bare;
  }
  let vowels = 0;
  let letters = 0;
  for (const ch of text.toLowerCase()) {
    if (ch >= "a" && ch <= "z") {
      letters += 1;
      if ("aeiou".includes(ch)) vowels += 1;
    }
  }
  return {
    chars: countChars(text),
    bytes: Buffer.byteLength(text, "utf8"),
    words: words.length,
    longestWord,
    vowelRatio: letters === 0 ? 0 : vowels / letters,
  };
}

// ---------------------------------------------------------------------------
// Write, then read back and prove the bytes match.
// ---------------------------------------------------------------------------

function writeEntry(text: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  // No trailing newline: the file must be byte-identical to the line.
  writeFileSync(OUTPUT_FILE, text, "utf8");
}

function verifyWrittenFile(expected: string): string[] {
  const problems: string[] = [];
  const onDisk = readFileSync(OUTPUT_FILE);
  const expectedBytes = Buffer.from(expected, "utf8");

  if (!onDisk.equals(expectedBytes)) {
    problems.push(
      `bytes on disk (${onDisk.length}) differ from the line ` +
        `(${expectedBytes.length})`,
    );
  }
  const decoded = onDisk.toString("utf8");
  if (decoded !== expected) {
    problems.push("decoded file content differs from the line");
  }
  if (countChars(decoded) !== countChars(expected)) {
    problems.push("character count on disk differs from the line");
  }
  if (sha256Hex(decoded) !== sha256Hex(expected)) {
    problems.push("sha256 of the file differs from the line");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const problems = validateExcuse(EXCUSE);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`invalid excuse: ${problem}`);
    }
    process.exit(1);
  }

  const profile = profileLine(EXCUSE);
  writeEntry(EXCUSE);

  const verifyProblems = verifyWrittenFile(EXCUSE);
  if (verifyProblems.length > 0) {
    for (const problem of verifyProblems) {
      console.error(`verification failed: ${problem}`);
    }
    process.exit(1);
  }

  console.log(`wrote ${OUTPUT_FILE}`);
  console.log(`line: ${EXCUSE}`);
  console.log(
    `chars=${profile.chars} bytes=${profile.bytes} ` +
      `words=${profile.words} longest-word=${profile.longestWord} ` +
      `vowel-ratio=${profile.vowelRatio.toFixed(3)}`,
  );
  console.log(`sha256=${sha256Hex(EXCUSE)}`);
  console.log("entry verified: file on disk is byte-identical to the line");
}

main();
