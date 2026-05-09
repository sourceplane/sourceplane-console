#!/usr/bin/env bash
set -euo pipefail

WAIT_SECONDS="${WAIT_SECONDS:-60}"

ORCHESTRATOR_MODEL="${ORCHESTRATOR_MODEL:-gpt-5.5}"
TASK_MODEL="${TASK_MODEL:-gpt-5.4}"

OPENCODE_AGENT="${OPENCODE_AGENT:-build}"

MAX_LOOPS=0
START_WITH_TASK=false
RESUME_ORCHESTRATOR=true
TASK_CLI="${TASK_CLI:-copilot}"

WORKSPACE_DIR="${WORKSPACE_DIR:-$(pwd)}"

ORCHESTRATOR_FIRST_PROMPT="${ORCHESTRATOR_FIRST_PROMPT:-Act as orchestrator.md}"
ORCHESTRATOR_RESUME_PROMPT="${ORCHESTRATOR_RESUME_PROMPT:-Continue acting as orchestrator.md. Review latest task/verify state and produce the next orchestration step.}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task-cli)
      TASK_CLI="${2:-}"
      shift 2
      ;;
    --orchestrator-model)
      ORCHESTRATOR_MODEL="${2:-}"
      shift 2
      ;;
    --task-model)
      TASK_MODEL="${2:-}"
      shift 2
      ;;
    --opencode-agent)
      OPENCODE_AGENT="${2:-}"
      shift 2
      ;;
    --start-with-task|--skip-first-orchestrator)
      START_WITH_TASK=true
      shift
      ;;
    --max-loops)
      MAX_LOOPS="${2:-}"
      if [[ -z "$MAX_LOOPS" || ! "$MAX_LOOPS" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-loops requires a number"
        exit 1
      fi
      shift 2
      ;;
    --wait)
      WAIT_SECONDS="${2:-}"
      if [[ -z "$WAIT_SECONDS" || ! "$WAIT_SECONDS" =~ ^[0-9]+$ ]]; then
        echo "Error: --wait requires seconds"
        exit 1
      fi
      shift 2
      ;;
    --workspace)
      WORKSPACE_DIR="${2:-}"
      shift 2
      ;;
    --no-resume-orchestrator)
      RESUME_ORCHESTRATOR=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--task-cli copilot|opencode|codex] [--orchestrator-model MODEL] [--task-model MODEL] [--opencode-agent AGENT] [--start-with-task] [--max-loops N] [--wait SECONDS] [--workspace PATH] [--no-resume-orchestrator]"
      exit 1
      ;;
  esac
done

case "$TASK_CLI" in
  copilot|opencode|codex)
    ;;
  *)
    echo "Error: unsupported --task-cli '${TASK_CLI}'. Use one of: copilot, opencode, codex"
    exit 1
    ;;
esac

cd "$WORKSPACE_DIR"

get_task_runner_prompt() {
  if [[ ! -f ai/state.json ]]; then
    echo "Error: ai/state.json not found"
    exit 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed"
    exit 1
  fi

  local task_agent
  task_agent="$(jq -r '.task_agent // empty' ai/state.json)"

  if [[ -z "$task_agent" || "$task_agent" == "null" ]]; then
    echo "Error: .task_agent is missing or empty in ai/state.json"
    exit 1
  fi

  echo "act as ${task_agent}"
}

codex_orchestrator_flags() {
  echo \
    --skip-git-repo-check \
    --model "$ORCHESTRATOR_MODEL" \
    --dangerously-bypass-approvals-and-sandbox
}

ORCHESTRATOR_HAS_SESSION=false

run_orchestrator() {
  if [[ "$RESUME_ORCHESTRATOR" == true && "$ORCHESTRATOR_HAS_SESSION" == true ]]; then
    echo "▶ Resuming orchestrator Codex session with ${ORCHESTRATOR_MODEL}..."

    codex exec resume \
      --last \
      $(codex_orchestrator_flags) \
      "$ORCHESTRATOR_RESUME_PROMPT"
  else
    echo "▶ Starting orchestrator with Codex ${ORCHESTRATOR_MODEL}..."

    codex exec \
      $(codex_orchestrator_flags) \
      "$ORCHESTRATOR_FIRST_PROMPT"

    ORCHESTRATOR_HAS_SESSION=true
  fi
}

run_task_runner_copilot() {
  local prompt
  prompt="$(get_task_runner_prompt)"

  echo "▶ Running task-runner with Copilot ${TASK_MODEL}..."
  echo "   prompt: ${prompt}"

  copilot \
    --model "$TASK_MODEL" \
    --prompt "$prompt" \
    --allow-all
}

run_task_runner_opencode() {
  local prompt
  prompt="$(get_task_runner_prompt)"

  echo "▶ Running task-runner with OpenCode ${TASK_MODEL} agent=${OPENCODE_AGENT}..."
  echo "   prompt: ${prompt}"

  opencode run \
    --dir "$WORKSPACE_DIR" \
    --model "$TASK_MODEL" \
    --agent "$OPENCODE_AGENT" \
    --dangerously-skip-permissions \
    "$prompt"
}

run_task_runner_codex() {
  local prompt
  prompt="$(get_task_runner_prompt)"

  echo "▶ Running task-runner with Codex ${TASK_MODEL}..."
  echo "   prompt: ${prompt}"

  codex exec \
    --skip-git-repo-check \
    --model "$TASK_MODEL" \
    --dangerously-bypass-approvals-and-sandbox \
    "$prompt"
}

run_task_runner() {
  case "$TASK_CLI" in
    copilot)
      run_task_runner_copilot
      ;;
    opencode)
      run_task_runner_opencode
      ;;
    codex)
      run_task_runner_codex
      ;;
  esac
}

wait_between_runs() {
  echo "⏳ Waiting ${WAIT_SECONDS}s..."
  sleep "$WAIT_SECONDS"
}

if [[ "$START_WITH_TASK" == true ]]; then
  echo "↷ Starting with task-runner using ${TASK_CLI}..."
  run_task_runner
  wait_between_runs
fi

loop_count=0

while true; do
  loop_count=$((loop_count + 1))
  echo "🔁 Loop ${loop_count}"

  run_orchestrator
  wait_between_runs

  run_task_runner

  if [[ "$MAX_LOOPS" -gt 0 && "$loop_count" -ge "$MAX_LOOPS" ]]; then
    echo "✅ Reached max loops: ${MAX_LOOPS}. Exiting."
    exit 0
  fi

  wait_between_runs
done