#!/usr/bin/env node
"use strict";
// Runs after each tool use. If forge_create_ticket was called, prompts user to record eval results.
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(raw || "{}");
    if (event.tool_name === "forge_create_ticket") {
      const key = (event.result && event.result.key) ? event.result.key : "unknown";
      process.stdout.write(
        `[Forge] Ticket ${key} shipped. Record your /forge output in evals/results/ to keep the regression baseline current.\n`
      );
    }
  } catch (_) {
    // Non-JSON input or unrelated tool use — ignore silently.
  }
});
