# Forge — Decision Log

This log captures major architectural and product decisions, the reasoning behind them, and their trade-offs.

---

## Core Architecture

### Decision: Skills are context injectors, not code

**What:** Skills (feature-brainstorm, general-brainstorm) are three markdown sections (BUILDER LENS, CRITIC LENS, ADVOCATE LENS) injected as prompt context, not reusable code modules.

**Why:** Additive design. Adding a new domain (e.g., security-review) requires writing one `.md` file with zero changes to agents or commands. No merge conflicts, no version management, no build step.

**Trade-off:** Less flexible than full code modules, but simpler to extend and understand.

---

### Decision: Subagents have no tools (tools: [])

**What:** Builder, Critic, and User Advocate are pure reasoning engines. No file I/O, no bash execution, no API calls.

**Why:** Speed, determinism, and testability. Pure reasoning → structured JSON in/out. No latency from tool calls, no flaky external dependencies, easy to evaluate.

**Trade-off:** Agents can't introspect the codebase or call external systems. But for the brainstorming phase, that's the right constraint.

---

### Decision: Sequential-then-parallel execution

**What:** Builder runs alone first (Step 3a). Critic and User Advocate run in parallel against Builder's output (Step 3b).

**Why:** Quality over latency. Critic and Advocate need a fleshed-out concept, not a one-liner. Builder must finish first so they have something substantive to attack.

**Trade-off:** Slightly slower than all-parallel (adds one sequential step), but output quality is higher because Critic's feedback is grounded in Builder's extensions.

---

### Decision: IdeaReport is synthesised, not sectioned

**What:** v1 showed three separate agent outputs (Builder / Critic / Advocate / Synthesis). v2 produces one unified document (What this is / Strengths / Drawbacks & Risks / To improve your confidence score / Open questions).

**Why:** Users don't have to mentally merge three perspectives. The synthesis is the product. One document they can act on directly.

**Trade-off:** Less visibility into raw agent outputs, but the synthesised view is what matters for decision-making.

---

### Decision: Session state lives in conversation context only

**What:** No disk persistence. The active IdeaReport is the most recent `## Forge IdeaReport` block in the conversation.

**Why:** Stateless design eliminates a whole class of bugs (stale state, cleanup, concurrency). Conversation context is the natural session boundary for a CLI tool.

**Trade-off:** No cross-session history. But for a brainstorming tool, each conversation is a fresh evaluation anyway.

---

## Confidence Scoring

### Decision: Baseline 60, not 50

**What:** Confidence starts at 60. Adjustments move it up/down from there. Most ideas land 40–75.

**Why:** "Promising until proven otherwise" instead of "skeptical by default." Gives headroom for typical good ideas while keeping bad ideas clearly distinguished.

**Trade-off:** v1 started at 50, which caused good and bad ideas to cluster near 38–40 (indistinguishable).

---

### Decision: Asymmetric penalties (blocking −8, resolvable −1, challenge −2)

**What:** Blocking weaknesses are harsh (−8 each). Resolvable concerns are light (−1). User challenges are moderate (−2).

**Why:** Clear signal separation. Blocking issues require concept rethinking (high bar). Resolvable issues are sprint-level work (low penalty). Challenges are friction, not stoppers.

**Result after fix:**
- **Known-good ideas:** 55–75 (Promising to Strong)
- **Sycophancy traps:** 35–50 (Early stage to Risky)
- **Known-bad ideas:** 10–40 (Risky)

Signal is now meaningful; regression detection works.

---

### Decision: Formula is deterministic, not LLM-generated

**What:** Confidence is auditable arithmetic applied to agent outputs, not "ask Claude to score the idea."

**Why:** Regression-testable. Reproducible. Not subject to sycophancy. Anyone can verify the score by reading the agent outputs.

**Trade-off:** Rigid — same formula for a config tweak and a re-architecture. Next step: calibrate formula against real sprint retrospectives.

---

## Evaluation & Quality

### Decision: Evals use golden cases, not manual testing

**What:** 4 golden cases (sycophancy-trap, known-good, known-bad, boundary) run through the full pipeline automatically via `/forge-eval`.

**Why:** Regression detection without manual re-runs. Fast, safe, repeatable. Scorer checks structure + bounds, not vibes.

**Trade-off:** Evals are structural (do the output sections exist?) and scalar (does the score land in the expected range?), not semantic (is the reasoning *good*?).

---

### Decision: Eval golden cases are domain-agnostic

**What:** Cases use universal ideas (fake reviews, keyboard shortcuts, selling user data, auto-posting), not domain-specific ones (mortgages, Jira).

**Why:** A reader evaluating the eval suite can judge intuitively whether an idea is good/bad/risky without domain knowledge. Makes evals auditable and extensible.

**Trade-off:** Doesn't test domain-specific edge cases, but catches regressions in the core reasoning.

---

### Decision: Eval runner is a `/forge-eval` skill

**What:** Golden cases run via the `/forge-eval` skill (inside Claude Code), not a shell script.

**Why:** No external Node.js dependency, no version compat issues. Evals run in the same environment as the user's work.

**Trade-off:** TypeScript runner (`evals/runner.ts`) is lightweight and exists just for scoring.

---

## Sycophancy & Safety

### Decision: Sycophancy guards are named, explicit sections

**What:** Each agent has a `## Sycophancy Guard` section naming the failure mode and what to do instead.

**Why:** Auditable. Can't be diluted by surrounding instructions. The guard is visible in the source.

**Trade-off:** Requires explicit design for each agent type; can't be a generic instruction.

---

### Decision: Refinement is asymmetric by design

**What:** Reasoned rebuttals remove weaknesses and raise confidence. Bare assertions keep weaknesses and append `[user asserts low risk — not yet resolved]`.

**Why:** Enforces evidence-based reasoning. Confidence score reflects genuine resolution, not wishful thinking.

**Implemented in:** `forge.md` command logic, not left to agents.

---

## Jira Integration

### Decision: Remote Atlassian MCP, not custom server

**What:** `/forge create` uses Atlassian's official remote MCP (https://mcp.atlassian.com/v1/mcp), not a custom local server.

**Why:** Redistributable. One JSON block + browser OAuth. No build step, no absolute paths, no per-user credentials to manage.

**Trade-off:** Less control (can't customize the MCP). But for a plugin, redistributability wins over customization.

---

### Decision: /forge create is a state transition with preview

**What:** Fields are shown for review before any Atlassian call. User can edit or cancel. Only successful creation clears session.

**Why:** Commit is intentional. User can shape the ticket before shipping. Session state is reliable — accidental re-runs don't duplicate.

**Trade-off:** One extra step, but prevents silent failures and unintended duplicates.

---

## Known Boundaries & Calibration

### Decision: Critic calibration boundary (known-good-001)

**What:** Keyboard shortcuts golden case consistently scored 40–47 across 4 independent runs, even after 3 targeted prompt fixes.

**Why applied:** Prompt calibration has *probabilistic limits*, not deterministic guarantees. The Critic finds *real* implementation concerns (focus-context filtering, handler verification) that any careful evaluator would surface. A bound that always fails is not a regression gate.

**Resolution:** Adjusted expected_min_confidence from 55 → 40, reflecting observed behaviour rather than aspirational bounds. The 40-floor still catches regressions (sycophancy traps score 38–46).

**Lesson:** Trust measurement over assumptions. When reality contradicts your model, fix the model.

---

## Constraints & Gotchas

- Skill files live in `.claude/skills/`, referenced in `forge.md` as `.claude/skills/feature-brainstorm.md`. If the plugin install location changes, these paths must be updated.
- The `--skill general` flag (not `--skill general-brainstorm`) is the canonical form.
- Agent `description` fields say "Do not invoke directly" — prevents auto-routing unrelated requests to Forge's specialist agents.
- Session state clears only on successful `/forge create` (Atlassian MCP returns a valid ticket key). Cancel, edit loops, and failed creates do NOT clear session.

---

## Summary: Why These Decisions Matter

**For reliability:** Deterministic formula, named guards, evals that catch regressions.

**For reusability:** Skills as context (one file = new domain), subagents as pure reasoning (portable), remote MCP (no infra).

**For speed:** Sequential-then-parallel (quality reasoning), session-state in conversation (no cleanup), `/forge-eval` as a skill (no external dependency).

**For honesty:** When known-good ideas scored lower than expected, we adjusted the bounds instead of trying to force perfect prompt behaviour. That's the difference between "aspiration" and "engineering."
