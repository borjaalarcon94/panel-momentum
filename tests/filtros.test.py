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
# El martes fantasma del 07/10/2026 (dos commits, 08:24 y 08:40) lo causaba ETIQUETAR MAL EL DIA:
# a las 08:24 se pedia "el cierre de hoy", TradingView devolvia el del lunes y se guardaba como
# martes. El guardia de la hora lo tapaba, pero de paso inutilizaba las repescas: la de las 07:00
# nunca pudo recuperar un cierre perdido, y por eso se perdio el del 03/11/2026.
# Ahora la hora no decide nada: decide sesion_objetivo(), y a las 08:24 de un martes pide el LUNES,
# que es el cierre que de verdad tiene. Eso es lo que se comprueba.
comprueba("a las 08:24 de un martes se pide el lunes, no el martes",
          b.sesion_objetivo(_mañana), "2026-10-06")
# CON EL MERCADO ABIERTO no hay cierre de nadie: TradingView devuelve el precio de AHORA, que no es
# el cierre de hoy (no ha pasado) ni el de ayer (ya no se puede pedir). Guardarlo seria poner un
# precio intradia con la etiqueta de ayer: un dia CORROMPIDO, peor que un dia que falta. El guardia
# viejo de la hora tapaba esto; al quitarlo para que las repescas funcionasen, abri ese agujero y
# hubo que ponerle un guardia propio.
comprueba("con el mercado abierto no se pide ninguna sesión",
          [h for h in range(b.APERTURA_UTC, b.CIERRE_UTC)
           if b.sesion_objetivo(_dt.datetime(2026, 11, 4, h, 0)) is not None], [])
comprueba("antes de que abra (madrugada y mañana) sí, y es el día anterior",
          [h for h in range(0, b.APERTURA_UTC)
           if b.sesion_objetivo(_dt.datetime(2026, 11, 4, h, 0)) != "2026-11-03"], [])
comprueba("y después del cierre, el de hoy",
          [h for h in range(b.CIERRE_UTC, 24)
           if b.sesion_objetivo(_dt.datetime(2026, 11, 4, h, 0)) != "2026-11-04"], [])
comprueba("main() se planta si no hay sesión que pedir",
          "if hoy is None:" in (R / "build.py").read_text(), True)
# Las dos de arriba siguen a APERTURA_UTC, asi que pasarian con la constante puesta en cualquier
# sitio. Estas son ABSOLUTAS: la bolsa de Nueva York opera de 14:30 a 21:00 UTC en invierno y de
# 13:30 a 20:30 en verano, asi que a estas horas NUNCA puede haber un cierre que guardar.
comprueba("a las horas en que Nueva York opera de verdad no se pide nada",
          [h for h in (14, 15, 16, 17, 18, 19, 20)
           if b.sesion_objetivo(_dt.datetime(2026, 11, 4, h, 0)) is not None], [])
comprueba("y el horario de verano también queda cubierto (abre a las 13:30 UTC)",
          b.sesion_objetivo(_dt.datetime(2026, 7, 8, 13, 0)) is None
          and b.sesion_objetivo(_dt.datetime(2026, 7, 8, 20, 0)) is None, True)
# --rehacer no mira ni el reloj ni el mercado: republica lo ya guardado. Tiene que seguir
# funcionando con la bolsa abierta, que es cuando se sube un arreglo de codigo.
_mainsrc = (R / "build.py").read_text()
_i_reh = _mainsrc.index('if "--rehacer" in sys.argv', _mainsrc.index("def main("))
_i_ses = _mainsrc.index("hoy = sesion_objetivo(", _mainsrc.index("def main("))
comprueba("--rehacer se atiende ANTES de mirar qué sesión toca", _i_reh < _i_ses, True)

comprueba("y a ninguna hora se pide un día cuyo cierre todavía no existe",
          [h for h in range(24)
           if b.sesion_objetivo(_dt.datetime(2026, 10, 7, h, 0)) == "2026-10-07" and h < b.CIERRE_UTC], [])
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
    # El SECTOR de cada entrada. Preguntas como "¿las biotecnologicas van peor?" (Borja, 04/11/2026)
    # no se pueden contestar sin el, y rebuscarlo en docs/datos solo funciona mientras ese dia siga
    # archivado. Se guarda una vez, el dia que la accion entra.
    comprueba("el recálculo guarda el sector de cada entrada",
              sum(1 for v in _limpio.values() if v.get("sec")) == len(_limpio), True)
    comprueba("y la industria", sum(1 for v in _limpio.values() if v.get("ind")) == len(_limpio), True)

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
# Contaba 4 campos y se rompio el 05/11/2026 al añadir el sector y el motivo. Contar campos no dice
# nada; lo que importa es que NO se guarde la fila entera (son ~90 candidatas al dia) y que esten
# los que hacen falta para medir. Se nombran.
comprueba("guarda solo los campos necesarios, no la fila entera",
          sorted(_ctl[0]), ["p", "por", "s", "sc", "t"])
# El sector NO va en cada fila: es el mismo todos los dias para la misma accion y repetirlo son
# ~2 MB al año de duplicado. Va una vez en docs/datos/sectores.json.
comprueba("el sector no se repite en cada fila del control",
          any(k in _ctl[0] for k in ("sec", "ind", "sector")), False)
# OJO: guarda_sectores() ESCRIBE en docs/datos/sectores.json. Una prueba no puede dejar una accion
# inventada en los datos de verdad, asi que se guarda el fichero y se restaura. (Lo dejo anotado
# porque ya me paso: la primera version de esta prueba metio "NY:ZZZ" en el fichero real.)
_rsec = b.DATOS / "sectores.json"
_sec_antes = _rsec.read_text() if _rsec.exists() else None
try:
    _dicc = b.guarda_sectores([{"ticker": "ZZZ", "simbolo": "NY:ZZZ",
                                "sector": "Health Technology", "industria": "Biotechnology"}])
    comprueba("pero sí en el diccionario de sectores", _dicc.get("NY:ZZZ"), ["Health Technology", "Biotechnology"])
    comprueba("que acumula y no pierde lo anterior", len(_dicc) > 1, True)
    comprueba("y no reescribe el fichero si nada ha cambiado",
              b.guarda_sectores([{"ticker": "ZZZ", "simbolo": "NY:ZZZ",
                                  "sector": "Health Technology", "industria": "Biotechnology"}]).get("NY:ZZZ"),
              ["Health Technology", "Biotechnology"])
finally:
    if _sec_antes is not None: _rsec.write_text(_sec_antes)
    elif _rsec.exists(): _rsec.unlink()
comprueba("y la prueba no deja basura en los datos reales",
          "NY:ZZZ" not in (_rsec.read_text() if _rsec.exists() else ""), True)
# Buscando la cadena a secas, una llamada COMENTADA seguia contando como presente. Tiene que ser
# una linea de codigo de verdad.
comprueba("main() guarda el diccionario en cada build",
          any(l.strip().startswith("guarda_sectores(")
              for l in (R / "build.py").read_text().splitlines()), True)
comprueba("y vive fuera del glob de los días (no crea sesiones fantasma)",
          (b.DATOS / "sectores.json").exists() and "sectores.json" not in [q.name for q in b.DATOS.glob("2*.json")], True)
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


# ─── EL ESTADO DE HOY NO PUEDE SER MAS VIEJO QUE EL HISTORICO ────────────────────────────────────
# panel.json lleva dos cosas que tienen que ir al mismo dia: "historico" (que --rehacer reconstruye
# desde docs/datos) y "actual" (el estado de hoy de cada accion, que solo se puede saber preguntando
# al mercado y que --rehacer conserva tal cual).
#
# Si se quedan desparejados, las pestañas se contradicen: Seguimiento mira el historico (que llega a
# hoy) y el veredicto se calcula con "actual" (que seria de ayer). Paso el 30/10/2026 resolviendo un
# rebase: en un rebase "--theirs" es el commit que se aplica, no el de arriba, asi que me quede con
# el panel.json de MI commit (18 dias) y luego --rehacer le puso el historico de 19. Dos acciones,
# HNGE y SLDE, salian COMPRA en Hoy y Vigilar en Seguimiento. Lo cazo el test de coherencia entre
# pestañas, pero solo porque corre con los datos de verdad: esta comprobacion lo dice directamente.
print("\nEL ESTADO DE HOY VA AL MISMO DIA QUE EL HISTORICO")
_p = _json.loads((b.WEB / "panel.json").read_text())
_ultimo = max(_p["dias"])
_sello = (_p.get("actualizado") or "")[:10]
comprueba("panel.json dice cuándo se actualizó", bool(_sello), True)
comprueba(f"el estado de hoy ({_sello}) no es anterior al último cierre ({_ultimo})",
          _sello >= _ultimo, True)
# Y las acciones del ultimo dia del historico tienen que tener estado de hoy: si falta, el veredicto
# de esa accion se calcula con lo que haya quedado por ahi.
_hoy = {a.get("s") or a["t"] for a in _p["historico"][_ultimo]["acciones"]}
_sin = sorted(_hoy - set(_p.get("actual") or {}))
comprueba(f"las {len(_hoy)} del top de hoy tienen estado actual", _sin, [])


# ─── LA SERIE DIARIA SOBREVIVE AL RECORTE DE precios.json ────────────────────────────────────────
# precios.json se recorta a DIAS=90 porque se descarga en el navegador. Hasta el 02/11/2026 era
# tambien la UNICA copia de esos cierres: el dia que la ventana empezase a cortar (hacia el
# 19/01/2027) la serie diaria de las acciones antiguas desapareceria PARA SIEMPRE, y es justo la que
# hace falta para volver a correr las reglas de salida sobre las entradas viejas.
#
# No se podia reconstruir de ningun sitio: docs/datos guardaba el top del dia y las candidatas del
# control, y 23 de las 42 seguidas (COHU, IOVA, ZETA, PAYS, XMTR...) no estan en ninguno de los dos
# porque ya no cumplen los requisitos. Ahora cada cierre se archiva en docs/datos, que no se recorta
# nunca, y precios.json pasa a ser una vista derivada.
print("\nLA SERIE DIARIA ESTA ARCHIVADA, NO SOLO EN precios.json")
_pr = _json.loads((b.WEB / "precios.json").read_text())
_ap, _ae = b.serie_archivada()

comprueba("el archivo tiene al menos tantos días como precios.json",
          len(_ap) >= len(_pr["dias"]), True)
_distintos = [f for f in _pr["dias"] if _ap.get(f) != _pr["dias"][f]]
comprueba("y reproduce todos sus cierres exactos", _distintos, [])
_distintasE = [f for f in _pr.get("emas", {}) if _ae.get(f) != _pr["emas"][f]]
comprueba("y todas sus EMA 50", _distintasE, [])

# Lo que de verdad importa: las que YA NO estan en el top ni entre las candidatas. Son las que se
# perderian, y son las que fueron mal: justo las que hay que poder medir.
_ult = max(_ap)
_hoy = b.leer(b.DATOS / f"{_ult}.json")
_top = {a["ticker"] for a in _hoy.get("acciones", [])}
_ctl = {a["t"] for a in _hoy.get("control", [])}
_seg = {k.split(":")[-1] for k in _ap[_ult]}
_solo = sorted(_seg - _top - _ctl)
comprueba(f"hay seguidas que solo viven en el archivo ({len(_solo)} de {len(_seg)})", len(_solo) > 0, True)
comprueba("y el archivo las tiene todas con su cierre",
          all(any(k.endswith(":" + t) or k == t for k in _ap[_ult]) for t in _solo), True)

# Un dia con cierres pero sin fichero de dia (el 21/10/2026, el build fallo) no puede perderse NI
# colarse como sesion: sin "acciones" apareceria en panel["dias"] como una sesion que no existio.
_panel = _json.loads((b.WEB / "panel.json").read_text())
_huerfanos = [f for f in _ap if not (b.DATOS / f"{f}.json").exists()]
if _huerfanos:
    comprueba(f"los días huérfanos ({', '.join(_huerfanos)}) están archivados aparte", True, True)
    comprueba("y no se cuelan como sesión en panel.json",
              [f for f in _huerfanos if f in _panel["dias"]], [])
else:
    comprueba("no hay días huérfanos que preservar", True, True)

# El archivo NO se recorta: tiene que haber tantos ficheros de dia como sesiones (o mas).
_ficheros = sorted(b.DATOS.glob("2*.json"))
comprueba("docs/datos no se recorta: hay un fichero por sesión al menos",
          len(_ficheros) >= len(_panel["dias"]), True)
# La PRIMERA sesion no lleva serie y es correcto: ese dia aun no habia nada seguido de antes, la
# serie de cierres empieza al dia siguiente. Cualquier otro hueco si seria una perdida real.
_primera = min(_panel["dias"])
_sinSerie = [q.stem for q in _ficheros if q.stem != _primera and not (b.leer(q) or {}).get("seguidas")]
comprueba(f"todos los días archivados llevan su serie, salvo la primera sesión ({_primera})", _sinSerie, [])
# Cada entrada de la serie es [cierre, EMA 50]. Esto se comprueba por ESTRUCTURA porque el camino de
# ESCRITURA solo corre en un build completo, que gasta llamadas a TradingView y no se puede lanzar
# desde una prueba. Si un dia se dejara de archivar la EMA, se veria aqui al dia siguiente.
_mal = []
for _q in _ficheros:
    for _k, _v in ((b.leer(_q) or {}).get("seguidas") or {}).items():
        if not isinstance(_v, list) or len(_v) != 2:
            _mal.append(f"{_q.stem}/{_k}")
comprueba("cada cierre archivado va con su EMA 50 en pareja [precio, ema]", _mal[:3], [])
_conEma = sum(1 for _q in _ficheros for _v in ((b.leer(_q) or {}).get("seguidas") or {}).values() if _v[1] is not None)
_tot = sum(1 for _q in _ficheros for _v in ((b.leer(_q) or {}).get("seguidas") or {}).values())
comprueba(f"y la mayoría llevan EMA de verdad ({_conEma} de {_tot})", _tot > 0 and _conEma > _tot * 0.8, True)

comprueba("y la primera sesión es justo la que no la lleva",
          not (b.leer(b.DATOS / f"{_primera}.json") or {}).get("seguidas"), True)


# ─── QUE SESION SE PIDE: EL MERCADO, NO EL RELOJ ─────────────────────────────────────────────────
# El 03/11/2026 se perdio un cierre entero. El cron de las 21:30 del martes no se disparo y las dos
# pasadas que lo recuperaron corrieron a las 01:35 y 03:04 UTC del miercoles. El build usaba
# hoy = utcnow().date(), asi que a esa hora pidio el cierre del dia 4 -que no existia todavia- y no
# guardo nada. Por lo mismo, la repesca de las 07:00 ("ultima red a primera hora del dia siguiente")
# NUNCA pudo recuperar nada: a las 07:00 miraba el cierre de ESE dia.
print("\nLA SESION SE DEDUCE DEL MERCADO, NO DEL RELOJ")
import datetime as _dt2
def _ses(t): return b.sesion_objetivo(_dt2.datetime.strptime(t, "%Y-%m-%d %H:%M"))

comprueba("a su hora (lun 21:35) pide el cierre del lunes", _ses("2026-11-02 21:35"), "2026-11-02")
# EL CASO QUE FALLO: el cron del martes encolado hasta pasada la medianoche UTC.
comprueba("el cron del martes corriendo a las 01:35 del miércoles pide el MARTES",
          _ses("2026-11-04 01:35"), "2026-11-03")
comprueba("y a las 03:04 del miércoles, también el martes", _ses("2026-11-04 03:04"), "2026-11-03")
# La repesca de las 07:00, que hasta ahora no podia recuperar nada.
comprueba("la repesca de las 07:00 del martes pide el cierre del LUNES",
          _ses("2026-11-03 07:00"), "2026-11-02")
comprueba("la del sábado a las 07:00 pide el viernes", _ses("2026-11-07 07:00"), "2026-11-06")
comprueba("un domingo a mediodía también pide el viernes", _ses("2026-11-08 12:00"), "2026-11-06")
comprueba("nunca devuelve un sábado o un domingo",
          [t for t in ("2026-11-07 09:00", "2026-11-08 09:00", "2026-11-09 03:00", "2026-11-07 22:00")
           if _dt2.date.fromisoformat(_ses(t)).weekday() >= 5], [])
# Justo en la frontera de la hora de cierre.
# Un minuto antes del cierre el mercado sigue abierto: no se pide nada. (Antes esto pedia el dia
# anterior, que era lo que iba a corromper el dato con un precio intradia.)
comprueba(f"un minuto antes del cierre ({b.CIERRE_UTC-1}:59 UTC) no se pide nada: la bolsa sigue abierta",
          _ses(f"2026-11-04 {b.CIERRE_UTC-1:02d}:59"), None)
comprueba(f"y a las {b.CIERRE_UTC}:00 en punto ya pide el de hoy",
          _ses(f"2026-11-04 {b.CIERRE_UTC:02d}:00"), "2026-11-04")

# main() no se puede ejecutar en una prueba (pide datos a TradingView), asi que la linea que elige
# el dia se ata por codigo: si alguien vuelve a poner el reloj ahi, se pierde otro cierre y no lo
# sabremos hasta que Borja lo vea en pantalla, como el 04/11/2026.
_src = (R / "build.py").read_text()
comprueba("main() deduce el día con sesion_objetivo()",
          "hoy = sesion_objetivo(datetime.datetime.utcnow())" in _src, True)
comprueba("y nadie vuelve a sacar el día del reloj",
          [l.strip() for l in _src.splitlines()
           if "utcnow()" in l and "strftime" in l and "%Y-%m-%d" in l and "actualizado" not in l
           and not l.lstrip().startswith(("#", "Antes", '\"\"\"'))], [])

# El guardia que impedia las repescas ya no esta, pero las defensas contra el dia fantasma SI: esas
# miran los DATOS, no la hora, que es lo unico que distingue un festivo de un cron encolado.
_mismas = [{"ticker": "A", "precio": 10.0}, {"ticker": "B", "precio": 20.0}, {"ticker": "C", "precio": 30.0}]
comprueba("un día con los mismos precios que el anterior se sigue rechazando",
          bool(b.sin_cierre_nuevo("2026-11-04", _dt2.datetime(2026, 11, 4, 22, 0), _mismas, _mismas)), True)
comprueba("y el S&P cerrando idéntico también",
          bool(b.sin_cierre_nuevo("2026-11-04", _dt2.datetime(2026, 11, 4, 22, 0), [], [], 500.0, 500.0)), True)
comprueba("pero una sesión normal a las 02:00 UTC (cron encolado) YA NO se rechaza por la hora",
          b.sin_cierre_nuevo("2026-11-03", _dt2.datetime(2026, 11, 4, 2, 0),
                             [{"ticker": "A", "precio": 10.0}], [{"ticker": "A", "precio": 11.0}]), None)


# ─── PROTECCION ANTE SALTOS BRUSCOS (desde el 05/11/2026) ───────────────────────────────────────
# Pedido por Borja: evitar biotecnologicas con caidas de mas del 20 % en una sesion CON LOS INDICES
# AGUANTANDO, y evitar las que tengan un catalizador a menos de una semana, readmitiendolas cuando
# pase. Medido antes de aplicarlo: con 42 entradas ninguna de las dos reglas habria cambiado nada.
# Se aplica porque protege de la COLA, que no se puede medir con 42 entradas y un solo evento.
print("\nPROTECCION: CATALIZADOR CERCA Y CAIDA BRUSCA")
_hoy5 = "2026-11-05"
_bio = {"ticker": "BIO", "sector": "Health Technology", "cambio": 0.0}
_far = {"ticker": "FAR", "sector": "Health Services", "industria": "Pharmaceuticals: Major", "cambio": 0.0}
_tec = {"ticker": "TEC", "sector": "Technology Services", "cambio": 0.0}

comprueba("reconoce una biotecnológica por sector", b.es_biotech(_bio), True)
comprueba("y una farmacéutica por industria", b.es_biotech(_far), True)
comprueba("y no confunde una tecnológica", b.es_biotech(_tec), False)

# CATALIZADOR: fuera mientras esta cerca, dentro en cuanto pasa (eso es "cuando pasen, ponlas").
_f = lambda d: (_dt.date(2026, 11, 5) + _dt.timedelta(days=d)).isoformat()
comprueba("con resultados hoy mismo, fuera", b.catalizador_cerca({"resultados": _f(0)}, _hoy5), True)
comprueba(f"con resultados a {b.DIAS_CATALIZADOR} días, fuera",
          b.catalizador_cerca({"resultados": _f(b.DIAS_CATALIZADOR)}, _hoy5), True)
comprueba(f"a {b.DIAS_CATALIZADOR+1} días ya entra",
          b.catalizador_cerca({"resultados": _f(b.DIAS_CATALIZADOR+1)}, _hoy5), False)
comprueba("y en cuanto los resultados PASAN vuelve a entrar sola",
          b.catalizador_cerca({"resultados": _f(-1)}, _hoy5), False)
comprueba("sin fecha de resultados no se descarta a nadie",
          b.catalizador_cerca({"resultados": None}, _hoy5), False)
comprueba("una fecha corrupta tampoco rompe el build",
          b.catalizador_cerca({"resultados": "no-es-fecha"}, _hoy5), False)

# CAIDA BRUSCA: solo biotech, solo si el indice aguanta.
comprueba("biotech que cae un 25 % hoy con el índice plano: fuera",
          b.cayo_fuerte({**_bio, "cambio": -25.0}, {}, {}, _hoy5, 0.3), True)
comprueba("si el índice también se hunde, NO se descarta: es el mercado, no la empresa",
          b.cayo_fuerte({**_bio, "cambio": -25.0}, {}, {}, _hoy5, -4.0), False)
comprueba("una tecnológica que cae lo mismo no entra en esta regla",
          b.cayo_fuerte({**_tec, "cambio": -25.0}, {}, {}, _hoy5, 0.3), False)
comprueba("una caída menor del umbral no descarta",
          b.cayo_fuerte({**_bio, "cambio": b.CAIDA_BRUSCA + 1}, {}, {}, _hoy5, 0.3), False)

# Y en la SERIE archivada, no solo hoy: una caida de hace dias tambien cuenta.
_serie = {"2026-11-02": {"NY:BIO": 100.0}, "2026-11-03": {"NY:BIO": 70.0}, "2026-11-04": {"NY:BIO": 72.0}}
_spyA = {"2026-11-02": 500.0, "2026-11-03": 499.0, "2026-11-04": 500.0}     # el indice aguanta
_spyB = {"2026-11-02": 500.0, "2026-11-03": 470.0, "2026-11-04": 475.0}     # el indice se hunde igual
_conS = {**_bio, "simbolo": "NY:BIO"}
comprueba("una caída del 30 % hace dos días, con el índice aguantando: fuera",
          b.cayo_fuerte(_conS, _serie, _spyA, _hoy5, 0.0), True)
comprueba("la misma caída con el índice hundido ese día: dentro",
          b.cayo_fuerte(_conS, _serie, _spyB, _hoy5, 0.0), False)
comprueba("sin dato del índice ese día no se descarta por las dudas",
          b.cayo_fuerte(_conS, _serie, {}, _hoy5, 0.0), False)
comprueba("fuera de la ventana de sesiones ya no cuenta",
          b.cayo_fuerte(_conS, _serie, _spyA, "2026-12-31", 0.0), False)

# EL COSTE SE REGISTRA: es la condicion con la que se acepto aplicar las reglas.
_cand = [{"ticker": "A", "simbolo": "NY:A", "precio": 1.0, "sector": "Health Technology"},
         {"ticker": "B", "simbolo": "NY:B", "precio": 2.0, "sector": "Technology Services"}]
_ctl = b.control(_cand, set(), {"A": {"total": 80}, "B": {"total": 70}}, {"A": "catalizador"})
comprueba("el control dice POR QUÉ cada candidata no está en el top",
          sorted((x["t"], x["por"]) for x in _ctl), [("A", "catalizador"), ("B", "nota")])
comprueba("y el sector de cada una está en el diccionario, no en la fila",
          all("sec" not in x for x in _ctl), True)
comprueba("sin protección, todas salen como descartadas por nota",
          {x["por"] for x in b.control(_cand, set(), {}, None)}, {"nota"})


# ─── LA PROTECCION NO FALSEA EL RECUENTO NI DISPARA LA ALARMA ───────────────────────────────────
# Dos numeros que estaban bien y que la proteccion del 05/11 rompio durante unas horas:
#  - la cabecera de Hoy dice "N cumplian los requisitos de M analizadas". Las apartadas por
#    proteccion LOS CUMPLEN: lo que se les impide es entrar hoy. Si no se cuentan, el numero miente.
#  - comprueba() aborta el build con menos de 3 candidatas, para detectar que el filtro o la fuente
#    se han roto. Con la lista ya filtrada, la proteccion podia disparar esa alarma sin que nada
#    estuviese roto, y un build abortado es una sesion perdida.
print("\nLA PROTECCION APARTA DEL TOP, NO DEL RECUENTO")
_srcm = (R / "build.py").read_text()
_main = _srcm[_srcm.index("def main("):]
comprueba("el top se elige de la lista filtrada (elegibles)",
          "sorted(elegibles, key=lambda a: (-nota(a)" in _main, True)
comprueba("pero el recuento de candidatas es el de las que cumplen los requisitos",
          '"candidatas": len(candidatas)' in _main, True)
comprueba("y la alarma de comprueba() mira esa misma lista completa",
          "comprueba(universo, candidatas, acciones, mercado, ref)" in _main, True)
comprueba("las protegidas se puntúan igual, para poder medirlas después",
          "puntos = puntuar(candidatas, ctx)" in _main, True)
comprueba("y «en marcha» también sale de las elegibles, no de todas",
          "en_marcha = sorted([a for a in elegibles" in _main, True)
# Y el grupo de control se construye con la lista COMPLETA: si se le pasara la filtrada, las
# apartadas por proteccion no quedarian anotadas en ningun sitio y no se podria medir lo que cuesta
# la regla, que es la condicion con la que se acepto aplicarla.
comprueba("el control se construye con todas las candidatas, no solo las elegibles",
          "control(candidatas, elegidas, puntos, proteccion)" in _main, True)

# Un dia completo simulado: 5 candidatas, 2 apartadas por proteccion.
_u = [{"ticker": "A", "simbolo": "NY:A", "precio": 10.0, "sector": "Health Technology", "cambio": 0.0, "resultados": None},
      {"ticker": "B", "simbolo": "NY:B", "precio": 11.0, "sector": "Technology Services", "cambio": 0.0, "resultados": None},
      {"ticker": "C", "simbolo": "NY:C", "precio": 12.0, "sector": "Health Technology", "cambio": -30.0, "resultados": None},
      {"ticker": "D", "simbolo": "NY:D", "precio": 13.0, "sector": "Technology Services", "cambio": 0.0,
       "resultados": (_dt.date(2026, 11, 5) + _dt.timedelta(days=3)).isoformat()},
      {"ticker": "E", "simbolo": "NY:E", "precio": 14.0, "sector": "Finance", "cambio": 0.0, "resultados": None}]
_prot = {}
for _a in _u:
    if b.catalizador_cerca(_a, "2026-11-05"): _prot[_a["ticker"]] = "catalizador"
    elif b.cayo_fuerte(_a, {}, {}, "2026-11-05", 0.1): _prot[_a["ticker"]] = "caida"
comprueba("aparta exactamente a la que cae y a la que publica resultados",
          sorted(_prot.items()), [("C", "caida"), ("D", "catalizador")])
_eleg = [a for a in _u if a["ticker"] not in _prot]
comprueba("quedan 3 elegibles para el top", [a["ticker"] for a in _eleg], ["A", "B", "E"])
comprueba("pero las candidatas siguen siendo 5", len(_u), 5)
_ctl2 = b.control(_u, {"A"}, {}, _prot)
comprueba("y el control recoge las 4 no elegidas, con su motivo",
          sorted((x["t"], x["por"]) for x in _ctl2),
          [("B", "nota"), ("C", "caida"), ("D", "catalizador"), ("E", "nota")])
comprueba("la elegida no aparece en el control", "A" in [x["t"] for x in _ctl2], False)


# ─── CUADRE DEL FICHERO DE CADA DIA ─────────────────────────────────────────────────────────────
# top + control tiene que ser EXACTAMENTE candidatas: el control son "las que cumplen y no se
# eligieron". Si alguna se cae por el camino -como estuvo a punto de pasar con las apartadas por
# proteccion el 05/11/2026- desaparece del registro sin dejar rastro y no se puede medir nada.
# Es el invariante que habria cazado ese fallo solo.
print("\nEL FICHERO DE CADA DIA CUADRA")
_desc, _sinctl = [], []
for _q in sorted(b.DATOS.glob("2*.json")):
    _d = b.leer(_q) or {}
    if not _d.get("acciones"):
        continue
    _n = _d.get("candidatas")
    _c = _d.get("control")
    if _c is None:
        _sinctl.append(_q.stem); continue
    if _n is not None and len(_c) + len(_d["acciones"]) != _n:
        _desc.append(f"{_q.stem}: {len(_d['acciones'])}+{len(_c)} != {_n}")
comprueba("top + control = candidatas en todos los días archivados", _desc[:3], [])
comprueba(f"({len(_sinctl)} días son anteriores al grupo de control y no se comprueban)", True, True)

# Y desde que existen las reglas de proteccion, el motivo de cada descartada tiene que estar.
_sinmotivo = []
for _q in sorted(b.DATOS.glob("2*.json")):
    if _q.stem < b.CAMBIO_REGLAS:
        continue
    _d = b.leer(_q) or {}
    if not _d.get("control"):
        continue
    if any("por" not in _x for _x in _d["control"]):
        _sinmotivo.append(_q.stem)
comprueba(f"desde el {b.CAMBIO_REGLAS}, cada descartada dice por qué lo está", _sinmotivo, [])

print(f"\n{total - fallos} de {total} comprobaciones correctas")
sys.exit(1 if fallos else 0)
