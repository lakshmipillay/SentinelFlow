Screen 1 — Global Layout (Base Frame)

Frame: Desktop 1440px width, dark mode

Header

Left: SentinelFlow logo

Center: Incident ID + Status Badge

Right: Hidden “Simulate Incident” button (demo only)

Screen 2 — Left Panel: Incoming Signal

Width: 25%

Component: Active Alert Card (Red Border)

Title: ACTIVE ALERT

JSON-style content:

service

severity

metric

timestamp

Component: Live Terminal (ScrollArea)

Auto-scrolling log lines

Monospace font

Red error highlights

Timestamp + error codes

Animation:

Logs scroll faster during investigation

Screen 3 — Center Panel: Workflow Visualizer

Width: 45%

Component: Step Tracker / Timeline

Horizontal steps:

Ingest

Analyze

RCA

Governance

Propose

Verify

Audit

Animated state indicator (Framer Motion)

Component: Agent Cards (Parallel)

Three cards displayed side-by-side:

SRE Agent Card

Title: SRE Agent

Skills badges:

Datadog

Prometheus

CloudWatch

Findings list

Confidence bar

Security Agent Card

Skills badges:

Splunk

IAM Logs

CSPM

Findings list

Confidence bar

Governance Analysis Card

Skills badges:

Policy Engine

Change Mgmt

Risk Register

Blast radius

Risk level

Component: Blast Radius Graph

Visual chain:

Database → API Gateway → Frontend

Each node has:

Health badge (Healthy / Warning / Critical)

Color-coded status

Screen 4 — Right Panel: Chat + Governance Gate

Width: 30%

Component: Agent Summary Chat

Message bubbles from “SentinelFlow”:

RCA summary

Correlation explanation

Risk summary

Component: Governance Approval Card (Sticky Bottom)

Appears ONLY when state = GOVERNANCE_PENDING

Card content:

Recommended Action

Blast Radius

Risk Level

Policy Conflicts

Reversibility

Buttons:

Approve (Green)

Approve with Restrictions (Yellow)

Block (Red)

Text area:

Rationale (required)

Screen 5 — Resolution State

After approval:

Center Panel

Big green “Resolved” state

Animated checkmark

Right Panel

Final decision summary

Audit confirmation

Left Panel

Logs slow down

Errors stop

Screen 6 — Audit & History (Optional Tab)

Optional tab:

Timeline of workflow events

DEVLOG preview

Governance decisions

Who approved + when

UI Design Tokens

Background: #0B0F14 (dark gray)

Accent: Neon cyan + neon green

Error: Red glow

Governance: Amber/yellow

Success: Neon green

Monospace for logs

Demo-Ready UX Details

Framer Motion spinners for “AI thinking”

Delayed transitions using setTimeout

Animated connecting lines for correlations

Skill badges fade in when used

Governance gate blocks center flow visually

Why This Matters for Judges

This UI:

Makes governance visible

Shows agent roles clearly

Demonstrates human-in-the-loop

Grounds AI in real tools

Differentiates from Slack bots

Reinforces SentinelFlow as a control plane

If you want, I can next:

Convert this into a demo video script

Or generate Next.js component skeletons that match this wireframe

Or write a one-page judge pitch tying backend + UI + differentiation together

please give me a prompt to give kiro

Perfect — this is the right moment to give Kiro a single, high-quality, system-defining build prompt that:

Encodes SentinelFlow + SRE Sidekick together

Locks in backend + UI architecture

Aligns with hackathon judging criteria

Produces demo-ready artifacts

Reinforces governance-first differentiation

Below is a judge-grade Kiro prompt you can paste directly into Kiro IDE (or save as a new prompt like @build-sre-sidekick).

This is written to get Kiro to build the right thing, not just code blindly.

Kiro Prompt: Build SentinelFlow + SRE Sidekick (Governed Backend + Mission Control UI)
@build-sre-sidekick
Role

Act as a Senior Full-Stack Engineer and AI Systems Architect.

You are building a governance-first agentic workflow system (SentinelFlow) with a Mission Control UI (SRE Sidekick) for human-in-the-loop incident response.

This is a hackathon project. Prioritize architecture clarity, workflow visualization, and governance over full production integrations.

System Context

SentinelFlow is a governed orchestration backend that:

Uses an Orchestrator Agent to control workflow

Runs parallel specialist analysis (SRE, Security, Governance)

Enforces mandatory governance approval

Proposes reversible remediation (no execution)

Produces mandatory audit artifacts

SRE Sidekick is a modern dashboard that visualizes this workflow and enforces human approval.

This system is not autonomous remediation.

Objectives

Build a demo-ready system that:

Visualizes agentic workflows in real time

Shows agent roles and skills explicitly

Enforces governance gates in the UI

Requires human approval for remediation

Produces audit artifacts

Differentiates from autonomous AI SRE tools

Backend Requirements (SentinelFlow)

Implement backend workflow state modeling:

IDLE
→ INCIDENT_INGESTED
→ ANALYZING
→ RCA_COMPLETE
→ GOVERNANCE_PENDING
→ ACTION_PROPOSED
→ VERIFIED
→ RESOLVED
→ TERMINATED


Each agent output MUST include:

agent name

skills used

structured findings

confidence level

Supported agent skills:

SRE:

Datadog

CloudWatch

Prometheus

OpenTelemetry

Security:

Splunk SIEM

IAM Logs

CSPM

Governance:

Policy Engine

Change Management

Risk Register

Governance Gate MUST:

Block workflow until human approval

Surface blast radius and risk

Support approve / approve with restrictions / block

No backend component may auto-execute fixes.

Frontend Requirements (SRE Sidekick)

Build a Next.js 14 single-page Mission Control dashboard with a fixed 3-pane layout:

Left Panel — Incoming Signal

Active alert card (JSON-style)

Live streaming terminal logs (mocked)

Center Panel — Agent Brain & Workflow

Animated step tracker

Parallel agent cards

Agent skills badges

Blast radius visualization

Framer Motion animations for “AI thinking”

Right Panel — Human Handoff & Governance

Plain-English agent summary

Governance approval card

Approve / Approve with Restrictions / Block

Required rationale input

UI Tech Stack

Next.js 14 (App Router)

Tailwind CSS

Shadcn/UI

Lucide-React icons

Framer Motion for animations

React Hooks / Context for state

Use mocked data only.