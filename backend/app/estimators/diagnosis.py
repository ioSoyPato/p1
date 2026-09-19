"""
Confound diagnosis: which of the four non-bug mechanisms is present.

Given a SimulationResult, this module quantifies, separately, the four
candidate explanations the assignment lists for beta(gross) < 0 (mechanism
#1, informed-trading leakage, is checked once, globally, by
validation.informed_trading_placebo -- it is a bug if present, not a
"finding" to quantify here):

  #2 cash drag       : corr(turnover, avg_cash_fraction), and how much of
                        gross_mid_return's cross-sectional variance lines up
                        with time spent in cash.
  #3 spread confound  : gross_fill_return - gross_mid_return, the part of a
                        naive "gross of commission" return that still has
                        half the bid-ask spread baked into it. We report its
                        average and regress it on turnover -- it should
                        scale close to linearly with trade count, since every
                        extra trade pays the spread once more.
  #4 compounding path : the residual beta(gross_mid ~ turnover) after
                        controlling for size/positions/risk -- this is the
                        part of the slope that survives even once BOTH cost
                        channels (#2, #3) have been stripped out of the
                        dependent variable, i.e. what turnover does to
                        returns even in a perfectly frictionless world.
  reverse causality    : regressing turnover on RETURN (arrow reversed) at
                        the SAME cross-section. A positive slope here is the
                        signature described in the prompt: a disposition (or
                        disposition-like) selling rule makes winners get
                        sold more, so accounts that got lucky end up with
                        higher measured turnover as a CONSEQUENCE of their
                        return, not a cause of it.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import statsmodels.api as sm


@dataclass
class DiagnosisResult:
    cash_drag_corr: float
    mean_cash_fraction: float
    spread_wedge_mean: float           # mean(gross_fill - gross_mid)
    spread_wedge_per_trade: float      # slope of wedge on n_trades
    spread_wedge_per_trade_p: float
    compounding_beta_gross_mid: float  # beta(gross_mid ~ turnover | controls)
    compounding_beta_p: float
    reverse_causality_beta: float      # beta(turnover ~ net_return | controls)
    reverse_causality_p: float


def diagnose_confounds(turnover: np.ndarray, avg_cash_fraction: np.ndarray,
                        gross_fill_return: np.ndarray, gross_mid_return: np.ndarray,
                        net_return: np.ndarray, n_trades: np.ndarray,
                        portfolio_size: np.ndarray, n_positions: np.ndarray,
                        risk_exposure: np.ndarray) -> DiagnosisResult:
    wedge = gross_fill_return - gross_mid_return

    X_trades = sm.add_constant(pd.DataFrame({"n_trades": n_trades}))
    fit_wedge = sm.OLS(wedge, X_trades).fit(cov_type="HC1")

    X_ctrl = sm.add_constant(pd.DataFrame({
        "turnover": turnover, "log_aum": portfolio_size,
        "n_positions": n_positions.astype(float), "risk_exposure": risk_exposure,
    }))
    fit_gmid = sm.OLS(gross_mid_return, X_ctrl).fit(cov_type="HC1")

    X_rev = sm.add_constant(pd.DataFrame({
        "net_return": net_return, "log_aum": portfolio_size,
        "n_positions": n_positions.astype(float), "risk_exposure": risk_exposure,
    }))
    fit_rev = sm.OLS(turnover, X_rev).fit(cov_type="HC1")

    return DiagnosisResult(
        cash_drag_corr=float(np.corrcoef(turnover, avg_cash_fraction)[0, 1]),
        mean_cash_fraction=float(avg_cash_fraction.mean()),
        spread_wedge_mean=float(wedge.mean()),
        spread_wedge_per_trade=float(fit_wedge.params["n_trades"]),
        spread_wedge_per_trade_p=float(fit_wedge.pvalues["n_trades"]),
        compounding_beta_gross_mid=float(fit_gmid.params["turnover"]),
        compounding_beta_p=float(fit_gmid.pvalues["turnover"]),
        reverse_causality_beta=float(fit_rev.params["net_return"]),
        reverse_causality_p=float(fit_rev.pvalues["net_return"]),
    )
