// .claude/workflows/research-workflow.js
//
// Deterministic, GIT-FREE research spine (the second Tiger loop, standing ALONGSIDE the dev pipeline).
// Runs ONE already-approved research goal (the /research-goal grill happened first). No git anywhere —
// state is the folder tree under research/<goalId>/; resume = read the ledger + experiment folders.
//   bootstrap (fast model, once) — approval-gate research/<goalId>/goal.md, freeze the controlled vars,
//       read the metric/harness/budget/taxonomy, seed the experiment0 baseline if missing, `tiger/research.py
//       init`, resolve today via the shell. (This is why no args are needed.)
//     → LOOP (opus, SERIAL, self-paced) — each round spawns a FRESH tiger-researcher (no prior agent
//       memory; it reconstructs from files) that deliberates, mines sources, implements a genuinely NEW
//       method under the FROZEN vars, runs the harness for REAL, passes the G0-G4 novelty gate, and ends
//       with six machine tokens. The JS reads the tokens fail-closed, tracks the best + stall counters,
//       computes goal-met itself (never trusting the agent's advisory GOAL_MET), and self-paces the next
//       round (exploit → explore → big-swing). Serial by design: each experiment must see the full
//       frontier to be judged novel, so never parallel across iterations.
//     → synthesis (opus, once) — writes research/<goalId>/REPORT.md and closes the ledger.
//
// The novelty engine (tiger/research.py) is the anti-tuning crux — the frozen controlled vars are EXCLUDED
// from the structural set so a parameter tweak can never masquerade as a new way. Models mirror the
// agent frontmatter; pass proModel/fastModel (or "inherit") for non-Anthropic backends. NO merge,
// NO branch, NO commit — promoting a winner into real code is a MANUAL human step. Launch:
// /research-workflow (no args).

export const meta = {
  name: "research-workflow",
  description:
    "Run ONE human-approved research goal through the autonomous, GIT-FREE novelty loop. bootstrap (sonnet) approval-gates research/<goalId>/goal.md, freezes the controlled vars, reads the deterministic seeded metric harness + budget + taxonomy, seeds the experiment0 baseline if missing, and inits tiger/research.py — so a bare /research-workflow needs no args. Then a SERIAL, self-paced loop spawns a FRESH tiger-researcher (opus) each round that deliberates via a parallel ideation panel, mines fetched sources, implements a genuinely NEW method under the FROZEN vars (no comments), runs the harness for REAL, and passes the G0-G4 novelty gate; the JS reads six machine tokens fail-closed, tracks best + stall, computes goal-met itself (never trusting the agent), and paces the next round (exploit→explore→big-swing). Stops on goal-met (SUCCESS), iter/wall budget (BUDGET), novelty-exhausted/patience/floor (STALL), or two blocked rounds (BLOCKED); then synthesis (opus) writes REPORT.md and closes the ledger. No git, no merge — promoting a winner is a manual human step. Overrides: goalId, goalFile, projectDir, today, proModel, fastModel, maxIter.",
  phases: [
    { title: "bootstrap", detail: "approval-gate the goal, freeze vars, seed the baseline, init the ledger", model: "sonnet" },
    { title: "loop", detail: "serial novelty-gated experiments — deliberate, fetch, implement, run, record", model: "opus" },
    { title: "synthesis", detail: "write REPORT.md — idea→hypothesis→result, the winner + provenance, dead-ends", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");
const argInt = (k, dflt) => {
  const n = parseInt(argStr(k), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
const MODEL_FOR = { bootstrap: FAST, researcher: PRO, synthesis: PRO };
const AG = {
  researcher: "tiger-skills:tiger-researcher",
  synthesis: "tiger-skills:tiger-researcher",
};
const spawn = (key, prompt, phaseName, extra = {}) =>
  agent(prompt, {
    ...(AG[key] ? { agentType: AG[key] } : {}),
    phase: phaseName,
    ...(MODEL_FOR[key] ? { model: MODEL_FOR[key] } : {}),
    ...extra,
  });

// Machine tokens — parse the value off a line that BEGINS with TOKEN:, take the LAST match, fail CLOSED
// (absent/garbled ⇒ the safe verdict: never continue on a broken agent, never claim a false SUCCESS).
const upper = (r) => String(r || "").toUpperCase();
const lastTokenLine = (report, token) => {
  const re = new RegExp("(?:^|\\n)[^\\S\\n]*" + token.toUpperCase() + ":[^\\S\\n]*([^\\n]*)", "g");
  let m, last = null;
  const s = upper(report);
  while ((m = re.exec(s)) !== null) last = m[1];
  return last;
};
const lastToken = (report, token) => {
  const line = lastTokenLine(report, token);
  const m = line == null ? null : line.match(/^([A-Z_]+)/);
  return m ? m[1] : "";
};
const lastTokenNum = (report, token) => {
  const line = lastTokenLine(report, token);
  const m = line == null ? null : line.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const RESEARCH_VERDICTS = ["IMPROVED", "NEUTRAL", "REGRESSED", "NOVELTY_EXHAUSTED", "BLOCKED"];
const researchVerdict = (report) => {
  const v = lastToken(report, "TIGER_RESEARCH");
  return RESEARCH_VERDICTS.includes(v) ? v : "";
};
const experimentTag = (report, iter) => {
  const line = lastTokenLine(report, "EXPERIMENT");
  const m = line == null ? null : line.match(/(\d+)/);
  return m ? "experiment" + m[1] : "experiment" + iter;
};
const goalMetClaim = (report) => lastToken(report, "GOAL_MET") === "YES";

// Direction-aware helpers — the SINGLE place min/max is interpreted.
const better = (dir, a, b) => (dir === "min" ? a < b : a > b); // a strictly better than b
const meets = (dir, v, target) => (dir === "min" ? v <= target : v >= target); // v satisfies target

// Stages read + patch the ledger through tiger/research.py (installed as tiger/research.py, SEPARATE from board.py);
// it loads → validates → mutates one spot → re-checks invariants → saves preserving everything else, and
// fails closed (exit 1 = REFUSED, ledger untouched).
const RESEARCH_TOOL =
  "Read the ledger with `python3 tiger/research.py summary` (plus `vectors` and `frontier`) and patch it ONLY " +
  "through `python3 tiger/research.py` (init / novelty-check / register / record-result / alias / stall-check / " +
  "set-status / close) — never hand-edit research_ledger.json. Every write re-checks the invariants and " +
  "fails closed (exit 1 = REFUSED, ledger untouched).";

// ── BOOTSTRAP — approval-gate the goal, freeze vars, seed the baseline, init the ledger ──────────
const BOOTSTRAP_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["abort"],
  properties: {
    goalId: { type: "string" },
    goalTitle: { type: "string" },
    goalFile: { type: "string", description: "Path to the goal.md doc." },
    projectDir: { type: "string" },
    today: { type: "string", description: "YYYY-MM-DD from `date +%F` — never invented." },
    startedEpoch: { type: ["number", "string"], description: "Seconds from `date +%s` at bootstrap — the wall origin." },
    metric: {
      type: "object",
      additionalProperties: true,
      properties: {
        name: { type: "string" },
        direction: { type: "string", enum: ["max", "min"] },
        target: { type: "number" },
        baseline: { type: "number" },
      },
    },
    harness: { type: "string", description: "The one fast, seeded, deterministic metric command." },
    frozen: { type: "object", additionalProperties: true, description: "The frozen controlled vars." },
    budget: {
      type: "object",
      additionalProperties: true,
      properties: {
        max_iters: { type: "number" },
        patience_K: { type: "number" },
        epsilon: { type: "number" },
        novelty_floor: { type: "number" },
        wall_hours: { type: "number" },
      },
    },
    baselineValue: { type: ["number", "null"], description: "experiment0's real measured metric." },
    nextIter: { type: "number", description: "Ledger last index + 1 (1 on a fresh goal; higher on resume)." },
    approved: { type: "boolean" },
    abort: { type: ["string", "null"] },
  },
};

phase("bootstrap");
const boot = await spawn(
  "bootstrap",
  `You are the DISCOVERY PREFLIGHT for the GIT-FREE research workflow. Do NOT deliberate, implement, or run
   an experiment — approval-gate the goal, freeze the context, seed the baseline, return it. Work in the
   current project directory. NO GIT anywhere — create NO branches, make NO commits; state is folders only.

   Optional caller hints (use only if non-empty; else discover):
     goalId="${argStr("goalId")}"  goalFile="${argStr("goalFile")}"  today="${argStr("today")}"  projectDir="${argStr("projectDir")}"

   STEPS:
   1. projectDir = hint else \`pwd\`. today = hint else \`date +%F\`. startedEpoch = \`date +%s\` (the wall origin).
   2. Resolve goalId: the goalId hint if present; else scan research/*/goal.md and pick the goal whose goal.md
      is approved and whose ledger is NOT already success/closed — prefer the most-recently-modified. goalFile =
      the goalFile hint, else research/<goalId>/goal.md.
   3. APPROVAL GATE (the ONE human gate; never run an unapproved goal). Read goalFile and require a frontmatter
      line matching \`tiger-status:.*approved\` (trim surrounding whitespace/quotes; "awaiting_review" is NOT
      approved). If goalFile is missing OR unapproved → abort "run /research-goal to grill + approve a goal
      first". If research/ holds no goal at all → abort "no research goal found — run /research-goal to create
      and approve one".
   4. Read from goalFile: metric {name, direction (max|min), target, baseline}; the FROZEN controlled vars;
      the pinned deterministic seeded harness command (with its hard timeout); budget {max_iters, patience_K,
      epsilon, novelty_floor, wall_hours}; and taxonomy.md's approach families.
   5. BASELINE — if research/<goalId>/experiment0/ is MISSING, seed it: run the pinned harness ONCE for REAL as
      a bounded background process with the pinned hard timeout (e.g. \`timeout <sec> <cmd>\`), capture the raw
      numbers to experiment0/metrics.json + logs to experiment0/evidence/, and write a minimal experiment0/
      experiment.md baseline card. baselineValue = the real measured metric (NEVER asserted — the Iron Law).
      If experiment0 already exists, read its metrics.json for baselineValue.
   6. \`python3 tiger/research.py init --goal <goalId>\` (seeds the ledger from goal.md; idempotent on resume).
      nextIter = \`python3 tiger/research.py next-n\` (ledger last index + 1; 1 on a fresh goal).
   ${RESEARCH_TOOL}

   Return the structured object. abort=null ONLY when an APPROVED goal is ready with a seeded experiment0 and an
   inited ledger; otherwise put the precise, human-actionable reason in abort.`,
  "bootstrap",
  { schema: BOOTSTRAP_SCHEMA }
);

if (boot === null || boot === undefined) {
  return {
    aborted:
      "bootstrap agent died at spawn (returned null) — backend/API incompatibility, not a goal problem. " +
      "Pass proModel/fastModel matching your backend's exact model names (or \"inherit\").",
    passed: false,
  };
}
if (boot.abort) {
  return {
    aborted: boot.abort,
    howToFix:
      "Finish the goal grill first: run /research-goal until research/<goalId>/goal.md exists with a metric, " +
      "frozen controlled vars, a deterministic harness command, a budget, taxonomy.md, and frontmatter " +
      "'tiger-status: approved'. Then re-run /research-workflow.",
    passed: false,
  };
}

const G = {
  id: boot.goalId,
  title: boot.goalTitle || boot.goalId,
  goalFile: boot.goalFile || `research/${boot.goalId}/goal.md`,
  dir: boot.projectDir || ".",
  today: boot.today || "",
  startedEpoch: boot.startedEpoch != null ? String(boot.startedEpoch) : "",
  metric: boot.metric || {},
  harness: boot.harness || "",
  frozen: boot.frozen || {},
  budget: boot.budget || {},
};
if (!G.id) {
  return { aborted: "bootstrap returned no goalId and no abort reason — cannot proceed.", passed: false };
}

const dir = G.metric.direction === "min" ? "min" : "max";
const target = Number(G.metric.target);
const baseline = Number(G.metric.baseline);
const bud = G.budget;
const maxIters = argInt("maxIter", Number(bud.max_iters) > 0 ? Number(bud.max_iters) : 12);
const patienceK = Number(bud.patience_K) > 0 ? Number(bud.patience_K) : 4;
const noveltyFloor = Number.isFinite(Number(bud.novelty_floor)) && Number(bud.novelty_floor) >= 0 ? Number(bud.novelty_floor) : 0.15;
const wallHours = Number(bud.wall_hours) > 0 ? Number(bud.wall_hours) : 0; // 0 = unbounded

const baseVal = boot.baselineValue != null ? Number(boot.baselineValue) : baseline;
let best = { experiment: "experiment0", value: Number.isFinite(baseVal) ? baseVal : null };

log(
  `bootstrap: goal ${G.id} ("${G.title}"), metric ${G.metric.name || "?"} (${dir}, target ${target}), ` +
  `baseline ${best.value}, budget maxIters=${maxIters} patienceK=${patienceK} floor=${noveltyFloor} ` +
  `wallHours=${wallHours || "∞"}. Approved ✓.`
);

// ── LOOP — serial, self-paced novelty-gated experiments ──────────────────────────
let iter = Number.isFinite(Number(boot.nextIter)) && Number(boot.nextIter) >= 1 ? Number(boot.nextIter) : 1;
let noImprove = 0;
let blockedStreak = 0;
const novelties = [];
let pacingHint = "exploit";
let iterationsRun = 0;
let outcome = null;

// A goal already met at the baseline needs no experiments — go straight to synthesis.
if (best.value != null && Number.isFinite(target) && meets(dir, best.value, target)) {
  outcome = "SUCCESS";
  log(`baseline ${best.value} already meets target ${target} (${dir}) — SUCCESS with no experiments.`);
}

while (!outcome && iter <= maxIters) {
  phase("iter-" + iter);
  const remaining = maxIters - iter + 1;
  const report = await spawn(
    "researcher",
    `Run experiment ${iter} of research goal ${G.id} as the Tiger Researcher — ONE merged context that
     deliberates, mines fetched sources, implements a genuinely NEW method under the FROZEN controlled vars,
     runs the harness for REAL, and records the card. You start FRESH with NO memory of prior rounds:
     reconstruct EVERYTHING from files (the Tiger principle — memory lives in FILES, not agent state).
     Goal id: ${G.id}   Goal doc: ${G.goalFile}  (READ the metric, direction, target, the FROZEN controlled
     vars, the pinned deterministic harness command, the budget, and taxonomy.md.)
     Project: ${G.dir}   Today: ${G.today}   Metric: ${G.metric.name || "?"} (direction ${dir}, target ${target}).
     THIS experiment index: experiment${iter}.   Pacing this round: ${pacingHint}.   Iterations remaining: ${remaining}.
     Wall origin (\`date +%s\` at bootstrap): ${G.startedEpoch || "?"}   Wall budget (hours, 0=unbounded): ${wallHours}.
     Coder model hint (pass to the tiger-code-generator you spawn): ${FAST}

     NO GIT anywhere — state is the folder tree under research/${G.id}/experiments/experiment${iter}/; that
     folder is IMMUTABLE once done. Run your full procedure (agents/tiger-researcher.md):
       1. RECONSTRUCT — \`python3 tiger/research.py summary\` + \`vectors\` + \`frontier\`; read in full ONLY the last
          2-3 experiment.md bodies (+ any earlier one whose next-idea seeds motivate a direction).
       2. DELIBERATE — spawn a small PARALLEL ideation panel (Agent tool, agentType "Explore") of DISTINCT
          candidate next-moves (learn-from-the-worst-failure / attack-the-current-best-weakness / import-a-
          fresh-fetched-source / a bold cross-family COMPOSITION); debate + rank grounded in prior results,
          novelty, and feasibility under the frozen vars (rebuttal round if close). WRITE the recorded
          self-discussion to experiment${iter}/deliberation.md — a first-class human-inspectable artifact.
       3. MINE SOURCES — WebSearch + WebFetch (arxiv for academic/technical goals, general web otherwise);
          SAVE each fetched {id-or-url, title, quoted_claim} to experiment${iter}/sources.md. Distil ONE
          falsifiable hypothesis (if we change X to <technique from source> then <metric> moves because <mechanism>).
       4. VECTOR + PRE-GATE — build approach_vector {family (from taxonomy.md), components[], controlled_vars
          (== the goal FROZEN set), sources[], hypothesis, nearest_prior}; \`python3 tiger/research.py novelty-check
          <vector.json>\` MUST exit 0 (G0 frozen-vars, G1 near-dup, G2 pure-tuning, G3 new-component, G4 new-source)
          or re-deliberate (≤3 tries; exhausted → TIGER_RESEARCH: NOVELTY_EXHAUSTED).
       5. IMPLEMENT — spawn tiger-code-generator (agentType "tiger-skills:tiger-code-generator", coder model
          ${FAST}) with a complete work packet into experiment${iter}/ (run.sh + method files); the METHOD runs
          under the FROZEN controlled vars; NO comments in method code.
       6. RUN — execute the pinned harness for REAL as a bounded background process with the pinned hard timeout;
          the METRIC is the number from THIS run (NEVER asserted — the Iron Law). Raw numbers → metrics.json,
          logs/outputs → evidence/.
       7. POST-GATE — \`python3 tiger/research.py novelty-check <vector.json> --built experiment${iter}\` (reads the
          ACTUAL built method files and re-derives the real component set); if REFUSED, mark the experiment
          rejected + UNCREDITED and report it honestly (a promised-new method that shipped a constant tweak fails).
       8. CRITIC — spawn tiger-novelty-critic (agentType "tiger-skills:tiger-novelty-critic") on the REAL method
          for the semantic NOVEL-and-smart veto (it ends TIGER_NOVELTY: <NOVEL|DUPLICATE>).
       9. RECORD — WRITE experiment${iter}/experiment.md in the built-in card format (approach-vector
          frontmatter + method + result + notes); \`python3 tiger/research.py register experiment${iter}\` then
          \`record-result experiment${iter} --metric <v> --status <improved|neutral|regressed>\`.
      10. PACING — ${pacingHint}: exploit = refine near the current best; explore = a distinct untried
          component; big-swing = FORCE an untried family from taxonomy.md (you are stalled). If cumulative wall
          (tiger/research.py summary, or \`date +%s\` minus ${G.startedEpoch || "the origin"}) exceeds ${wallHours}h
          when >0, wrap up and stop.
     ${RESEARCH_TOOL}
     You NEVER change the frozen controlled vars (that is tuning, not a new way — a G3-gated new component MAY
     introduce its OWN intrinsic var, nothing else), NEVER assert a metric, and NEVER edit a prior IMMUTABLE
     experiment folder.
     Print one WALL_HOURS_USED: <cumulative hours> line, THEN END with EXACTLY these six lines, in order, last:
       TIGER_RESEARCH: <IMPROVED|NEUTRAL|REGRESSED|NOVELTY_EXHAUSTED|BLOCKED>
       EXPERIMENT: experiment${iter}
       METRIC: <numeric metric measured THIS run>
       NOVELTY_DISTANCE: <0..1>
       DELTA_VS_BEST: <signed number vs the prior best>
       GOAL_MET: <YES|NO>`,
    "iter-" + iter
  );

  if (report === null || report === undefined) {
    return {
      goalId: G.id,
      aborted:
        "tiger-researcher died at spawn (returned null) — backend/API incompatibility. Pass " +
        "proModel/fastModel matching your backend's model names (or \"inherit\"), then re-run.",
      iterationsRun,
      best,
      passed: false,
    };
  }
  iterationsRun++;

  const verdict = researchVerdict(report);
  const expTag = experimentTag(report, iter);
  const metric = lastTokenNum(report, "METRIC");
  const novelty = lastTokenNum(report, "NOVELTY_DISTANCE");
  const delta = lastTokenNum(report, "DELTA_VS_BEST");
  const wallUsed = lastTokenNum(report, "WALL_HOURS_USED");

  // The researcher gave up on finding a novel move — stall, stop.
  if (verdict === "NOVELTY_EXHAUSTED") {
    outcome = "STALL";
    log(`iter-${iter}: ${expTag} — NOVELTY_EXHAUSTED (no novel move survived the gate). STALL.`);
    break;
  }
  // A blocked build/harness round: tolerate one, stop on two in a row.
  if (verdict === "BLOCKED") {
    blockedStreak++;
    log(`iter-${iter}: ${expTag} — BLOCKED (round ${blockedStreak}).`);
    if (blockedStreak >= 2) { outcome = "BLOCKED"; break; }
    pacingHint = "big-swing";
    iter++;
    continue;
  }
  // A garbled/absent verdict, or a "ran" verdict without a real numeric metric, is untrustworthy — fail
  // closed toward stopping so a broken agent never burns budget or false-claims progress.
  if (!(verdict === "IMPROVED" || verdict === "NEUTRAL" || verdict === "REGRESSED") || metric == null) {
    outcome = "BLOCKED";
    log(`iter-${iter}: garbled report (verdict='${verdict}', metric=${metric}) — stopping fail-closed.`);
    break;
  }
  blockedStreak = 0;

  const nd = novelty == null ? 0 : novelty;
  novelties.push(nd);
  const window = novelties.slice(-3);
  const rollingNovelty = window.reduce((s, x) => s + x, 0) / window.length;

  // Best + improvement are JS-derived, direction-aware — the source of truth for goal-met and pacing.
  const improved = best.value == null ? true : better(dir, metric, best.value);
  if (improved) { best = { experiment: expTag, value: metric }; noImprove = 0; }
  else { noImprove++; }

  log(
    `iter-${iter}: ${expTag} metric=${metric} delta=${delta == null ? "?" : delta} (best ${best.value} @ ` +
    `${best.experiment}), verdict=${verdict}, novelty=${nd} (roll ${rollingNovelty.toFixed(3)}), ` +
    `noImprove=${noImprove}, agentClaimsGoalMet=${goalMetClaim(report) ? "YES" : "NO"}.`
  );

  // STOP — goal-met is JS-derived from best vs target given direction (never trust the agent's GOAL_MET).
  if (best.value != null && Number.isFinite(target) && meets(dir, best.value, target)) { outcome = "SUCCESS"; break; }
  // STOP — wall budget, from the researcher-reported cumulative wall (JS stays clock-free by design).
  if (wallHours > 0 && wallUsed != null && wallUsed > wallHours) { outcome = "BUDGET"; break; }
  // STOP — stall: patience exhausted or the rolling novelty collapsed below the floor.
  if (noImprove >= patienceK || rollingNovelty < noveltyFloor) { outcome = "STALL"; break; }
  // STOP — iteration budget spent.
  if (iter >= maxIters) { outcome = "BUDGET"; break; }

  // Self-pace the next round: exploit while improving, explore at a small stall, big-swing when stuck.
  pacingHint = noImprove <= 1 ? "exploit" : noImprove === 2 ? "explore" : "big-swing";
  iter++;
}
if (!outcome) outcome = "BUDGET"; // fell out of the loop = iteration budget spent

log(`loop done: outcome=${outcome} after ${iterationsRun} experiment(s); best ${best.value} @ ${best.experiment}.`);

// ── SYNTHESIS — write REPORT.md and close the ledger (any clean stop) ─────────────
const ledgerStatus = outcome === "SUCCESS" ? "success" : outcome === "BLOCKED" ? "blocked" : "stalled";
phase("synthesis");
const synth = await spawn(
  "synthesis",
  `Write the closing synthesis for research goal ${G.id} as the Tiger Researcher in SYNTHESIS mode — do NOT
   run a new experiment. Reconstruct from files only (\`python3 tiger/research.py summary\` + \`vectors\` + \`frontier\`
   and the experiment.md bodies). NO GIT, NO merge. Write research/${G.id}/REPORT.md with:
     • an idea → hypothesis → result table across EVERY experiment (family, novelty, metric, verdict),
     • the WINNING method (${best.experiment}, metric ${best.value}) with its full provenance chain
       (deliberation.md → sources.md → the built method files → evidence/), and
     • the dead-ends and what each ruled out.
   Outcome: ${outcome} (best ${best.value} vs target ${target}, direction ${dir}, after ${iterationsRun}
   experiment(s)). REPORT.md simply POINTS at research/${G.id}/experiments/${best.experiment}/ — promoting a
   winner into real code is a MANUAL human step, never done here. ${RESEARCH_TOOL}
   Then \`python3 tiger/research.py set-status ${ledgerStatus}\` and \`python3 tiger/research.py close\`.
   END with: REPORT_WRITTEN: <YES|NO>.`,
  "synthesis"
);
const reportWritten = synth != null && lastToken(synth, "REPORT_WRITTEN") === "YES";
if (synth == null) log("synthesis spawn returned null — REPORT.md may not have been written; re-run to finalize.");

return {
  goalId: G.id,
  title: G.title,
  metric: G.metric.name || "",
  direction: dir,
  target,
  iterationsRun,
  best,
  outcome,
  goalMet: outcome === "SUCCESS",
  passed: outcome === "SUCCESS",
  reportWritten,
  inspect: `open research/${G.id}/REPORT.md; resume = re-run /research-workflow`,
};
