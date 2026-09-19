"""
Overconfidence estimator: performance ~ turnover, controlling for size,
number of positions, and risk exposure.

    r_i = alpha + beta * Turnover_i + gamma' X_i + eps_i,   X_i = [log(AUM_i), n_i, beta_i]

Run on THREE dependent variables (see engine.py for exact definitions):
  - net_return        : real-world return, all costs included
  - gross_fill_return : costs of commission removed, spread still baked into fills
  - gross_mid_return   : the frictionless counterfactual of the same trades

THE CONTRAST IS THE WHOLE TEST.
  - beta(net) < 0 and beta(gross_mid) ~ 0   => trading is expensive, not misinformed
                                               (Barber & Odean 2000).
  - beta(gross_mid) < 0 too                  => something beyond cost is going on;
                                               see diagnosis.py for which of the
                                               four mechanisms is responsible.

This is a single cross-sectional regression, one row per account, so
there is no repeated-observation clustering issue here (contrast the
disposition estimator, which pools many sale-day observations per
account and therefore needs account-clustered bootstrap). We still use
heteroskedasticity-robust (HC1) standard errors throughout, since
turnover and account size are not remotely homoskedastic regressors in
this population.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import statsmodels.api as sm


@dataclass
class RegressionResult:
    dep_var: str
    n_obs: int
    params: dict          # name -> coefficient
    se: dict               # name -> HC1 robust SE
    tvalues: dict
    pvalues: dict
    conf_int: dict         # name -> (lo, hi)
    r_squared: float
    beta_turnover: float
    se_beta_turnover: float
    p_beta_turnover: float


def _fit_one(y: np.ndarray, X: pd.DataFrame) -> RegressionResult:
    Xc = sm.add_constant(X, has_constant="add")
    model = sm.OLS(y, Xc, missing="drop")
    fit = model.fit(cov_type="HC1")
    ci = fit.conf_int(alpha=0.05)
    ci_dict = {name: (float(ci.loc[name, 0]), float(ci.loc[name, 1])) for name in fit.params.index}
    return RegressionResult(
        dep_var="", n_obs=int(fit.nobs),
        params={k: float(v) for k, v in fit.params.items()},
        se={k: float(v) for k, v in fit.bse.items()},
        tvalues={k: float(v) for k, v in fit.tvalues.items()},
        pvalues={k: float(v) for k, v in fit.pvalues.items()},
        conf_int=ci_dict,
        r_squared=float(fit.rsquared),
        beta_turnover=float(fit.params["turnover"]),
        se_beta_turnover=float(fit.bse["turnover"]),
        p_beta_turnover=float(fit.pvalues["turnover"]),
    )


def run_overconfidence_regressions(
    turnover: np.ndarray, portfolio_size: np.ndarray, n_positions: np.ndarray,
    risk_exposure: np.ndarray, net_return: np.ndarray, gross_fill_return: np.ndarray,
    gross_mid_return: np.ndarray,
) -> dict[str, RegressionResult]:
    X = pd.DataFrame({
        "turnover": turnover,
        "log_aum": portfolio_size,
        "n_positions": n_positions.astype(float),
        "risk_exposure": risk_exposure,
    })

    out = {}
    for label, y in [
        ("net", net_return),
        ("gross_fill", gross_fill_return),
        ("gross_mid", gross_mid_return),
    ]:
        r = _fit_one(np.asarray(y, dtype=float), X)
        r.dep_var = label
        out[label] = r
    return out
