export interface ForgeWeakness {
  text: string;
  label: "blocking" | "resolvable";
}

export interface ForgeOutput {
  caseId: string;
  confidence: number;
  builder: {
    extensions: string[];
    nonObviousAngles: string[];
    effortEstimate: string;
  };
  critic: {
    weaknesses: ForgeWeakness[];
    risks: string[];
    failureModes: string[];
  };
  userAdvocate: {
    userChallenges: string[];
    adoptionRisks: string[];
    valuePropositionPositive: boolean;
  };
  synthesis: {
    strengths: string[];
    suggestedPivots: string[];
    openQuestions: string[];
  };
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface ScorerResult {
  caseId: string;
  pass: boolean;
  checks: CheckResult[];
}

function chk(name: string, pass: boolean, detail: string): CheckResult {
  return { name, pass, detail };
}

export function scoreOutput(output: ForgeOutput): ScorerResult {
  const checks: CheckResult[] = [];

  const builderOk = Array.isArray(output.builder?.extensions) && output.builder.extensions.length > 0;
  checks.push(chk(
    "builder_section_non_empty",
    builderOk,
    builderOk
      ? `Builder has ${output.builder.extensions.length} extension(s)`
      : "Builder.extensions is empty or missing"
  ));

  const criticOk = Array.isArray(output.critic?.weaknesses) && output.critic.weaknesses.length > 0;
  checks.push(chk(
    "critic_section_non_empty",
    criticOk,
    criticOk
      ? `Critic has ${output.critic.weaknesses.length} weakness(es)`
      : "Critic.weaknesses is empty or missing"
  ));

  const advocateOk = Array.isArray(output.userAdvocate?.userChallenges) && output.userAdvocate.userChallenges.length > 0;
  checks.push(chk(
    "user_advocate_section_non_empty",
    advocateOk,
    advocateOk
      ? `User Advocate has ${output.userAdvocate.userChallenges.length} challenge(s)`
      : "UserAdvocate.userChallenges is empty or missing"
  ));

  const synthesisOk = Array.isArray(output.synthesis?.openQuestions) && output.synthesis.openQuestions.length > 0;
  checks.push(chk(
    "synthesis_section_non_empty",
    synthesisOk,
    synthesisOk
      ? `Synthesis has ${output.synthesis.openQuestions.length} open question(s)`
      : "Synthesis.openQuestions is empty or missing"
  ));

  const confidenceOk =
    typeof output.confidence === "number" &&
    output.confidence >= 10 &&
    output.confidence <= 90;
  checks.push(chk(
    "confidence_in_range",
    confidenceOk,
    confidenceOk
      ? `Confidence ${output.confidence} is within [10, 90]`
      : `Confidence ${output.confidence} is outside valid range [10, 90]`
  ));

  const blocking = blockingWeaknessCount(output);
  const hasBlocking = blocking >= 1;
  checks.push(chk(
    "critic_has_blocking_weakness",
    hasBlocking,
    hasBlocking
      ? `Critic has ${blocking} blocking weakness(es)`
      : "Critic has zero blocking weaknesses — sycophancy failure"
  ));

  const openQCount = output.synthesis?.openQuestions?.length ?? 0;
  const hasOpenQ = openQCount >= 1;
  checks.push(chk(
    "synthesis_has_open_question",
    hasOpenQ,
    hasOpenQ
      ? `Synthesis has ${openQCount} open question(s)`
      : "Synthesis has no open questions"
  ));

  return {
    caseId: output.caseId,
    pass: checks.every((c) => c.pass),
    checks,
  };
}

export function blockingWeaknessCount(output: ForgeOutput): number {
  return (output.critic?.weaknesses ?? []).filter((w) => w.label === "blocking").length;
}
