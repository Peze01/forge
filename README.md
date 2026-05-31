# Forge

A Claude Code plugin that runs adversarial brainstorming on any idea. Three parallel AI subagents — Builder, Critic, and User Advocate — evaluate your idea simultaneously and produce a structured report with a confidence score, weaknesses, suggested pivots, and open questions. When you're ready to commit, `/forge ship` maps the report directly to a Jira ticket.

## The problem it solves

Plain Claude is sycophantic. It validates and builds on what you say rather than challenging it. At a company that ships weekly via AI, a bad idea that gets validated costs a full sprint. Forge makes adversarial thinking the default entry point — before a line of code is written.

## How it works

```
/forge add OAuth SSO to the mortgage portal
```

Forge launches three subagents **in parallel**:

| Subagent | Role |
|---|---|
| **Builder** | Extends the idea, surfaces non-obvious angles, estimates effort |
| **Critic** | Finds weaknesses, risks, and failure modes |
| **User Advocate** | Challenges from the end user's perspective |

The results are synthesised into an **IdeaReport** with a confidence score (1–100):

```
## Forge IdeaReport — Round 1

Idea:       Add OAuth SSO to the mortgage portal
Skill:      feature-brainstorm
Confidence: 74/100 🟡
Technically feasible with clear user value. The Critic raised a genuine
performance concern at scale that needs resolution before committing a sprint.

### Builder
Extensions:
- Add token refresh caching at the API gateway layer to reduce auth latency...
- Instrument every SSO step with structured log events and correlation IDs...
Effort estimate: M → 3 story points

### Critic
Weaknesses:
- Synchronous token validation adds 200–400ms per request [blocking]
- No graceful fallback if the identity provider is unreachable [resolvable]

### User Advocate
User challenges:
- Mortgage advisors under rate-lock pressure will not pause for an SSO onboarding flow...
Value proposition: Solves a real ops problem but creates a new UX hurdle for advisors.

### Synthesis
Open questions:
- What is the fallback auth path if the IdP is down during peak hours?
- Does the identity provider support the existing session timeout requirements?
```

**Refine in natural language** — reply to rebut a Critic finding or add new constraints. Forge updates only the affected sections and recalculates confidence. Reasoned rebuttals remove weaknesses; bare assertions keep them with a note.

**Ship when ready:**

```
/forge ship
```

Creates a Jira ticket with summary, full IdeaReport as description, acceptance criteria mapped from findings, story points from effort estimate, and labels. Clears the session.

## Installation

Forge is a Claude Code plugin — you install it by copying its files into your target project. This repo is the source; your project is the destination.

**What lives in this repo:**

```
forge/                        ← this repo
├── .claude/                  ← the plugin itself (commands, agents, skills)
├── hooks/                    ← optional session lifecycle scripts
├── evals/                    ← optional regression test harness
└── mcp/                      ← Jira MCP server (TypeScript, Node.js)
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

# Hooks — optional, needed for session reminders
cp -r hooks ~/your-project/hooks

# Eval harness — optional, needed for regression testing
cp -r evals ~/your-project/evals
```

> **Already have a `.claude/` directory?** Merge the subdirectories instead of overwriting:
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
│   │   └── forge-ship.md
│   ├── agents/
│   │   ├── forge-builder.md
│   │   ├── forge-critic.md
│   │   └── forge-user-advocate.md
│   └── skills/
│       ├── feature-brainstorm.md
│       └── general-brainstorm.md
├── hooks/          ← if you copied it
└── evals/          ← if you copied it
```

Open Claude Code in `your-project/` and run `/forge add a search bar`. If you see an IdeaReport, the plugin is working.

### 3. Register hooks (optional)

The hooks need to be registered with Claude Code so they fire automatically. Add the following to `your-project/.claude/settings.json` (create the file if it doesn't exist):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "command": "node hooks/session-start.js"
      }
    ],
    "PostToolUse": [
      {
        "command": "node hooks/post-ticket-eval.js"
      }
    ]
  }
}
```

Claude Code runs hooks from the project root, so `node hooks/session-start.js` resolves correctly as long as you copied `hooks/` into your project root in Step 2.

`session_start` prints a ready reminder when Claude Code opens. `post_tool_use` prompts you to log eval results whenever a ticket is shipped. Skip this step entirely if you don't want hooks — `/forge` works without them.

### 4. Set up the eval harness (optional)

```bash
cd your-project/evals
npm install
npx ts-node runner.ts
```

On first run the runner exits with an error — that's expected. It prints a checklist of ideas to run through `/forge`, one per golden case. For each case: run the listed `/forge` command in Claude Code, extract the key fields from the IdeaReport into a `results/{id}.json` file, then re-run the runner to score it. See `evals/golden-cases.json` for the full case set and `evals/scorer.ts` for what gets checked.

### 5. Connect the Atlassian MCP (required for `/forge ship`)

`/forge` works without this step. Only `/forge ship` requires it.

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

Reload Claude Code. On first use you will be prompted to authenticate with your Atlassian account via browser — no API tokens or build steps required. Once authenticated, `/forge ship` will automatically find your Jira projects and create tickets with the correct fields.

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
/forge ship
```

Creates a ticket and clears the session. The Jira fields are:

| Field | Source |
|---|---|
| Summary | Idea, trimmed to ≤100 chars |
| Description | Full IdeaReport markdown |
| Acceptance Criteria | Critic weaknesses → "Must handle: X", Builder extensions → "Must include: Y", Open questions → "Must answer before release: Z" |
| Story Points | S=1, M=3, L=5, XL=8 |
| Labels | `forge`, `{skill-name}` |

## Architecture decisions

**Skills are context injectors, not workflow engines.** Each skill file (`feature-brainstorm.md`, `general-brainstorm.md`) contains three evaluation lenses (BUILDER LENS, CRITIC LENS, ADVOCATE LENS) that get passed as context to the corresponding subagent. The command is the workflow. Adding a new domain takes one file.

**Subagents run in parallel.** All three Agent calls launch in a single message. Sequential invocation would triple latency for no benefit — the three agents have no dependencies on each other.

**Session state is conversation context.** No disk writes. The active IdeaReport is the most recent `## Forge IdeaReport` block in the conversation. This keeps the plugin stateless and eliminates a whole class of state management bugs.

**Sycophancy guards are named and explicit.** Each agent file has a dedicated `## Sycophancy Guard` section naming the failure mode and what to do instead. This makes the guard auditable and prevents it from being diluted by surrounding instructions.

**Confidence starts at 50, not 80.** The baseline is neutral. The score moves down for weaknesses and up for genuine extensions — most first-round ideas land in the 50–75 range, which reflects realistic uncertainty rather than manufactured optimism.

## Evaluations

```bash
cd evals
npm install
npx ts-node runner.ts
```

Runs the golden case suite: known-good ideas, known-bad ideas, and sycophancy traps (obviously bad ideas phrased confidently). Each case is scored against expected output shape — structure and key field presence, not semantic quality, so runs are fast and safe to run on every prompt change. See `evals/golden-cases.json` for the full set.

The runner exits 1 if any cases have no recorded result. Fill in `evals/results/{id}.json` for each case after running `/forge` manually, then re-run to verify.

## Adding a new skill

1. Create `.claude/skills/your-skill.md` with three sections: `## BUILDER LENS`, `## CRITIC LENS`, `## ADVOCATE LENS`.
2. Update `forge.md` to recognise `--skill your-flag` and map it to `your-skill.md`.
3. Add golden cases for the new skill in `evals/golden-cases.json`.

No changes needed to agents, commands, or the MCP server.

## Reflection

See [REFLECTION.md](REFLECTION.md) for trade-offs made, what would change with more time, and how to measure whether Forge is actually improving developer outcomes.
