---
name: plan-issue
description: Creates a GitHub issue with a full implementation plan for a feature. Use when the user wants to plan a feature and track it as an issue.
argument-hint: "[feature description]"
disable-model-invocation: true
---

# Plan Issue

**Announce at start:** "Creating a GitHub issue with implementation plan for: $ARGUMENTS"

## Workflow

You receive a feature description via `$ARGUMENTS`. Your job is to:

1. **Research the codebase** — Understand the current architecture, relevant files, patterns, and conventions needed to plan this feature. Use Glob, Grep, and Read tools as needed.

2. **Write the implementation plan** — Follow the writing-plans skill format below to create a detailed, bite-sized implementation plan. Save it to `docs/plans/YYYY-MM-DD-<feature-name>.md` (use today's date).

3. **Create a GitHub issue** — Use `gh issue create` with the plan content as the issue body. The issue title should be concise (under 70 chars). Add a `enhancement` label if it exists.

## Plan Format (from writing-plans)

The plan document MUST follow this structure:

### Header

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

### Tasks

Each task is broken into bite-sized steps (2-5 minutes each):

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `exact/path/to/test.ts`

**Step 1: Write the failing test**
[Complete test code]

**Step 2: Run test to verify it fails**
Run: `npx vitest run path/to/test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
[Complete implementation code]

**Step 4: Run test to verify it passes**
Run: `npx vitest run path/to/test.ts`
Expected: PASS

**Step 5: Commit**
```

### Plan Principles

- **Exact file paths** — always
- **Complete code** in the plan (never "add validation here")
- **Exact commands** with expected output
- **DRY, YAGNI, TDD** — frequent commits
- Assume the implementer has zero codebase context but is a skilled developer

## GitHub Issue Creation

After saving the plan file, create the issue:

```bash
gh issue create --title "<concise feature title>" --body "$(cat docs/plans/YYYY-MM-DD-<feature-name>.md)" --label "enhancement"
```

If the `enhancement` label doesn't exist, create without labels.

**After creation, report the issue URL to the user.**
