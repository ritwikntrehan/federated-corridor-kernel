# Utility proof — live bounded cohort run

**Run status:** complete  
**Run UTC:** 2026-11-17T07:59:43.516Z  
**Git commit:** `c40ddc1a0d5fe1a141b23d4b9184a5c449d34cad`  
**Runtime:** 20814 ms  
**Mode:** live upstream requests (not fixtures)

## Executive answer

The kernel can combine registered-study status, stop reasons, enrollment semantics and exact publication references with OpenAlex work/citation metadata and exact NIH project-year award records. No one provider supplies that combined view. Every link below is an identifier-backed association; it does not establish that a grant funded a trial, that a project produced a paper, or that a registered outcome succeeded or failed.

The independent SPRINT control resolved with status **partial** across 3 provider countries. The terminated-trial sample produced **30 unique verified relationships**. A zero is a valid observed yield, not replaced with fixture data.

## Method and limits

The cohort is a bounded sample of the first 15 records from stable, documented filters. It is not representative of all trials or projects. ClinicalTrials.gov status and phase are validated again after retrieval. OpenAlex annual citation counts are reported only for returned years; unavailable years remain unknown. NIH amounts are project-record fiscal-year values, not payments for a paper or trial. Direct and indirect amounts are not assumed to sum to award amount.

Provider request URLs are preserved in [the machine-readable artifact](benchmarks/results/utility-proof.json), with API keys removed. The production Worker reserves five of Cloudflare's 50 subrequests and stops at 45 with a continuation. This Node-side live runner uses a separate 200-request ceiling while retaining the shared RePORTER rate limiter.

## Benchmark 1 — terminated Phase II interventional oncology trials

| NCT ID | status | reason stopped | relevant date | exact PMID/DOI | supported citation years | verified NIH cores | missing-link reason |
|---|---|---|---|---|---|---|---|
| NCT05753007 | TERMINATED | Study terminated by sponsor due to low enrollment. | 2025-02-11 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT00006092 | TERMINATED | low accrual | 2003-03 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT00862134 | TERMINATED | Interim analysis indicated low probability of clinically significant result | 2010-05 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT00330564 | TERMINATED | Slow accrual. | 2011-05 | 22105611, 10.1093/annonc/mdr011, 22105611, 10.1093/annonc/mdr011 | available in raw artifact | P30CA016672 | — |
| NCT00003516 | TERMINATED | Slow accrual | 2004-03-18 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT01938833 | TERMINATED | Closed by Sponsor | 2016-12-08 | 18269774, 10.3816/cbc.2007.n.049, 20224928, 10.1007/s10549-010-0825-z, 20217129, 10.1007/s00432-010-0849-0 | available in raw artifact | none | no supported NIH project match |
| NCT00179738 | TERMINATED | not supplied | 2007-04 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT00209014 | TERMINATED | Celgene unable to continue funds. | 2006-06 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT00004221 | TERMINATED | not supplied | 2002-02-06 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT03773133 | TERMINATED | High number of screen failures | 2019-10-10 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT02543749 | TERMINATED | not supplied | 2022-07 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT03109847 | TERMINATED | Poor accrual | 2022-12-07 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT02162758 | TERMINATED | Business Decisions; No Safety Concerns | 2016-04 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT04690855 | TERMINATED | This study has been terminated due to Lack of Accrual. | 2022-12-20 | none | unknown | none | no exact publication reference or OpenAlex resolution |
| NCT02013778 | TERMINATED | Lack of enrollment | 2019-02 | none | unknown | none | no exact publication reference or OpenAlex resolution |

This table describes exact publication-reference associations and associated NIH project records. It does not describe sunk capital or causal funding.

## Benchmark 2 — NIH R01/U01 project cohort

| NIH core | study section | fiscal years | project-year award USD | direct/indirect USD | OpenAlex works | exact NCT links |
|---|---|---|---|---|---|---|
| R01AA025859 | ZRG1 | 2017, 2019, 2018 | 199648, 199648, 199648 | 125538/74110, 126776/72872, 123124/76524 | 1 | 0 |
| R01AA026687 | ZRG1 | 2020, 2019, 2021 | 405787, 411863, 405787 | 260120/145667, 264015/147848, 260120/145667 | 3 | 0 |
| R01AA027017 | ARM | 2021, 2019, 2022, 2018, 2020 | 445668, 525183, 429765, 492122, 532861 | 287528/158140, 338828/186355, 277268/152497, 317498/174624, 343781/189080 | 3 | 0 |
| R01AA028263 | CHSA | 2021, 2022 | 500834, 543569 | 323543/177291, 380955/162614 | 3 | 0 |
| R01AA029984 | ZRG1 | 2022 | 429615 | 299192/130423 | 3 | 0 |
| R01AG027060 | ASG | 2018, 2020, 2021, 2022, 2019 | 635299, 460652, 644242, 563519, 421229, 367515, 615325 | 408575/226724, 270972/189680, 433956/210286, 386472/177047, 274199/147030, 238525/128990, 407120/208205 | 3 | 0 |
| R01AG034852 | ZRG1 | 2018, 2020, 2017, 2016, 2019 | 116567, 1405760, 1401969, 1286627, 1370095, 1622643 | 102442/14125, 1216050/189710, 1155288/246681, 1117335/169292, 1120993/249102, 1388678/233965 | 3 | 0 |
| R01AG047178 | NAME | 2019, 2017, 2018, 2016 | 328772, 328772, 328772, 334735 | 217481/111291, 217481/111291, 217481/111291, 218711/116024 | 3 | 0 |
| R01AG047932 | ODHS | 2022 | 520291 | 344672/175619 | 3 | 0 |
| R01AG049762 | ASG | 2018, 2020, 2017, 2016, 2019 | 291798, 489980, 569061, 104258, 667426, 581264, 565480 | 212926/78872, 328797/161183, 380136/188925, 67047/37211, 443379/224047, 399102/182162, 377672/187808 | 3 | 0 |
| R01AG049970 | ZRG1 | 2017, 2018, 2016 | 590385, 584436, 372944, 581743 | 502994/87391, 492416/92020, 302255/70689, 390066/191677 | 3 | 0 |
| R01AG051752 | ASG | 2017, 2016, 2018 | 287094, 312118, 286447 | 205000/82094, 205000/107118, 205000/81447 | 3 | 1 |
| R01AG051827 | ASG | 2018, 2019, 2017, 2020, 2016 | 723675, 661396, 740387, 652038, 844377 | 495220/228455, 455040/206356, 506002/234385, 447332/204706, 565168/279209 | 3 | 1 |
| R01AG052446 | CNN | 2020, 2018, 2016, 2019, 2017 | 628161, 413290, 657271, 660940, 663774, 644797 | 436021/192140, 280386/132904, 493323/163948, 480211/180729, 493023/170751, 466868/177929 | 3 | 0 |
| R01AG053274 | VCMB | 2018, 2019, 2021, 2020, 2017 | 529023, 98135, 529157, 529157, 529157, 519328 | 320701/208322, 59476/38659, 320701/208456, 320701/208456, 320701/208456, 315701/203627 | 3 | 0 |

This is a funded-project/publication/trial-reference network. It does not establish that an award financed a trial or produced a clinical outcome.

## Benchmark 3 — exact-only versus candidate-augmented

| measure | exact only | candidate enabled |
|---|---:|---:|
| verified relationships | 30 | 30 |
| hypothesis relationships | 0 | 0 |
| missing candidate attributes | 0 | 1 |

Verified counts remained identical. Candidate coverage lift is 0; this is not recall or precision. Zero candidates means the existing APIs did not expose a defensible shared attribute bridge for this sample.

## Per-corridor funnels

### Benchmark 1

| corridor | attempts | verified edges | hypothesis edges | no matches | errors |
|---|---:|---:|---:|---:|---:|
| clinicaltrials-to-openalex | 5 | 5 | 0 | 13 | 0 |
| openalex-to-nih-reporter | 2 | 25 | 0 | 1 | 0 |

### Benchmark 2

| corridor | attempts | verified edges | hypothesis edges | no matches | errors |
|---|---:|---:|---:|---:|---:|
| openalex-to-clinical-trials | 43 | 2 | 0 | 41 | 0 |

## Independent API value versus federated value

- ClinicalTrials.gov supplied study status, reason stopped, dates, enrollment count/type, sponsor, outcomes, phases, and publication references where present.
- OpenAlex supplied work identity, publication dates, citation totals/available annual counts, institution RORs, and preserved funder-award identifiers where present.
- NIH RePORTER supplied project/application identity, fiscal-year awards, optional direct/indirect components, organization/PI/study-section fields, and project-publication PMID associations where present.
- The trial → publication and publication → project-year chains, cross-provider drop-offs, and per-corridor yield require joining at least two systems.

## Observed bottlenecks

1. `no_publication_reference`: 13
2. `non_nih_award`: 3

Upstream failures remain errors and make this report degraded; the runner exits non-zero rather than presenting fixture output as live proof.
