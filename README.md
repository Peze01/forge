# Forge

A Claude Code plugin that runs adversarial brainstorming on any idea. Builder runs first to flesh out the concept, then Critic and User Advocate challenge it in parallel — producing a synthesised IdeaReport with a confidence score, strengths, drawbacks, and open questions. When you're ready to commit, `/forge create` maps the report directly to a Jira ticket.

## The problem it solves

Plain Claude is sycophantic. It validates and builds on what you say rather than challenging it. At a company that ships weekly via AI, a bad idea that gets validated costs a full sprint. Forge makes adversarial thinking the default entry point — before a line of code is written.

## How it works

```
/forge add OAuth SSO to the mortgage portal
```

Forge runs Builder first to flesh out the idea, then launches Critic and User Advocate **in parallel** against the expanded concept:

| Subagent          | Role                                                            |
| ----------------- | --------------------------------------------------------------- |
| **Builder**       | Extends the idea, surfaces non-obvious angles, estimates effort |
| **Critic**        | Finds weaknesses, risks, and failure modes                      |
| **User Advocate** | Challenges from the end user's perspective                      |

The results are synthesised into a single **IdeaReport** with a confidence score (10–90):

```
## Forge IdeaReport — Round 1
**Idea:** Add OAuth SSO to the mortgage portal
**Skill:** feature-brainstorm | **Confidence:** 63/100 🟡 | **Effort:** M
*Three builder extensions add real value, but two blocking concerns — token validation
latency and absent IdP fallback — must be resolved before committing a sprint.*

### What this is
This feature adds Single Sign-On via OAuth 2.0 to the mortgage advisor portal,
allowing advisors to authenticate using their existing corporate identity provider
instead of managing per-app credentials. It eliminates IT support overhead from
password resets, reduces login friction across tools, and positions the
platform for enterprise SSO requirements from integration partners.

### Strengths
- Token refresh caching at the API gateway eliminates per-request auth latency
- Structured correlation IDs on every SSO step give ops instant visibility into failures
- OAuth scopes can enforce per-lender data access rules without new middleware

### Drawbacks & Risks
- Synchronous token validation adds 200–400ms per request at peak advisor load `[blocking]`
- No graceful fallback if the IdP is unreachable during rate-lock deadlines `[blocking]`
- SSO onboarding screen interrupts advisors in high-pressure moments `[resolvable]`

### To improve your confidence score
- How will you handle token validation latency at 500+ concurrent advisors?
- What is the fallback auth path if the IdP is down during end-of-month deadlines?

### Open questions
- Does the identity provider support the existing 30-minute session timeout requirements?
- Which lenders require SSO and which will continue with password auth?
```

**Refine in natural language** — reply to rebut a Critic finding or add new constraints. Forge updates only the affected sections and recalculates confidence. Reasoned rebuttals remove weaknesses; bare assertions keep them with a note.

**Ship when ready:**

```
/forge create
```

Creates a Jira ticket with summary, description from "What this is", acceptance criteria from Drawbacks, implementation notes from Strengths, story points from effort estimate, and labels. Clears the session.

## Installation

Forge is a Claude Code plugin — you install it by copying its files into your target project. This repo is the source; your project is the destination.

**What lives in this repo:**

```
forge/                        ← this repo
├── .claude/                  ← the plugin itself (commands, agents, skills)
└── evals/                    ← optional regression test harness
```

### 1. Clone this repo

```bash
git clone https://github.com/your-org/forge
```

### 2. Copy the plugin into your project

Run these commands **from inside the cloned `forge/` directory**, replacing `~/your-project` with the actual path to your project:

```bash
# Core plugin — required
cp -r .claude ~/your-project/.claude

# Eval harness — optional, needed for regression testing
cp -r evals ~/your-project/evals
```

> **Already have a `.claude/` directory?** Merge the subdirectories instead of overwriting:
>
> ```bash
> cp -r .claude/commands ~/your-project/.claude/commands
> cp -r .claude/agents   ~/your-project/.claude/agents
> cp -r .claude/skills   ~/your-project/.claude/skills
> ```

After this step, your project should look like:

```
your-project/
├── .claude/
│   ├── commands/
│   │   ├── forge.md
│   │   └── forge-create.md
│   ├── agents/
│   │   ├── forge-builder.md
│   │   ├── forge-critic.md
│   │   └── forge-user-advocate.md
│   └── skills/
│       ├── feature-brainstorm.md
│       └── general-brainstorm.md
└── evals/          ← if you copied it
```

Open Claude Code in `your-project/` and run `/forge add a search bar`. If you see an IdeaReport, the plugin is working.

### 3. Set up the eval harness (optional)

```bash
cd your-project/evals
npm install
npx ts-node runner.ts
```

On first run the runner exits with an error — that's expected. It prints a checklist of ideas to run through `/forge`, one per golden case. For each case: run the listed `/forge` command in Claude Code, extract the key fields from the IdeaReport into a `results/{id}.json` file, then re-run the runner to score it. See `evals/golden-cases.json` for the full case set and `evals/scorer.ts` for what gets checked.

### 4. Connect the Atlassian MCP (required for `/forge create`)

`/forge` works without this step. Only `/forge create` requires it.

Add the following to `your-project/.claude/settings.json`:

```json
{
  "mcpServers": {
    "atlassian": {
      "url": "https://mcp.atlassian.com/v1/mcp",
      "type": "http"
    }
  }
}
```

Reload Claude Code. On first use you will be prompted to authenticate with your Atlassian account via browser — no API tokens or build steps required. Once authenticated, `/forge create` will automatically find your Jira projects and create tickets with the correct fields.

> **Project type:** your Jira project must be a **Software** project (Scrum or Kanban). Business projects don't have the "Story" issue type.

## Usage

### Default skill — technical feature evaluation

```
/forge <idea>
```

Evaluates with the `feature-brainstorm` skill: technical feasibility, sprint estimation, performance and security risks, user adoption.

### General skill — domain-agnostic

```
/forge <idea> --skill general
```

Evaluates with the `general-brainstorm` skill: business strategy, market fit, incentive alignment, adoption.

### Refine the report

After `/forge` produces a report, just reply in natural language:

```
The Critic's performance concern doesn't apply here because we validate tokens at
the edge and cache the result for 15 minutes — auth service never sees per-request load.
```

Forge updates the affected section and recalculates confidence. Reasoned rebuttals are accepted; bare assertions are noted but not resolved.

### Ship to Jira

```
/forge create
```

Assembles a full ticket preview and asks for confirmation before creating anything. You can edit any field (summary, points, labels, description, criteria, notes, risks) or cancel — the IdeaReport stays active until the ticket is actually created. Once you confirm, creates the ticket and clears the session. The Jira fields are:

| Field                  | Source                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Summary                | Idea title, trimmed to ≤100 chars                                                                                                |
| Description            | "What this is" prose, verbatim                                                                                                   |
| Acceptance Criteria    | `[blocking]` Drawbacks → "Must resolve: X"; `[resolvable]` → "Should handle: X"; Open questions → "Must clarify before build: X" |
| Implementation Notes   | Strengths rewritten as concrete build actions                                                                                    |
| Risks & Considerations | User-behaviour challenges → "Risk: X — Mitigation: Y"                                                                            |
| Story Points           | S=1, M=3, L=5, XL=8                                                                                                              |
| Labels                 | `forge`, `{skill-name}`                                                                                                          |

## Architecture decisions

**Skills are context injectors, not workflow engines.** Each skill file (`feature-brainstorm.md`, `general-brainstorm.md`) contains three evaluation lenses (BUILDER LENS, CRITIC LENS, ADVOCATE LENS) that get passed as context to the corresponding subagent. The command is the workflow. Adding a new domain takes one file.

**Builder runs first, then Critic and User Advocate in parallel.** Builder output is forwarded to Critic and User Advocate, so they critique the fleshed-out concept rather than the user's original one-liner. Critic and User Advocate still launch in a single message, keeping that step at minimum latency.

**Session state is conversation context.** No disk writes. The active IdeaReport is the most recent `## Forge IdeaReport` block in the conversation. This keeps the plugin stateless and eliminates a whole class of state management bugs.

**Sycophancy guards are named and explicit.** Each agent file has a dedicated `## Sycophancy Guard` section naming the failure mode and what to do instead. This makes the guard auditable and prevents it from being diluted by surrounding instructions.

**Confidence starts at 60** The baseline is "promising until proven otherwise." The score moves down for blocking weaknesses (−8), resolvable concerns (−1), and user challenges (−2); it moves up for genuine extensions (+4 each) and effort estimates. Most first-round ideas land in the 40–75 range, which reflects realistic uncertainty rather than manufactured optimism.

## Evaluations

```bash
cd evals
npm install
npx ts-node runner.ts
```

Runs the golden case suite: known-good ideas, known-bad ideas, and sycophancy traps (obviously bad ideas phrased confidently). Each case is scored against expected output shape — structure and key field presence, not semantic quality, so runs are fast and safe to run on every prompt change. See `evals/golden-cases.json` for the full set.

The fastest way to populate results is the `/forge-eval` skill — run it inside Claude Code and it executes all four golden cases through the full pipeline automatically, writes the result files, and prints a scored summary. No manual `/forge` runs required.

Alternatively, run cases manually: the runner prints a checklist with the exact `/forge` command per case. Extract the key fields from the IdeaReport into `results/{id}.json`, then re-run to score.

## Adding a new skill

1. Create `.claude/skills/your-skill.md` with three sections: `## BUILDER LENS`, `## CRITIC LENS`, `## ADVOCATE LENS`.
2. Update `forge.md` to recognise `--skill your-flag` and map it to `your-skill.md`.
3. Add golden cases for the new skill in `evals/golden-cases.json`.

No changes needed to agents, commands, or the Atlassian MCP configuration.

## Demo

See [DEMO.md](DEMO.md) for a full written walkthrough — two scenarios showing Forge catching a sycophancy trap and taking a real feature from concept to Jira ticket, including the refinement loop and `/forge create` preview step.
