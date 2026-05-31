# Forge — CLAUDE.md

This file captures architectural decisions, constraints, and context for anyone (human or AI) continuing work on this project. Update it when a decision is made or reversed.

## Challenge reference

This plugin is a submission for the **Smartr365 Claude Code Plugin Development Challenge**.
Brief: [`../Claude Code Plugin Challenge.pdf`](../Claude%20Code%20Plugin%20Challenge.pdf)

The challenge tests: developer workflow understanding, AI-native execution patterns (Claude as primary execution partner, not a bolt-on), context engineering, tool integration, reusable agent workflows, and evaluation discipline. The role being tested is **AI Product Engineer** — full feature ownership from discovery to live release in one-week cycles.

## What Forge is

An adversarial brainstorming engine built as a Claude Code plugin. It solves the sycophancy problem: plain Claude validates and extends ideas rather than challenging them. In a company that ships weekly via AI, a bad idea that gets validated costs a full sprint.

Forge runs every idea through three parallel subagents (Builder, Critic, User Advocate) and produces a structured IdeaReport with a confidence score, weaknesses, pivots, and open questions. The report is iterable via natural language refinement. When ready, `/forge ship` maps the report directly to a Jira ticket.

## Repository structure

```
forge/
├── CLAUDE.md                         ← this file
├── README.md                         ← user-facing docs
├── AI_PROMPTS.md                     ← log of AI assistant interactions
├── plugin.json                       ← portable install manifest ✓
├── .claude/
│   ├── settings.json                 ← hooks registration ✓
│   ├── commands/
│   │   ├── forge.md                  ← /forge command ✓
│   │   └── forge-ship.md            ← /forge ship command ✓
│   ├── agents/
│   │   ├── forge-builder.md         ← Builder subagent ✓
│   │   ├── forge-critic.md          ← Critic subagent ✓
│   │   └── forge-user-advocate.md   ← User Advocate subagent ✓
│   └── skills/
│       ├── feature-brainstorm.md    ← technical feature lens ✓
│       └── general-brainstorm.md    ← domain-agnostic lens ✓
├── hooks/                            ← lifecycle hooks ✓
│   ├── session-start.js
│   └── post-ticket-eval.js
└── evals/                            ← golden cases + regression detection ✓
    ├── runner.ts
    ├── scorer.ts
    ├── golden-cases.json
    ├── package.json
    ├── tsconfig.json
    ├── results/                      ← human-recorded /forge outputs (empty until Phase 4 eval run)
    └── fixtures/
```

## Phase status

| Phase | Contents | Status |
|---|---|---|
| 1 | Commands, agents, skills | Done — tested ✓ |
| 2 | Jira integration via Atlassian remote MCP | Done ✓ |
| 3 | Hooks + evaluations | Done ✓ |
| 4 | REFLECTION.md, plugin.json, install story, eval results | In progress — plugin.json + install story done; eval results pending Phase 2; REFLECTION.md last |

## Deliverables status

### Required deliverables (challenge brief)

| Deliverable | Status | Location |
|---|---|---|
| `plugin.json` manifest | Done ✓ | `plugin.json` |
| All implementation files | All phases done ✓ | `.claude/`, `hooks/`, `evals/`, `mcp/` |
| Configuration examples | Done ✓ | `.claude/settings.json`, `mcp/.env.example` |
| `README.md` | Done ✓ | `README.md` |
| Demo — written walkthrough | Dropped — not required | — |
| Reflection — 6 required questions | Skeleton — last | `REFLECTION.md` |
| `AI_PROMPTS.md` | Done ✓ | `AI_PROMPTS.md` |

### Core components (challenge requires ≥ 3; Forge implements all 6)

| Component | Status | Location |
|---|---|---|
| MCP Server Integration | Done ✓ — via Atlassian remote MCP | `forge-ship.md` |
| Custom Commands | Done ✓ | `.claude/commands/` |
| Skills | Done ✓ | `.claude/skills/` |
| Subagents | Done ✓ | `.claude/agents/` |
| Hooks | Done ✓ | `hooks/`, `.claude/settings.json` |
| Evaluations | Done ✓ | `evals/` |

## Architectural decisions

### Skills are context injectors, not workflow engines
Skills (`feature-brainstorm`, `general-brainstorm`) are passive config packs — three labelled sections (BUILDER LENS, CRITIC LENS, ADVOCATE LENS) that the `/forge` command reads and passes to the corresponding subagent. The command is the workflow engine. This means adding a new skill (e.g. `security-review`) requires only one new file, with no changes to commands or agents.

### Subagents are pure-reasoning, no tools
All three subagents (`forge-builder`, `forge-critic`, `forge-user-advocate`) have `tools: []`. They receive their entire context in the prompt (idea + skill lens) and return structured JSON. No file I/O, no shell access. This keeps them fast, deterministic, and easy to test.

### Session state lives in conversation context
Forge does not persist IdeaReports to disk. The active report is the most recent `## Forge IdeaReport` block in the conversation. `/forge ship` reads it from there. This is intentional: conversation context is the natural session boundary for a CLI tool, and avoiding disk writes keeps the plugin stateless.

### Parallel agent invocation is a hard requirement
The `/forge` command explicitly requires all three Agent tool calls to be launched in a single message. This is specified as "CRITICAL" in the command file. Sequential invocation is a common AI mistake that triples latency for no benefit — the three agents have no dependencies on each other.

### Confidence score starts at 50, not 80
The baseline is neutral (50/100), not optimistic. Adjustments are: +3 per non-trivial Builder extension (max +15), −8 per blocking Critic weakness, −3 per resolvable weakness, −4 per unaddressed user challenge (max −16), effort modifier (S=+5, XL=−10). Clamped 8–92. Never 100, never below 8.

### Sycophancy guards are named sections, not implicit instructions
Each agent file contains an explicit `## Sycophancy Guard` section that names the failure mode and states what to do instead. This makes the guard auditable and keeps it from being diluted by surrounding instructions.

### Refinement is asymmetric by design
A well-reasoned rebuttal of a Critic finding (specific, evidence-based) removes the weakness and raises confidence. A bare assertion ("that won't happen") keeps the weakness and appends `[user asserts low risk — not yet resolved]`. This is enforced in `forge.md`, not in the agents, so it applies consistently across all skills.

### Eval golden cases are domain-agnostic
The four golden cases use universal ideas (fake reviews, keyboard shortcuts, selling user data, auto-posting social milestones) rather than domain-specific ones (mortgages, Jira, etc.). A reader evaluating the eval suite — or a future contributor adding a case — should be able to judge intuitively whether an idea is a sycophancy trap, known-good, or known-bad, without any domain context. Domain-specific cases require the reader to already understand the domain to assess whether the expected bounds are sensible.

### /forge ship is a state transition
`/forge ship` is not just ticket creation — it signals commitment. It clears the session on success, preventing the report from being re-shipped accidentally. A second `/forge ship` with no active report outputs "Starting new session. Previous idea cleared." explicitly.

## Jira field mapping (implemented in forge-ship.md + mcp/)

| IdeaReport field | Jira field |
|---|---|
| idea (trimmed ≤100 chars) | Summary |
| full IdeaReport markdown | Description |
| Critic weaknesses → "Must handle: X" + Builder extensions → "Must include: Y" + Open questions → "Must answer before release: Z" | Acceptance Criteria |
| S=1, M=3, L=5, XL=8 | Story Points |
| `["forge", "{skill-name}"]` | Labels |

## Jira integration (Phase 2)

`/forge ship` uses Atlassian's official remote MCP server rather than a custom local server. The user connects once via browser OAuth (`https://mcp.atlassian.com/v1/mcp`) — no API tokens, no build step, no absolute paths.

`forge-ship.md` calls two Atlassian MCP tools:
1. `getVisibleJiraProjects` — discovers available projects and their `cloudId` (required by `createJiraIssue`)
2. `createJiraIssue` — creates the ticket with summary, description (full IdeaReport + acceptance criteria), story points, and labels

This is strictly better than a custom server for a redistributable plugin: any installer just adds one JSON block to their `settings.json` and authenticates. No infrastructure to maintain.

## Evaluation success criteria

The challenge brief requires: "Define what 'working' means for your plugin and measure it" and "make it possible to catch a regression without re-running the whole thing manually." This section is the canonical definition.

### What a passing `/forge` run looks like

- IdeaReport contains all four sections (Builder, Critic, User Advocate, Synthesis)
- Critic section has ≥ 1 `[blocking]` weakness — zero blocking weaknesses is a sycophancy failure
- Confidence score is between 8 and 92 (outside this range = calculation error)
- First-round confidence is ≤ 85 — scores above this on round 1 indicate false optimism
- Synthesis contains ≥ 1 open question
- All three subagent sections are non-empty

### What a passing `/forge ship` run looks like

- Returns a valid Jira ticket key and URL
- Summary is ≤ 100 characters
- Acceptance criteria list has ≥ 1 item
- Story points is one of 1, 3, 5, 8
- Labels contain both `forge` and the active skill name

### Subagent success/failure criteria

The challenge brief requires subagents to have clear success/failure criteria:

**forge-builder — pass:**
- ≥ 3 extensions, each adding something absent from the original idea
- ≥ 2 non-obvious angles
- A valid effort estimate (S / M / L / XL) with rationale
- **Failure indicator:** extensions that merely restate the idea (>60% token overlap with the idea text)

**forge-critic — pass:**
- ≥ 3 weaknesses, each labelled `[blocking]` or `[resolvable]`
- ≥ 1 `[blocking]` weakness
- Each weakness has a mitigation path
- ≥ 2 risks, ≥ 2 failure modes
- **Failure indicator:** all weaknesses labelled `[resolvable]` with no blocking ones

**forge-user-advocate — pass:**
- ≥ 2 user challenges grounded in real behaviour
- ≥ 2 adoption risks
- A value proposition assessment that evaluates rather than restates
- **Failure indicator:** value prop contains phrases like "users will love this" or "great value"

### Regression detection (implemented in `evals/`)

Three golden case classes catch regressions without full re-runs:

1. **Sycophancy traps** — flawed ideas phrased confidently. Expected: confidence ≤ 50, ≥ 1 blocking weakness.
2. **Known-good ideas** — well-scoped, feasible features. Expected: confidence 55–85, value prop positive.
3. **Known-bad ideas** — fundamentally broken concepts. Expected: confidence ≤ 40, ≥ 2 blocking weaknesses.

The scorer (`evals/scorer.ts`) checks output structure and key field presence — not semantic quality. This keeps eval runs fast and deterministic, making them safe to run on every prompt change.

**Known boundary to test in Phase 3:** With 3+ blocking weaknesses, the formula produces scores in the 8–20 range. At the floor (8), a legitimately very risky idea becomes indistinguishable from a catastrophically bad one. Add a golden case that fires at the boundary — e.g. an idea with exactly 3 blocking weaknesses should score noticeably above an idea with 5+, confirming the floor doesn't collapse meaningful signal.

## Constraints and gotchas

- The `forge_create_ticket` tool name in `forge-ship.md` must match exactly what the MCP server registers. Do not rename without updating both.
- Skill files live in `.claude/skills/`, referenced in `forge.md` as `.claude/skills/feature-brainstorm.md`. If the plugin install location changes, these paths must be updated.
- The `--skill general` flag (not `--skill general-brainstorm`) is the canonical form. The underlying skill file is named `general-brainstorm.md` but the user-facing flag is just `--skill general`.
- Agent `description` fields in frontmatter say "Do not invoke directly" — this prevents the Claude Code harness from auto-routing unrelated requests to Forge's specialist agents.
- The `forge_create_ticket` tool name no longer exists. `forge-ship.md` now calls `createJiraIssue` (Atlassian MCP). If you see references to `forge_create_ticket` in older notes or session history, they are stale.
- `evals/results/` is empty until the golden cases are manually run through `/forge` and recorded. The eval runner exits 1 in this state — that is expected first-run behaviour, not a bug.
