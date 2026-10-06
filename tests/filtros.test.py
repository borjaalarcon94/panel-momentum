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

print("\nCOHERENCIA DE UMBRALES")
comprueba("el techo de capitalización está en el filtro del escáner",
          any(f["left"] == "market_cap_basic" and f["right"] == [300e6, b.CAP_MAX] for f in b.FILTROS), True)
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

print(f"\n{total - fallos} de {total} comprobaciones correctas")
sys.exit(1 if fallos else 0)
