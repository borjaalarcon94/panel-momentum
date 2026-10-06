"""Screener de growth con momentum: consulta TradingView y genera docs/index.html.
Lo ejecuta GitHub Actions cada dia laborable. Solo usa la libreria estandar.

Aqui se OBTIENEN los datos y se GUARDAN solo las mejores del dia. La logica de puntuacion vive en
docs/puntuacion.js (unica fuente): aqui se ejecuta con node (puntuar.js) para ordenar y quedarnos con el top,
y en el navegador para mostrar el detalle. Asi un cambio de criterio recalcula tambien los dias ya guardados.
"""
import hashlib, json, statistics, subprocess, urllib.request, datetime, pathlib

R = pathlib.Path(__file__).parent
WEB = R / "docs"
DATOS = WEB / "datos"      # los ficheros de cada dia se sirven tal cual: no se incrustan en el HTML
GUARDAR = 10          # top que se guarda y se sigue cada dia
EN_MARCHA = 5         # cumplen todo pero estan muy extendidas: se guardan aparte, no son entrada temprana
DIAS = 90             # dias del resumen ligero que usa el seguimiento
SEGUIR_DIAS = 30      # dias cuyos datos frescos van en panel.json (lo que usa el seguimiento normal)
SEGUIR_EXTRA = 90     # hasta aqui se siguen descargando datos, pero van en extra.json: la web solo lo
                      # descarga si tienes una posicion abierta que ya no esta en panel.json
# Campos necesarios para recomprobar requisitos y repuntuar una accion seguida (el resto no se publica).
CAMPOS_SEGUIMIENTO = ("ticker", "empresa", "simbolo", "precio", "cambio", "cap", "volmedio", "volrel", "adr", "rsi",
                      "sma200", "ema9", "ema21", "ema50", "max52", "min52", "max1m", "max3m", "ingresos", "ingresosq", "ingresosfy",
                      "ingresostot", "bpa", "bpaq", "mbruto", "margen", "fcfm", "deudapat", "caja", "deuda",
                      "semana", "mes", "tres", "seis", "sector", "industria", "resultados", "atr", "acciones", "ingresosprev")

# Negocios cuyo "crecimiento" suele venir del precio de una materia prima o de los fletes, no de mas clientes.
SECTORES_CICLICOS = {"Energy Minerals", "Non-Energy Minerals", "Process Industries", "Utilities"}
INDUSTRIAS_CICLICAS = ("Marine Shipping", "Oil", "Gas", "Coal", "Steel", "Mining", "Metals", "Chemicals")
# Vehiculos que reparten rentas o cotizan por su patrimonio: no son candidatos a multiplicar varias veces.
INDUSTRIAS_EXCLUIDAS = ("Real Estate Investment Trusts", "Investment Trusts/Mutual Funds", "Investment Managers")

# Requisitos obligatorios (reducen el universo a empresas en tendencia alcista con crecimiento real).
# ADR, volumen relativo, aceleracion, margenes y ruptura NO son obligatorios: puntuan (docs/puntuacion.js).
FILTROS = [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "close", "operation": "greater", "right": 2},
    {"left": "market_cap_basic", "operation": "in_range", "right": [300e6, 10e9]},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000},
    {"left": "SMA200", "operation": "less", "right": "close"},   # precio sobre media 200
    {"left": "EMA50", "operation": "less", "right": "EMA9"},     # EMA9 > EMA50
    {"left": "RSI", "operation": "greater", "right": 55},
]
CRECIMIENTO_MIN = 20     # % interanual, el mayor entre TTM y ultimo trimestre
MAX_DESDE_MAXIMO = 20    # % por debajo del maximo de 52 semanas
CAP_MAX = 10e9           # techo de capitalizacion: buscamos empresas que puedan multiplicar, no megacaps
LIQUIDEZ_MIN = 2e6       # $ negociados al dia de media: hay que poder salir de la posicion

C = {"name": "ticker", "description": "empresa", "close": "precio", "change": "cambio",
     "relative_volume_10d_calc": "volrel", "market_cap_basic": "cap", "ADRP": "adr", "RSI": "rsi",
     "sector": "sector", "industry": "industria",
     "total_revenue_yoy_growth_ttm": "ingresos", "total_revenue_yoy_growth_fq": "ingresosq",
     "total_revenue_yoy_growth_fy": "ingresosfy",
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
     "average_volume_10d_calc": "volmedio", "volume": "vol", "total_revenue_ttm": "ingresostot", "ATR": "atr",
     "total_shares_outstanding_fundamental": "acciones", "revenue_forecast_next_fy": "ingresosprev"}


def scan(body):
    body = {"markets": ["america"], "options": {"lang": "en"}, **body}
    req = urllib.request.Request(
        "https://scanner.tradingview.com/america/scan", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
                 "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r).get("data", [])


def redondea(v):
    """TradingView devuelve 15 decimales inutiles: ocupan espacio en el repositorio y no aportan nada."""
    if isinstance(v, float):
        return round(v, 4) if abs(v) < 1e6 else round(v)
    return v


def filas(datos):
    out = []
    for it in datos:
        f = {k: redondea(v) for k, v in zip(C.values(), it["d"])}
        if f.get("resultados"):
            f["resultados"] = datetime.datetime.utcfromtimestamp(f["resultados"]).strftime("%Y-%m-%d")
        f["simbolo"] = it["s"]
        out.append(f)
    return out


def excluida(a):
    ind = (a.get("industria") or "").lower()
    return (a.get("sector") in SECTORES_CICLICOS
            or any(x.lower() in ind for x in INDUSTRIAS_CICLICAS)
            or any(x.lower() in ind for x in INDUSTRIAS_EXCLUIDAS))


def puntuar(acciones, ctx):
    """Ejecuta docs/puntuacion.js con node y devuelve {ticker: {total, sinPenalizar, extendida}}."""
    if not acciones:
        return {}
    entrada = json.dumps({"acciones": acciones, "ctx": ctx}, ensure_ascii=False)
    out = subprocess.run(["node", str(R / "puntuar.js")], input=entrada, capture_output=True, text=True, check=True)
    return {x["ticker"]: x for x in json.loads(out.stdout)}


def cumple(a):
    """Requisitos que no se pueden expresar como filtro simple en el escaner."""
    g = max(a.get("ingresos") or -999, a.get("ingresosq") or -999)
    if g < CRECIMIENTO_MIN:
        return False
    if not a.get("max52") or not a.get("precio"):
        return False
    if (a.get("volmedio") or 0) * a["precio"] < LIQUIDEZ_MIN:
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


def regimen(mercado):
    """El momentum funciona mucho peor con el mercado por debajo de su media de 200 dias."""
    spy = next((m for m in mercado if m["ticker"] == "SPY"), {})
    sobre200 = bool(spy.get("precio") and spy.get("sma200") and spy["precio"] > spy["sma200"])
    sobre50 = sum(1 for m in mercado if m.get("precio") and m.get("ema50") and m["precio"] > m["ema50"])
    return {"favorable": sobre200 and sobre50 >= 2, "spySobre200": sobre200, "indicesSobre50": sobre50}


def comprueba(universo, candidatas, acciones, mercado, ref):
    """Si la fuente devuelve algo raro, es mejor no publicar que publicar basura.
    Al fallar, GitHub Actions marca el trabajo en rojo y avisa por correo; los datos de ayer siguen online."""
    fallos = []
    if len(universo) < 50:
        fallos.append(f"el escáner solo devolvió {len(universo)} valores en el universo base")
    if len(candidatas) < 3:
        fallos.append(f"solo {len(candidatas)} candidatas: el filtro o la fuente han cambiado")
    for a in acciones:
        if not a.get("precio") or a["precio"] <= 0 or not a.get("cap"):
            fallos.append(f"{a.get('ticker')} viene sin precio o sin capitalización")
        if not a.get("sma200") or not a.get("ema50"):
            fallos.append(f"{a.get('ticker')} viene sin medias móviles")
    spy = next((m for m in mercado if m["ticker"] == "SPY"), None)
    if not spy or not spy.get("precio") or not spy.get("sma200"):
        fallos.append("sin datos del S&P 500 (SPY)")
    if len(ref.get("sectores", {})) < 5:
        fallos.append("sin medianas de sector suficientes para la fuerza relativa")
    if fallos:
        raise SystemExit("DATOS NO FIABLES, no se publica nada:\n - " + "\n - ".join(fallos[:8]))


def leer(p):
    d = json.loads(p.read_text())
    return d if isinstance(d, dict) else {"acciones": d}


def main():
    WEB.mkdir(exist_ok=True)
    DATOS.mkdir(parents=True, exist_ok=True)
    hoy = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    universo = filas(scan({"columns": list(C), "filter": FILTROS, "range": [0, 3000],
                           "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}}))
    candidatas = [a for a in universo if cumple(a) and not excluida(a)]
    mercado = filas(scan({"columns": list(C), "symbols": {"tickers": ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:IWM"]}}))
    ref = referencia()
    spy = next((m for m in mercado if m["ticker"] == "SPY"), {})
    ctx = {"fecha": hoy, "spy": {"tres": spy.get("tres"), "seis": spy.get("seis")}, "sectores": ref["sectores"]}
    puntos = puntuar(candidatas, ctx)
    nota = lambda a: (puntos.get(a["ticker"]) or {}).get("total") or 0
    # A igualdad de puntuacion, primero la de menor capitalizacion: mas recorrido para multiplicar.
    acciones = sorted(candidatas, key=lambda a: (-nota(a), a.get("cap") or 0))[:GUARDAR]
    # Cumplen todos los requisitos pero estan muy extendidas: no son entrada temprana, van aparte.
    elegidas = {a["ticker"] for a in acciones}
    en_marcha = sorted([a for a in candidatas if a["ticker"] not in elegidas
                        and (puntos.get(a["ticker"]) or {}).get("extendida")],
                       key=lambda a: (puntos.get(a["ticker"]) or {}).get("sinPenalizar") or 0, reverse=True)[:EN_MARCHA]
    comprueba(universo, candidatas, acciones, mercado, ref)
    # Sabado o domingo no hay cierre nuevo: TradingView devuelve el del viernes. Guardarlo crea un dia
    # falso que ocupa sitio y que luego cuenta como sesion al medir resultados. El filtro por datos
    # repetidos no basta: si cambia el codigo de puntuacion, el top sale distinto con los mismos precios.
    if datetime.date.fromisoformat(hoy).weekday() >= 5:
        print("Fin de semana: no hay cierre nuevo, no se guarda el dia")
        acciones = None
    previos = [p for p in sorted(DATOS.glob("2*.json")) if p.stem != hoy]
    if previos and acciones is not None:
        ant = leer(previos[-1])["acciones"]
        if [(a["ticker"], a["precio"]) for a in ant] == [(a["ticker"], a["precio"]) for a in acciones]:
            print("Mismos datos que el dia anterior (festivo): no se guarda")
            acciones = None
    if acciones is not None:
        (DATOS / f"{hoy}.json").write_text(json.dumps(
            {"acciones": acciones, "enMarcha": en_marcha, "mercado": mercado, "referencia": ref,
             "universo": len(universo), "candidatas": len(candidatas)},
            ensure_ascii=False))
    todos = {p.stem: leer(p) for p in sorted(DATOS.glob("2*.json"))[-DIAS:]}
    # Resumen ligero de todos los dias (lo usa el seguimiento): ticker, simbolo, precio y puntuacion.
    historico = {}
    for f, d in todos.items():
        if not d["acciones"]:
            continue
        spy_d = next((m for m in d.get("mercado", []) if m["ticker"] == "SPY"), {})
        pts = puntuar(d["acciones"], {"fecha": f, "spy": {"tres": spy_d.get("tres"), "seis": spy_d.get("seis")},
                                      "sectores": (d.get("referencia") or {}).get("sectores", {})})
        historico[f] = {"acciones": [{"t": a["ticker"], "s": a.get("simbolo"), "p": a.get("precio"),
                                      "sc": (pts.get(a["ticker"]) or {}).get("total") if d.get("referencia") else None,
                                      "ac": a.get("acciones"),   # para detectar dilucion con el tiempo
                                      "n": a.get("empresa")} for a in d["acciones"]],
                        "spy": next((m.get("precio") for m in d.get("mercado", []) if m["ticker"] == "SPY"), None)}
    # Estado de HOY de todas las acciones que han pasado por el top ultimamente: permite saber en el
    # seguimiento si siguen cumpliendo los requisitos aunque hayan salido del top.
    def simbolos_de(dias_atras):
        return {a["simbolo"] for f, d in list(todos.items())[-dias_atras:]
                for a in d["acciones"] + d.get("enMarcha", []) if a.get("simbolo")}

    recientes = sorted(simbolos_de(SEGUIR_DIAS))
    antiguos_seguidos = sorted(simbolos_de(SEGUIR_EXTRA) - set(recientes))
    frescos = {}
    for lista in (recientes, antiguos_seguidos):
        for i in range(0, len(lista), 300):
            for fila in filas(scan({"columns": list(C), "symbols": {"tickers": lista[i:i + 300]}})):
                frescos[fila["simbolo"]] = {k: v for k, v in fila.items() if k in CAMPOS_SEGUIMIENTO and v is not None}
    actual = {s: v for s, v in frescos.items() if s in set(recientes)}
    extra = {s: v for s, v in frescos.items() if s in set(antiguos_seguidos)}
    (WEB / "extra.json").write_text(json.dumps({"actual": extra}, ensure_ascii=False))
    antiguos = sorted({a["simbolo"] for d in todos.values() for a in d["acciones"]
                       if a.get("simbolo") and a["simbolo"] not in frescos})
    precios = {s: a["precio"] for s, a in frescos.items()}
    for i in range(0, len(antiguos), 400):
        for it in scan({"columns": ["close"], "symbols": {"tickers": antiguos[i:i + 400]}}):
            precios[it["s"]] = redondea(it["d"][0])
    estaticos = sorted(f for f in WEB.glob("*.*") if f.suffix in (".js", ".css"))
    version = hashlib.sha256(b"".join(f.read_bytes() for f in estaticos)).hexdigest()[:8]
    panel = {"version": version, "dias": sorted(todos), "historico": historico, "precios": precios, "actual": actual,
             "mercadoHoy": mercado, "referenciaHoy": ref,
             "criterios": {"precioMin": 2, "capMin": 300e6, "capMax": CAP_MAX, "volumenMin": 300000,
                           "liquidezMin": LIQUIDEZ_MIN, "rsiMin": 55, "crecimientoMin": CRECIMIENTO_MIN,
                           "maxDesdeMaximo": MAX_DESDE_MAXIMO},
             "regimen": regimen(mercado),
             "actualizado": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")}
    (WEB / "panel.json").write_text(json.dumps(panel, ensure_ascii=False))
    # index.html solo cambia cuando cambia la plantilla o el codigo de la web: los datos se cargan aparte.
    # La version viaja tambien dentro de panel.json: si el navegador sirve un index.html viejo desde su cache,
    # la web lo detecta al cargar los datos y se refresca sola (ver iniciar() en docs/app.js).
    html = (R / "plantilla.html").read_text().replace("__VER__", version)
    if not (WEB / "index.html").exists() or (WEB / "index.html").read_text() != html:
        (WEB / "index.html").write_text(html)
    print(hoy, "universo:", len(universo), "candidatas:", len(candidatas),
          "guardadas:", "-" if acciones is None else len(acciones),
          "ya en marcha:", len(en_marcha), "vigiladas:", len(actual), "+", len(extra), "en extra.json")


if __name__ == "__main__":
    main()
