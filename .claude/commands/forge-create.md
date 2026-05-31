---
description: Create a Jira ticket from the current Forge IdeaReport and close the session. Run /forge create after brainstorming to officially commit an idea as a feature. Requires the Atlassian MCP to be connected.
---

You are executing the Forge create workflow. This is a state transition: brainstorming ends, a Jira ticket is created, and the session is cleared.

## Step 1 — Check for Previous Create in This Session

If the current conversation already contains a "Ticket created:" line from a prior `/forge create` run:

Output exactly:
```
Starting new session. Previous idea cleared.

No new ticket created — the previous IdeaReport was already committed.
Run /forge <new idea> to begin the next brainstorming session.
```
Then stop.

## Step 2 — Locate Active IdeaReport

Search the current conversation for the most recent `## Forge IdeaReport` block.

If none found:
```
No active IdeaReport found.

Run /forge <idea> to start a brainstorming session, then return here when ready to create a ticket.
```
Then stop.

If found, extract these fields exactly from the v2 IdeaReport format:
- **idea** — from the `**Idea:**` line
- **skill** — from the `**Skill:**` field in the header line
- **confidence_score** — the numeric value from `**Confidence:**` (integer only, no emoji)
- **round** — from `Round N` in the heading
- **effort_estimate** — from `**Effort:**` field in the header line (S, M, L, or XL)
- **what_this_is** — the full prose block under `### What this is` (3–6 sentences)
- **strengths** — all bullet points under `### Strengths`
- **drawbacks_and_risks** — all bullet points under `### Drawbacks & Risks` (preserve `[resolvable]`/`[blocking]` labels)
- **open_questions** — all bullet points under `### Open questions`

## Step 3 — Derive Story Points

Map effort estimate to story points:
- S → 1
- M → 3
- L → 5
- XL → 8
- Not found → 3 (default; note this in output with `[defaulted — no effort estimate in report]`)

## Step 4 — Build Acceptance Criteria

Construct a numbered list derived from **Drawbacks & Risks** and **Open questions**:

1. From each `[blocking]` item in Drawbacks & Risks → `Must resolve: {weakness rewritten as a positive requirement}`
2. From each `[resolvable]` item in Drawbacks & Risks → `Should handle: {weakness rewritten as a positive requirement}`
3. From each Open question that is a pre-implementation concern → `Must clarify before build: {question}`

Rules for rewriting:
- Flip weaknesses to requirements. "Auth service will be saturated under peak load" → "Must resolve: auth token validation must be async and cached to avoid latency spikes under peak concurrent load"
- Keep each criterion to one sentence. No nested bullets.
- Minimum 1 item always. If no weaknesses are extracted, derive at least one from the most significant Open question.

## Step 4b — Build Implementation Notes

Derive from the **Strengths** section — each bullet becomes one concrete implementation note:

- Frame as things to build or consider, not abstract positives.
- Transform the strength into a specific technical or design action.
  - Example: "Real-time sync capability" → "Implement real-time sync via WebSocket; include fallback polling for clients with unreliable connections"
  - Example: "Configurable thresholds" → "Expose threshold configuration via a settings panel; default values should be set to the 80th-percentile baseline from the existing dataset"
- Produce 2–5 bullets. If there are more than 5 strengths, pick the ones with the most actionable implementation surface.

## Step 4c — Build Risks & Considerations

Derive from items in **Drawbacks & Risks** that describe user behaviour, adoption concerns, or trust issues (typically from the User Advocate perspective):

- Frame each as: `Risk: {the challenge} — Mitigation: {a concrete action or design decision}`
- Example: "Users may not trust auto-generated summaries" → "Risk: Users distrust AI-generated content — Mitigation: Show source citations inline and allow one-click override to manual entry"
- Produce 1–4 bullets. If all Drawbacks items are purely technical, note the most significant technical risk with a mitigation hint instead.

## Step 5 — Assemble Description

Assemble the full Jira description body as markdown, structured for both human readability and AI implementation readability:

```
## Description

{what_this_is — the "What this is" prose from the IdeaReport, verbatim. 3–6 sentences.}

## Acceptance Criteria

{numbered list from Step 4, one item per line}

## Implementation Notes

{bullet list from Step 4b, one item per line}

## Risks & Considerations

{bullet list from Step 4c, one item per line}

---
Forged with confidence {score}/100 | Skill: {skill} | Rounds: {N}
```

Story points and labels go in Jira fields — do NOT include them in the description body.

## Step 6 — Preview & Confirm

### Step 6a — Render the preview

Output the following formatted block, substituting all assembled field values:

```
## Ticket Preview

**Summary:** {summary}
**Points:** {story_points} ({effort_estimate}) | **Labels:** forge, {skill} | **Confidence:** {score}/100

### Description
{what_this_is prose}

### Acceptance Criteria
{numbered list from Step 4}

### Implementation Notes
{bullet list from Step 4b}

### Risks & Considerations
{bullet list from Step 4c}

---
Does this look right?
- Reply **yes** to create the ticket
- Reply **edit [field] [new value]** to change a specific field
- Reply **cancel** to exit without creating (your IdeaReport stays active)
```

Stop. Wait for user input. Do NOT call any Atlassian MCP tools yet.

### Step 6b — Handle the user's reply

**YES / CONFIRM / CREATE / any clear affirmative:**
Proceed to Step 7.

**CANCEL / NO / STOP:**
Output exactly:
```
Ticket not created. Your IdeaReport is still active.
Run /forge create when ready.
```
Then stop. Do NOT clear session state.

**`edit [field] [new value]` — structured edit:**

Accepted field names (case-insensitive):

| Field name | Action |
|---|---|
| `summary` | Replace summary text; re-apply ≤100 char trim |
| `points` | Must be one of 1, 3, 5, 8. If anything else: output `Points must be 1, 3, 5, or 8. No changes made.` and re-render the preview unchanged |
| `labels` | Replace labels with the comma-separated list provided; always keep "forge" in the list |
| `description` | Replace the Description section |
| `criteria` or `ac` | Replace the Acceptance Criteria section |
| `notes` | Replace the Implementation Notes section |
| `risks` | Replace the Risks & Considerations section |

**Natural language edit request** (e.g. "make the acceptance criteria more specific", "add a note about rate limiting", "shorten the description"):
Apply the edit to the relevant section using judgement.

**Multiple edits in one message** (e.g. "change summary to X and set points to 5"):
Apply all changes at once, re-render the preview once, ask for confirmation once.

After any valid edit: re-render the full preview in the same format as Step 6a with the change applied. Ask for confirmation again. Do not proceed to Step 7 until the user explicitly confirms.

**State rule:** Session state (the IdeaReport) is only cleared after a successful ticket creation — Atlassian MCP returns a valid ticket key. Cancel, edit loops, and failed creates do NOT clear session state.

## Step 7 — Find Project and Create Ticket

### Step 7a — Discover available Jira projects

Call `getVisibleJiraProjects` (Atlassian MCP tool) with no arguments.

**If the tool is not available (tool not found / MCP server not registered):**
Output exactly:
```
Cannot create ticket — Atlassian MCP is not connected.

To connect:

1. Add this block to your .claude/settings.json (inside the top-level object):

   "mcpServers": {
     "atlassian": {
       "url": "https://mcp.atlassian.com/v1/mcp",
       "type": "http"
     }
   }

2. Restart Claude Code (close and reopen the terminal, or reload the window in VS Code).

3. On first use, a browser window will open to authenticate with your Atlassian account.
   Sign in and approve access.

4. Run /forge create again — your IdeaReport is still active.
```
Then stop without clearing session state.

**If the tool returns an empty list or no projects:**
Output exactly:
```
Connected to Atlassian, but no Jira projects are visible to your account.

This usually means:
  • You authenticated with an account that has no Jira projects
  • Your account lacks "Create Issues" permission in all projects

To fix: ask your Jira admin to grant you Create Issues permission on the relevant
project, then run /forge create again.

Your IdeaReport is still active.
```
Then stop without clearing session state.

**If exactly one project is returned:** use it automatically without prompting.

**If two or more projects are returned:**
Output exactly:
```
Multiple Jira projects found — which one should this ticket go into?

{numbered list: N. {project name} ({PROJECT-KEY}) for each result}

Reply with the number or project key (e.g. "1" or "ENG").
```
Stop and wait for user input.

- If the user replies with a valid number or project key: select that project and proceed directly to Step 7b. Do NOT re-show the ticket preview.
- If the user replies with an invalid choice: list the options again and ask once more.
- If the user replies with cancel/no/stop: output "Ticket not created. Your IdeaReport is still active." and stop without clearing session state.

From the selected project, note the `cloudId` (UUID) and `projectKey`.

### Step 7b — Create the ticket

Call `createJiraIssue` (Atlassian MCP tool):

| Field | Value |
|---|---|
| `cloudId` | from Step 7a |
| `projectKey` | from Step 7a |
| `issueTypeName` | `"Story"` |
| `summary` | idea trimmed to ≤ 100 characters |
| `description` | full assembled description from Step 5 |
| `additional_fields` | `{ "labels": ["forge", "{skill-name}"], "customfield_10016": {story_points} }` |

If the idea exceeds 100 characters: truncate at the last word boundary before 100 chars and append `...`.

## Step 8 — Handle Response

### On success:

Output exactly:
```
Ticket created: {TICKET-KEY} — {ticket URL}

Summary:    {summary}
Points:     {story_points} ({effort_estimate})
Labels:     forge, {skill-name}
Confidence: {score}/100

Acceptance criteria ({N} items):
{numbered list}

Implementation notes ({N} items):
{bullet list}

---
Starting new session. Previous idea cleared.
Run /forge <new idea> to start the next brainstorming session.
```

### On failure:

Output exactly:
```
Failed to create ticket: {error message from Atlassian MCP}

Common causes:
  • Story points field not supported — try removing story points and retry
  • Summary too long — Forge trims to 100 chars but some instances have lower limits
  • Labels not permitted in this project — the ticket was created without labels
  • Permission error — your account may not have Create Issues access in this project

Your IdeaReport is still active — run /forge create to retry.
```

Do NOT clear session state on failure. The IdeaReport must remain available for retry.
