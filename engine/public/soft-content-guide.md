# Soft content authoring brief

This guide is the reusable brief for drafting the three horse paragraphs printed in
the Evolution Stables PDS. Drafting happens outside the engine. The engine stores the
approved plain text and its legal compiler prints it verbatim.

Use this prompt in a separate chat:

> Use this guide to help me write the soft content for [HORSE LEGAL NAME].

## What the chat needs

Provide the horse record, pedigree snapshot, aggregate race summary and trainer
details. If sales history, trainer comments or physique notes are relevant, provide
them too.

The minimum input set is:

1. Horse record: legal name, foaling date, sex, colour, breeder, sire, dam and
   registration details.
2. Pedigree and race summary: the four-generation family tree, starts, wins, seconds,
   thirds and stakes.
3. Trainer: name, stable and location.
4. Sales history, if known: sale, year, lot, vendor and whether sold or withdrawn.

If a fact is missing, write around it. A shorter true paragraph is better than a
fuller invented one.

## What the engine requires

The engine saves three human-authored horse fields:

| Label | Field |
|---|---|
| About the horse | `aboutHorse` |
| Racing outlook and pedigree | `racingOutlookAndPedigree` |
| Race expectation | `raceExpectation` |

The fourth PDS soft slot is the trainer biography. It belongs to the trainer party
record and is not pasted into the horse form.

## Output contract

Return exactly these three blocks, in this order, with no preamble:

```text
About the horse
<plain-text prose>

Racing outlook and pedigree
<plain-text prose>

Race expectation
<plain-text prose>
```

Then return a separate `Facts used` list. This list is for checking only and must not
be pasted into the engine.

## Section 1: About the horse

Target: 100–150 words, three short paragraphs.

1. Identity: name, colour, sex, sire, dam, foaling date, breeder, and any meaningful
   sale or retention fact.
2. Type: what the cross produces physically and genetically, plus one useful fact
   about the female family.
3. Situation: where the horse is, who trains her, the yard's location, and one
   concrete fact that establishes the yard's standing.

Do not repeat the full key-details table or list every win by the sire. The pedigree
section carries that detail.

## Section 2: Racing outlook and pedigree

Target: 120–170 words, usually two paragraphs.

1. Sire: race record by distance and grade, stud record with sourced numbers, and
   one named graduate.
2. Dam and programme: the dam's record, distances and black type; one fact about the
   next dam; the distance range the profile supports; the intended grade; and how the
   programme maps to the lease term.

Every claim must be traceable to the NZTR record, pedigree data or trainer. Distances
must be specific. Do not promise a stakes win or use an unsupported adjective.

## Section 3: Race expectation

Target: 50–90 words, one standalone paragraph.

State whether the horse is in training, trialling, spelling or raced. Say what
triggers the next step, that the yard decides, and how Members receive updates.

This text prints twice: under the PDS heading and in the key-information summary. It
must make sense on its own. Do not say “as above” or “as outlined below”.

## Hard rules

1. Plain text only. Do not use headings, bullets, numbering, bold, italics, links,
   backticks or other Markdown inside a section.
2. Every proper noun and number must trace to a supplied source.
3. No invented statistics, dates, targets or performance claims.
4. No purchase urgency, benefit-selling or promises of price, return or results.
5. Each section must make sense without either of the other two.
6. Use third person for the horse and plain English throughout.
7. Do not use these banned terms: Tokinvest, VARA, token, tokens, tokenised, digital
   token, Fair Value, 14 business days or absorb.
8. Do not mention commercial terms in the horse prose. They belong to the legal
   terms, not these paragraphs.

## Facts used

After the three blocks, list the source of every proper noun and number used. Example:

```text
Facts used
- Foaling date, identity and registration: NZTR Stud Book
- 15-node family tree: NZTR pedigree snapshot
- Starts, wins, placings and stakes: NZTR race summary
- Trainer and stable: trainer record
```

If a fact has no source, remove the corresponding claim before returning the copy.

## Final checklist

- The output is exactly three plain-text sections.
- The three blocks are 100–150, 120–170 and 50–90 words respectively.
- Every block stands alone.
- No Markdown or banned vocabulary is present.
- `Race expectation` can be read as a one-line summary.
- Every proper noun and number appears in `Facts used`.
- No claim has been invented to fill a gap.

## Where it goes

Open the horse profile in the DSL Engine, find **Soft content**, and paste each plain
text block into the matching box. The engine validates required content, Markdown and
banned terms before saving. Length outside the target ranges produces a warning, not
an automatic rejection.

The trainer biography is edited on the trainer record.
