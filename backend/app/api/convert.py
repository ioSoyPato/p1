from __future__ import annotations

import numpy as np

from ..simulator.agents import TraitSpec
from ..simulator.prices import PriceConfig
from ..simulator.scenario import ScenarioConfig
from .schemas import ScenarioIn, TraitSpecIn, PriceConfigIn


def trait_spec(t: TraitSpecIn) -> TraitSpec:
    return TraitSpec(kind=t.kind, value=t.value, lo=t.lo, hi=t.hi, mean=t.mean,
                      concentration=t.concentration)


def price_config(p: PriceConfigIn) -> PriceConfig:
    return PriceConfig(**p.model_dump())


def scenario_config(s: ScenarioIn) -> ScenarioConfig:
    return ScenarioConfig(
        key=s.key, name=s.name, description=s.description,
        delta=trait_spec(s.delta), kappa=trait_spec(s.kappa),
        n_agents=s.n_agents, seed=s.seed, price_seed=s.price_seed, price=price_config(s.price),
        rebalance_confound=s.rebalance_confound, reversal_confound=s.reversal_confound,
        lam0=s.lam0, k_scale=s.k_scale, d_scale=s.d_scale, x_ref=s.x_ref, h_max=s.h_max,
        reinvest_delay_days=s.reinvest_delay_days, rebal_period_days=s.rebal_period_days,
        rebal_band=s.rebal_band, reversal_lookback_days=s.reversal_lookback_days,
        rev_scale=s.rev_scale, rev_x_ref=s.rev_x_ref,
        capital_lo=s.capital_lo, capital_hi=s.capital_hi,
        n_positions_lo=s.n_positions_lo, n_positions_hi=s.n_positions_hi,
    )


def jsonable(obj):
    """Recursively convert numpy scalars/arrays (and tuples) into plain JSON types."""
    if isinstance(obj, dict):
        return {k: jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return jsonable(obj.tolist())
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (v != v) else v  # NaN -> null
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, float) and obj != obj:
        return None
    return obj
