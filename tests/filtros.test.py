"""Pruebas de los filtros del proceso diario: python3 tests/filtros.test.py"""

import importlib.util, pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("b", R / "build.py")
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)

fallos = total = 0
def comprueba(nombre, real, esperado):
    global fallos, total
    total += 1
    if real == esperado: print(f"  ✓ {nombre}")
    else:
        fallos += 1
        print(f"  ✗ {nombre}\n      esperado: {esperado}\n      obtenido: {real}")

sana = {"ticker": "OK", "precio": 50, "cap": 2e9, "volmedio": 1e6, "ingresos": 40, "ingresosq": 45,
        "max52": 52, "sector": "Technology Services", "industria": "Packaged Software"}
def con(**kw): return {**sana, **kw}

print("\nREQUISITOS DE ENTRADA")
comprueba("una empresa que cumple todo pasa", b.cumple(sana), True)
comprueba("sin crecimiento no pasa", b.cumple(con(ingresos=5, ingresosq=5)), False)
comprueba("basta con que crezca el trimestre", b.cumple(con(ingresos=5, ingresosq=30)), True)
comprueba("si está a -30 % de su máximo no pasa", b.cumple(con(precio=36)), False)
comprueba("justo en el límite del 20 % pasa", b.cumple(con(precio=52 * 0.8)), True)
comprueba("sin dato de máximo no pasa", b.cumple(con(max52=None)), False)
comprueba("con poca liquidez en dólares no pasa", b.cumple(con(precio=2.5, volmedio=400000, max52=2.6)), False)
comprueba("sin dato de crecimiento no pasa", b.cumple(con(ingresos=None, ingresosq=None)), False)

print("\nSECTORES EXCLUIDOS")
comprueba("una naviera queda fuera", b.excluida(con(industria="Marine Shipping")), True)
comprueba("una petrolera queda fuera", b.excluida(con(sector="Energy Minerals")), True)
comprueba("un REIT queda fuera", b.excluida(con(industria="Real Estate Investment Trusts")), True)
comprueba("una gestora de fondos queda fuera", b.excluida(con(industria="Investment Managers")), True)
comprueba("una empresa de software entra", b.excluida(sana), False)
comprueba("una biotecnológica entra", b.excluida(con(sector="Health Technology", industria="Biotechnology")), False)

# 16/10/2026: se encontro un dia fantasma guardado, el domingo 2026-10-04, con el SPY identico al
# del viernes anterior (769,64): el escaneo devolvio los cierres del viernes con fecha de domingo.
# Era de antes de que existiera sin_cierre_nuevo(). Cuenta como sesion y adelanta la madurez de las
# entradas en la pestaña Resultados, que es justo la medicion que hay que hacer en noviembre.
# Estas tres comprobaciones impiden que vuelva a entrar ninguno sin que nadie se entere.
print("\nNINGUN DIA FANTASMA ENTRE LOS DATOS GUARDADOS")
import datetime as _dt
_datos = sorted(b.DATOS.glob("2*.json"))
_fines = [f.stem for f in _datos if _dt.date.fromisoformat(f.stem).weekday() >= 5]
comprueba("ningun fichero de datos cae en fin de semana", _fines, [])
_fechas = [f.stem for f in _datos]
comprueba("no hay fechas duplicadas", len(_fechas), len(set(_fechas)))

def _spy_de(f):
    import json
    d = json.loads(f.read_text())
    return next((m.get("precio") for m in d.get("mercado", []) if m.get("ticker") == "SPY"), None)

_repes = []
for _i in range(1, len(_datos)):
    _a, _b = _spy_de(_datos[_i - 1]), _spy_de(_datos[_i])
    if _a is not None and _a == _b:
        _repes.append(f"{_datos[_i-1].stem} y {_datos[_i].stem} comparten el SPY ({_a})")
comprueba("ningun par de dias consecutivos comparte el precio del SPY", _repes, [])

_vacios = []
for _f in _datos:
    import json
    _d = json.loads(_f.read_text())
    if not _d.get("acciones"):
        _vacios.append(_f.stem)
comprueba("ningun dia guardado esta vacio", _vacios, [])

# 17/10/2026: los dias 1 y 2 de octubre se guardaron con referencia.sectores VACIA. Sin medianas de
# sector no hay fuerza relativa, asi que puntuo 0 todo el mundo y el desempate de main() —"a igualdad,
# la de menor capitalizacion"— eligio el top entero: esos dos dias el panel enseno las 10 mas pequenas
# en vez de las mejores. De ahi salieron 10 tickers (YDES, BAND, QMCO, XRPN, SVIA, ELMT, AXTI, FWDI,
# ABSI, SHMD) que el sistema nunca eligio y que contaban como entradas en Resultados.
# La guarda de comprueba() que lo impide se anadio el 4 de octubre, despues. Esto lo caza en los datos
# ya guardados, que es lo que aquella no mira.
print("\nNINGUN DIA GUARDADO SIN PUNTUACION")
_sin_ref, _sin_sc = [], []
for _f in sorted(b.DATOS.glob("2*.json")):
    import json
    _d = json.loads(_f.read_text())
    _sect = len((_d.get("referencia") or {}).get("sectores", {}))
    if _sect < 5:
        _sin_ref.append(f"{_f.stem} tiene {_sect} sectores en referencia")
comprueba("todos los dias traen medianas de sector (si no, nadie puntua)", _sin_ref, [])

_panel = json.loads((b.WEB / "panel.json").read_text())
for _f, _h in _panel.get("historico", {}).items():
    _acc = _h.get("acciones") or []
    if _acc and all(a.get("sc") is None for a in _acc):
        _sin_sc.append(f"{_f}: las {len(_acc)} sin puntuacion")
comprueba("ningun dia del historico esta entero sin puntuacion", _sin_sc, [])

comprueba("los dias de panel.json son exactamente los ficheros guardados",
          sorted(_panel["dias"]), sorted(f.stem for f in b.DATOS.glob("2*.json")))

# 20/10/2026: la version se calculaba solo con js y css, asi que renombrar una pestaña en
# plantilla.html no la movia y la recarga automatica no saltaba.
print("\nLA VERSION CUBRE TAMBIEN LA PLANTILLA")
_src = (b.R / "build.py").read_text()
comprueba("plantilla.html entra en el hash de version",
          'estaticos = sorted(f for f in WEB.glob("*.*") if f.suffix in (".js", ".css")) + [R / "plantilla.html"]' in _src, True)

# 22/10/2026: el 21 no se publico porque humo.test.js fallo y bloqueaba el build. Un fallo de red
# habria hecho lo mismo. Estas comprobaciones atan las dos defensas.
print("\nEL PANEL NO SE QUEDA SIN PUBLICAR POR UN FALLO AJENO")
_wf = (b.R / ".github" / "workflows" / "panel.yml").read_text()
comprueba("el test de humo no bloquea la publicacion diaria",
          "continue-on-error: ${{ github.event_name == 'schedule' }}" in _wf, True)
comprueba("pero el trabajo acaba en rojo para que llegue el aviso",
          "steps.humo.outcome == 'failure'" in _wf, True)
comprueba("y las pruebas de logica pura SI bloquean",
          "node tests/reglas.test.js" in _wf.split("Humo sobre los datos")[0], True)
comprueba("el escaneo reintenta ante un fallo de red", b.scan.__defaults__, (3,))
comprueba("hay tres intentos al dia: el principal y dos repescas", _wf.count("- cron:"), 3)
comprueba("las repescas usan --solo-si-falta", "--solo-si-falta" in _wf, True)
comprueba("y la repesca sale sin escanear si el cierre de hoy ya esta",
          hasattr(b, "ya_esta_hecho"), True)
# El print final usaba 'extra', que solo se asigna en una rama: sin cierre nuevo (festivo, o lanzado
# antes del cierre) el script reventaba DESPUES de escribir panel.json y salia con error, asi que el
# Action no publicaba. Se comprueba que la variable esta inicializada en las dos ramas.
_src_b = (b.R / "build.py").read_text()
comprueba("'extra' esta inicializada tambien cuando no hay cierre nuevo",
          "extra = {}" in _src_b.split("else:\n        antiguos_seguidos")[0], True)
# Se recorre el camino del reintento de verdad: la primera version usaba time.sleep sin importar
# time, asi que habria reventado con NameError justo cuando hiciera falta.
import urllib.request as _ur, time as _t
_n = [0]; _origU, _origS = _ur.urlopen, _t.sleep
def _falla(*a, **k):
    _n[0] += 1
    raise OSError("red caida simulada")
_ur.urlopen, _t.sleep = _falla, lambda s: None
try:
    b.scan({"columns": ["name"], "range": [0, 1]}, intentos=3)
    _err = "no lanzo excepcion"
except OSError:
    _err = None
except Exception as _e:
    _err = f"{type(_e).__name__}: {_e}"
finally:
    _ur.urlopen, _t.sleep = _origU, _origS
comprueba("y el camino del reintento se ejecuta sin romperse", _err, None)
comprueba("reintenta las 3 veces antes de rendirse", _n[0], 3)

# 22/10/2026: la sesion del 21 se perdio porque el build no corrio, y precios.json —que es lo que
# hace posible simular stops en la pestaña Resultados— quedo con un hueco. Se recupero de nasdaq.com
# (verificado: los 29 cierres del 20 coinciden al centimo con los que ya habia). Esto detecta el
# proximo hueco en vez de que pase inadvertido.
print("\nLA SERIE DIARIA DE CIERRES NO TIENE HUECOS")
import datetime as _d2, json as _j2
_pr = _j2.loads((b.WEB / "precios.json").read_text())["dias"]
_f = sorted(_pr)
_huecos = []
for _i in range(1, len(_f)):
    _a = _d2.date.fromisoformat(_f[_i - 1]); _b2 = _d2.date.fromisoformat(_f[_i])
    _t = _a + _d2.timedelta(days=1)
    while _t < _b2:
        if _t.weekday() < 5: _huecos.append(_t.isoformat())
        _t += _d2.timedelta(days=1)
comprueba("ningun dia de mercado falta en precios.json", _huecos, [])
comprueba("las fechas van en orden", _f, sorted(_f))
comprueba("ningun dia de la serie esta vacio", [x for x in _f if not _pr[x]], [])
_fds = [x for x in _f if _d2.date.fromisoformat(x).weekday() >= 5]
comprueba("ni cae en fin de semana", _fds, [])

print("\nCOHERENCIA DE UMBRALES")
comprueba("el suelo de capitalización del escáner coincide con el documentado",
          [f["right"] for f in b.FILTROS if f["left"] == "market_cap_basic"], [b.CAP_MIN])
# 14/10/2026: se quito el techo de 10 B. Si alguien vuelve a meter un limite superior por arriba,
# estas dos pruebas lo cazan: dejarian de verse PLTR, SHOP o LLY sin que nadie lo hubiera decidido.
comprueba("no hay techo de capitalización", b.CAP_MAX, None)
comprueba("el filtro de capitalización no acota por arriba",
          [f["operation"] for f in b.FILTROS if f["left"] == "market_cap_basic"], ["greater"])
def acepta_cap(valor):
    """Evalua los filtros de capitalizacion del escaner contra un valor concreto."""
    for f in b.FILTROS:
        if f["left"] != "market_cap_basic":
            continue
        if f["operation"] == "greater" and not valor > f["right"]:
            return False
        if f["operation"] == "in_range" and not (f["right"][0] <= valor <= f["right"][1]):
            return False
    return True

comprueba("el escáner acepta una megacap (PLTR, 484 B)", acepta_cap(484e9), True)
comprueba("el escáner acepta una grande (HALO, 13 B)", acepta_cap(13e9), True)
comprueba("el escáner sigue rechazando por debajo del suelo", acepta_cap(100e6), False)
comprueba("el RSI mínimo del escáner coincide con el documentado",
          [f["right"] for f in b.FILTROS if f["left"] == "RSI"], [55])
comprueba("se guardan 10 al día", b.GUARDAR, 10)
comprueba("el seguimiento con datos frescos llega a 90 días", b.SEGUIR_EXTRA, 90)

print("\nEL BLINDAJE SALTA CON DATOS MALOS")
def falla(fn):
    try: fn(); return False
    except SystemExit: return True
mercado_ok = [{"ticker": "SPY", "precio": 500, "sma200": 450}]
ref_ok = {"sectores": {f"s{i}": {} for i in range(6)}}
comprueba("universo diminuto: no publica", falla(lambda: b.comprueba(list(range(10)), [sana] * 5, [sana], mercado_ok, ref_ok)), True)
comprueba("sin candidatas: no publica", falla(lambda: b.comprueba(list(range(200)), [], [], mercado_ok, ref_ok)), True)
comprueba("una acción sin precio: no publica", falla(lambda: b.comprueba(list(range(200)), [sana] * 5, [con(precio=None)], mercado_ok, ref_ok)), True)
comprueba("sin datos del S&P: no publica", falla(lambda: b.comprueba(list(range(200)), [sana] * 5, [], [], ref_ok)), True)
comprueba("con todo correcto sí publica",
          falla(lambda: b.comprueba(list(range(200)), [sana] * 5, [con(sma200=40, ema50=45)], mercado_ok, ref_ok)), False)

import datetime as _dt

print("\nSOLO SE GUARDA UN DIA SI SU CIERRE YA EXISTE")
# Han colado tres dias fantasma: un domingo, un martes por la manana y uno con los mismos precios
# pero distinta composicion del top. Cada uno cuenta como sesion y duplica entradas en Resultados.
_noche = _dt.datetime(2026, 10, 7, 21, 40)
_mañana = _dt.datetime(2026, 10, 7, 8, 24)
_top = [{"ticker": t, "precio": p} for t, p in
        [("PAYS", 14.36), ("CDNA", 63.79), ("COHU", 73.1), ("FEIM", 87.13), ("BLFS", 38.61)]]
_otro = [{"ticker": t, "precio": p} for t, p in
         [("PAYS", 14.50), ("CDNA", 64.00), ("COHU", 73.5), ("FEIM", 88.0), ("BLFS", 39.0)]]
# el caso real del 7 de octubre: mismos precios, pero sale BLFS y entra IOVA
_recompuesto = _top[:4] + [{"ticker": "IOVA", "precio": 12.96}]

comprueba("un martes despues del cierre si se guarda",
          b.sin_cierre_nuevo("2026-10-07", _noche, _otro, _top), None)
comprueba("un martes por la manana no: el cierre de hoy aun no existe",
          b.sin_cierre_nuevo("2026-10-07", _mañana, _otro, _top) is not None, True)
comprueba("un domingo no, aunque sea de noche",
          b.sin_cierre_nuevo("2026-10-04", _noche, _otro, _top) is not None, True)
comprueba("un sabado tampoco",
          b.sin_cierre_nuevo("2026-10-03", _noche, _otro, _top) is not None, True)
comprueba("mismos precios que ayer (festivo): no se guarda",
          b.sin_cierre_nuevo("2026-10-07", _noche, _top, _top) is not None, True)
comprueba("mismos precios pero otra composicion del top: tampoco",
          b.sin_cierre_nuevo("2026-10-07", _noche, _top, _recompuesto) is not None, True)
comprueba("el primer dia de todos si se guarda (no hay anterior)",
          b.sin_cierre_nuevo("2026-10-07", _noche, None, _top), None)
# 17/10/2026: el agujero de la comprobacion de festivo era que necesita 3 tickers en comun con el dia
# anterior. El domingo fantasma del 4 de octubre no compartia NINGUNO, asi que no podia dispararse.
# El SPY siempre esta y no depende de la composicion del top: es la prueba limpia.
# El caso real del domingo 4: el top no compartia NINGUN ticker con el dia anterior, asi que la
# comparacion precio a precio no tenia nada que comparar y no podia dispararse.
_sin_comunes = [{"ticker": "ZZZ" + str(i), "precio": 10.0 + i} for i in range(9)]
comprueba("festivo cazado por el SPY aunque el top no comparta ni un ticker",
          b.sin_cierre_nuevo("2026-10-07", _noche, _sin_comunes, _top, 769.64, 769.64) is not None, True)
comprueba("y con el codigo anterior ese caso se colaba: sin tickers comunes no habia nada que comparar",
          b.sin_cierre_nuevo("2026-10-07", _noche, _sin_comunes, _top), None)
comprueba("con el SPY distinto, el dia si se guarda",
          b.sin_cierre_nuevo("2026-10-07", _noche, _otro, _top, 771.79, 769.64), None)
comprueba("sin dato del SPY se sigue cayendo a la comparacion ticker a ticker",
          b.sin_cierre_nuevo("2026-10-07", _noche, _top, _top, None, None) is not None, True)
comprueba("un SPY de hoy sin el de ayer no bloquea nada",
          b.sin_cierre_nuevo("2026-10-07", _noche, _otro, _top, 771.79, None), None)
comprueba("el motivo dice el precio, para poder comprobarlo",
          "769.64" in b.sin_cierre_nuevo("2026-10-07", _noche, _sin_comunes, _top, 769.64, 769.64), True)
# El SPY puede cerrar igual dos dias seguidos por azar. Si alguna accion SI se movio, hubo sesion.
_movido = [dict(a, precio=a["precio"] * 1.01) for a in _top]
comprueba("si el SPY coincide por azar pero las acciones se han movido, el dia SI se guarda",
          b.sin_cierre_nuevo("2026-10-07", _noche, _top, _movido, 769.64, 769.64), None)
comprueba("y si ni el SPY ni las acciones se mueven, no se guarda",
          b.sin_cierre_nuevo("2026-10-07", _noche, _top, _top, 769.64, 769.64) is not None, True)

comprueba("si no hay acciones que guardar, no se inventa un motivo",
          b.sin_cierre_nuevo("2026-10-07", _mañana, _otro, None), None)

print("\nNINGUNA ACCION DEL TOP SE QUEDA SIN DATOS DE HOY")
# El 7 de octubre BLFS estaba en el top y el escaneo de seguimiento no la devolvio: desaparecio del
# seguimiento y del registro de Resultados sin que nada avisara.
_top = [{"simbolo": "NASDAQ:BLFS", "ticker": "BLFS", "precio": 38.61, "rsi": 61.0, "cap": 1.89e9},
        {"simbolo": "NASDAQ:PAYS", "ticker": "PAYS", "precio": 14.36, "rsi": 63.0, "cap": 8.1e8}]
_escaneo = {"NASDAQ:PAYS": {"ticker": "PAYS", "precio": 14.36}}
_r = b.con_respaldo(_escaneo, _top)
comprueba("la que falta en el escaneo se rellena con los datos del top",
          "NASDAQ:BLFS" in _r, True)
comprueba("y con su precio correcto", _r["NASDAQ:BLFS"]["precio"], 38.61)
comprueba("la que si vino no se toca", _r["NASDAQ:PAYS"], {"ticker": "PAYS", "precio": 14.36})
comprueba("sin top que respaldar no se inventa nada", b.con_respaldo(_escaneo, []), _escaneo)
comprueba("solo se copian los campos del seguimiento",
          all(k in b.CAMPOS_SEGUIMIENTO for k in _r["NASDAQ:BLFS"]), True)

print("\nSIN CIERRE NUEVO NO SE PUBLICA NADA DE MEDIA SESION")
# El 7 de octubre a las 15:18 UTC, con la bolsa abierta, un push regeneró panel.json con precios de
# media sesion: Seguimiento decia "ZETA, COMPRA" y Hoy decia "PAYS, COMPRA" el mismo dia. Todo el
# sistema esta definido sobre cierres diarios; un precio intradia no puede entrar.
_fuente = open(R / "build.py").read()
comprueba("el escaneo de seguimiento solo corre si hay cierre nuevo",
          "if motivo and anterior.get(\"actual\"):" in _fuente, True)
comprueba("sin cierre nuevo se reutiliza el 'actual' del ultimo cierre",
          'actual, precios = anterior["actual"], anterior.get("precios", {})' in _fuente, True)
comprueba("la fecha de actualizacion tampoco se toca",
          'actualizado = anterior.get("actualizado")' in _fuente, True)
comprueba("ni el regimen de mercado",
          'anterior.get("regimen") if (motivo and anterior.get("regimen"))' in _fuente, True)


# ─── EL REGISTRO PERMANENTE NUNCA PIERDE NI MUEVE UNA ENTRADA ────────────────────────────────────
# docs/entradas.json existe porque panel.json solo lleva 90 sesiones: cuando la ventana empiece a
# recortar (hacia el 19/01/2027), sin este fichero cada entrada antigua se re-fecharia sola y las
# que salieron del top desaparecerian del registro, dejando solo supervivientes.
#
# Se recalcula entero desde docs/datos en cada build Y se fusiona con lo ya guardado. La fusion es
# la red de seguridad, y lo que garantiza es UNA cosa: el registro solo puede mejorar. Nunca mueve
# una entrada hacia adelante ni pierde una clave. Eso es lo que se prueba aqui, porque es lo que
# hace que el fichero sea de fiar aunque algun dia falte un dato o se cambie el codigo de arriba.
print("\nEL REGISTRO PERMANENTE SOLO PUEDE MEJORAR")
import json as _json, tempfile as _tmp, pathlib as _pl

_real = b.WEB / "entradas.json"
_guardado = _real.read_text() if _real.exists() else None
try:
    _hist = _json.loads((b.WEB / "panel.json").read_text())["historico"]

    def _construye(previo):
        """construye_entradas() partiendo del fichero que se le diga."""
        if previo is None:
            if _real.exists(): _real.unlink()
        else:
            _real.write_text(_json.dumps(previo, ensure_ascii=False))
        return b.construye_entradas(_hist)

    _limpio = _construye(None)
    comprueba("sin fichero previo, se reconstruye entero desde docs/datos", len(_limpio) > 0, True)
    # La nota del dia de entrada: es lo unico del registro que NO se puede recalcular mas tarde, porque
    # necesita los fundamentales de aquel dia. Si el recalculo la deja a None, la pregunta de noviembre
    # "¿sirve de algo la puntuacion?" se queda sin datos y no hay forma de recuperarla.
    comprueba("el recálculo guarda la puntuación del día de entrada",
              sum(1 for v in _limpio.values() if v.get("sc") is not None) == len(_limpio), True)
    comprueba("y el precio y el índice de aquel día",
              all(v.get("p") is not None and v.get("spy") is not None for v in _limpio.values()), True)

    _k = next(k for k, v in _limpio.items() if v["t"] == "FIGS")

    # 1 · una fecha mas antigua ya guardada MANDA, aunque docs/datos diga otra cosa.
    _viejo = {**_limpio, _k: {**_limpio[_k], "f": "2020-01-02", "p": 1.23, "sc": 11, "spy": 300}}
    _r = _construye(_viejo)
    comprueba("una fecha de entrada más antigua ya guardada no se pierde", _r[_k]["f"], "2020-01-02")
    comprueba("y arrastra su precio de entrada", _r[_k]["p"], 1.23)
    comprueba("y su puntuación de entrada", _r[_k]["sc"], 11)
    comprueba("y el índice de aquel día", _r[_k]["spy"], 300)

    # 2 · una fecha mas RECIENTE guardada por error NO mueve la entrada hacia adelante.
    _r = _construye({**_limpio, _k: {**_limpio[_k], "f": "2099-12-31", "p": 999.0}})
    comprueba("una fecha más reciente NO mueve la entrada hacia adelante", _r[_k]["f"], _limpio[_k]["f"])
    comprueba("ni le cambia el precio de entrada", _r[_k]["p"], _limpio[_k]["p"])

    # 3 · una clave que ya no tiene respaldo en docs/datos sobrevive: es el caso que de verdad
    #     protege el fichero, porque es el unico en que la informacion ya no esta en ningun otro
    #     sitio. Si se perdiese, el registro se quedaria con supervivientes y la media subiria sola.
    _f = {"t": "FANTASMA", "s": "NASDAQ:FANTASMA", "f": "2020-02-03", "p": 10.0,
          "sc": 70, "b": 1.0, "n": "Fantasma", "spy": 300, "ult": "2020-03-04", "pult": 7.0, "spyult": 310}
    _r = _construye({**_limpio, "NASDAQ:FANTASMA": _f})
    comprueba("una entrada sin respaldo en docs/datos sobrevive", _r.get("NASDAQ:FANTASMA"), _f)
    comprueba("y no se inventa ninguna otra", len(_r), len(_limpio) + 1)

    # 4 · la ultima vez que se la vio solo puede avanzar, nunca retroceder.
    _r = _construye({**_limpio, _k: {**_limpio[_k], "ult": "2020-01-01", "pult": 1.0}})
    comprueba("una última vista más antigua no retrasa la del fichero", _r[_k]["ult"], _limpio[_k]["ult"])
    _r = _construye({**_limpio, _k: {**_limpio[_k], "ult": "2099-12-31", "pult": 55.0}})
    comprueba("una última vista más reciente sí se conserva", (_r[_k]["ult"], _r[_k]["pult"]), ("2099-12-31", 55.0))

    # 5 · la primera aparicion del recalculo es la PRIMERA, no la ultima.
    _prim = {}
    for _d in sorted(_hist):
        for _a in _hist[_d]["acciones"]:
            _prim.setdefault(_a.get("s") or _a["t"], _d)
    comprueba("el recálculo guarda la primera aparición de cada acción",
              all(_limpio[kk]["f"] == vv for kk, vv in _prim.items() if kk in _limpio), True)
    comprueba("y la última vista es la última, no la primera",
              all(_limpio[kk]["ult"] >= _limpio[kk]["f"] for kk in _limpio), True)
    comprueba("alguna acción ha estado más de un día (si no, la comprobación de arriba es vacía)",
              any(_limpio[kk]["ult"] > _limpio[kk]["f"] for kk in _limpio), True)
finally:
    if _guardado is not None: _real.write_text(_guardado)
    elif _real.exists(): _real.unlink()


# ─── EL GRUPO DE CONTROL ─────────────────────────────────────────────────────────────────────────
# Cada dia pasan los 9 requisitos del orden de 110 acciones y el panel se queda con 10. Las otras
# ~100 se tiraban, y sin ellas no hay forma de responder a si la NOTA aporta algo o lo que funciona
# son los requisitos: medido solo contra el top no se puede saber, porque el top es el grupo elegido.
# No cuesta ni una llamada mas (vienen en el mismo scan). Lo que se prueba aqui es que guarda
# exactamente las NO elegidas y que no se cuela en el registro de entradas.
print("\nGRUPO DE CONTROL")
_cand = [{"ticker": "AAA", "simbolo": "NY:AAA", "precio": 10.0},
         {"ticker": "BBB", "simbolo": "NY:BBB", "precio": 20.0},
         {"ticker": "CCC", "simbolo": "NY:CCC", "precio": 30.0}]
_ctl = b.control(_cand, {"AAA"}, {"BBB": {"total": 77}, "CCC": {}})
comprueba("guarda solo las candidatas que el panel NO eligió", [x["t"] for x in _ctl], ["BBB", "CCC"])
comprueba("con su cierre, para poder medirlas", [x["p"] for x in _ctl], [20.0, 30.0])
comprueba("y su nota cuando la hay", [x["sc"] for x in _ctl], [77, None])
comprueba("no guarda la fila entera, solo 4 campos", sorted(_ctl[0]), ["p", "s", "sc", "t"])
comprueba("si el panel elige todas, el control queda vacío",
          b.control(_cand, {"AAA", "BBB", "CCC"}, {}), [])

# El control NO puede entrar en el registro de entradas: son acciones que el panel no recomendo, y
# contarlas como entradas inflaria el registro con operaciones que nunca existieron.
_tmp = {"2026-01-05": {"acciones": [{"ticker": "TOP", "simbolo": "NY:TOP", "precio": 5.0}],
                       "control": [{"t": "CTL", "s": "NY:CTL", "p": 9.0, "sc": 90}],
                       "mercado": [{"ticker": "SPY", "precio": 500}]}}
_dir = b.DATOS
_salvados = sorted(_dir.glob("2*.json"))
import shutil as _sh, tempfile as _tf, os as _os
_box = _tf.mkdtemp()
try:
    for _f in _salvados: _sh.move(str(_f), _box)
    (_dir / "2026-01-05.json").write_text(_json.dumps(_tmp["2026-01-05"], ensure_ascii=False))
    if _real.exists(): _real.unlink()
    _reg = b.construye_entradas({"2026-01-05": {"acciones": [{"t": "TOP", "sc": 80}], "spy": 500}})
    comprueba("una acción del grupo de control no entra en el registro",
              sorted(v["t"] for v in _reg.values()), ["TOP"])
finally:
    (_dir / "2026-01-05.json").unlink(missing_ok=True)
    for _f in sorted(_pl.Path(_box).glob("2*.json")): _sh.move(str(_f), str(_dir))
    _os.rmdir(_box)
    if _guardado is not None: _real.write_text(_guardado)
    elif _real.exists(): _real.unlink()

print(f"\n{total - fallos} de {total} comprobaciones correctas")
sys.exit(1 if fallos else 0)
