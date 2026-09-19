"""
Agent-population generation.

Each account i gets four independent draws:
    delta_i  in [0,1]  -- disposition strength (injected parameter #1)
    kappa_i  in [0,1]  -- overprecision / churn intensity (injected parameter #2)
    W_i      in [$10k, $500k] -- starting capital (log-uniform: wealth is
                                 realistically right-skewed; a plain uniform
                                 draw would put half the mass above $255k)
    n_i      in [5, 30] -- target number of positions held

TraitSpec lets a scenario fix delta/kappa at an exact population-wide value
("fixed" -- used by the 8 headline scenarios in the table, because a
homogeneous population makes the comparative statics in that table
unambiguous: "scenario 3 has delta=0.8" means every account in it does),
or draw them from a distribution ("uniform"/"beta" -- used by the
heterogeneous baseline population that the Independence section runs on,
since asking for "the correlation between delta_i and kappa_i" is only a
meaningful question when both actually vary across accounts).

delta_i and kappa_i are always drawn from two independent calls to the
RNG (independent streams), never from a joint/copula distribution --
this is what "drawn independently" means operationally, and it is what
lets us report a near-zero *sample* correlation between the two traits
in the Independence section while still finding a non-zero correlation
between delta_i and *realized* turnover (see engine.py docstring).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

import numpy as np


@dataclass
class TraitSpec:
    kind: Literal["fixed", "uniform", "beta"] = "fixed"
    value: float = 0.0          # used when kind == "fixed"
    lo: float = 0.0             # used when kind == "uniform"
    hi: float = 1.0
    mean: float = 0.3           # used when kind == "beta"
    concentration: float = 6.0  # higher = tighter around `mean`

    def draw(self, rng: np.random.Generator, n: int) -> np.ndarray:
        if self.kind == "fixed":
            return np.full(n, self.value, dtype=float)
        if self.kind == "uniform":
            return rng.uniform(self.lo, self.hi, n)
        if self.kind == "beta":
            m = np.clip(self.mean, 1e-3, 1 - 1e-3)
            a = m * self.concentration
            b = (1 - m) * self.concentration
            return rng.beta(a, b, n)
        raise ValueError(f"unknown TraitSpec.kind={self.kind!r}")


@dataclass
class AgentPopulationConfig:
    n_agents: int = 1200
    delta: TraitSpec = field(default_factory=lambda: TraitSpec(kind="fixed", value=0.0))
    kappa: TraitSpec = field(default_factory=lambda: TraitSpec(kind="fixed", value=0.0))
    capital_lo: float = 10_000.0
    capital_hi: float = 500_000.0
    n_positions_lo: int = 5
    n_positions_hi: int = 30


@dataclass
class AgentPopulation:
    delta: np.ndarray      # (M,)
    kappa: np.ndarray      # (M,)
    capital: np.ndarray    # (M,)
    n_positions: np.ndarray  # (M,) int

    @property
    def n_agents(self) -> int:
        return self.delta.shape[0]


def generate_agents(cfg: AgentPopulationConfig, rng: np.random.Generator) -> AgentPopulation:
    m = cfg.n_agents
    # Independent draws: two separate calls into the same bit generator's
    # stream. Nothing here ever conditions kappa's draw on delta's value
    # (or vice-versa), which is the operational meaning of "independent".
    delta = np.clip(cfg.delta.draw(rng, m), 0.0, 1.0)
    kappa = np.clip(cfg.kappa.draw(rng, m), 0.0, 1.0)

    log_lo, log_hi = np.log(cfg.capital_lo), np.log(cfg.capital_hi)
    capital = np.exp(rng.uniform(log_lo, log_hi, m))

    n_positions = rng.integers(cfg.n_positions_lo, cfg.n_positions_hi + 1, m)

    return AgentPopulation(delta=delta, kappa=kappa, capital=capital, n_positions=n_positions)
