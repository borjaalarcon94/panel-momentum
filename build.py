"""Panel de momentum: consulta TradingView y genera docs/index.html.
Lo ejecuta GitHub Actions cada día laborable. Solo usa la librería estándar."""
import json, urllib.request, datetime, pathlib, html

RAIZ = pathlib.Path(__file__).parent
DATOS = RAIZ / "data"
WEB = RAIZ / "docs"
DIAS_HISTORIAL = 60

# Filtros (los de tu captura de TradingView)
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
COLS = ["name", "description", "close", "change", "relative_volume_10d_calc",
        "market_cap_basic", "ADRP", "RSI", "sector",
        "total_revenue_yoy_growth_ttm", "net_margin_ttm", "earnings_release_next_date"]
KEYS = ["ticker", "empresa", "precio", "cambio", "volrel", "cap", "adr", "rsi",
        "sector", "ingresos", "margen", "resultados"]


def consultar():
    body = {"markets": ["america"], "columns": COLS, "filter": FILTROS,
            "options": {"lang": "en"}, "sort": {"sortBy": "change", "sortOrder": "desc"},
            "range": [0, 200]}
    req = urllib.request.Request(
        "https://scanner.tradingview.com/america/scan",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
                 "Origin": "https://www.tradingview.com",
                 "Referer": "https://www.tradingview.com/"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    filas = []
    for item in data.get("data", []):
        f = dict(zip(KEYS, item["d"]))
        if f["resultados"]:
            f["resultados"] = datetime.datetime.utcfromtimestamp(f["resultados"]).strftime("%Y-%m-%d")
        f["simbolo"] = item["s"]
        filas.append(f)
    return filas


def cargar_historial():
    dias = {}
    for p in sorted(DATOS.glob("*.json"))[-DIAS_HISTORIAL:]:
        dias[p.stem] = json.loads(p.read_text())
    return dias


def generar_html(dias):
    plantilla = (RAIZ / "plantilla.html").read_text()
    datos = json.dumps(dias, ensure_ascii=False).replace("</", "<\\/")
    return plantilla.replace("/*DATOS*/null", datos)


def main():
    DATOS.mkdir(exist_ok=True)
    WEB.mkdir(exist_ok=True)
    hoy = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    filas = consultar()
    (DATOS / f"{hoy}.json").write_text(json.dumps(filas, ensure_ascii=False, indent=1))
    (WEB / "index.html").write_text(generar_html(cargar_historial()))
    print(f"{hoy}: {len(filas)} acciones")


if __name__ == "__main__":
    main()
