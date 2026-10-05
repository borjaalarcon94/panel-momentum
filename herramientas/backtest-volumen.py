"""¿Una ruptura de máximos con volumen alto rinde más que una sin volumen?"""
import json, random, urllib.request, statistics
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json", "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"}

def tv(body):
    body = {"markets": ["america"], "options": {"lang": "en"}, **body}
    r = urllib.request.Request("https://scanner.tradingview.com/america/scan", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": UA, "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
    return json.load(urllib.request.urlopen(r, timeout=60))["data"]

def historico(sym):
    url = f"https://api.nasdaq.com/api/quote/{sym}/historical?assetclass=stocks&fromdate=2023-09-01&todate=2026-10-05&limit=9999"
    j = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=30))
    out = []
    for r in (j.get("data") or {}).get("tradesTable", {}).get("rows") or []:
        try:
            m, d, y = r["date"].split("/")
            out.append((f"{y}-{m}-{d}", float(r["close"].replace("$", "").replace(",", "")), float(r["volume"].replace(",", ""))))
        except Exception: pass
    return sorted(out)

def ema(xs, n):
    k, out, e = 2 / (n + 1), [], None
    for x in xs:
        e = x if e is None else x * k + e * (1 - k); out.append(e)
    return out
def sma(xs, n):
    out, s = [], 0.0
    for i, x in enumerate(xs):
        s += x
        if i >= n: s -= xs[i - n]
        out.append(s / min(i + 1, n) if i + 1 >= n else None)
    return out
def rsi(xs, n=14):
    out = [None] * len(xs); g = l = 0.0
    for i in range(1, len(xs)):
        d = xs[i] - xs[i - 1]; gi, li = max(d, 0), max(-d, 0)
        if i <= n: g += gi / n; l += li / n
        else: g = (g * (n - 1) + gi) / n; l = (l * (n - 1) + li) / n
        if i >= n: out[i] = 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    return out

universo = tv({"columns": ["name"], "filter": [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "market_cap_basic", "operation": "in_range", "right": [300e6, 10e9]},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000}],
    "range": [0, 5000], "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}})
random.seed(7)
muestra = random.sample([r["d"][0] for r in universo], 220)
obs = []
for i, t in enumerate(muestra):
    try:
        h = historico(t)
        if len(h) < 400: continue
        c = [x[1] for x in h]; v = [x[2] for x in h]
        e9, e50, s200, r14, v50 = ema(c, 9), ema(c, 50), sma(c, 200), rsi(c), sma(v, 50)
        for j in range(220, len(c) - 63, 5):
            if s200[j] is None or r14[j] is None or not v50[j]: continue
            p = c[j]
            if not (p > s200[j] and e9[j] > e50[j] and r14[j] > 55): continue
            if p < max(c[j - 252:j + 1]) * 0.8: continue
            obs.append({"rompe": p >= max(c[j - 63:j]) * 0.999, "volrel": v[j] / v50[j],
                        "f3m": (c[j + 63] / p - 1) * 100})
    except Exception: pass
    if i % 60 == 0: print(f"  {i}/{len(muestra)}…", flush=True)

def fila(nom, xs):
    val = sorted(o["f3m"] for o in xs)
    if len(val) < 60: return print(f"  {nom:46} n={len(val):4}  (pocos datos)")
    print(f"  {nom:46} n={len(val):4}  media {sum(val)/len(val):6.1f}%  mediana {val[len(val)//2]:5.1f}%  "
          f"≥+50% {100*sum(1 for x in val if x>=50)/len(val):5.1f}%  ≤-35% {100*sum(1 for x in val if x<=-35)/len(val):5.1f}%")
print(f"\nobservaciones: {len(obs)}\n")
fila("No rompe máximos de 3 meses", [o for o in obs if not o["rompe"]])
rot = [o for o in obs if o["rompe"]]
fila("Rompe máximos (todas)", rot)
fila("Rompe con volumen BAJO (<1x su media)", [o for o in rot if o["volrel"] < 1])
fila("Rompe con volumen normal (1-1,5x)", [o for o in rot if 1 <= o["volrel"] < 1.5])
fila("Rompe con volumen ALTO (≥1,5x)", [o for o in rot if o["volrel"] >= 1.5])
fila("Rompe con volumen MUY ALTO (≥2,5x)", [o for o in rot if o["volrel"] >= 2.5])
