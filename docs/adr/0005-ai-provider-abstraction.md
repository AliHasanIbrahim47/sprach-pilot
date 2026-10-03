# ADR-0005: AI provider abstraction (OCR, TTS, STT, LLM)

- Status: Accepted
- Date: 2026-09-26
- Deciders: Tech Lead / ML
- Ticket: SP-031, SP-086

## Context

Features need OCR, TTS, STT, translation, and LLM assistance. Paid cloud APIs are out of scope for v1; providers will change (local Ollama, ML service, LibreTranslate, LanguageTool, etc.). Call sites must not hard-code a single vendor SDK.

## Decision

Introduce a **provider abstraction** behind application ports:

- Interfaces for OCR, TTS, STT, LLM (and related helpers) in the API/worker (and later `apps/ml-service`)
- Config-driven selection via `AI_MODE` (`stub` | `local`) and service URLs — no paid API keys in v1
- Stub implementations for CI and early UI; local/self-hosted adapters for real runs
- Spikes (e.g. SP-031) record benchmarks; this ADR records the architectural boundary

## Alternatives considered

| Option | Why not |
| --- | --- |
| Call Ollama/OpenAI SDKs directly from controllers | Couples features to vendors; hard to stub in tests |
| Single mega-"AIService" class | Becomes a god object; prefer narrow ports |
| Only cloud SaaS | Conflicts with self-hosted / no paid keys product constraint |
| Browser-only inference | Too limited for OCR/STT pipelines and documents |

## Consequences

- New AI capabilities add a port + adapter; feature services depend on the port.
- Worker owns long-running AI jobs; API enqueues and reports status.
- Changing a provider is a config/adapter change, not a rewrite of dialogue/document flows.
- Evaluation data and model choices stay in spike notes linked from feature tickets.
