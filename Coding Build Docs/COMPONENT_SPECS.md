# Pattern Mirror: Component Specifications

**Version:** 1.0
**Scope:** Algorithm-level detail for the five analysis engines (ARCHITECTURE.md 3.5) and the narrative generation engine (3.6) — referenced by PHASE_SPECS.md 2.1-2.2 and 3.1, implemented against the code-structure stubs already named there.

**Design principle used throughout:** deterministic code does what deterministic code is actually good at (counting, grouping, correlation math); Claude does what language understanding is actually good at (reading tone, assessing trait alignment, writing the report). Where a "detect X from free text" step would require fake precision from a hand-rolled formula, this doc hands that step to Claude instead — matching ARCHITECTURE.md 3.5's own listed technology for the framework engines ("Custom Node.js + Claude API"), not inventing new infrastructure.

---

## 1. Pattern Detection Engine

`backend/functions/src/services/analysisEngines/patternDetection.ts` (per PHASE_SPECS.md 2.1's code structure)

Pure deterministic — no Claude calls. Fast, cheap, runs on structured `{date, mood, intensity, lifeArea, text}` entries regardless of data source (structured upload or post-extraction).

### `calculateFrequencies(entries)`
```
frequency[area] = count(entries where lifeArea == area) / total(entries)
```
Edge case: 0 entries → return `{}`, caller treats as "insufficient data" upstream rather than dividing by zero here.

### `detectCorrelations(entries)`
Cross-area correlation, not individual-entry correlation:

1. Build a daily aggregate per life area: for each date in the entries' range, `dailyIntensity[area][date] = mean(intensity)` of that area's entries that day (undefined if no entry that day for that area).
2. For every pair of areas `(A, B)` that have entries on at least `MIN_OVERLAP_DAYS = 5` shared dates, compute the Pearson correlation coefficient `r` over those shared dates' intensities (pairwise-deletion — only dates both have data for, not zero-filled, since a 0 would falsely mean "very low intensity" rather than "no entry").
3. Keep pairs with `|r| >= 0.5`. Sort by `|r|` descending, cap at **top 5** (avoid overwhelming the narrative stage with noise).
4. `interpretation` is a template string chosen by sign + magnitude band, e.g.:
   - `r >= 0.7`: "High-intensity {A} days strongly coincide with high-intensity {B} days"
   - `0.5 <= r < 0.7`: "High-intensity {A} days tend to coincide with high-intensity {B} days"
   - `r <= -0.5`: "High-intensity {A} days tend to coincide with *lower*-intensity {B} days"

Edge cases: fewer than 2 life areas present → `correlations: []`. A pair below `MIN_OVERLAP_DAYS` is skipped, not scored at 0 — insufficient data is not the same as "no correlation."

### `identifyTemporalTrends(entries)`
Group by day-of-week (0=Sunday..6=Saturday):
```
avgIntensity[day] = mean(intensity of entries on that day-of-week)
moodFrequency[day][mood] = count(mood on that day-of-week) / count(entries on that day-of-week)
```
Edge case: a day-of-week with fewer than **3** samples across the whole range is still returned, but the caller (narrative generation) should treat it as low-confidence and avoid asserting it as a strong pattern — don't silently drop it (the user may genuinely only journal on certain days, which is itself a pattern), but don't overstate it either.

### `analyzeBlindSpots(entries, userContext)`
Two concrete, defensible heuristics — not a fuzzy "detect avoidance from tone" rule (that belongs to Claude during narrative generation, not this deterministic step):

- **Avoided areas:** life areas referenced in `userContext.values` or `userContext.goals` (simple case-insensitive keyword match against a small life-area synonym table, e.g. "fitness"/"health"/"gym" → `Health`) that have `frequency < 0.05` in the actual entries. Surfaced as `{area, reason: "stated_but_rarely_journaled"}`.
- **Disproportionate areas:** any life area with `frequency > 0.5` — over half of all journaling concentrated in one area. Surfaced as `{area, reason: "disproportionate_focus"}`.

Output: `{avoidedAreas: [...], disproportionateAreas: [...]}`. This is a list of *candidates* for the narrative engine to write about with actual nuance — the deterministic engine flags them, Claude explains them.

### Output Schema
```json
{
  "frequencies": { "Work": 0.45, "Relationships": 0.28, "Health": 0.18, "Spirituality": 0.09 },
  "correlations": [
    { "area1": "Work", "area2": "Health", "correlation": 0.72, "interpretation": "High-intensity Work days strongly coincide with high-intensity Health days" }
  ],
  "temporalTrends": [
    { "dayOfWeek": "Monday", "avgIntensity": 2.4, "moodFrequency": { "anxious": 0.6 }, "sampleSize": 8 }
  ],
  "blindSpots": {
    "avoidedAreas": [{ "area": "Spirituality", "reason": "stated_but_rarely_journaled" }],
    "disproportionateAreas": []
  }
}
```

### Tests (beyond PHASE_SPECS.md 2.1's list)
- Pair below `MIN_OVERLAP_DAYS` is excluded from `correlations`, not scored
- A day-of-week with 1-2 samples still appears in `temporalTrends` with its real `sampleSize`
- `userContext.values` mentioning an area that *is* well-represented does not appear in `avoidedAreas`

---

## 2. Quote Selection Engine

`backend/functions/src/services/quoteSelectionService.ts` (PHASE_SPECS.md 2.2)

**Two-stage design** — a cheap local pre-filter, then a Claude pass for the actual selection. Rationale: PHASE_SPECS.md 2.1 and 2.3 call out journals with 100-300+ entries; sending every entry to Claude for every focus question is both expensive and unnecessary when most entries are obviously irrelevant to a given question.

### Stage 1 — deterministic shortlist (`shortlistCandidates`)
Score every entry by:
- **keyword overlap**: lowercased, stopword-stripped term overlap between the focus question and the entry text (simple Jaccard or count-overlap — no embedding model required)
- **authenticity heuristic**: word count in `[20, 300]` (too short ⇒ likely low-content; a 300+ word wall of text is harder to quote cleanly) and non-zero first-person pronoun density
- **clarity heuristic**: average sentence length in a readable band (roughly 8-25 words/sentence)

Combine (`0.6 * keywordOverlap + 0.2 * authenticity + 0.2 * clarity`), take the **top 30** (or all entries if fewer than 30 exist). This stage never makes the final pick — it just keeps Stage 2's prompt a bounded size regardless of journal length.

### Stage 2 — Claude selection (`selectQuotes`)
Prompt Claude with the focus question and the Stage 1 shortlist (date/mood/area/text per entry); ask for the **top 3-5** quotes as structured JSON, each with a one-line `relevanceNote` explaining why it was chosen (used by narrative generation, not shown verbatim to the user). Claude — not the keyword score — makes the actual relevance judgment, since "does this entry genuinely speak to this focus question" is a reading-comprehension task.

```
You are selecting journal quotes that genuinely speak to a specific question —
not just ones that share keywords with it.

Focus question: "{focusQuestion}"

Candidate entries (date, mood, life area, text):
{shortlist}

Select the 3-5 entries that most genuinely illuminate this question. For each,
give a one-sentence note on why it's relevant. Return JSON only:
[{"date": "...", "mood": "...", "area": "...", "quote": "...", "relevanceNote": "..."}]
```

Edge cases: fewer than 3 candidates survive Stage 1 (very short or sparse journal) → return whatever Stage 2 finds, do not pad with weak matches; the narrative generation prompt (section 6 below) is told explicitly how many quotes it has and not to claim more evidence than exists.

### Output Schema
```json
[{ "quote": "...", "date": "2025-03-15", "mood": "anxious", "area": "Work", "relevanceNote": "..." }]
```

---

## 3. MBTI Framework Mapping

`backend/functions/src/services/analysisEngines/mbtiFramework.ts` (PHASE_SPECS.md 2.2)

### Reference profiles
Sixteen compact trait profiles — used as the "expected pattern" Claude compares the user's actual pattern data against. Written as original descriptive summaries of well-established trait tendencies (not reproduced test content).

| Type | Core tendencies |
|---|---|
| INTJ | Strategic, future-focused, independent, logic-first decisions, low small-talk tolerance |
| INTP | Analytical, idea-driven, flexible over structured, detached from routine, values precision |
| ENTJ | Decisive, goal-driven, organizes people/systems, blunt feedback style, future-oriented |
| ENTP | Idea-generative, debates for exploration not conflict, dislikes repetition, improvisational |
| INFJ | Meaning-driven, idealistic, deep 1:1 connection over breadth, internally conflict-averse |
| INFP | Values-driven, introspective, authenticity-seeking, resists external structure |
| ENFJ | People-focused, organizes others' growth, attuned to group emotional tone, decisive about values |
| ENFP | Enthusiastic, possibility-focused, relationship-warm, resists routine, idea-to-idea energy |
| ISTJ | Duty-driven, routine-preferring, detail-careful, present-focused, skeptical of untested ideas |
| ISFJ | Service-oriented, routine-preferring, quietly attentive to others' needs, conflict-avoidant |
| ESTJ | Order-imposing, efficiency-focused, directive, present/near-term focused, rule-respecting |
| ESFJ | Harmony-seeking, socially attentive, tradition-respecting, decisive about others' wellbeing |
| ISTP | Hands-on problem-solving, present-focused, independent, logic over sentiment, low routine need |
| ISFP | Present-focused, values-driven but quiet about it, aesthetic/sensory attentive, conflict-avoidant |
| ESTP | Action-oriented, present-focused, risk-tolerant, pragmatic, low patience for abstraction |
| ESFP | Present-focused, socially energized, spontaneous, enjoys sensory/experiential life |

### `analyzeMBTI(userType, patternData, textExcerpts)`
1. Look up `userType`'s profile above.
2. Pull the relevant signals already computed by the Pattern Detection Engine — `frequencies` (e.g. INTJ's low small-talk tolerance ↔ low `Relationships` frequency), `correlations`, `temporalTrends` — plus 5-10 representative text excerpts (reuse Quote Selection Engine's shortlist logic, not a second embedding step).
3. Send profile + pattern data + excerpts to Claude, asking for an alignment percentage and specific divergences — Claude is doing the actual trait-vs-behavior comparison, since that requires reading the excerpts' content and tone, not just their metadata.

```
The user identifies as {userType}. Typical {userType} tendencies: {profile}.

Their journal data shows: {frequencies, correlations, temporalTrends summary}
Representative excerpts: {textExcerpts}

Assess: where does their actual behavior align with {userType} tendencies, and
where does it diverge? Divergence is not a flaw — name it as a blind spot or an
integrated strength depending on what the data suggests. Return JSON:
{"alignmentPercentage": 0-100, "alignedPatterns": [...], "divergences": [...]}
```

Edge case: `userMbtiType` not provided → skip this engine entirely, per PHASE_SPECS.md 2.2's test "Framework skipped if user didn't provide type → No error." Don't guess a type.

### Output Schema
```json
{
  "type": "INTJ",
  "alignmentPercentage": 78,
  "expectedPatterns": ["Strategic, future-focused thinking", "..."],
  "observedPatterns": { "frequencies": {...}, "correlations": [...] },
  "divergences": ["Higher-than-expected Relationships engagement — possible integrated strength"]
}
```

---

## 4. Enneagram Framework Mapping

`backend/functions/src/services/analysisEngines/enneagramFramework.ts`

Same two-step shape as MBTI (deterministic data gathering, Claude-based alignment judgment) — not duplicated below in full; only what differs.

### Reference profiles

| Type | Core fear | Core desire | Stress direction (→) | Growth direction (→) |
|---|---|---|---|---|
| 1 — Reformer | Being wrong/corrupt | Being good, having integrity | → 4 (moody, withdrawn) | → 7 (spontaneous, accepting) |
| 2 — Helper | Being unloved/unneeded | Being loved, needed | → 8 (controlling, confrontational) | → 4 (self-aware, authentic) |
| 3 — Achiever | Being worthless without achievement | Being valued, successful | → 9 (checked-out, complacent) | → 6 (committed, cooperative) |
| 4 — Individualist | Having no identity/significance | Being uniquely themselves | → 2 (clingy, approval-seeking) | → 1 (principled, disciplined) |
| 5 — Investigator | Being incapable/overwhelmed | Being competent, understanding | → 7 (scattered, impulsive) | → 8 (decisive, engaged) |
| 6 — Loyalist | Being without support/guidance | Having security, support | → 3 (image-focused, competitive) | → 9 (relaxed, trusting) |
| 7 — Enthusiast | Being trapped in pain/deprivation | Being satisfied, fulfilled | → 1 (critical, rigid) | → 5 (focused, present) |
| 8 — Challenger | Being controlled/vulnerable | Self-protection, control of own life | → 5 (withdrawn, secretive) | → 2 (open, caring) |
| 9 — Peacemaker | Loss of connection/fragmentation | Inner/outer peace | → 6 (anxious, suspicious) | → 3 (self-asserting, engaged) |

### `analyzeEnneagram(userType, patternData, textExcerpts)`
Same request shape as MBTI, swapping the profile table and asking Claude specifically about **stress vs. growth direction** signals — e.g. a Type 3 showing `disproportionateAreas` skewed toward achievement-coded life areas combined with declining mood intensity over the date range reads differently than the same skew with *stable* mood (closer to stress-direction checkout vs. sustained high-functioning achievement focus). Claude makes that call from the actual trend data, not a hardcoded threshold.

Edge case: same as MBTI — no `userEnneagramType` provided, skip entirely.

---

## 5. Values Alignment Engine

`backend/functions/src/services/analysisEngines/valuesAlignment.ts`

No PHASE_SPECS.md code-structure stub exists for this one yet beyond the ARCHITECTURE.md 3.5 description — defined here from that description: *"Cross-references user's stated values against journal behavior. Flags where data contradicts stated values."*

### `analyzeValuesAlignment(userValues, entries, patternData)`
1. Deterministic pre-check: for each stated value (free-text, e.g. "Family", "Integrity", "Growth"), keyword-match against entry text and against `frequencies`/`avoidedAreas` (reuses the life-area synonym table from Pattern Detection's blind-spot check) to produce a rough "mentioned vs. not" and "corresponding life-area frequency" signal per value.
2. Send stated values + that signal summary + representative excerpts to Claude, asking it to identify genuine contradictions (data that undercuts a stated value) and aligned areas (data that supports it) — again, judging *contradiction* from text requires reading comprehension, not keyword counting alone.

```
The user states these values: {userValues}.

For each value, here's what their journal data shows: {signal summary}
Representative excerpts: {textExcerpts}

Identify: where does their journaled behavior align with a stated value, and
where does it genuinely contradict one (not just "they didn't mention it" —
an unmentioned value isn't automatically a contradiction). Return JSON:
{"valuesProvided": [...], "alignedAreas": [...], "contradictions": [...]}
```

Edge case: `userContext.values` empty/not provided → skip entirely, same pattern as the framework engines.

### Output Schema
```json
{
  "valuesProvided": ["Integrity", "Family", "Growth"],
  "alignedAreas": ["Growth: consistent reflection and goal-setting language"],
  "contradictions": ["Family: stated as top value, but Relationships is the most-avoided life area"]
}
```

---

## 6. Narrative Generation Engine

`backend/functions/src/services/narrativeGeneration/narrativeService.ts` (PHASE_SPECS.md 3.1)

Takes every engine's output above plus `userContext` and produces the 6 report sections. **Shared voice constraints across all 6 prompts** (already established in PHASE_SPECS.md 3.1, restated here as the single source of truth so the per-section prompts below don't repeat it):

> Voice: warm, evidence-based, non-prescriptive. Show, don't tell. No directives, no "you should." Observations grounded in the actual data provided — never claim a pattern the data doesn't support, and never claim more quotes/evidence exist than were actually provided. Plain text only, no markdown/formatting codes in the output (the PDF template, not Claude, owns formatting).

### 6.1 Your Emotional Landscape (2-3 paragraphs)
```
Section: "Your Emotional Landscape"
Data: {frequencies, temporalTrends, dominant moods}
Write 2-3 paragraphs summarizing the top life areas and emotional tones
present in their journaling. Include one concrete observation from the
temporal trends (e.g. a day-of-week pattern) if the data supports it with
a reasonable sample size — skip it if the sample is too thin to say
anything meaningful.
```

### 6.2 / 6.3 Focus Question #1 / #2 (2-3 pages each)
```
Section: "{focusQuestion}"
Data: {relevant correlations, quotes from Quote Selection Engine, blind spots touching this question}
Structure:
1. The Pattern — narrative summary of what the data shows
2. The Evidence — weave in the {N} provided quotes (N may be fewer than 5;
   never imply more exist)
3. The Interconnections — how this pattern relates to other life areas,
   grounded in the correlations data provided
4. Reflective Questions — 3-5 open-ended questions, not advice
```

### 6.4 Your Blind Spots (1-2 pages)
```
Section: "Your Blind Spots"
Data: {blindSpots.avoidedAreas, blindSpots.disproportionateAreas}
Write about what the data flags as avoided or disproportionate. Frame as
observation and open possibility, not diagnosis — "the data shows X" not
"this means you are Y." If both lists are empty, write a short section
acknowledging the journal shows fairly even engagement across life areas
rather than fabricating a blind spot to fill the section.
```

### 6.5 Framework Lenses (1-2 pages per selected framework)
One prompt per framework actually selected (MBTI, Enneagram, Values) — **omit entirely** for any framework the user didn't select or didn't provide a type for, per PHASE_SPECS.md 2.2's "Framework skipped if user didn't select → No error."
```
Section: "Your {Framework} Lens"
Data: {that framework's engine output — alignmentPercentage, divergences, etc.}
Structure: type/profile stated → what we observed → where it aligns →
where it diverges, framed as blind spot or integrated strength per the
engine's own framing, not reinterpreted.
```

### 6.6 Closing (1 paragraph)
```
Section: "Closing"
Write one warm closing paragraph. Honor the practice of journaling itself,
not just its content. No summary of prior sections, no prescription, no
new claims about the data — an invitation to keep reflecting, nothing more.
```

### Assembly
`narrativeService.ts` calls each section prompt, concatenates results in order (Landscape → Focus Q1 → Focus Q2 → Blind Spots → Framework Lens(es) → Closing), and hands the array to the PDF compiler (PHASE_SPECS.md 3.2) — which owns section numbering, headings, and page breaks, not the narrative prompts themselves.

---

## 7. Related Documents

- **PHASE_SPECS.md** 2.1-2.3, 3.1 — where each engine fits in the build timeline, plus the baseline test lists these specs extend
- **ARCHITECTURE.md** 3.5-3.6 — system-level description of each engine and its declared technology
- **API_SPEC.md** — `focusQuestions`, `frameworks`, `userContext` request shape these engines consume
