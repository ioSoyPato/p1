from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class TraitSpecIn(BaseModel):
    kind: Literal["fixed", "uniform", "beta"] = "fixed"
    value: float = 0.0
    lo: float = 0.0
    hi: float = 1.0
    mean: float = 0.3
    concentration: float = 6.0


class PriceConfigIn(BaseModel):
    n_securities: int = 60
    n_days: int = 504
    n_sectors: int = 6
    market_drift: float = 0.00030
    market_vol: float = 0.0080
    sector_drift_spread: float = 0.00012
    sector_vol: float = 0.0055
    idio_vol_lo: float = 0.0060
    idio_vol_hi: float = 0.0140
    idio_drift_spread: float = 0.00008
    market_beta_mean: float = 1.00
    market_beta_sd: float = 0.28
    sector_beta_mean: float = 1.00
    sector_beta_sd: float = 0.35
    p0: float = 100.0
    spread_bps_lo: float = 10.0
    spread_bps_hi: float = 70.0
    commission_bps: float = 4.0
    commission_min_usd: float = 2.00


class ScenarioIn(BaseModel):
    key: str = "custom"
    name: str = "Escenario personalizado"
    description: str = ""
    delta: TraitSpecIn = Field(default_factory=TraitSpecIn)
    kappa: TraitSpecIn = Field(default_factory=lambda: TraitSpecIn())
    n_agents: int = 1200
    seed: int = 12345
    price_seed: int = 12345
    price: PriceConfigIn = Field(default_factory=PriceConfigIn)
    rebalance_confound: bool = False
    reversal_confound: bool = False
    lam0: float = 0.0030
    k_scale: float = 6.0
    d_scale: float = 0.9
    x_ref: float = 0.08
    h_max: float = 0.35
    reinvest_delay_days: int = 2
    rebal_period_days: int = 21
    rebal_band: float = 0.30
    reversal_lookback_days: int = 20
    rev_scale: float = 0.9
    rev_x_ref: float = 0.10
    capital_lo: float = 10_000.0
    capital_hi: float = 500_000.0
    n_positions_lo: int = 5
    n_positions_hi: int = 30
    n_boot: int = 1000


class SimulateRequest(BaseModel):
    scenario_key: Optional[str] = None      # run one of the 9 standard scenarios
    custom: Optional[ScenarioIn] = None      # or provide a full custom config
