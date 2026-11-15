"""
TA factor scores (factor_scoring._ta_*) checked against plain numpy references
of the standard definitions: Wilder RSI/ATR, SMA-seeded EMA for MACD, and
20-bar Bollinger bands with the sample standard deviation.
"""
import numpy as np
import pytest

from app.services import factor_scoring as fs


def _history(n=250, seed=3, drift=0.0):
    rng = np.random.default_rng(seed)
    close = np.abs(100 + np.cumsum(rng.normal(drift, 1.5, n))) + 5
    return [
        {"close": c, "high": c + rng.uniform(0.1, 2.0), "low": c - rng.uniform(0.1, 2.0), "volume": 1e6}
        for c in close
    ]


def _wilder(values, length):
    out = np.full(len(values), np.nan)
    out[length - 1] = np.mean(values[:length])
    for i in range(length, len(values)):
        out[i] = (out[i - 1] * (length - 1) + values[i]) / length
    return out


def _ema(values, length):
    out = np.full(len(values), np.nan)
    start = np.flatnonzero(~np.isnan(values))[0]
    out[start + length - 1] = np.mean(values[start:start + length])
    alpha = 2 / (length + 1)
    for i in range(start + length, len(values)):
        out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
    return out


def _true_range(df):
    high, low, close = (df[c].to_numpy() for c in ("high", "low", "close"))
    prev = np.concatenate([[np.nan], close[:-1]])
    return np.nanmax(np.vstack([high - low, np.abs(high - prev), np.abs(low - prev)]), axis=0)


def _bands(close):
    mid = close.rolling(20).mean().iloc[-1]
    sd = close.rolling(20).std().iloc[-1]
    return mid - 2 * sd, mid, mid + 2 * sd


@pytest.fixture
def df():
    return fs._build_df(_history())


def test_momentum_score(df):
    close = df["close"].to_numpy()
    delta = np.diff(close)
    gain, loss = _wilder(np.clip(delta, 0, None), 14), _wilder(np.clip(-delta, 0, None), 14)
    rsi = 100 * gain[-1] / (gain[-1] + loss[-1])
    macd = _ema(close, 12) - _ema(close, 26)
    hist = macd[-1] - _ema(macd, 9)[-1]
    expected = max(0.0, min(100.0, (rsi - 30) / 40 * 100)) * 0.6 + (75.0 if hist > 0 else 25.0) * 0.4
    assert fs._ta_momentum_score(df) == pytest.approx(expected, abs=1e-9)


def test_volatility_score(df):
    atr_pct = _wilder(_true_range(df), 14)[-1] / df["close"].iloc[-1] * 100
    bbl, bbm, bbu = _bands(df["close"])
    bbw = (bbu - bbl) / bbm * 100
    expected = (
        max(0.0, min(100.0, (8.0 - atr_pct) / 6.0 * 100)) * 0.5
        + max(0.0, min(100.0, (40.0 - bbw) / 30.0 * 100)) * 0.5
    )
    assert fs._ta_volatility_score(df) == pytest.approx(expected, abs=1e-9)


def test_value_score(df):
    bbl, _, bbu = _bands(df["close"])
    pct_b = (df["close"].iloc[-1] - bbl) / (bbu - bbl)
    assert fs._ta_value_score(df) == pytest.approx(max(0.0, min(100.0, (1.0 - pct_b) * 100)), abs=1e-9)


@pytest.mark.parametrize("seed", [5, 8, 13])
def test_quality_score(seed):
    df = fs._build_df(_history(seed=seed))
    high, low = df["high"].to_numpy(), df["low"].to_numpy()
    up, down = np.diff(high), -np.diff(low)
    plus_dm = _wilder(np.where((up > down) & (up > 0), up, 0.0), 14)
    minus_dm = _wilder(np.where((down > up) & (down > 0), down, 0.0), 14)
    tr = _wilder(_true_range(df)[1:], 14)
    plus_di, minus_di = 100 * plus_dm / tr, 100 * minus_dm / tr
    dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = _wilder(dx[~np.isnan(dx)], 14)[-1]
    expected = max(0.0, min(100.0, max(0.0, min(100.0, adx * 2)) + (20.0 if plus_di[-1] > minus_di[-1] else -20.0)))
    # ADX warm-up seeding differs from this reference by < 1e-4 after 250 bars
    assert fs._ta_quality_score(df) == pytest.approx(expected, abs=1e-3)
