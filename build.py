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
APERTURA_UTC = 13      # hora UTC a partir de la cual el mercado PUEDE estar abierto (NY abre a las
                       # 14:30 en invierno y 13:30 en verano; se deja margen). Entre esta hora y
                       # CIERRE_UTC el dato que devuelve TradingView es INTRADIA, no un cierre.
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


# ─── PROTECCION ANTE SALTOS BRUSCOS ─────────────────────────────────────────────────────────────
# Pedido por Borja el 04/11/2026, literal: "evitemos empresas biotecnologicas que hayan tenido
# caidas mayores del 20 % con los indices aguantando. Tambien evitemos las que tengan catalizadores
# binarios cerca (1 semana), cuando estos catalizadores pasen, si mandan señal si que ponlas".
#
# MEDIDO ANTES DE APLICARLO (auditoria/registro.md, 04-05/11/2026): con las 42 entradas del registro
# ninguna de las dos reglas habria cambiado una sola entrada, y la biotecnologia es el sector que
# MEJOR va (-0,05 % de media contra -2,93 % del resto). Se aplica igualmente, y con razon: el
# proposito no es ganar mas, es no estar dentro el dia del salto, y una proteccion de cola NO SE
# PUEDE medir con 42 entradas y un solo evento. Mi medicion demuestra que no ha hecho falta todavia,
# no que no vaya a hacer falta.
#
# Lo que si cuesta: desde hoy el registro mezcla dos reglas de entrada. Para que eso no estropee la
# medicion de primavera, cada candidata descartada por estas reglas se anota en el grupo de control
# con el motivo (ver control()), asi que en marzo se sabra exactamente cuantas subidas costo y
# cuantos sustos ahorro.
DIAS_CATALIZADOR = 7     # dias hasta resultados por debajo de los cuales no se entra
CAIDA_BRUSCA = -20       # % de caida en UNA sesion que descarta a la accion
INDICE_AGUANTA = -2      # si el indice cae MENOS de esto, la caida es de la empresa y no del mercado
VENTANA_CAIDA = 20       # sesiones hacia atras en las que se busca esa caida
DIAS_CAIDA = 45          # ...y ademas, nunca mas atras de estos dias naturales. Las dos cosas: la
                         # cuenta de sesiones sola no acota nada si el archivo tiene huecos o si se
                         # consulta una fecha lejana, y entonces una caida de hace meses seguiria
                         # descartando a la accion para siempre.
CAMBIO_REGLAS = "2026-11-05"   # desde este cierre el top se elige tambien con estas dos reglas


def es_biotech(a):
    """Biotecnologica o farmaceutica. La regla de la caida brusca se pidio SOLO para estas.

    Nota para primavera: aplicarla a todo el universo seria mas protector y cuesta poco (COHU, que
    cayo un 21 %, es Electronic Technology y no entraria aqui). Se deja como lo pidio Borja; el
    grupo de control guarda el sector de cada candidata, asi que ampliarla se podra medir.
    """
    sec = a.get("sector") or ""
    ind = (a.get("industria") or "").lower()
    return sec == "Health Technology" or "biotech" in ind or "pharmaceutical" in ind


def catalizador_cerca(a, hoy):
    """Resultados a menos de DIAS_CATALIZADOR dias. Cuando pasan, la accion vuelve sola al top.

    AVISO QUE HAY QUE REPETIR DONDE SE LEA: esto cubre SOLO los resultados trimestrales. Los
    catalizadores binarios de una biotecnologica -fechas PDUFA, lecturas de ensayos- NO estan en los
    datos que recibimos: TradingView da earnings_release_next_date y nada mas. Conseguirlos exige
    otra fuente, o sea llamadas fuera del presupuesto de 4 al dia. Por eso esta regla NO habria
    evitado lo de IOVA, que se desplomo por una noticia con los resultados todavia a 7 dias.
    """
    r = a.get("resultados")
    if not r:
        return False
    try:
        d = (datetime.date.fromisoformat(r) - datetime.date.fromisoformat(hoy)).days
    except ValueError:
        return False
    return 0 <= d <= DIAS_CATALIZADOR


def cayo_fuerte(a, serie, spy, hoy, cambio_spy_hoy=None):
    """Biotecnologica con una caida de CAIDA_BRUSCA % o mas en UNA sesion, con el indice aguantando.

    "Con el indice aguantando" es la parte que distingue un problema DE LA EMPRESA de un dia malo
    del mercado: si el S&P se hunde a la vez, la caida no dice nada de la accion.

    Se mira el dato de hoy (change), que viene en el scan y vale para cualquier accion aunque sea la
    primera vez que la vemos, y ademas la serie archivada, que solo existe para las que han pasado
    por el top o por el grupo de control. De una accion nueva sin serie solo se puede ver hoy.
    """
    if not es_biotech(a):
        return False
    if (a.get("cambio") or 0) <= CAIDA_BRUSCA and (cambio_spy_hoy is None or cambio_spy_hoy > INDICE_AGUANTA):
        return True
    k = a.get("simbolo") or a.get("ticker")
    try:
        limite = (datetime.date.fromisoformat(hoy) - datetime.timedelta(days=DIAS_CAIDA)).isoformat()
    except ValueError:
        return False
    fechas = [f for f in sorted(serie) if limite <= f <= hoy][-VENTANA_CAIDA - 1:]
    prev = prev_spy = None
    for f in fechas:
        p, s = serie[f].get(k), spy.get(f)
        if p and prev and (p / prev - 1) * 100 <= CAIDA_BRUSCA:
            # Sin dato del indice ese dia no se puede saber si aguanto: no se descarta por las dudas.
            if prev_spy and s and (s / prev_spy - 1) * 100 > INDICE_AGUANTA:
                return True
        if p:
            prev = p
        if s:
            prev_spy = s
    return False


def serie_spy():
    """Cierre del SPY de cada dia archivado, para saber si el indice aguanto."""
    out = {}
    for q in sorted(DATOS.glob("2*.json")):
        d = leer(q)
        v = next((m.get("precio") for m in (d.get("mercado") or []) if m.get("ticker") == "SPY"), None)
        if v:
            out[q.stem] = v
    return out


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
    # Aqui habia un  if ahora.hour < CIERRE_UTC: return "...el cierre de hoy aun no existe".
    # Tenia sentido cuando "hoy" era la fecha del reloj: a mediodia pedir "el cierre de hoy" devolvia
    # el de ayer con la fecha de hoy, y eso creaba dias fantasma. Con sesion_objetivo() el dia que se
    # pide YA es el correcto a cualquier hora, asi que ese guardia solo servia para impedir las
    # repescas: era justo lo que hacia inutil la de las 07:00. Las defensas contra el dia fantasma
    # son las de abajo (el SPY identico y los mismos precios), que miran los DATOS y no la hora.
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


def sesion_objetivo(ahora):
    """De que sesion se puede tener cierre AHORA MISMO.

    Antes el build usaba la fecha UTC del reloj:  hoy = utcnow().strftime("%Y-%m-%d").
    GitHub encola los cron (medido el 02/11/2026: de 22 a 57 minutos), y el 03/11/2026 los encolo
    MAS DE CUATRO HORAS: la pasada de las 21:30 del martes acabo corriendo a las 01:35 del miercoles.
    A esa hora "hoy" ya era el dia 4, el build fue a buscar un cierre que todavia no existe, no
    guardo nada, y EL CIERRE DEL MARTES SE PERDIO. No es recuperable sin volver a pedirlo.

    Por lo mismo, la repesca de las 07:00 ("ultima red a primera hora del dia siguiente") NUNCA pudo
    recuperar nada en su vida: a las 07:00 miraba el cierre de ESE dia, que obviamente no existe.
    Su unico commit, el del 03/11/2026 a las 08:11, solo refresco precios.json.

    Ahora la sesion sale del mercado, no del reloj: antes de la hora de cierre, el ultimo cierre
    disponible es el del dia anterior; y si cae en fin de semana, el viernes.
    """
    # CON EL MERCADO ABIERTO NO HAY CIERRE DE NADIE. TradingView devuelve el precio de AHORA, que no
    # es el cierre de hoy (aun no ha pasado) ni el de ayer (ya no se puede pedir). Guardarlo seria
    # poner el precio intradia de hoy con la etiqueta de ayer: un dia corrompido, peor que un dia
    # que falta. Este guardia sustituye al viejo "hora < CIERRE_UTC", que tapaba esto pero de paso
    # inutilizaba las repescas de madrugada.
    if APERTURA_UTC <= ahora.hour < CIERRE_UTC:
        return None
    d = ahora.date()
    if ahora.hour < CIERRE_UTC:
        d -= datetime.timedelta(days=1)
    while d.weekday() >= 5:
        d -= datetime.timedelta(days=1)
    return d.isoformat()


def ya_esta_hecho(hoy):
    """True si el cierre de hoy ya esta guardado. Lo usa el intento de repesca para salir sin gastar
    ni una llamada los dias en que el build de las 21:30 fue bien, que son casi todos."""
    return (DATOS / f"{hoy}.json").exists()


def construye_historico(todos):
    """Resumen ligero de cada dia (lo usan el seguimiento y la pestana Resultados): ticker, simbolo,
       precio, puntuacion, acciones en circulacion, beta y el cierre del SPY de ese dia.
       Se reconstruye entero desde docs/datos en cada build, asi que anadir un campo lo rellena
       tambien hacia atras sin tener que volver a pedir nada a la red."""
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
                                      # beta: sin ella, comparar con el S&P 500 compara una cesta que se
                                      # mueve 5 veces mas con el indice, y la diferencia se lee como acierto
                                      "b": a.get("beta"),
                                      "n": a.get("empresa")} for a in d["acciones"]],
                        "spy": next((m.get("precio") for m in d.get("mercado", []) if m["ticker"] == "SPY"), None)}
    return historico


def control(candidatas, elegidas, puntos, proteccion=None):
    """GRUPO DE CONTROL: las candidatas que pasaron los 9 requisitos y el panel NO eligio.

       Cada dia pasan los filtros del orden de 110 acciones y el panel se queda con GUARDAR=10, las
       de mas nota. Las otras ~100 se tiraban. Sin ellas no hay forma de responder a la unica
       pregunta que decide si el algoritmo se puede afinar: **¿la nota aporta algo, o lo que funciona
       son los 9 requisitos y el orden dentro da igual?** Medido contra el propio top no se puede
       saber, porque el top es el grupo elegido: hace falta el grupo que no se eligio.

       No cuesta NI UNA llamada mas a TradingView: estas acciones ya vienen en el mismo scan diario,
       solo se estaban descartando. Se guarda lo minimo para medirlas (ticker, simbolo, cierre y
       nota), no la fila entera: unos 4 KB al dia en docs/datos, que no se sirve a los visitantes.

       No cambia ninguna regla ni entra en la web. Es solo el control que hoy no existe."""
    # "por": por que no esta en el top. Sin esto, una candidata apartada por la proteccion del
    # 05/11/2026 seria indistinguible de una que simplemente puntuo menos, y en primavera no se
    # podria responder a lo unico que importa de esa regla: cuantas subidas costo y cuantos sustos
    # ahorro. Es la condicion con la que se acepto aplicarla.
    prot = proteccion or {}
    return [{"t": a["ticker"], "s": a.get("simbolo"), "p": a.get("precio"),
             "sc": (puntos.get(a["ticker"]) or {}).get("total"),
             "sec": a.get("sector"), "ind": a.get("industria"),
             "por": prot.get(a["ticker"], "nota")}
            for a in candidatas if a["ticker"] not in elegidas]


def serie_archivada():
    dias_p, dias_e = {}, {}
    # Dias con cierres pero SIN fichero de dia: el 21/10/2026 el build fallo y no se guardo el
    # top, pero los precios si entraron en precios.json. No se puede crear un 2026-10-21.json
    # porque sin "acciones" se colaria como sesion fantasma en panel["dias"], que es justo lo que
    # vigila filtros.test.py. Van aparte, en un fichero que no entra en el glob de los dias.
    extra_f = DATOS / "serie-extra.json"
    if extra_f.exists():
        for f, sg in (leer(extra_f) or {}).items():
            dias_p[f] = {k: v[0] for k, v in sg.items() if v and v[0] is not None}
            e = {k: v[1] for k, v in sg.items() if v and len(v) > 1 and v[1] is not None}
            if e:
                dias_e[f] = e
    for q in sorted(DATOS.glob("2*.json")):
        d = leer(q)
        sg = d.get("seguidas") or {}
        if not sg:
            continue
        dias_p[q.stem] = {k: v[0] for k, v in sg.items() if v and v[0] is not None}
        e = {k: v[1] for k, v in sg.items() if v and len(v) > 1 and v[1] is not None}
        if e:
            dias_e[q.stem] = e
    return dias_p, dias_e


def construye_entradas(historico):
    """REGISTRO PERMANENTE de la primera aparicion de cada accion en el top.

       Por que existe: panel.json solo lleva las ultimas DIAS=90 sesiones. Cuando la ventana empiece
       a recortar (con 18 sesiones el 29/10/2026, hacia el 19/01/2027) la pestaña Resultados dejaria
       de ver el primer dia de las entradas antiguas y las RE-FECHARIA sola, a su aparicion mas
       antigua de las que todavia quedasen dentro. Con los datos de hoy eso convertiria FIGS de
       +43,9 % a +13,9 % sin que nada avisase: el registro se degradaria solo y en silencio.

       No es un fichero que se va rellenando a mano y hay que rezar para que no se corrompa. Se
       RECALCULA entero desde docs/datos, que no se recorta NUNCA, y ademas se FUSIONA con lo ya
       guardado quedandose siempre con la fecha MAS ANTIGUA de las dos. Asi:
         - si docs/datos esta completo, el fichero es correcto por construccion;
         - si algun dia faltara un fichero de docs/datos, la fecha ya registrada sobrevive.
       Nunca puede mover una entrada hacia adelante, que es el unico error que importa aqui.

       La puntuacion de entrada se guarda la primera vez y se conserva: calcularla necesita los
       fundamentales de aquel dia, que solo estan en su fichero de docs/datos."""
    ruta_previa = WEB / "entradas.json"
    previo = leer(ruta_previa) if ruta_previa.exists() else {}
    reg = {}
    for q in sorted(DATOS.glob("2*.json")):
        f, d = q.stem, leer(q)
        if not d or not d.get("acciones"):
            continue
        spy_f = next((m.get("precio") for m in d.get("mercado", []) if m["ticker"] == "SPY"), None)
        for a in d["acciones"]:
            k = a.get("simbolo") or a["ticker"]
            if k not in reg:
                reg[k] = {"t": a["ticker"], "s": a.get("simbolo"), "f": f, "p": a.get("precio"),
                          "sc": next((x.get("sc") for x in historico.get(f, {}).get("acciones", [])
                                      if x["t"] == a["ticker"]), None),
                          "b": a.get("beta"), "n": a.get("empresa"), "spy": spy_f,
                          # Sector e industria del dia que entro. Sin esto, cualquier pregunta por
                          # sector ("¿las biotecnologicas van peor?", 04/11/2026) hay que responderla
                          # rebuscando en docs/datos, y solo mientras ese dia siga archivado. Son dos
                          # cadenas por accion, una vez en la vida de cada una.
                          "sec": a.get("sector"), "ind": a.get("industria")}
            # Ultima vez que se la vio en el top, y su precio y el del indice ese dia. Sin esto, una
            # accion que salga del top y acabe fuera de la ventana de 90 sesiones DESAPARECERIA del
            # registro, que se quedaria solo con las que siguen dentro: supervivientes. Es un sesgo
            # peor que el re-fechado, porque las que salen del top son justo las que han ido mal.
            reg[k]["ult"] = f
            reg[k]["pult"] = a.get("precio")
            reg[k]["spyult"] = spy_f
    # Fusion: la fecha mas antigua manda, y nunca se pierde una clave ya registrada.
    for k, v in previo.items():
        if k not in reg:
            reg[k] = v
            continue
        if v.get("f") and v["f"] < reg[k]["f"]:         # fecha de entrada: la mas antigua manda
            for c in ("f", "p", "sc", "b", "spy"):
                if v.get(c) is not None:
                    reg[k][c] = v[c]
        if reg[k].get("sc") is None and v.get("sc") is not None and v.get("f") == reg[k]["f"]:
            reg[k]["sc"] = v["sc"]                      # la nota ya calculada no se vuelve a perder
        if v.get("ult") and v["ult"] > (reg[k].get("ult") or ""):   # ultima vista: la mas reciente
            for c, o in (("ult", "ult"), ("pult", "pult"), ("spyult", "spyult")):
                if v.get(o) is not None:
                    reg[k][c] = v[o]
    return reg


def version_de():
    """El hash que rompe la cache del navegador. plantilla.html entra: un cambio solo de textos
       tambien tiene que mover la version (paso el 20/10/2026 al renombrar una subpestana)."""
    estaticos = sorted(f for f in WEB.glob("*.*") if f.suffix in (".js", ".css")) + [R / "plantilla.html"]
    return hashlib.sha256(b"".join(f.read_bytes() for f in estaticos)).hexdigest()[:8]


def publica_html(version):
    """index.html solo cambia cuando cambia la plantilla o el codigo: los datos se cargan aparte.
       La version viaja tambien dentro de panel.json, asi que un index.html viejo en cache se
       detecta al cargar los datos y la web se refresca sola (ver iniciar() en docs/app.js)."""
    html = (R / "plantilla.html").read_text().replace("__VER__", version)
    if not (WEB / "index.html").exists() or (WEB / "index.html").read_text() != html:
        (WEB / "index.html").write_text(html)


def rehacer():
    """Republica la web SIN TOCAR LA RED: cero llamadas a TradingView.

       Hace falta porque el presupuesto de 4 llamadas al dia estaba atado al despliegue: tocar un
       texto o arreglar una pestana disparaba el workflow por push, que escaneaba entero. O gastabas
       llamadas fuera de presupuesto, o esperabas a la noche para ver el arreglo publicado.

       Rehace lo que se deriva de lo ya guardado (el historico, con los campos nuevos rellenados
       tambien hacia atras, y la version que rompe la cache) y conserva tal cual lo que solo se
       puede saber preguntando al mercado: precios, estado actual, mercado, referencia y regimen.
       No toca docs/precios.json: sin cierres nuevos no hay nada que anadir alli."""
    ruta = WEB / "panel.json"
    if not ruta.exists():
        print("No hay docs/panel.json que rehacer: hace falta un build completo primero.")
        return 1
    panel = json.loads(ruta.read_text())
    todos = {q.stem: leer(q) for q in sorted(DATOS.glob("2*.json"))[-DIAS:]}
    if not todos:
        print("No hay dias guardados en docs/datos: nada que rehacer.")
        return 1
    antes = panel.get("version")
    panel["historico"] = construye_historico(todos)
    # El registro permanente se reescribe tambien aqui: --rehacer no toca la red y docs/datos ya
    # tiene todo lo que hace falta, asi que no hay motivo para dejarlo viejo.
    (WEB / "entradas.json").write_text(json.dumps(construye_entradas(panel["historico"]), ensure_ascii=False))
    panel["dias"] = sorted(todos)
    panel["criterios"] = {"precioMin": 2, "capMin": CAP_MIN, "capMax": CAP_MAX, "volumenMin": 300000,
                          "liquidezMin": LIQUIDEZ_MIN, "rsiMin": 55, "crecimientoMin": CRECIMIENTO_MIN,
                          "maxDesdeMaximo": MAX_DESDE_MAXIMO}
    panel["version"] = version_de()
    ruta.write_text(json.dumps(panel, ensure_ascii=False))
    publica_html(panel["version"])
    filas = [a for d in panel["historico"].values() for a in d["acciones"]]
    con_beta = sum(1 for a in filas if a.get("b") is not None)
    print(f"Rehecho sin tocar la red: version {antes} -> {panel['version']} | "
          f"{len(todos)} dias | beta en {con_beta}/{len(filas)} filas | precios y estado de hoy intactos.")
    return 0


def main():
    WEB.mkdir(exist_ok=True)
    DATOS.mkdir(parents=True, exist_ok=True)
    # --rehacer va PRIMERO: republica con lo ya guardado y no mira el reloj ni el mercado para nada,
    # asi que tiene que funcionar tambien con la bolsa abierta (un push de codigo a mediodia).
    if "--rehacer" in sys.argv:
        sys.exit(rehacer())
    hoy = sesion_objetivo(datetime.datetime.utcnow())
    if hoy is None:
        print("El mercado puede estar abierto: el dato de ahora no es el cierre de ninguna sesión. "
              "Nada que guardar.")
        return 0
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
    # Las dos reglas de proteccion. Van AQUI, al elegir el top, y NO en cumple(): cumple() se evalua
    # cada dia sobre lo que ya tienes, y una posicion abierta no puede pasar a "ya no cumple" solo
    # porque se acerquen sus resultados. Esto filtra a QUIEN ENTRA, como la exclusion de sectores.
    mercado = filas(scan({"columns": list(C), "symbols": {"tickers": ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:IWM"]}}))
    ref = referencia()
    _serie_prot, _ = serie_archivada()
    _spy_prot = serie_spy()
    _spy_hoy = next((m.get("cambio") for m in mercado if m.get("ticker") == "SPY"), None)
    proteccion = {}
    for a in candidatas:
        if catalizador_cerca(a, hoy):
            proteccion[a["ticker"]] = "catalizador"
        elif cayo_fuerte(a, _serie_prot, _spy_prot, hoy, _spy_hoy):
            proteccion[a["ticker"]] = "caida"
    if proteccion:
        print("Proteccion: fuera del top -> " +
              ", ".join(f"{t} ({m})" for t, m in sorted(proteccion.items())))
    # candidatas SIGUE siendo "las que cumplen los nueve requisitos". Las apartadas por proteccion
    # los cumplen igual: lo que se les impide es ENTRAR HOY. Mezclar las dos cosas rompia dos
    # numeros que ya estaban bien:
    #   - la cabecera de Hoy dice "N cumplian los requisitos de M analizadas", y habria dejado de
    #     contar a las protegidas, que si los cumplen;
    #   - comprueba() aborta el build si hay menos de 3 candidatas para detectar que el filtro o la
    #     fuente se han roto, y la proteccion habria podido disparar esa alarma sin que nada
    #     estuviese roto.
    # Asi que la lista filtrada lleva otro nombre y se usa SOLO para elegir el top.
    elegibles = [a for a in candidatas if a["ticker"] not in proteccion]
    spy = next((m for m in mercado if m["ticker"] == "SPY"), {})
    ctx = {"fecha": hoy, "spy": {"tres": spy.get("tres"), "seis": spy.get("seis")}, "sectores": ref["sectores"]}
    # Se puntuan TODAS, tambien las protegidas: su nota va al grupo de control y es lo que permitira
    # medir en primavera si la regla aparto a buenas o a malas.
    puntos = puntuar(candidatas, ctx)
    nota = lambda a: (puntos.get(a["ticker"]) or {}).get("total") or 0
    # A igualdad de puntuacion, primero la de menor capitalizacion: mas recorrido para multiplicar.
    acciones = sorted(elegibles, key=lambda a: (-nota(a), a.get("cap") or 0))[:GUARDAR]
    # Cumplen todos los requisitos pero estan muy extendidas: no son entrada temprana, van aparte.
    elegidas = {a["ticker"] for a in acciones}
    en_marcha = sorted([a for a in elegibles if a["ticker"] not in elegidas
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
             "universo": len(universo), "candidatas": len(candidatas),
             # Las apartadas por la proteccion van TAMBIEN al control, con su motivo: si se cayeran
             # del registro no se podria medir nunca lo que la regla cuesta.
             "control": control(candidatas, elegidas, puntos, proteccion),
             "reglas": CAMBIO_REGLAS},
            ensure_ascii=False))
    todos = {p.stem: leer(p) for p in sorted(DATOS.glob("2*.json"))[-DIAS:]}
    historico = construye_historico(todos)
    # Primera aparicion de cada accion, fuera de la ventana de DIAS: ver construye_entradas().
    (WEB / "entradas.json").write_text(json.dumps(construye_entradas(historico), ensure_ascii=False))
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
    # EL ARCHIVO MANDA, NO precios.json.
    # precios.json se recorta a DIAS=90 porque se descarga en el navegador. Hasta el 02/11/2026 era
    # tambien la UNICA copia de esos cierres, asi que el dia que la ventana empezase a cortar (hacia
    # el 19/01/2027) la serie diaria de las acciones antiguas desapareceria PARA SIEMPRE. Y es justo
    # la que hace falta para la unica cosa que de verdad queremos hacer en primavera: volver a correr
    # las reglas de salida sobre las entradas viejas y ver cual funciona mejor.
    # No se podia reconstruir de ningun sitio: docs/datos solo guardaba el top del dia y las
    # candidatas del control, y 23 de las 42 seguidas (COHU, IOVA, ZETA, PAYS, XMTR...) no estan en
    # ninguno de los dos porque ya no cumplen los requisitos.
    # Ahora cada cierre se archiva en docs/datos, que NO se recorta nunca y NO se sirve a nadie, y
    # precios.json pasa a ser una vista derivada y recortada de ese archivo. Cuesta ~1 KB al dia.

    if acciones is not None:
        ruta_hoy = DATOS / f"{hoy}.json"
        if ruta_hoy.exists():
            d_hoy = leer(ruta_hoy)
            d_hoy["seguidas"] = {s: [redondea(v), redondea((actual.get(s) or {}).get("ema50"))]
                                 for s, v in precios.items()}
            ruta_hoy.write_text(json.dumps(d_hoy, ensure_ascii=False))

    historicos_precios, emas_archivo = serie_archivada()
    fp = WEB / "precios.json"
    # Transicion: lo que ya estaba en precios.json y todavia no esta archivado no se pierde.
    if fp.exists():
        try:
            viejo = json.loads(fp.read_text())
            for f, v in (viejo.get("dias") or {}).items():
                historicos_precios.setdefault(f, v)
            for f, v in (viejo.get("emas") or {}).items():
                emas_archivo.setdefault(f, v)
        except Exception:
            pass
    # Junto al cierre se guarda la EMA 50 del dia. Motivo: el trinquete del stop ("el stop nunca
    # baja") solo subia los dias en que el usuario abria la app, porque se calculaba con el dato de
    # ese momento y se guardaba en su navegador. Si no mirabas en una semana, los escalones de esos
    # dias se perdian y tu stop quedaba MAS BAJO de lo que la tabla 5 promete: arriesgabas mas de lo
    # que el sistema decia. Con la EMA 50 diaria el trinquete se reconstruye entero desde la serie y
    # deja de depender de un habito. El dato ya se descarga (esta en CAMPOS_SEGUIMIENTO): solo se
    # guardaba. Cuesta unos 8 KB mas en un fichero que solo se descarga en dos pestañas.
    historicas_emas = emas_archivo
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
    version = version_de()
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
    publica_html(version)
    print(hoy, "universo:", len(universo), "candidatas:", len(candidatas),
          "guardadas:", "-" if acciones is None else len(acciones),
          "ya en marcha:", len(en_marcha), "vigiladas:", len(actual), "+", len(extra), "en extra.json")


if __name__ == "__main__":
    main()
