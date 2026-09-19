"""
The simulation engine: turns (prices, agents, scenario) into per-account
outcomes.

THE SELLING RULE -- A HOLDING HAZARD, NOT A DIRECT PROBABILITY.

Every active position has, on every day, a "hazard" h in [0,1]: the
probability that the account closes it *today*, conditional on still
holding it. Nothing in the code ever writes "if gain: sell w.p. 0.15" --
delta_i and kappa_i only ever enter as *multipliers on a hazard rate*,
and PGR/PLR/turnover are read off afterwards, counting what actually got
sold. That is the sense in which the disposition effect and turnover are
emergent, not parametrized directly.

    x            = (mid_price - purchase_price) / purchase_price   [unrealized return]
    churn(kappa) = 1 + k_scale * kappa                              [uniform across gains AND losses]
    tilt(delta,x)= 1 + d_scale * delta * tanh(x / x_ref)             [ >1 for x>0, <1 for x<0 ]
    h            = clip( lam0 * churn(kappa) * tilt(delta,x),  0, h_max )
    sell today  ~ Bernoulli(h)                                      [independent draw per position per day]

delta and kappa act on *completely different* channels of h: kappa
scales the hazard identically regardless of sign(x) (it is a pure
trading-frequency dial), while delta only ever multiplies the hazard
*asymmetrically* around x=0 (it is a pure gain/loss-tilt dial). At
delta=0 the tilt term is 1 for every x, so gains and losses are sold at
exactly the same rate and PGR=PLR in expectation. At kappa=0 there is no
extra churn, but delta can still be active. This separation is what
lets Scenarios 2-5 in the table isolate one mechanism at a time.

TWO CONFOUND MECHANISMS (Scenarios 7-8) run with delta=kappa=0 (so the
hazard above is flat, tilt=1 everywhere) but ADD a second, independent
trigger for closing a position that has nothing to do with the
account's own purchase price:

  - Rebalancing (Sec. 7): every `rebal_period_days` the account checks
    each position's *current portfolio weight* against its equal-weight
    target (1/n_i) and force-sells (fully closes) any position more than
    `rebal_band` over target. Since a position's weight rises when its
    price rises, this mechanically closes winners more than losers --
    with zero reference to loss aversion.

  - Reversal belief (Sec. 8): the hazard gets an extra multiplier driven
    by the security's own trailing return (a market-wide, forward-looking
    signal about NOTHING, since returns are i.i.d. by construction --
    see prices.py), not by the account's unrealized P&L. An account
    sells securities that have recently gone up (believing in
    reversion) and holds onto ones that recently fell. Because a
    position bought a while ago that is up on paper usually also has a
    positive trailing return, this looks like a disposition effect to
    an estimator that only sees "gain vs. loss vs. purchase price", even
    though the true decision rule never once looks at the purchase price.

COST ACCOUNTING. Every buy fills at the ask, every sell fills at the
bid; every trade also pays a proportional commission (floored at a
minimum ticket size). Three P&L measures are tracked per account so the
overconfidence section can separate "expensive" from "misinformed":

  - net_return       : actual dollar P&L, all costs included (bid/ask + commission)
  - gross_fill_return: net_return with commission added back, but STILL
                       priced at the bid/ask fills actually received --
                       this is what a naive "gross of commission" measure
                       gives you, and it still has half the spread baked
                       into it (the "spread inside the price path" confound).
  - gross_mid_return : the same trades (same securities, same share
                       counts, same timing) repriced at the *mid* quote
                       with zero commission -- the frictionless
                       counterfactual return of the exact decisions the
                       account made. This isolates security-selection
                       skill from every cost effect.

REINVESTMENT (the big constraint). Whenever a position is closed, the
freed cash sits idle for `reinvest_delay_days` (structural cash drag,
always on) and is then placed in a security drawn UNIFORMLY AT RANDOM
from the whole universe -- never as a function of any future return,
belief, or performance ranking. This is what guarantees the simulator
can never generate "informed trading": nothing about which security
gets bought is correlated with what that security's price will do next,
by construction.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .agents import AgentPopulation, generate_agents, AgentPopulationConfig
from .prices import PricePanel, simulate_prices
from .scenario import ScenarioConfig


@dataclass
class SimulationResult:
    scenario: ScenarioConfig
    agents: AgentPopulation
    prices: PricePanel

    # per-account aggregates, all shape (M,)
    Gr: np.ndarray
    Gp: np.ndarray
    Lr: np.ndarray
    Lp: np.ndarray
    net_return: np.ndarray
    gross_fill_return: np.ndarray
    gross_mid_return: np.ndarray
    turnover: np.ndarray
    risk_exposure: np.ndarray
    portfolio_size: np.ndarray   # log(time-avg AUM)
    total_commission: np.ndarray
    n_trades: np.ndarray
    avg_cash_fraction: np.ndarray

    # population time series, each shape (T+1,)
    ts_days: np.ndarray
    ts_mean_net_value_idx: np.ndarray   # cross-sectional mean of (value/capital)
    ts_cum_Gr: np.ndarray
    ts_cum_Gp: np.ndarray
    ts_cum_Lr: np.ndarray
    ts_cum_Lp: np.ndarray
    ts_mean_turnover: np.ndarray
    ts_market_index: np.ndarray  # cumulative market factor, for context


def run_simulation(scenario: ScenarioConfig, seed: int | None = None) -> SimulationResult:
    """
    Two INDEPENDENT random streams, not one:

      - `price_rng`, seeded by `scenario.price_seed`, generates the price
        panel (see prices.py).
      - `pop_rng`, seeded by `scenario.seed` (or the `seed` override),
        generates the agent population AND every random draw the engine
        makes afterwards (sale Bernoullis, reinvestment security choices).

    Every one of the 8 standard scenarios shares the SAME `price_seed`
    (see scenario.py) -- they all trade in the literal same simulated
    market, with the same 500+ days of prices for the same 60 securities.
    This is the "common random numbers" variance-reduction technique: it
    is what makes it valid to say "scenario 3 has a bigger PGR-PLR gap
    than scenario 2 because delta is bigger", rather than "because
    scenario 3 happened to draw a luckier market". Without this, two
    scenarios' average returns are not comparable at all -- the
    cross-sectional sampling noise in a single ~2-year market realization
    (order of several percentage points on the TOTAL period return) is
    large enough to swamp any of the effect sizes this assignment asks us
    to measure.
    """
    seed = scenario.seed if seed is None else seed
    price_rng = np.random.default_rng(scenario.price_seed)
    pop_rng = np.random.default_rng(seed)

    price_cfg = scenario.price
    price_cfg.n_securities = max(price_cfg.n_securities, 50)
    prices = simulate_prices(price_cfg, price_rng)

    agent_cfg = AgentPopulationConfig(
        n_agents=scenario.n_agents, delta=scenario.delta, kappa=scenario.kappa,
        capital_lo=scenario.capital_lo, capital_hi=scenario.capital_hi,
        n_positions_lo=scenario.n_positions_lo, n_positions_hi=scenario.n_positions_hi,
    )
    agents = generate_agents(agent_cfg, pop_rng)

    return _simulate(prices, agents, scenario, pop_rng)


def _simulate(prices: PricePanel, agents: AgentPopulation, sc: ScenarioConfig,
              rng: np.random.Generator) -> SimulationResult:
    M = agents.n_agents
    N = prices.n_securities
    T = prices.n_days
    K = int(agents.n_positions.max())

    slot_valid = np.arange(K)[None, :] < agents.n_positions[:, None]   # (M,K) structural mask

    active = np.zeros((M, K), dtype=bool)
    security = np.zeros((M, K), dtype=np.int64)
    purchase_price = np.zeros((M, K))       # ask fill price paid
    purchase_price_mid = np.zeros((M, K))   # mid price at same moment (for gross_mid)
    purchase_day = np.zeros((M, K), dtype=np.int64)
    shares = np.zeros((M, K))            # real share count, from the ask-fill trade value
    shares_mid = np.zeros((M, K))        # frictionless counterfactual share count (see do_buys)
    reinvest_at = np.full((M, K), -1, dtype=np.int64)

    cash = agents.capital.copy()
    n_positions_f = agents.n_positions.astype(float)

    Gr = np.zeros(M); Gp = np.zeros(M); Lr = np.zeros(M); Lp = np.zeros(M)
    total_commission = np.zeros(M)
    n_trades = np.zeros(M)
    total_buy_value = np.zeros(M)
    total_sell_value = np.zeros(M)
    gross_mid_pnl = np.zeros(M)
    aum_time_sum = np.zeros(M)
    beta_time_sum = np.zeros(M)
    cash_time_sum = np.zeros(M)

    ts_days = np.arange(T + 1)
    ts_mean_net_value_idx = np.zeros(T + 1)
    ts_cum_Gr = np.zeros(T + 1); ts_cum_Gp = np.zeros(T + 1)
    ts_cum_Lr = np.zeros(T + 1); ts_cum_Lp = np.zeros(T + 1)
    ts_mean_turnover = np.zeros(T + 1)
    ts_market_index = np.zeros(T + 1)
    market_cum = 0.0

    commission_bps = prices.commission_bps
    commission_min = prices.commission_min_usd

    def commission_of(trade_value: np.ndarray) -> np.ndarray:
        return np.maximum(commission_min, commission_bps / 10_000.0 * trade_value)

    def do_buys(idx_i: np.ndarray, idx_k: np.ndarray, day: int, ask_row: np.ndarray, mid_row: np.ndarray):
        if idx_i.size == 0:
            return
        sec_choice = rng.integers(0, N, size=idx_i.size)  # UNIFORM RANDOM: the big constraint
        ask_p = ask_row[sec_choice]
        mid_p = mid_row[sec_choice]

        # Reinvestment target is CURRENT total account value / n_i, not the
        # account's original capital. This matters: a fixed dollar target
        # would cap every new lot at its initial size regardless of how
        # much the account has grown, permanently stranding a winner's
        # excess proceeds in zero-yield cash -- an artifact of the sizing
        # rule, not a real "compounding path" phenomenon. Sizing off
        # current wealth keeps a position's target share of the portfolio
        # constant instead, so gains actually compound. (Scenario 7 studies
        # the *deliberate* opposite choice -- trimming back to a target
        # weight -- as its own, separate confound mechanism.)
        val_now = np.where(active, shares * mid_row[security], 0.0).sum(axis=1)
        total_value_now = cash + val_now
        target_dollar = total_value_now / np.maximum(n_positions_f, 1.0)

        # Two or more slots belonging to the SAME agent can mature for
        # reinvestment on the same day. Split that agent's available cash
        # across its pending slots instead of letting each slot claim up to
        # target_dollar independently (which would silently overspend the
        # account's cash, since plain fancy-index writes to `cash[idx_i]`
        # do not accumulate for repeated indices).
        uniq_i, inverse, counts = np.unique(idx_i, return_inverse=True, return_counts=True)
        demand_total = counts * target_dollar[uniq_i]
        avail_total = np.minimum(np.maximum(cash[uniq_i], 0.0), demand_total)
        spend = (avail_total[inverse] / counts[inverse])
        spend = np.maximum(spend, 0.0)

        comm = commission_of(spend)
        trade_value = np.maximum(spend - comm, 0.0)
        sh = np.where(ask_p > 0, trade_value / np.maximum(ask_p, 1e-9), 0.0)

        # Frictionless counterfactual share count: the SAME dollars `spend`,
        # at the mid quote, with no commission subtracted. This is what
        # makes gross_mid_return a genuinely cost-free repricing of the
        # exact same decisions -- if it instead reused `sh` (which already
        # has the ask markup and the commission baked into how many shares
        # it bought), gross_mid would still carry a piece of the spread
        # cost, and that residual would grow with every extra trade a
        # high-turnover account makes even at delta=kappa=0.
        sh_mid = np.where(mid_p > 0, spend / np.maximum(mid_p, 1e-9), 0.0)

        np.add.at(cash, idx_i, -spend)
        np.add.at(total_commission, idx_i, comm)
        np.add.at(total_buy_value, idx_i, trade_value)
        np.add.at(n_trades, idx_i, 1)

        active[idx_i, idx_k] = True
        security[idx_i, idx_k] = sec_choice
        purchase_price[idx_i, idx_k] = ask_p
        purchase_price_mid[idx_i, idx_k] = mid_p
        purchase_day[idx_i, idx_k] = day
        shares[idx_i, idx_k] = sh
        shares_mid[idx_i, idx_k] = sh_mid
        reinvest_at[idx_i, idx_k] = -1

    # ---- initial portfolios at day 0 ----
    idx_i0, idx_k0 = np.where(slot_valid)
    do_buys(idx_i0, idx_k0, 0, prices.ask[0], prices.mid[0])

    ts_mean_net_value_idx[0] = 1.0
    ts_market_index[0] = 0.0

    for t in range(1, T + 1):
        mid_row, bid_row, ask_row = prices.mid[t], prices.bid[t], prices.ask[t]
        market_cum += prices.log_ret[t - 1].mean()  # rough population-level market context only

        sec = security
        cur_mid = mid_row[sec]
        cur_bid = bid_row[sec]
        purchase = purchase_price
        x = np.where(active, (cur_mid - purchase) / np.maximum(purchase, 1e-9), 0.0)

        churn = 1.0 + sc.k_scale * agents.kappa[:, None]
        tilt = 1.0 + sc.d_scale * agents.delta[:, None] * np.tanh(x / sc.x_ref)
        h = sc.lam0 * churn * tilt

        if sc.reversal_confound:
            lb = sc.reversal_lookback_days
            t0 = max(t - lb, 0)
            trail = mid_row / np.maximum(prices.mid[t0], 1e-9) - 1.0   # (N,) trailing return, past-only
            trail_sec = trail[sec]
            h = h * (1.0 + sc.rev_scale * np.tanh(trail_sec / sc.rev_x_ref))

        h = np.clip(h, 0.0, sc.h_max)
        h = np.where(active, h, 0.0)

        sell_draw = rng.random((M, K)) < h

        if sc.rebalance_confound and (t % sc.rebal_period_days == 0):
            value = np.where(active, shares * cur_mid, 0.0)
            total_value = value.sum(axis=1, keepdims=True)
            target_w = 1.0 / np.maximum(agents.n_positions, 1)[:, None]
            weight = np.divide(value, np.maximum(total_value, 1e-9))
            overweight = active & (weight > target_w * (1.0 + sc.rebal_band))
            sell_draw = sell_draw | overweight

        sell_mask = active & sell_draw

        sold_today_any = sell_mask.any(axis=1)
        row_mask = sold_today_any[:, None]
        is_gain = active & (x > 1e-9)
        is_loss = active & (x < -1e-9)
        Gr += (is_gain & sell_mask & row_mask).sum(axis=1)
        Gp += (is_gain & ~sell_mask & row_mask).sum(axis=1)
        Lr += (is_loss & sell_mask & row_mask).sum(axis=1)
        Lp += (is_loss & ~sell_mask & row_mask).sum(axis=1)

        idx_i, idx_k = np.where(sell_mask)
        if idx_i.size > 0:
            sec_sold = security[idx_i, idx_k]
            sh_sold = shares[idx_i, idx_k]
            bid_p = bid_row[sec_sold]
            trade_value = sh_sold * bid_p
            comm = commission_of(trade_value)
            proceeds = trade_value - comm

            np.add.at(cash, idx_i, proceeds)
            np.add.at(total_commission, idx_i, comm)
            np.add.at(total_sell_value, idx_i, trade_value)
            np.add.at(n_trades, idx_i, 1)

            sh_mid_sold = shares_mid[idx_i, idx_k]
            mid_p_now = mid_row[sec_sold]
            mid_p_buy = purchase_price_mid[idx_i, idx_k]
            np.add.at(gross_mid_pnl, idx_i, sh_mid_sold * (mid_p_now - mid_p_buy))

            active[idx_i, idx_k] = False
            reinvest_at[idx_i, idx_k] = t + sc.reinvest_delay_days

        due_mask = (~active) & (reinvest_at == t)
        idx_bi, idx_bk = np.where(due_mask)
        do_buys(idx_bi, idx_bk, t, ask_row, mid_row)

        val_active = np.where(active, shares * cur_mid, 0.0)
        aum = cash + val_active.sum(axis=1)
        aum_time_sum += aum
        cash_time_sum += cash
        beta_active = np.where(active, shares * cur_mid * prices.market_beta[sec], 0.0)
        beta_time_sum += np.divide(beta_active.sum(axis=1), np.maximum(val_active.sum(axis=1), 1e-9))

        ts_mean_net_value_idx[t] = float(np.mean(aum / agents.capital))
        ts_cum_Gr[t] = float(Gr.sum()); ts_cum_Gp[t] = float(Gp.sum())
        ts_cum_Lr[t] = float(Lr.sum()); ts_cum_Lp[t] = float(Lp.sum())
        ts_mean_turnover[t] = float(np.mean((total_buy_value + total_sell_value) / 2.0 / np.maximum(aum_time_sum / t, 1e-9) * (252.0 / t)))
        ts_market_index[t] = market_cum

    # Annualizing a cumulative-since-day-0 turnover by a factor of 252/t
    # blows up for small t (a single early trade reads as an enormous
    # annualized rate) -- this is a display artifact of the burn-in window,
    # not a real early spike in trading activity, so it is blanked out here
    # rather than left to dominate the chart's y-axis.
    burn_in = min(20, T)
    ts_mean_turnover[1:burn_in] = np.nan

    # ---- finalize per-account outcomes ----
    final_mid = prices.mid[T]
    final_bid = prices.bid[T]
    val_at_bid = np.where(active, shares * final_bid[security], 0.0).sum(axis=1)
    final_aum_net = cash + val_at_bid
    net_pnl = final_aum_net - agents.capital

    val_at_mid = np.where(active, shares * final_mid[security], 0.0).sum(axis=1)
    open_mid_pnl = np.where(active, shares_mid * (final_mid[security] - purchase_price_mid), 0.0).sum(axis=1)
    gross_mid_total_pnl = gross_mid_pnl + open_mid_pnl

    gross_fill_pnl = net_pnl + total_commission

    net_return = net_pnl / agents.capital
    gross_fill_return = gross_fill_pnl / agents.capital
    gross_mid_return = gross_mid_total_pnl / agents.capital

    avg_aum = aum_time_sum / T
    turnover = (total_buy_value + total_sell_value) / 2.0 / np.maximum(avg_aum, 1e-9) * (252.0 / T)
    risk_exposure = beta_time_sum / T
    portfolio_size = np.log(np.maximum(avg_aum, 1.0))
    avg_cash_fraction = cash_time_sum / T / np.maximum(avg_aum, 1e-9)

    return SimulationResult(
        scenario=sc, agents=agents, prices=prices,
        Gr=Gr, Gp=Gp, Lr=Lr, Lp=Lp,
        net_return=net_return, gross_fill_return=gross_fill_return, gross_mid_return=gross_mid_return,
        turnover=turnover, risk_exposure=risk_exposure, portfolio_size=portfolio_size,
        total_commission=total_commission, n_trades=n_trades, avg_cash_fraction=avg_cash_fraction,
        ts_days=ts_days, ts_mean_net_value_idx=ts_mean_net_value_idx,
        ts_cum_Gr=ts_cum_Gr, ts_cum_Gp=ts_cum_Gp, ts_cum_Lr=ts_cum_Lr, ts_cum_Lp=ts_cum_Lp,
        ts_mean_turnover=ts_mean_turnover, ts_market_index=ts_market_index,
    )
