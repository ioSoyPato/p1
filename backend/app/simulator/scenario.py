"""Scenario configuration: one object fully determines one population run."""

from __future__ import annotations

from dataclasses import dataclass, field

from .agents import TraitSpec
from .prices import PriceConfig


@dataclass
class ScenarioConfig:
    key: str
    name: str
    description: str

    delta: TraitSpec
    kappa: TraitSpec

    n_agents: int = 1200
    seed: int = 12345          # population + engine random stream
    price_seed: int = 12345    # price-panel random stream (see engine.run_simulation)

    price: PriceConfig = field(default_factory=PriceConfig)

    # confound switches -- mechanisms structurally unrelated to delta/kappa
    rebalance_confound: bool = False
    reversal_confound: bool = False

    # hazard-model structural constants (shared unless a scenario overrides)
    lam0: float = 0.0030         # baseline daily hazard (liquidity-driven turnover)
    k_scale: float = 6.0         # kappa=1 -> (1+k_scale) x baseline hazard
    d_scale: float = 0.9         # strength of the gain/loss hazard tilt at delta=1
    x_ref: float = 0.08          # unrealized-return scale at which tanh saturates
    h_max: float = 0.35          # ceiling on daily sale probability for one position

    reinvest_delay_days: int = 2  # structural cash-drag friction, always on

    rebal_period_days: int = 21
    rebal_band: float = 0.30      # trim any slot more than 30% over its equal-weight target

    reversal_lookback_days: int = 20
    rev_scale: float = 0.9
    rev_x_ref: float = 0.10

    capital_lo: float = 10_000.0
    capital_hi: float = 500_000.0
    n_positions_lo: int = 5
    n_positions_hi: int = 30


def fixed(value: float) -> TraitSpec:
    return TraitSpec(kind="fixed", value=value)


def uniform01() -> TraitSpec:
    return TraitSpec(kind="uniform", lo=0.0, hi=1.0)


# Shared across every standard scenario ON PURPOSE (common random numbers):
# scenarios 1-8 trade in the literal same simulated market (same price_seed)
# and start from the literal same population of capitals/position-counts
# (same seed), so the ONLY thing that can move an estimator's output from
# one scenario to the next is the behavioral configuration that changed.
_SHARED_PRICE_SEED = 42
_SHARED_POP_SEED = 100

STANDARD_SCENARIOS: list[ScenarioConfig] = [
    ScenarioConfig(
        key="s1_null", name="1. Null",
        description="Sin disposición ni sobreconfianza: benchmark de ruido puro.",
        delta=fixed(0.0), kappa=fixed(0.0), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s2_disp_low", name="2. Disposición sola (baja)",
        description="delta=0.3 homogéneo, kappa=0.",
        delta=fixed(0.3), kappa=fixed(0.0), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s3_disp_high", name="3. Disposición sola (alta)",
        description="delta=0.8 homogéneo, kappa=0.",
        delta=fixed(0.8), kappa=fixed(0.0), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s4_turn_low", name="4. Sobreconfianza sola (baja)",
        description="kappa=0.3 homogéneo, delta=0.",
        delta=fixed(0.0), kappa=fixed(0.3), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s5_turn_high", name="5. Sobreconfianza sola (alta)",
        description="kappa=0.8 homogéneo, delta=0.",
        delta=fixed(0.0), kappa=fixed(0.8), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s6_both", name="6. Ambas activas",
        description="delta=0.8 y kappa=0.8 homogéneos: interacción mecánica.",
        delta=fixed(0.8), kappa=fixed(0.8), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
    ),
    ScenarioConfig(
        key="s7_rebalance", name="7. Confusor: rebalanceo",
        description="delta=kappa=0, pero se recorta mecánicamente todo lote que "
                     "supere en más de un `rebal_band` su peso de referencia.",
        delta=fixed(0.0), kappa=fixed(0.0), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
        rebalance_confound=True,
    ),
    ScenarioConfig(
        key="s8_reversal", name="8. Confusor: creencia en reversión",
        description="delta=kappa=0, pero el agente vende títulos con retorno "
                     "reciente alto y retiene los de retorno reciente bajo, "
                     "creyendo (incorrectamente, dado que los retornos son i.i.d.) "
                     "en reversión a la media.",
        delta=fixed(0.0), kappa=fixed(0.0), seed=_SHARED_POP_SEED, price_seed=_SHARED_PRICE_SEED,
        reversal_confound=True,
    ),
    ScenarioConfig(
        key="s9_heterogeneous", name="9. Población heterogénea (base para independencia)",
        description="delta_i, kappa_i ~ U(0,1) i.i.d. por cuenta: usada para la "
                     "sección de independencia, donde ambos parámetros deben variar "
                     "para que la correlación muestral tenga sentido.",
        delta=uniform01(), kappa=uniform01(), seed=909, price_seed=_SHARED_PRICE_SEED, n_agents=1500,
    ),
]


def get_scenario(key: str) -> ScenarioConfig:
    for s in STANDARD_SCENARIOS:
        if s.key == key:
            return s
    raise KeyError(f"unknown scenario key={key!r}")
