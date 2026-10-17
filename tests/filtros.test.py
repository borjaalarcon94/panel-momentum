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

print(f"\n{total - fallos} de {total} comprobaciones correctas")
sys.exit(1 if fallos else 0)
