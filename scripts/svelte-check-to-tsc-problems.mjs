// Utility script to convert svelte-check --output machine-verbose to tsc problems format,
// for better integration with VSCode's $tsc problem matcher.
// Usage: svelte-check --output machine-verbose | node svelte-check-to-tsc-problems.mjs
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on("line", (line) => {
  const match = line.match(/^\d+\s+(.*)$/);
  if (!match) return;

  try {
    const obj = JSON.parse(match[1]);

    if (obj.type === "ERROR" || obj.type === "WARNING") {
      const severity = obj.type.toLowerCase();
      const code = obj.code ? `TS${obj.code}` : "";
      console.log(
        `${obj.filename}:${Number(obj.start.line) + 1}:${Number(obj.start.character) + 1} - ${severity} ${code}: ${obj.message}`
      );
    }
  } catch {
    // ignore
  }
});
