"""Screener de growth con momentum: consulta TradingView y genera docs/index.html.
Lo ejecuta GitHub Actions cada dia laborable. Solo usa la libreria estandar.

Aqui solo se OBTIENEN y se GUARDAN datos en bruto. La puntuacion y las senales se calculan en
docs/puntuacion.js, para que cualquier cambio de criterio se aplique tambien a los dias ya guardados.
"""
import json, statistics, urllib.request, datetime, pathlib

R = pathlib.Path(__file__).parent
DATOS, WEB = R / "data", R / "docs"
DIAS = 90

# Requisitos obligatorios (reducen el universo a empresas en tendencia alcista con crecimiento real).
# ADR, volumen relativo, aceleracion, margenes y ruptura NO son obligatorios: puntuan (docs/puntuacion.js).
FILTROS = [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "close", "operation": "greater", "right": 2},
    {"left": "market_cap_basic", "operation": "greater", "right": 300e6},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000},
    {"left": "SMA200", "operation": "less", "right": "close"},   # precio sobre media 200
    {"left": "EMA50", "operation": "less", "right": "EMA9"},     # EMA9 > EMA50
    {"left": "RSI", "operation": "greater", "right": 55},
]
CRECIMIENTO_MIN = 20     # % interanual, el mayor entre TTM y ultimo trimestre
MAX_DESDE_MAXIMO = 20    # % por debajo del maximo de 52 semanas

C = {"name": "ticker", "description": "empresa", "close": "precio", "change": "cambio",
     "relative_volume_10d_calc": "volrel", "market_cap_basic": "cap", "ADRP": "adr", "RSI": "rsi",
     "sector": "sector", "industry": "industria",
     "total_revenue_yoy_growth_ttm": "ingresos", "total_revenue_yoy_growth_fq": "ingresosq",
     "earnings_per_share_diluted_yoy_growth_ttm": "bpa", "earnings_per_share_diluted_yoy_growth_fq": "bpaq",
     "gross_margin_ttm": "mbruto", "net_margin_ttm": "margen", "operating_margin_ttm": "moperativo",
     "free_cash_flow_margin_ttm": "fcfm", "free_cash_flow_ttm": "fcf",
     "debt_to_equity": "deudapat", "cash_n_short_term_invest_fq": "caja", "total_debt_fq": "deuda",
     "current_ratio": "liquidez", "beta_1_year": "beta",
     "earnings_release_next_date": "resultados", "Perf.W": "semana", "Perf.1M": "mes",
     "Perf.3M": "tres", "Perf.6M": "seis",
     "price_52_week_high": "max52", "price_52_week_low": "min52",
     "SMA50": "sma50", "SMA200": "sma200", "EMA9": "ema9", "EMA21": "ema21", "EMA50": "ema50",
     "High.1M": "max1m", "High.3M": "max3m",
     "average_volume_10d_calc": "volmedio", "volume": "vol", "total_revenue_ttm": "ingresostot"}


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


def cumple(a):
    """Requisitos que no se pueden expresar como filtro simple en el escaner."""
    g = max(a.get("ingresos") or -999, a.get("ingresosq") or -999)
    if g < CRECIMIENTO_MIN:
        return False
    if not a.get("max52") or not a.get("precio"):
        return False
    return a["precio"] >= a["max52"] * (1 - MAX_DESDE_MAXIMO / 100)


def referencia():
    """Medianas de rentabilidad por sector y del mercado: base de la fuerza relativa."""
    datos = scan({"columns": ["sector", "Perf.3M", "Perf.6M"],
                  "filter": [{"left": "type", "operation": "equal", "right": "stock"},
                             {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
                             {"left": "market_cap_basic", "operation": "greater", "right": 300e6},
                             {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000}],
                  "range": [0, 6000], "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}})
    por_sector, todos3, todos6 = {}, [], []
    for it in datos:
        s, p3, p6 = it["d"]
        if p3 is None:
            continue
        por_sector.setdefault(s or "Otros", []).append((p3, p6))
        todos3.append(p3)
        if p6 is not None:
            todos6.append(p6)
    sectores = {s: {"tres": statistics.median([x[0] for x in v]),
                    "seis": statistics.median([x[1] for x in v if x[1] is not None] or [0])}
                for s, v in por_sector.items() if len(v) >= 5}
    return {"sectores": sectores, "universo": len(todos3),
            "mercado": {"tres": statistics.median(todos3 or [0]), "seis": statistics.median(todos6 or [0])}}


def leer(p):
    d = json.loads(p.read_text())
    return d if isinstance(d, dict) else {"acciones": d}


def main():
    DATOS.mkdir(exist_ok=True)
    WEB.mkdir(exist_ok=True)
    hoy = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    universo = filas(scan({"columns": list(C), "filter": FILTROS, "range": [0, 3000],
                           "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}}))
    acciones = [a for a in universo if cumple(a)]
    mercado = filas(scan({"columns": list(C), "symbols": {"tickers": ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:IWM"]}}))
    ref = referencia()
    previos = [p for p in sorted(DATOS.glob("2*.json")) if p.stem != hoy]
    if previos:
        ant = leer(previos[-1])["acciones"]
        if [(a["ticker"], a["precio"]) for a in ant] == [(a["ticker"], a["precio"]) for a in acciones]:
            print("Mismos datos que el dia anterior (festivo): no se guarda")
            acciones = None
    if acciones is not None:
        (DATOS / f"{hoy}.json").write_text(json.dumps(
            {"acciones": acciones, "mercado": mercado, "referencia": ref, "universo": len(universo)},
            ensure_ascii=False))
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
    print(hoy, "universo:", len(universo), "seleccionadas:", "-" if acciones is None else len(acciones),
          "seguimiento:", len(precios))


if __name__ == "__main__":
    main()
