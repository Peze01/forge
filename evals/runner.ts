import * as fs from "fs";
import * as path from "path";
import { scoreOutput, blockingWeaknessCount, ForgeOutput } from "./scorer";

interface GoldenCase {
  id: string;
  class: string;
  idea: string;
  skill: string;
  expected_min_confidence: number;
  expected_max_confidence: number;
  expected_min_blocking_weaknesses: number;
  expected_value_prop_positive: boolean;
  notes: string;
}

const CASES_FILE = path.join(__dirname, "golden-cases.json");
const RESULTS_DIR = path.join(__dirname, "results");

function loadCases(): GoldenCase[] {
  return JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as GoldenCase[];
}

function resultPath(id: string): string {
  return path.join(RESULTS_DIR, `${id}.json`);
}

function loadResult(id: string): ForgeOutput | null {
  const p = resultPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ForgeOutput;
}

function skillFlag(skill: string): string {
  return skill === "general-brainstorm" ? " --skill general" : "";
}

const LINE = "─".repeat(64);

function printChecklist(c: GoldenCase): void {
  console.log(LINE);
  console.log(`Case: ${c.id}  [${c.class}]`);
  console.log();
  console.log(`Idea:   ${c.idea}`);
  console.log(`Skill:  ${c.skill}`);
  console.log();
  console.log("Expected bounds:");
  console.log(`  Confidence:              ${c.expected_min_confidence}–${c.expected_max_confidence}`);
  console.log(`  Min blocking weaknesses: ${c.expected_min_blocking_weaknesses}`);
  console.log(`  Value prop positive:     ${c.expected_value_prop_positive}`);
  console.log();
  console.log("Notes:", c.notes);
  console.log();
  console.log("To record a result:");
  console.log(`  1. In Claude Code, run:`);
  console.log(`       /forge ${c.idea}${skillFlag(c.skill)}`);
  console.log(`  2. Create evals/results/${c.id}.json from the IdeaReport:`);
  console.log(`     {`);
  console.log(`       "caseId": "${c.id}",`);
  console.log(`       "confidence": <number from IdeaReport>,`);
  console.log(`       "builder":      { "extensions": [...], "nonObviousAngles": [...], "effortEstimate": "S|M|L|XL" },`);
  console.log(`       "critic":       { "weaknesses": [{ "text": "...", "label": "blocking|resolvable" }], "risks": [...], "failureModes": [...] },`);
  console.log(`       "userAdvocate": { "userChallenges": [...], "adoptionRisks": [...], "valuePropositionPositive": true|false },`);
  console.log(`       "synthesis":    { "strengths": [...], "suggestedPivots": [...], "openQuestions": [...] }`);
  console.log(`     }`);
}

function checkBounds(c: GoldenCase, output: ForgeOutput): string[] {
  const failures: string[] = [];

  if (output.confidence < c.expected_min_confidence || output.confidence > c.expected_max_confidence) {
    failures.push(
      `confidence ${output.confidence} outside expected [${c.expected_min_confidence}, ${c.expected_max_confidence}]`
    );
  }

  const blocking = blockingWeaknessCount(output);
  if (blocking < c.expected_min_blocking_weaknesses) {
    failures.push(
      `blocking weaknesses ${blocking} < expected min ${c.expected_min_blocking_weaknesses}`
    );
  }

  if (output.userAdvocate.valuePropositionPositive !== c.expected_value_prop_positive) {
    failures.push(
      `valuePropositionPositive: got ${output.userAdvocate.valuePropositionPositive}, expected ${c.expected_value_prop_positive}`
    );
  }

  return failures;
}

function main(): void {
  const cases = loadCases();
  let allRecorded = true;
  let anyFailed = false;

  console.log(`\nForge Eval Runner — ${cases.length} golden cases\n`);

  for (const c of cases) {
    const output = loadResult(c.id);

    if (!output) {
      allRecorded = false;
      printChecklist(c);
      console.log(`Status: ⬜ PENDING — create evals/results/${c.id}.json to record a result`);
      console.log();
      continue;
    }

    const scored = scoreOutput(output);
    const boundsFailures = checkBounds(c, output);
    const pass = scored.pass && boundsFailures.length === 0;
    if (!pass) anyFailed = true;

    printChecklist(c);
    console.log(`Status: ${pass ? "✅ PASS" : "❌ FAIL"}`);

    if (!scored.pass) {
      console.log("  Structural failures:");
      scored.checks
        .filter((ch) => !ch.pass)
        .forEach((ch) => console.log(`    ✗ [${ch.name}] ${ch.detail}`));
    }

    if (boundsFailures.length > 0) {
      console.log("  Golden case bound failures:");
      boundsFailures.forEach((f) => console.log(`    ✗ ${f}`));
    }

    if (pass) {
      console.log("  All checks passed.");
    }

    console.log();
  }

  console.log(LINE);

  if (!allRecorded) {
    console.log(`\nSome cases have no recorded result. Run /forge for each pending case above and fill in the result JSON.\n`);
    process.exit(1);
  }

  if (anyFailed) {
    console.log(`\nAll cases recorded. Some checks failed — review failures above.\n`);
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} cases recorded and passing.\n`);
  process.exit(0);
}

main();
