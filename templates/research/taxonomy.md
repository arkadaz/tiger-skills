# Approach Taxonomy — {{GOAL_ID}}

> The CLOSED-enum vocabulary of approach FAMILIES. Every experiment's `approach_vector.family`
> MUST be exactly one value from the table below — the novelty gate folds `{family}` into the
> structural set S, so a stray family reads as a whole new region of the search space.
> `/research-goal` authors this with the human (seeded with the ML defaults below); re-author
> the families for your domain before approval. Add a family ONLY by editing this file.

## Families (default: ML / model-architecture goals)
| Family | The kind of "new way" it names |
|---|---|
| `attention-mechanism` | how tokens/nodes attend — sparse, linear, kernelized, local-global |
| `positional-encoding` | how position/structure is injected — absolute, relative, rotary, learned |
| `graph-rewiring` | changing the connectivity the model sees — edges added/dropped/expandered |
| `tokenization` | the input unit — subword, byte, patch, learned-vocab |
| `loss-objective` | what is optimized — contrastive, margin, auxiliary, reweighted |
| `pretraining-task` | the self-supervision — masking, denoising, next-x, ordering |
| `pooling-readout` | how per-unit reps collapse to an answer — mean/attention/set/hierarchical |
| `normalization` | where/how activations are normed — pre/post, group, RMS, none |
| `expressivity` | raising the function class — higher-order, WL-boosting, feature augmentation |
| `spectral` | operating in an eigen/frequency basis — filters, Laplacian, Fourier features |
| `sampling` | which data/subgraph/negatives are drawn, and how |

## Re-authoring for a non-ML goal (example: a trading strategy)
| Family | The kind of "new way" it names |
|---|---|
| `state-estimation` | filtering the latent state — Kalman, particle, HMM |
| `momentum` | trend-continuation signals across horizons |
| `mean-reversion` | fade-the-move / spread-reversion signals |
| `stat-arb` | cross-sectional relative-value baskets |
| `regime-switching` | conditioning behavior on a detected regime |
| `vol-targeting` | sizing/allocation driven by volatility |
| `microstructure` | order-flow / book / execution-level signals |
| `ml-signal` | a learned predictor as the alpha source |

## Rule
- CLOSED enum: an `approach_vector.family` outside this table is REFUSED at novelty-check.
- Broadening the search space = a human edit here, on the record — never an agent's silent choice.
