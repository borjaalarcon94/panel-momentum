"""Screener de growth con momentum: consulta TradingView y genera docs/index.html.
Lo ejecuta GitHub Actions cada dia laborable. Solo usa la libreria estandar.

Aqui se OBTIENEN los datos y se GUARDAN solo las mejores del dia. La logica de puntuacion vive en
docs/puntuacion.js (unica fuente): aqui se ejecuta con node (puntuar.js) para ordenar y quedarnos con el top,
y en el navegador para mostrar el detalle. Asi un cambio de criterio recalcula tambien los dias ya guardados.
"""
import hashlib, json, statistics, subprocess, sys, time, urllib.request, datetime, pathlib

R = pathlib.Path(__file__).parent
WEB = R / "docs"
DATOS = WEB / "datos"      # los ficheros de cada dia se sirven tal cual: no se incrustan en el HTML
GUARDAR = 10          # top que se guarda y se sigue cada dia
EN_MARCHA = 5         # cumplen todo pero estan muy extendidas: se guardan aparte, no son entrada temprana
DIAS = 90             # dias del resumen ligero que usa el seguimiento
SEGUIR_DIAS = 30      # dias cuyos datos frescos van en panel.json (lo que usa el seguimiento normal)
CIERRE_UTC = 21        # hora UTC a partir de la cual el cierre de hoy ya existe (NY cierra a las 20:00)
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
CAP_MIN = 300e6          # suelo de capitalizacion: por debajo no hay liquidez ni informacion fiable
CAP_MAX = None           # sin techo. Lo hubo en 10e9 ("una gigante ya no multiplica") hasta el 14 de octubre
                         # de 2026. Se quito por dos motivos, ver auditoria/registro.md:
                         #  1. La premisa no se sostuvo al medirla: las de mas de 10 B rindieron igual o mejor.
                         #  2. El stop es la EMA 50 con tope del 15 %. Las grandes cotizan a 6-22 % de su
                         #     EMA 50 y las pequenas a 20-40 %, donde el tope muerde y el stop deja de ser
                         #     tecnico. Con las grandes el stop es de verdad la media movil.
                         # El sesgo hacia lo pequeno sigue vivo, pero como preferencia blanda: el bonus de
                         # tamano de puntuacion.js y el desempate por menor capitalizacion de main().
FILTROS = [
    {"left": "type", "operation": "equal", "right": "stock"},
    {"left": "exchange", "operation": "in_range", "right": ["NASDAQ", "NYSE", "AMEX"]},
    {"left": "close", "operation": "greater", "right": 2},
    {"left": "market_cap_basic", "operation": "greater", "right": CAP_MIN},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 300000},
    {"left": "SMA200", "operation": "less", "right": "close"},   # precio sobre media 200
    {"left": "EMA50", "operation": "less", "right": "EMA9"},     # EMA9 > EMA50
    {"left": "RSI", "operation": "greater", "right": 55},
]
CRECIMIENTO_MIN = 20     # % interanual, el mayor entre TTM y ultimo trimestre
MAX_DESDE_MAXIMO = 20    # % por debajo del maximo de 52 semanas
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


def scan(body, intentos=3):
    """Con reintento: un fallo puntual de red dejaba el panel sin actualizar ese dia, y una sesion
    perdida no se recupera nunca porque TradingView solo sirve el dato del momento."""
    body = {"markets": ["america"], "options": {"lang": "en"}, **body}
    ultimo = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(
                "https://scanner.tradingview.com/america/scan", data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
                         "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r).get("data", [])
        except Exception as e:
            ultimo = e
            print(f"escaneo fallido (intento {i+1} de {intentos}): {e}", flush=True)
            if i + 1 < intentos:
                time.sleep(5 * (i + 1))
    raise ultimo


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


def con_respaldo(frescos, top):
    """Rellena con los datos del top de hoy los simbolos que el escaneo de seguimiento no devolvio.

    Si ese escaneo se deja uno, la accion se queda sin datos de hoy y desaparece del seguimiento y del
    registro de Resultados aunque este en el top. Paso con BLFS el 7 de octubre de 2026. Los datos del
    top ya estan escaneados, asi que el respaldo no cuesta ninguna llamada mas.
    """
    salida = dict(frescos)
    for a in top:
        s = a.get("simbolo")
        if s and s not in salida:
            salida[s] = {k: v for k, v in a.items() if k in CAMPOS_SEGUIMIENTO and v is not None}
    return salida


def previos_de(hoy):
    return [p for p in sorted(DATOS.glob("2*.json")) if p.stem != hoy]


def sin_cierre_nuevo(hoy, ahora, anteriores, acciones, spy_hoy=None, spy_ayer=None):
    """Motivo por el que NO hay un cierre nuevo que guardar, o None si si lo hay.

    Un push de codigo dispara el Action a cualquier hora, y con el mercado cerrado TradingView
    devuelve el cierre anterior con la fecha de hoy. Eso creaba dias fantasma que luego cuentan como
    sesion y duplican las entradas al medir resultados: ha pasado un domingo y un martes por la manana.
    """
    if acciones is None:
        return None
    if datetime.date.fromisoformat(hoy).weekday() >= 5:
        return "Fin de semana, no hay sesion"
    if ahora.hour < CIERRE_UTC:
        return f"Son las {ahora:%H:%M} UTC y Nueva York cierra a las 20:00, el cierre de hoy aun no existe"
    # El SPY es la prueba mas limpia y no depende de que el top se parezca al de ayer: si el indice
    # cierra exactamente igual que la sesion anterior, no ha habido sesion. Asi se cazo el domingo
    # fantasma del 4 de octubre (769,64 identico al viernes). La comparacion ticker a ticker de abajo
    # necesita 3 valores en comun, y aquel dia el top no compartia NINGUNO con el anterior.
    ant = {a["ticker"]: a["precio"] for a in anteriores} if anteriores else {}
    movidas = [a for a in acciones if a["ticker"] in ant and ant[a["ticker"]] != a["precio"]]
    if spy_hoy is not None and spy_ayer is not None and spy_hoy == spy_ayer and not movidas:
        # "and not movidas" para el caso raro pero posible de que el SPY cierre igual dos dias
        # seguidos por azar: si alguna accion SI se ha movido, hubo sesion y el dia se guarda.
        return f"El S&P 500 cierra igual que la sesion anterior ({spy_hoy}): festivo o mercado cerrado"
    if anteriores:
        # Ticker a ticker, no la lista entera: la composicion del top puede cambiar (sale una, entra
        # otra) con los mismos precios, y eso sigue siendo exactamente el mismo cierre.
        comunes = [a for a in acciones if a["ticker"] in ant]
        if len(comunes) >= 3 and all(ant[a["ticker"]] == a["precio"] for a in comunes):
            return "Mismos precios que el dia anterior (festivo o mercado cerrado)"
    return None


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


def ya_esta_hecho(hoy):
    """True si el cierre de hoy ya esta guardado. Lo usa el intento de repesca para salir sin gastar
    ni una llamada los dias en que el build de las 21:30 fue bien, que son casi todos."""
    return (DATOS / f"{hoy}.json").exists()


def main():
    WEB.mkdir(exist_ok=True)
    DATOS.mkdir(parents=True, exist_ok=True)
    hoy = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    # Repesca: si ya hay cierre de hoy no se hace nada, y si no lo hay se construye entero. Sale
    # ANTES de escanear, asi que en un dia normal cuesta cero llamadas.
    if "--solo-si-falta" in sys.argv:
        if ya_esta_hecho(hoy):
            print(f"El cierre de {hoy} ya esta guardado: nada que repescar.")
            return
        if datetime.date.fromisoformat(hoy).weekday() >= 5:
            print("Fin de semana: nada que repescar.")
            return
        print(f"FALTA el cierre de {hoy}: el build principal no lo guardo. Reintentando entero.")
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
    acciones_hoy = list(acciones)   # el top de hoy, aunque luego no se guarde como dia nuevo
    _prev = leer(previos_de(hoy)[-1]) if previos_de(hoy) else None
    _spy = lambda d: next((m.get("precio") for m in (d or {}).get("mercado", []) if m.get("ticker") == "SPY"), None)
    motivo = sin_cierre_nuevo(hoy, datetime.datetime.utcnow(),
                              _prev["acciones"] if _prev else None, acciones,
                              _spy({"mercado": mercado}), _spy(_prev))
    if motivo:
        print(motivo + ": no se guarda el dia")
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

    # Sin cierre nuevo no se publica NADA de media sesion. Todo el sistema (EMA 50, stop, RSI, el
    # protocolo de salida) esta definido sobre cierres diarios; con un precio de media sesion la
    # pestaña Seguimiento daba un veredicto y la pestaña Hoy otro sobre la misma accion el mismo dia,
    # y los stops bailaban hasta el cierre. Se conserva lo del ultimo cierre y se ahorran las llamadas.
    anterior = {}
    if motivo:
        try:
            anterior = json.loads((WEB / "panel.json").read_text())
        except Exception:
            anterior = {}
    recientes = sorted(simbolos_de(SEGUIR_DIAS))
    if motivo and anterior.get("actual"):
        print("Sin cierre nuevo: se conservan los datos de seguimiento del ultimo cierre")
        # extra solo se rellena en la otra rama, y el print final lo usa: sin esto el script
        # reventaba con UnboundLocalError DESPUES de escribir panel.json, o sea que salia con
        # codigo de error y el Action no llegaba a publicar. Pasaba cada festivo y cada vez que se
        # lanzara antes del cierre. Encontrado el 22/10/2026 al probar la repesca.
        extra = {}
        actual, precios = anterior["actual"], anterior.get("precios", {})
        mercado = anterior.get("mercadoHoy") or mercado
        ref = anterior.get("referenciaHoy") or ref
        actualizado = anterior.get("actualizado")
    else:
        antiguos_seguidos = sorted(simbolos_de(SEGUIR_EXTRA) - set(recientes))
        frescos = {}
        for lista in (recientes, antiguos_seguidos):
            for i in range(0, len(lista), 300):
                for fila in filas(scan({"columns": list(C), "symbols": {"tickers": lista[i:i + 300]}})):
                    frescos[fila["simbolo"]] = {k: v for k, v in fila.items() if k in CAMPOS_SEGUIMIENTO and v is not None}
        frescos = con_respaldo(frescos, acciones_hoy + en_marcha)
        actual = {s: v for s, v in frescos.items() if s in set(recientes)}
        extra = {s: v for s, v in frescos.items() if s in set(antiguos_seguidos)}
        (WEB / "extra.json").write_text(json.dumps({"actual": extra}, ensure_ascii=False))
        antiguos = sorted({a["simbolo"] for d in todos.values() for a in d["acciones"]
                           if a.get("simbolo") and a["simbolo"] not in frescos})
        precios = {s: a["precio"] for s, a in frescos.items()}
        for i in range(0, len(antiguos), 400):
            for it in scan({"columns": ["close"], "symbols": {"tickers": antiguos[i:i + 400]}}):
                precios[it["s"]] = redondea(it["d"][0])
        actualizado = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")
    # Serie diaria de cierres de todo lo que ha pasado por el top. Sin esto, la simulacion de stops de
    # la pestaña Resultados es ciega justo los dias que importan: una accion se cae del top cuando se
    # debilita, que es cuando saltaria el stop. El dato ya lo pedimos (precios), solo faltaba guardarlo.
    # Va en su propio fichero, no en panel.json, porque solo lo necesita esa pestaña y panel.json se
    # descarga en cada visita. Se recorta a DIAS sesiones para que no crezca sin fin.
    historicos_precios = {}
    fp = WEB / "precios.json"
    if fp.exists():
        try:
            historicos_precios = json.loads(fp.read_text()).get("dias", {})
        except Exception:
            historicos_precios = {}
    # Junto al cierre se guarda la EMA 50 del dia. Motivo: el trinquete del stop ("el stop nunca
    # baja") solo subia los dias en que el usuario abria la app, porque se calculaba con el dato de
    # ese momento y se guardaba en su navegador. Si no mirabas en una semana, los escalones de esos
    # dias se perdian y tu stop quedaba MAS BAJO de lo que la tabla 5 promete: arriesgabas mas de lo
    # que el sistema decia. Con la EMA 50 diaria el trinquete se reconstruye entero desde la serie y
    # deja de depender de un habito. El dato ya se descarga (esta en CAMPOS_SEGUIMIENTO): solo se
    # guardaba. Cuesta unos 8 KB mas en un fichero que solo se descarga en dos pestañas.
    historicas_emas = {}
    if fp.exists():
        try:
            historicas_emas = json.loads(fp.read_text()).get("emas", {})
        except Exception:
            historicas_emas = {}
    if acciones is not None:   # en fin de semana o festivo no hay cierre nuevo que guardar
        historicos_precios[hoy] = {s: redondea(v) for s, v in precios.items()}
        historicas_emas[hoy] = {s: redondea(v.get("ema50")) for s, v in actual.items() if v.get("ema50")}
    historicos_precios = {f: v for f, v in sorted(historicos_precios.items())[-DIAS:]}
    historicas_emas = {f: v for f, v in sorted(historicas_emas.items())[-DIAS:]}
    fp.write_text(json.dumps({"dias": historicos_precios, "emas": historicas_emas},
                             ensure_ascii=False, separators=(",", ":")))

    # plantilla.html entra en el hash: un cambio solo de plantilla (textos, nombres de pestañas)
    # no movia la version, asi que la recarga automatica no saltaba y el navegador podia servir el
    # HTML viejo de su cache. Paso el 20/10/2026 al renombrar una subpestaña.
    estaticos = sorted(f for f in WEB.glob("*.*") if f.suffix in (".js", ".css")) + [R / "plantilla.html"]
    version = hashlib.sha256(b"".join(f.read_bytes() for f in estaticos)).hexdigest()[:8]
    panel = {"version": version, "dias": sorted(todos), "historico": historico, "precios": precios, "actual": actual,
             "mercadoHoy": mercado, "referenciaHoy": ref,
             "criterios": {"precioMin": 2, "capMin": CAP_MIN, "capMax": CAP_MAX, "volumenMin": 300000,
                           "liquidezMin": LIQUIDEZ_MIN, "rsiMin": 55, "crecimientoMin": CRECIMIENTO_MIN,
                           "maxDesdeMaximo": MAX_DESDE_MAXIMO},
             "regimen": anterior.get("regimen") if (motivo and anterior.get("regimen")) else regimen(mercado),
             "actualizado": actualizado}
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
