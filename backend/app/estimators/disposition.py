"""
Disposition-effect estimator: PGR / PLR with account-clustered bootstrap.

METHODOLOGY (Odean 1998). On every day an account closes at least one
position, look at that account's ENTIRE portfolio held that day and
classify every position as a paper gain or a paper loss against its own
purchase price. A gain that gets closed that day adds to G_r ("gain
realized"); a gain that is still open at the end of that day adds to
G_p ("gain paper"); L_r / L_p are the loss-side analogues.

    PGR_hat = G_r / (G_r + G_p)      "proportion of gains realized"
    PLR_hat = L_r / (L_r + L_p)      "proportion of losses realized"

Both counts are accumulated across every account and every sale-day in
the sample, then the two ratios are computed ONCE from the pooled totals
(not averaged account-by-account) -- this is the original Odean
estimator, and it is the estimator this module implements.

FOUR THINGS THIS MODULE COMMITS TO IN WRITING (per the assignment):

1. Days with no sale contribute nothing. A day on which an account
   makes zero closes is invisible to G_r/G_p/L_r/L_p entirely -- the
   engine only accumulates into these counters on `sold_today_any`
   rows (see engine.py). This is intentional: PGR/PLR are conditional
   on "having made a trading decision that day"; a day with no trade
   tells you nothing about a gain/loss-conditional selling propensity.

2. Partial sales. This simulator never partially sells a position --
   every close is a full-lot liquidation (see engine.py: `active` is
   a boolean per slot, there is no fractional share bookkeeping for a
   sale). So the "does half a position count as one realization or a
   fraction" question does not arise here by construction: every
   realization is exactly one full-lot event, weighted as 1 count, the
   same way Odean counts a full liquidation. Had we allowed partial
   sales, the defensible convention (and the one we would use) is to
   weight the realization by the dollar fraction closed, not to count
   it as a full event -- otherwise an account that trims 1% of a
   position 50 times would be counted as 50 realizations.

3. Cost basis. Every position is a single lot: the reinvestment rule
   never adds to an existing open position, it always opens a brand
   new slot. There is therefore no averaging question (average cost vs.
   FIFO vs. per-lot) -- per-lot IS the cost basis, unambiguously, because
   there is only ever one lot per open position.

4. Exactly at the purchase price. x = (mid - purchase)/purchase is
   compared against 0 with a small numerical tolerance (1e-9); an exact
   tie contributes to NEITHER the gain nor the loss counters (matches
   Odean, who also drops break-even closes -- a position that has not
   moved is neither a "gain" nor a "loss" signal about loss aversion).

CLUSTERING. Observations within an account are not independent (the
same delta_i shapes every one of that account's sale-day realizations),
so the bootstrap resamples ACCOUNTS with replacement, not individual
realizations. Resampling individual (G_r,G_p,L_r,L_p) events instead
(as if every realization were an independent draw) is included here too,
under `naive_event_bootstrap`, purely to demonstrate -- as the
assignment requires -- how much that wrong assumption understates the
standard error.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class DispositionResult:
    Gr: float; Gp: float; Lr: float; Lp: float
    PGR: float; PLR: float
    diff: float           # PGR - PLR
    ratio: float          # PGR / PLR
    n_accounts: int
    n_accounts_active: int  # accounts with at least one non-zero count

    se_diff_cluster: float; ci_diff_cluster: tuple[float, float]
    se_ratio_cluster: float; ci_ratio_cluster: tuple[float, float]
    se_pgr_cluster: float; se_plr_cluster: float

    se_diff_naive: float; ci_diff_naive: tuple[float, float]
    se_ratio_naive: float

    boot_diff_cluster: np.ndarray
    boot_diff_naive: np.ndarray


def _pgr_plr(Gr: float, Gp: float, Lr: float, Lp: float) -> tuple[float, float]:
    pgr = Gr / (Gr + Gp) if (Gr + Gp) > 0 else np.nan
    plr = Lr / (Lr + Lp) if (Lr + Lp) > 0 else np.nan
    return pgr, plr


def estimate_disposition(Gr: np.ndarray, Gp: np.ndarray, Lr: np.ndarray, Lp: np.ndarray,
                          n_boot: int = 2000, seed: int = 777) -> DispositionResult:
    rng = np.random.default_rng(seed)
    M = Gr.shape[0]

    tot_Gr, tot_Gp, tot_Lr, tot_Lp = Gr.sum(), Gp.sum(), Lr.sum(), Lp.sum()
    PGR, PLR = _pgr_plr(tot_Gr, tot_Gp, tot_Lr, tot_Lp)
    diff = PGR - PLR
    ratio = PGR / PLR if PLR not in (0, np.nan) and not np.isnan(PLR) else np.nan

    active_mask = (Gr + Gp + Lr + Lp) > 0
    n_active = int(active_mask.sum())

    # ---- cluster (by-account) bootstrap: resample the M accounts ----
    boot_diff_c = np.empty(n_boot)
    boot_ratio_c = np.empty(n_boot)
    boot_pgr_c = np.empty(n_boot)
    boot_plr_c = np.empty(n_boot)
    for b in range(n_boot):
        idx = rng.integers(0, M, size=M)
        gr, gp, lr, lp = Gr[idx].sum(), Gp[idx].sum(), Lr[idx].sum(), Lp[idx].sum()
        pgr_b, plr_b = _pgr_plr(gr, gp, lr, lp)
        boot_pgr_c[b] = pgr_b; boot_plr_c[b] = plr_b
        boot_diff_c[b] = pgr_b - plr_b
        boot_ratio_c[b] = pgr_b / plr_b if plr_b and not np.isnan(plr_b) else np.nan

    se_diff_c = float(np.nanstd(boot_diff_c, ddof=1))
    ci_diff_c = tuple(np.nanpercentile(boot_diff_c, [2.5, 97.5]))
    se_ratio_c = float(np.nanstd(boot_ratio_c, ddof=1))
    ci_ratio_c = tuple(np.nanpercentile(boot_ratio_c, [2.5, 97.5]))
    se_pgr_c = float(np.nanstd(boot_pgr_c, ddof=1))
    se_plr_c = float(np.nanstd(boot_plr_c, ddof=1))

    # ---- naive (by-event / multinomial) bootstrap: WRONG, for comparison ----
    total_n = tot_Gr + tot_Gp + tot_Lr + tot_Lp
    probs = np.array([tot_Gr, tot_Gp, tot_Lr, tot_Lp]) / total_n if total_n > 0 else np.array([0.25] * 4)
    boot_diff_n = np.empty(n_boot)
    boot_ratio_n = np.empty(n_boot)
    n_total_int = int(round(total_n))
    for b in range(n_boot):
        counts = rng.multinomial(n_total_int, probs) if n_total_int > 0 else np.zeros(4)
        gr, gp, lr, lp = counts
        pgr_b, plr_b = _pgr_plr(gr, gp, lr, lp)
        boot_diff_n[b] = pgr_b - plr_b
        boot_ratio_n[b] = pgr_b / plr_b if plr_b and not np.isnan(plr_b) else np.nan

    se_diff_n = float(np.nanstd(boot_diff_n, ddof=1))
    ci_diff_n = tuple(np.nanpercentile(boot_diff_n, [2.5, 97.5]))
    se_ratio_n = float(np.nanstd(boot_ratio_n, ddof=1))

    return DispositionResult(
        Gr=float(tot_Gr), Gp=float(tot_Gp), Lr=float(tot_Lr), Lp=float(tot_Lp),
        PGR=float(PGR), PLR=float(PLR), diff=float(diff), ratio=float(ratio),
        n_accounts=M, n_accounts_active=n_active,
        se_diff_cluster=se_diff_c, ci_diff_cluster=ci_diff_c,
        se_ratio_cluster=se_ratio_c, ci_ratio_cluster=ci_ratio_c,
        se_pgr_cluster=se_pgr_c, se_plr_cluster=se_plr_c,
        se_diff_naive=se_diff_n, ci_diff_naive=ci_diff_n, se_ratio_naive=se_ratio_n,
        boot_diff_cluster=boot_diff_c, boot_diff_naive=boot_diff_n,
    )
