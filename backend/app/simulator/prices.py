"""
Price generation: a factor model with correlated returns.

DESIGN. Every security's daily log-return is built from three additive
pieces:

    r_{i,t} = beta_mkt_i * F_mkt_t + beta_sec_i * F_sec(i)_t + eps_{i,t}

F_mkt_t is a single market factor shared by all N securities. F_sec_t is
one of S sector factors (each security belongs to exactly one sector).
eps_{i,t} is idiosyncratic noise, independent across i and t. All three
components are drawn i.i.d. across days *before* any agent exists or
makes a decision.

WHY A FACTOR MODEL AND NOT PLAIN GBM. Plain (single-asset) GBM would
give 50+ securities with cross-sectionally *independent* returns, which
is unrealistic (real equities co-move through the market and their
sector) and, more importantly for this assignment, it would remove the
one thing we need for the overconfidence regression's control variable:
a meaningful "risk exposure" measure. With a factor model each security
has a market beta, so each account's portfolio has a well-defined
market-beta exposure that can enter X_i in the turnover regression as a
genuine risk-exposure control, and correlated returns give portfolios
realistic (non-diversifiable) volatility.

THE BIG CONSTRAINT (informed trading must not exist). Every price path
for all N securities and all T days is generated once, in full, up
front, using only the RNG seed -- before the agent-simulation loop ever
runs. Agents can only read prices that are already fixed; nothing in
the agent code ever writes to, or influences, this array (no market
impact is modeled). This makes it *structurally impossible* for a
trading decision to be correlated with a subsequently realized return:
the future returns are drawn independent of, and prior to, any decision
that could depend on them. The only channel through which a bias could
still look "informed" is if we let an agent's *reinvestment* rule pick
new securities using a forecast -- we never do that (see engine.py:
reinvestment always draws uniformly at random from the universe).

Returns are i.i.d. across days by construction (no autocorrelation, no
momentum, no true mean reversion). This is a deliberate simplifying
choice, and it matters for Scenario 8 (the "belief in reversal"
confound): an agent who trades on a trailing-return signal is acting on
a pattern that does not actually exist in the return-generating
process. That the confound still produces a measured effect is exactly
the point -- it shows the bias is coming from the *decision rule*, not
from the agent being "right" about momentum/reversal.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class PriceConfig:
    n_securities: int = 60
    n_days: int = 504  # ~2 trading years at 252 sessions/year
    n_sectors: int = 6

    market_drift: float = 0.00030   # ~7.9%/yr annualized
    market_vol: float = 0.0080      # daily vol of the market factor

    sector_drift_spread: float = 0.00012  # sector drifts ~ N(0, this)
    sector_vol: float = 0.0055

    idio_vol_lo: float = 0.0060
    idio_vol_hi: float = 0.0140
    idio_drift_spread: float = 0.00008  # tiny cross-sectional drift noise

    market_beta_mean: float = 1.00
    market_beta_sd: float = 0.28
    sector_beta_mean: float = 1.00
    sector_beta_sd: float = 0.35

    p0: float = 100.0

    spread_bps_lo: float = 10.0   # full bid-ask spread, bps of mid price
    spread_bps_hi: float = 70.0
    commission_bps: float = 4.0   # proportional commission, bps of trade value
    commission_min_usd: float = 2.00  # minimum ticket commission


@dataclass
class PricePanel:
    mid: np.ndarray        # (T+1, N) mid prices, mid[0] = p0 for all
    bid: np.ndarray        # (T+1, N)
    ask: np.ndarray        # (T+1, N)
    log_ret: np.ndarray    # (T, N) mid-price log returns, log_ret[t] = log(mid[t+1]/mid[t])
    sector_id: np.ndarray  # (N,) int
    market_beta: np.ndarray  # (N,)
    sector_beta: np.ndarray  # (N,)
    spread_bps: np.ndarray   # (N,)
    commission_bps: float
    commission_min_usd: float
    config: PriceConfig = field(repr=False, default=None)

    @property
    def n_securities(self) -> int:
        return self.mid.shape[1]

    @property
    def n_days(self) -> int:
        return self.log_ret.shape[0]


def simulate_prices(cfg: PriceConfig, rng: np.random.Generator) -> PricePanel:
    n, t, s = cfg.n_securities, cfg.n_days, cfg.n_sectors

    sector_id = rng.integers(0, s, size=n)
    market_beta = np.clip(rng.normal(cfg.market_beta_mean, cfg.market_beta_sd, n), 0.15, 2.2)
    sector_beta = np.clip(rng.normal(cfg.sector_beta_mean, cfg.sector_beta_sd, n), 0.0, 2.2)
    idio_vol = rng.uniform(cfg.idio_vol_lo, cfg.idio_vol_hi, n)
    idio_drift = rng.normal(0.0, cfg.idio_drift_spread, n)
    sector_drift = rng.normal(0.0, cfg.sector_drift_spread, s)
    spread_bps = rng.uniform(cfg.spread_bps_lo, cfg.spread_bps_hi, n)

    # All randomness for the whole horizon is drawn now, once, up front.
    market_factor = rng.normal(cfg.market_drift, cfg.market_vol, t)               # (T,)
    sector_factor = rng.normal(sector_drift[None, :], cfg.sector_vol, (t, s))       # (T, S)
    idio = rng.normal(idio_drift[None, :], idio_vol[None, :], (t, n))              # (T, N)

    sector_factor_per_sec = sector_factor[:, sector_id]  # (T, N)
    log_ret = (
        market_beta[None, :] * market_factor[:, None]
        + sector_beta[None, :] * sector_factor_per_sec
        + idio
    )

    log_mid = np.concatenate([np.zeros((1, n)), np.cumsum(log_ret, axis=0)], axis=0)
    mid = cfg.p0 * np.exp(log_mid)

    half_spread_frac = (spread_bps / 10_000.0) / 2.0
    bid = mid * (1.0 - half_spread_frac[None, :])
    ask = mid * (1.0 + half_spread_frac[None, :])

    return PricePanel(
        mid=mid, bid=bid, ask=ask, log_ret=log_ret,
        sector_id=sector_id, market_beta=market_beta, sector_beta=sector_beta,
        spread_bps=spread_bps, commission_bps=cfg.commission_bps,
        commission_min_usd=cfg.commission_min_usd, config=cfg,
    )
