from __future__ import annotations

import dataclasses
import time

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ..simulator.scenario import STANDARD_SCENARIOS, get_scenario, ScenarioConfig
from ..simulator.engine import run_simulation, SimulationResult
from ..estimators.disposition import estimate_disposition
from ..estimators.overconfidence import run_overconfidence_regressions
from ..estimators.diagnosis import diagnose_confounds
from ..validation.validate import informed_trading_placebo, independence_report, monotonicity_report
from .schemas import SimulateRequest
from .convert import scenario_config, jsonable

app = FastAPI(title="Simulador de Sesgos Conductuales", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _scenario_meta(sc: ScenarioConfig) -> dict:
    return {
        "key": sc.key, "name": sc.name, "description": sc.description,
        "delta": dataclasses.asdict(sc.delta), "kappa": dataclasses.asdict(sc.kappa),
        "rebalance_confound": sc.rebalance_confound, "reversal_confound": sc.reversal_confound,
        "n_agents": sc.n_agents,
    }


@app.get("/api/scenarios")
def list_scenarios():
    return jsonable({"scenarios": [_scenario_meta(s) for s in STANDARD_SCENARIOS]})


def _run_and_package(sc: ScenarioConfig, n_boot: int = 1000, max_points: int = 2000) -> dict:
    t0 = time.time()
    res: SimulationResult = run_simulation(sc)
    sim_time = time.time() - t0

    disp = estimate_disposition(res.Gr, res.Gp, res.Lr, res.Lp, n_boot=n_boot)
    regs = run_overconfidence_regressions(
        res.turnover, res.portfolio_size, res.agents.n_positions.astype(float),
        res.risk_exposure, res.net_return, res.gross_fill_return, res.gross_mid_return,
    )
    diag = diagnose_confounds(
        res.turnover, res.avg_cash_fraction, res.gross_fill_return, res.gross_mid_return,
        res.net_return, res.n_trades, res.portfolio_size, res.agents.n_positions,
        res.risk_exposure,
    )

    n = res.agents.n_agents
    idx = np.arange(n) if n <= max_points else np.linspace(0, n - 1, max_points).astype(int)

    agents_sample = {
        "delta": res.agents.delta[idx], "kappa": res.agents.kappa[idx],
        "capital": res.agents.capital[idx], "n_positions": res.agents.n_positions[idx],
        "turnover": res.turnover[idx], "net_return": res.net_return[idx],
        "gross_fill_return": res.gross_fill_return[idx], "gross_mid_return": res.gross_mid_return[idx],
        "risk_exposure": res.risk_exposure[idx],
    }

    regs_out = {}
    for label, r in regs.items():
        regs_out[label] = {
            "dep_var": r.dep_var, "n_obs": r.n_obs, "params": r.params, "se": r.se,
            "pvalues": r.pvalues, "conf_int": r.conf_int, "r_squared": r.r_squared,
            "beta_turnover": r.beta_turnover, "se_beta_turnover": r.se_beta_turnover,
            "p_beta_turnover": r.p_beta_turnover,
        }

    ts_n = res.ts_days.shape[0]
    ts_idx = np.arange(ts_n) if ts_n <= max_points else np.linspace(0, ts_n - 1, max_points).astype(int)
    pgr_ts = np.divide(res.ts_cum_Gr, res.ts_cum_Gr + res.ts_cum_Gp,
                        out=np.full(ts_n, np.nan), where=(res.ts_cum_Gr + res.ts_cum_Gp) > 0)
    plr_ts = np.divide(res.ts_cum_Lr, res.ts_cum_Lr + res.ts_cum_Lp,
                        out=np.full(ts_n, np.nan), where=(res.ts_cum_Lr + res.ts_cum_Lp) > 0)

    time_series = {
        "day": res.ts_days[ts_idx],
        "mean_value_index": res.ts_mean_net_value_idx[ts_idx],
        "pgr": pgr_ts[ts_idx], "plr": plr_ts[ts_idx],
        "mean_turnover": res.ts_mean_turnover[ts_idx],
        "market_index": res.ts_market_index[ts_idx],
    }

    summary = {
        "n_agents": n, "n_days": res.prices.n_days, "n_securities": res.prices.n_securities,
        "mean_net_return": float(res.net_return.mean()),
        "mean_gross_fill_return": float(res.gross_fill_return.mean()),
        "mean_gross_mid_return": float(res.gross_mid_return.mean()),
        "mean_turnover": float(res.turnover.mean()),
        "mean_cash_fraction": float(res.avg_cash_fraction.mean()),
        "mean_commission_usd": float(res.total_commission.mean()),
        "mean_n_trades": float(res.n_trades.mean()),
        "sim_time_seconds": sim_time,
    }

    disposition = {
        "Gr": disp.Gr, "Gp": disp.Gp, "Lr": disp.Lr, "Lp": disp.Lp,
        "PGR": disp.PGR, "PLR": disp.PLR, "diff": disp.diff, "ratio": disp.ratio,
        "n_accounts": disp.n_accounts, "n_accounts_active": disp.n_accounts_active,
        "se_diff_cluster": disp.se_diff_cluster, "ci_diff_cluster": disp.ci_diff_cluster,
        "se_ratio_cluster": disp.se_ratio_cluster, "ci_ratio_cluster": disp.ci_ratio_cluster,
        "se_pgr_cluster": disp.se_pgr_cluster, "se_plr_cluster": disp.se_plr_cluster,
        "se_diff_naive": disp.se_diff_naive, "ci_diff_naive": disp.ci_diff_naive,
        "se_ratio_naive": disp.se_ratio_naive,
        "boot_diff_cluster_hist": np.histogram(disp.boot_diff_cluster[~np.isnan(disp.boot_diff_cluster)], bins=30),
        "boot_diff_naive_hist": np.histogram(disp.boot_diff_naive[~np.isnan(disp.boot_diff_naive)], bins=30),
    }
    # histograms come back as (counts, edges) tuples from np.histogram
    for k in ["boot_diff_cluster_hist", "boot_diff_naive_hist"]:
        counts, edges = disposition[k]
        disposition[k] = {"counts": counts, "edges": edges}

    diagnosis = dataclasses.asdict(diag)

    return jsonable({
        "scenario": _scenario_meta(sc),
        "summary": summary,
        "disposition": disposition,
        "overconfidence": regs_out,
        "diagnosis": diagnosis,
        "agents_sample": agents_sample,
        "time_series": time_series,
    })


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    if req.scenario_key:
        try:
            sc = get_scenario(req.scenario_key)
        except KeyError:
            raise HTTPException(404, f"unknown scenario_key {req.scenario_key!r}")
        n_boot = 1000
    elif req.custom:
        sc = scenario_config(req.custom)
        n_boot = req.custom.n_boot
    else:
        raise HTTPException(400, "must provide scenario_key or custom")

    if sc.n_agents > 4000:
        raise HTTPException(400, "n_agents capped at 4000 for the interactive API")
    if sc.price.n_days > 1500:
        raise HTTPException(400, "n_days capped at 1500 for the interactive API")

    return _run_and_package(sc, n_boot=n_boot)


@app.get("/api/validation/placebo")
def validation_placebo():
    p = informed_trading_placebo()
    return jsonable(dataclasses.asdict(p))


@app.get("/api/validation/independence")
def validation_independence():
    r = independence_report()
    return jsonable(dataclasses.asdict(r))


@app.get("/api/validation/monotonicity")
def validation_monotonicity():
    df = monotonicity_report()
    return jsonable({"rows": df.to_dict(orient="records")})


@app.get("/api/health")
def health():
    return {"status": "ok"}
