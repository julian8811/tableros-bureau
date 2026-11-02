# -*- coding: utf-8 -*-
"""Trae los agregados del ETL Bureau (repo bureau-inteligencia-turistica)
y los deja en data/open con el schema de este tablero. No toca las piezas
propias (icca/evi/huella/informe) ni reescribe conectividad/ema/medata.
Wikipedia y GDELT salieron del tablero: la señal digital ahora es prensa
(bureau_prensa.json). Si una fuente falla, el JSON anterior queda.
"""
import json
import datetime as _dt
import re
import traceback
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "open"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "https://raw.githubusercontent.com/julian8811/bureau-inteligencia-turistica/main/etl-bureau/export/tableros_bureau"
UA = {"User-Agent": "TablerosBureau/1.0"}
ERRORES = []

# Piezas que gestiona este script dentro de data/open. Se usan para limpiar
# asientos viejos del manifiesto sin tocar las piezas propias del tablero.
_PIEZAS_PROPIAS = ("bureau_marca_llm.json", "bureau_paises_2025_2026.json",
                    "bureau_prensa.json", "bureau_oferta.json",
                    "bureau_seguridad.json", "bureau_clima.json",
                    "bureau_conectividad.json")
_IDS_PROPIOS = ("marca-llm", "bureau-paises", "prensa-medios",
                  "bureau-oferta", "bureau-seguridad", "bureau-clima",
                  "bureau-conectividad")


def _es_pieza_propia(entrada):
    pid = str(entrada.get("id", ""))
    arch = Path(str(entrada.get("archivo", ""))).name
    return pid in _IDS_PROPIOS or arch in _PIEZAS_PROPIAS


def bajar(nombre):
    url = BASE + "/" + nombre
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def guardar(nombre, payload):
    p = OUT / nombre
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print("escribe", nombre)
    return p


def marca_llm():
    try:
        src = bajar("marca_llm_2025_2026.json")
    except Exception as exc:
        ERRORES.append("marca_llm: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla marca_llm, se conserva el anterior")
        return
    cats = src.get("categorias", [])
    serie = [
        {
            "categoria": c.get("categoria"),
            "n": c.get("n", 0),
            "share": c.get("share", 0),
            "sent_net": c.get("sent_net", 0),
            "top_topico": c.get("top_topico", ""),
        }
        for c in cats
    ]
    ventana = str(src.get("ventana", ""))
    guardar("bureau_marca_llm.json", {
        "id": "marca-llm",
        "titulo": "Conversación digital clasificada por LLM",
        "fuente": "ETL Bureau (alerts_rss + prensa_rss, Groq) " + ventana,
        "ventana": ventana,
        "ventana_anios": sorted({int(y) for y in re.findall(r"20\d{2}", ventana)}),
        "url": BASE + "/marca_llm_2025_2026.json",
        "licencia": "Agregados propios del ETL; titulares de sus medios originales.",
        "universo": "Titulares de la ventana corriente clasificados en MICE/vacacional/marca/seguridad/clima/infraestructura/otro.",
        "serie": serie,
        "top_topico_global": src.get("top_topico_global", ""),
        "n_total": src.get("n_total", sum(c.get("n", 0) for c in cats)),
    })
    print("marca_llm", len(serie), "categorias")


def paises():
    try:
        src = bajar("paises_2025_2026.json")
    except Exception as exc:
        ERRORES.append("paises: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla paises, se conserva el anterior")
        return
    serie = src.get("serie", src if isinstance(src, list) else [])
    guardar("bureau_paises_2025_2026.json", {
        "id": "bureau-paises",
        "titulo": "Emisores 2025-2026 (ETL Bureau, grano anual)",
        "fuente": "ETL Bureau, pais_dashboard (Socrata Migración/Aerocivil)",
        "url": BASE + "/paises_2025_2026.json",
        "licencia": "Agregados propios del ETL; fuente primaria datos.gov.co.",
        "universo": "Grano anual declarado; no reemplaza la serie mensual de conectividad.",
        "grano": "anual",
        "serie": serie,
    })
    print("paises", len(serie), "filas")


def prensa():
    try:
        src = bajar("prensa_medios.json")
    except Exception as exc:
        ERRORES.append("prensa: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla prensa, se conserva el anterior")
        return
    serie = src.get("serie", src if isinstance(src, list) else [])
    guardar("bureau_prensa.json", {
        "id": "prensa-medios",
        "titulo": "Menciones en prensa (ETL Bureau)",
        "fuente": "ETL Bureau, Google News RSS + Reddit",
        "url": BASE + "/prensa_medios.json",
        "licencia": "Agregados propios del ETL; titulares de sus medios originales.",
        "universo": "Titulares recientes y conteo semanal de menciones. Reemplaza a Wikipedia/GDELT como señal digital.",
        "descarga": src.get("generado", _dt.date.today().isoformat()),
        "ventana_serie": src.get("ventana_serie", []),
        "serie": serie,
        "titulares": src.get("titulares", []),
        "sentimiento_neto": src.get("sentimiento_neto"),
        "n_total_menciones": src.get("n_total_menciones", len(serie)),
    })
    print("prensa", len(serie), "semanas")


def oferta():
    try:
        src = bajar("oferta_territorio_2025_2026.json")
    except Exception as exc:
        ERRORES.append("oferta: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla oferta, se conserva el anterior")
        return
    s = src.get("serie", {})
    guardar("bureau_oferta.json", {
        "id": "bureau-oferta",
        "titulo": "Oferta y territorio (ETL Bureau)",
        "fuente": "ETL Bureau, RNT + MEData + DANE EGIT " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/oferta_territorio_2025_2026.json",
        "licencia": "Agregados propios del ETL; fuentes primarias datos.gov.co / DANE / MEData.",
        "universo": "Prestadores RNT, tarifa y ocupación por zona, uplift de 6 temporadas, turismo interno.",
        "serie": s.get("temporadas", []) + s.get("tarifa_zona", []) + s.get("ocupacion_zonas", []),
        "rnt": s.get("rnt", {}),
        "turismo_interno": s.get("turismo_interno", {}),
    })
    print("oferta ok")


def seguridad():
    try:
        src = bajar("seguridad_2025_2026.json")
    except Exception as exc:
        ERRORES.append("seguridad: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla seguridad, se conserva el anterior")
        return
    guardar("bureau_seguridad.json", {
        "id": "bureau-seguridad",
        "titulo": "Seguridad ciudadana Medellín (ETL Bureau)",
        "fuente": "ETL Bureau, SIEDCO Policía Nacional " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/seguridad_2025_2026.json",
        "licencia": "Datos abiertos SIEDCO; agregados propios del ETL.",
        "universo": "Homicidios y hurtos ciudad; hurtos sin desagregación por zona (null, no 0).",
        "serie": src.get("serie_mensual", []),
        "top_zonas": src.get("top_zonas", []),
        "top_modalidades": src.get("top_modalidades", []),
    })
    print("seguridad ok")


def clima():
    try:
        src = bajar("clima_aire_2025_2026.json")
    except Exception as exc:
        ERRORES.append("clima: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla clima, se conserva el anterior")
        return
    guardar("bureau_clima.json", {
        "id": "bureau-clima",
        "titulo": "Clima y calidad del aire (ETL Bureau)",
        "fuente": "ETL Bureau, IDEAM + Open-Meteo + aire_med " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/clima_aire_2025_2026.json",
        "licencia": "Datos abiertos IDEAM/Open-Meteo; agregados propios del ETL.",
        "universo": "Lluvia mensual agregada, PM2.5 diario, pronóstico ensemble 7 días.",
        "serie": src.get("lluvia_mensual", []),
        "pm25_serie": src.get("pm25_serie", []),
        "pronostico": src.get("pronostico", []),
    })
    print("clima ok")


def conectividad_bench():
    try:
        src = bajar("conectividad_benchmark_2025_2026.json")
    except Exception as exc:
        ERRORES.append("conectividad_bench: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla conectividad_bench, se conserva el anterior")
        return
    guardar("bureau_conectividad.json", {
        "id": "bureau-conectividad",
        "titulo": "Conectividad ampliada y benchmarks (ETL Bureau)",
        "fuente": "ETL Bureau, Aerocivil/terminales/DANE/Eurostat/WB/Wikimedia " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/conectividad_benchmark_2025_2026.json",
        "licencia": "Agregados propios del ETL; fuentes primarias datos.gov.co / Eurostat / Banco Mundial.",
        "universo": "Oferta aérea (sillas/vuelos), operaciones, terrestre, metro, TRM, costos, benchmarks EU/mundo, digital.",
        "serie": src.get("operaciones_serie", []) + src.get("terrestre_serie", []),
        "oferta_aerea": src.get("oferta_aerea", {}),
        "metro_serie": src.get("metro_serie", []),
        "trm_serie": src.get("trm_serie", []),
        "costos_destino": src.get("costos_destino", []),
        "benchmark_eu": src.get("benchmark_eu", []),
        "benchmark_mundo": src.get("benchmark_mundo", []),
        "wikimedia_serie": src.get("wikimedia_serie", []),
        "travel_metrics": src.get("travel_metrics", []),
        "skips": src.get("skips", []),
    })
    print("conectividad_bench ok")


def manifiesto():
    try:
        previo = json.loads((OUT / "manifiesto.json").read_text(encoding="utf-8"))
    except Exception:
        previo = {"generado": "", "piezas": [], "errores": []}
    piezas = [x for x in previo.get("piezas", []) if not _es_pieza_propia(x)]
    for nombre, pid, clave in (
        ("bureau_marca_llm.json", "marca-llm", "serie"),
        ("bureau_paises_2025_2026.json", "bureau-paises", "serie"),
        ("bureau_prensa.json", "prensa-medios", "serie"),
        ("bureau_oferta.json", "bureau-oferta", "serie"),
        ("bureau_seguridad.json", "bureau-seguridad", "serie"),
        ("bureau_clima.json", "bureau-clima", "serie"),
        ("bureau_conectividad.json", "bureau-conectividad", "serie"),
    ):
        path = OUT / nombre
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        piezas.append({
            "archivo": "data/open/" + nombre,
            "id": pid,
            "estado": "ok",
            "n": len(payload.get(clave, []) or []),
        })
    doc = dict(previo)
    doc["piezas"] = piezas
    doc["errores"] = (previo.get("errores", []) + ERRORES)[-20:]
    (OUT / "manifiesto.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("manifiesto", [(x["id"], x["n"]) for x in piezas if str(x["id"]).startswith("marca") or str(x["id"]).startswith("bureau")])


if __name__ == "__main__":
    marca_llm()
    paises()
    prensa()
    oferta()
    seguridad()
    clima()
    conectividad_bench()
    manifiesto()
