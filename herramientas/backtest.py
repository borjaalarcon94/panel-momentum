"""Backtest de la parte tecnica del screener con precios reales de nasdaq.com.

Mide, sobre una muestra del universo elegible (300 M - 10.000 M, volumen > 300.000), que paso en los
3 meses siguientes a cada situacion tecnica. Sirvio para calibrar las penalizaciones de
docs/puntuacion.js. Uso:  python3 herramientas/backtest.py  (escribe obs.json en el directorio actual)

LIMITES, importantes al leer los resultados:
- Solo tecnico: no hay fundamentales historicos puntuales gratuitos, asi que no mide margenes ni crecimiento.
- Sesgo de supervivencia: la muestra son empresas que HOY siguen cotizando en ese rango de capitalizacion.
  Las que quebraron o se hundieron no estan, asi que todo sale mejor de lo que fue en realidad.
- Periodo 2024-2026, mayoritariamente alcista.
- Observaciones semanales solapadas: la muestra efectiva es menor que el numero de observaciones.
"""
import json, random, urllib.request, datetime, statistics, sys, time

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json", "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"}

def tv(body):
    body = {"markets": ["america"], "options": {"lang": "en"}, **body}
    r = urllib.request.Request("https://scanner.tradingview.com/america/scan", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": UA, "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
    return json.load(urllib.request.urlopen(r, timeout=60))["data"]

def historico(sym):
    url = f"https://api.nasdaq.com/api/quote/{sym}/historical?assetclass=stocks&fromdate=2023-09-01&todate=2026-10-04&limit=9999"
    req = urllib.request.Request(url, headers=H)
    j = json.load(urllib.request.urlopen(req, timeout=30))
    rows = (j.get("data") or {}).get("tradesTable", {}).get("rows") or []
    out = []
    for r in rows:
        try:
            m, d, y = r["date"].split("/")
            out.append((f"{y}-{m}-{d}", float(r["close"].replace("$", "").replace(",", ""))))
        except Exception:
            pass
    return sorted(out)

def ema(xs, n):
    k, out, e = 2 / (n + 1), [], None
    for x in xs:
        e = x if e is None else x * k + e * (1 - k)
        out.append(e)
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
        d = xs[i] - xs[i - 1]
        gi, li = max(d, 0), max(-d, 0)
        if i <= n:
            g += gi / n; l += li / n
        else:
            g = (g * (n - 1) + gi) / n; l = (l * (n - 1) + li) / n
        if i >= n:
            out[i] = 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    return out

universo = tv({"columns": ["name"], "filter": [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "market_cap_basic", "operation": "in_range", "right": [300e6, 10e9]},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000}],
    "range": [0, 5000], "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}})
tickers = [r["d"][0] for r in universo]
random.seed(7)
muestra = random.sample(tickers, min(200, len(tickers)))
print(f"universo elegible: {len(tickers)} · muestra analizada: {len(muestra)}", flush=True)

obs = []
ok = 0
for i, t in enumerate(muestra):
    try:
        h = historico(t)
        if len(h) < 400: continue
        fechas = [x[0] for x in h]; cierres = [x[1] for x in h]
        e9, e21, e50, s200 = ema(cierres, 9), ema(cierres, 21), ema(cierres, 50), sma(cierres, 200)
        r14 = rsi(cierres)
        ok += 1
        for j in range(220, len(cierres) - 63, 5):          # una observacion por semana
            p = cierres[j]
            if s200[j] is None or r14[j] is None: continue
            max52 = max(cierres[max(0, j - 252):j + 1])
            obs.append({
                "t": t, "f": fechas[j], "p": p,
                "tendencia": p > s200[j] and e9[j] > e50[j],
                "rsi": r14[j], "dmax": (p / max52 - 1) * 100,
                "extEma": (p / e50[j] - 1) * 100, "extSma": (p / s200[j] - 1) * 100,
                "mes": (p / cierres[j - 21] - 1) * 100,
                "desdeMin": (p / min(cierres[max(0, j - 252):j + 1]) - 1) * 100,
                "f1m": (cierres[j + 21] / p - 1) * 100, "f3m": (cierres[j + 63] / p - 1) * 100})
    except Exception as e:
        pass
    if i % 40 == 0: print(f"  {i}/{len(muestra)}…", flush=True)

print(f"acciones con histórico suficiente: {ok} · observaciones: {len(obs)}", flush=True)
json.dump(obs, open("obs.json", "w"))
