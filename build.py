"""Acciones con momentum: consulta TradingView y genera docs/index.html.
Lo ejecuta GitHub Actions cada dia laborable. Solo usa la libreria estandar."""
import json, urllib.request, datetime, pathlib

R = pathlib.Path(__file__).parent
DATOS, WEB = R / "data", R / "docs"
DIAS = 90

FILTROS = [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "close", "operation": "greater", "right": 3},
    {"left": "change", "operation": "greater", "right": 0.01},
    {"left": "market_cap_basic", "operation": "greater", "right": 300e6},
    {"left": "EMA9", "operation": "less", "right": "close"},
    {"left": "EMA50", "operation": "less", "right": "close"},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 500000},
    {"left": "ADRP", "operation": "greater", "right": 7},
    {"left": "RSI", "operation": "greater", "right": 60},
]
C = {"name": "ticker", "description": "empresa", "close": "precio", "change": "cambio",
     "relative_volume_10d_calc": "volrel", "market_cap_basic": "cap", "ADRP": "adr",
     "RSI": "rsi", "sector": "sector", "industry": "industria",
     "total_revenue_yoy_growth_ttm": "ingresos", "net_margin_ttm": "margen",
     "earnings_release_next_date": "resultados", "Perf.W": "semana", "Perf.1M": "mes",
     "price_52_week_high": "max52", "SMA200": "sma200", "EMA50": "ema50"}


def scan(body):
    body = {"markets": ["america"], "options": {"lang": "en"}, **body}
    req = urllib.request.Request(
        "https://scanner.tradingview.com/america/scan", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
                 "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r).get("data", [])


def filas(datos):
    out = []
    for it in datos:
        f = dict(zip(C.values(), it["d"]))
        if f.get("resultados"):
            f["resultados"] = datetime.datetime.utcfromtimestamp(f["resultados"]).strftime("%Y-%m-%d")
        f["simbolo"] = it["s"]
        out.append(f)
    return out


def leer(p):
    d = json.loads(p.read_text())
    return d if isinstance(d, dict) else {"acciones": d}


def main():
    DATOS.mkdir(exist_ok=True)
    WEB.mkdir(exist_ok=True)
    hoy = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    acciones = filas(scan({"columns": list(C), "filter": FILTROS, "range": [0, 300],
                           "sort": {"sortBy": "change", "sortOrder": "desc"}}))
    mercado = filas(scan({"columns": list(C), "symbols": {"tickers": ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:IWM"]}}))
    previos = [p for p in sorted(DATOS.glob("2*.json")) if p.stem != hoy]
    if previos:
        ant = leer(previos[-1])["acciones"]
        if [(a["ticker"], a["precio"]) for a in ant] == [(a["ticker"], a["precio"]) for a in acciones]:
            print("Mismos datos que el dia anterior (festivo): no se guarda")
            acciones = None
    if acciones is not None:
        (DATOS / f"{hoy}.json").write_text(json.dumps({"acciones": acciones, "mercado": mercado}, ensure_ascii=False))
    dias = {p.stem: leer(p) for p in sorted(DATOS.glob("2*.json"))[-DIAS:]}
    simbolos = sorted({a["simbolo"] for d in dias.values() for a in d["acciones"] if a.get("simbolo")})
    precios = {}
    for i in range(0, len(simbolos), 400):
        for it in scan({"columns": ["close"], "symbols": {"tickers": simbolos[i:i + 400]}}):
            precios[it["s"]] = it["d"][0]
    todo = {"dias": dias, "precios": precios, "actualizado": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")}
    html = (R / "plantilla.html").read_text().replace(
        "/*DATOS*/null", json.dumps(todo, ensure_ascii=False).replace("</", "<\\/"))
    (WEB / "index.html").write_text(html)
    print(hoy, "acciones:", "-" if acciones is None else len(acciones), "seguimiento:", len(precios))


if __name__ == "__main__":
    main()
