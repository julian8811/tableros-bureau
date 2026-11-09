# -*- coding: utf-8 -*-
"""Trae los agregados del ETL Bureau (repo bureau-inteligencia-turistica)
y los deja en data/open con el schema de este tablero. No reescribe
conectividad/ema/medata/icca/evi/huella locales.
Intenta sincronizar informe_llm.json del export; si 404, conserva el local.
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
                    "bureau_conectividad.json", "bureau_calendario.json",
                    "bureau_owid.json", "bureau_sit.json",
                    "bureau_consumo.json",
                    "bureau_pronostico.json", "bureau_frescura.json", "informe_llm.json")
_IDS_PROPIOS = ("marca-llm", "bureau-paises", "prensa-medios",
                  "bureau-oferta", "bureau-seguridad", "bureau-clima",
                  "bureau-conectividad", "bureau-calendario",
                  "bureau-owid", "bureau-sit", "bureau-consumo", "bureau-pronostico",
                  "bureau-frescura", "informe-llm")


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
    ti = s.get("turismo_interno", {})
    tserie = ti.get("serie", {})
    plano = [{"concepto": c, "trimestre": r.get("trimestre"), "valor": r.get("valor")}
             for c, filas in tserie.items() for r in (filas or [])]
    guardar("bureau_oferta.json", {
        "id": "bureau-oferta",
        "titulo": "Oferta y territorio (ETL Bureau)",
        "fuente": "ETL Bureau, RNT + DANE EGIT " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/oferta_territorio_2025_2026.json",
        "licencia": "Agregados propios del ETL; fuentes primarias datos.gov.co / DANE.",
        "universo": "Prestadores RNT y turismo interno trimestral. Sin fuentes descontinuadas.",
        "serie": plano,
        "rnt": s.get("rnt", {}),
        "turismo_conceptos": ti.get("conceptos", []),
        "corte": src.get("cortes", {}).get("turismo_interno", ""),
        "cortes": src.get("cortes", {}),
        "retiradas": src.get("retiradas", []),
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
        "corte": max([r.get("periodo", "") for r in src.get("serie_mensual", [])] or [""]),
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
        "sisaire_pm25": src.get("sisaire_pm25", []),
        "pronostico": src.get("pronostico", []),
        "corte": max([r.get("periodo", "") for r in src.get("lluvia_mensual", [])] or [""]),
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
        "fuente": "ETL Bureau, Aerocivil/Eurostat/Wikimedia " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/conectividad_benchmark_2025_2026.json",
        "licencia": "Agregados propios del ETL; fuentes primarias datos.gov.co / Eurostat.",
        "universo": "Operaciones aéreas, TRM, benchmarks UE y señal digital. Sin fuentes descontinuadas.",
        "serie": src.get("operaciones_serie", []),
        "trm_serie": src.get("trm_serie", []),
        "bts_colombia": src.get("bts_colombia", []),
        "ipc_colombia": src.get("ipc_colombia", []),
        "benchmark_eu": src.get("benchmark_eu", []),
        "wikimedia_serie": src.get("wikimedia_serie", []),
        "cortes": src.get("cortes", {}),
        "retiradas": src.get("retiradas", []),
        "skips": src.get("skips", []),
    })
    print("conectividad_bench ok")


def calendario():
    try:
        src = bajar("calendario_contexto_2025_2026.json")
    except Exception as exc:
        ERRORES.append("calendario: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla calendario, se conserva el anterior")
        return
    guardar("bureau_calendario.json", {
        "id": "bureau-calendario",
        "titulo": "Calendario y contexto (ETL Bureau)",
        "fuente": "ETL Bureau, festivos CO + IDEAM " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/calendario_contexto_2025_2026.json",
        "licencia": "Datos abiertos; agregados propios del ETL.",
        "universo": "Feriados nacionales y red de estaciones IDEAM con reporte en Medellín.",
        "serie": src.get("festivos", []),
        "festivos_emisores": src.get("festivos_emisores", []),
        "avisos_viaje": src.get("avisos_viaje", []),
        "estaciones": src.get("estaciones", {}),
        "corte": max([r.get("date", "") for r in src.get("festivos", [])] or [""]),
    })
    print("calendario ok")


def owid():
    try:
        src = bajar("owid_benchmark_2025_2026.json")
    except Exception as exc:
        ERRORES.append("owid: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla owid, se conserva el anterior")
        return
    guardar("bureau_owid.json", {
        "id": "bureau-owid",
        "titulo": "Benchmark mundial (ETL Bureau)",
        "fuente": "ETL Bureau, Our World in Data (UN Tourism) " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/owid_benchmark_2025_2026.json",
        "licencia": "CC-BY Our World in Data; agregados propios del ETL.",
        "universo": "Llegadas internacionales por país; top 25 del último año + serie de Colombia.",
        "serie": src.get("serie", []),
        "colombia_serie": src.get("colombia_serie", []),
        "regiones": src.get("regiones_ultimo", []),
        "cortes": src.get("cortes", {}),
    })
    print("owid ok")


def sit():
    try:
        src = bajar("sit_emisores_2025_2026.json")
    except Exception as exc:
        ERRORES.append("sit: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla sit, se conserva el anterior")
        return
    guardar("bureau_sit.json", {
        "id": "bureau-sit",
        "titulo": "Perfiles emisores SIT (ETL Bureau)",
        "fuente": "ETL Bureau, SIT Medellín perfiles de mercado " + str(src.get("ventana", "")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/sit_emisores_2025_2026.json",
        "licencia": "Cifras citadas de informes SIT; agregados propios del ETL.",
        "universo": "5 mercados emisores auditados (cifras clave 2025 + nulos honestos documentados).",
        "serie": src.get("mercados", []),
        "corte": "2025",
    })
    print("sit ok")


def consumo():
    try:
        src = bajar("consumo_2025_2026.json")
    except Exception as exc:
        ERRORES.append("consumo: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla consumo, se conserva el anterior")
        return
    guardar("bureau_consumo.json", {
        "id": "bureau-consumo",
        "titulo": "Consumo turistico (ETL Bureau)",
        "fuente": "ETL Bureau, " + str(src.get("fuente", "DANE CST + SIT + SITE")),
        "ventana": str(src.get("ventana", "")),
        "url": BASE + "/consumo_2025_2026.json",
        "licencia": str(src.get("licencia", "Agregados propios del ETL.")),
        "universo": str(src.get("universo", "")),
        "serie": src.get("serie_mercados", []),
        "gasto_extranjero_co": src.get("gasto_extranjero_co", {}),
        "gasto_medellin": src.get("gasto_medellin", {}),
        "series_disponibles": src.get("series_disponibles", []),
        "notas": src.get("notas", []),
    })
    print("consumo ok")


def pronostico():
    try:
        src = bajar("pronosticos.json")
    except Exception as exc:
        ERRORES.append("pronostico: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla pronostico, se conserva el anterior")
        return
    guardar("bureau_pronostico.json", src)
    print("pronostico ok", len(src.get("series") or []))


def frescura():
    try:
        src = bajar("frescura_dashboard.json")
    except Exception as exc:
        ERRORES.append("frescura: " + "".join(traceback.format_exception_only(type(exc), exc)).strip())
        print("falla frescura, se conserva el anterior")
        return
    guardar("bureau_frescura.json", src)
    print("frescura ok", src.get("estado"), str(src.get("resumen")))


def informe_llm():
    """Baja informe_llm.json del export remoto si existe; si 404, conserva el local."""
    local = OUT / "informe_llm.json"
    try:
        src = bajar("informe_llm.json")
    except Exception as exc:
        msg = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        ERRORES.append("informe_llm: " + msg)
        if local.exists():
            print("falla informe_llm, se conserva el anterior")
        else:
            print("falla informe_llm y no hay local:", msg)
        return
    if not isinstance(src, dict) or not isinstance(src.get("secciones"), list):
        ERRORES.append("informe_llm: payload sin secciones")
        print("informe_llm inválido remoto, se conserva el anterior")
        return
    guardar("informe_llm.json", src)
    print("informe_llm ok", len(src.get("secciones") or []), "secciones · corte", src.get("corte"))


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
        ("bureau_calendario.json", "bureau-calendario", "serie"),
        ("bureau_owid.json", "bureau-owid", "serie"),
        ("bureau_sit.json", "bureau-sit", "serie"),
        ("bureau_consumo.json", "bureau-consumo", "serie"),
        ("bureau_pronostico.json", "bureau-pronostico", "series"),
        ("bureau_frescura.json", "bureau-frescura", "fuentes"),
        ("informe_llm.json", "informe-llm", "secciones"),
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
    doc["generado"] = _dt.date.today().isoformat()
    (OUT / "manifiesto.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("manifiesto", [(x["id"], x["n"]) for x in piezas if str(x["id"]).startswith("marca") or str(x["id"]).startswith("bureau") or str(x["id"]).startswith("informe")])


if __name__ == "__main__":
    marca_llm()
    paises()
    prensa()
    oferta()
    seguridad()
    clima()
    conectividad_bench()
    calendario()
    owid()
    sit()
    consumo()
    pronostico()
    frescura()
    informe_llm()
    manifiesto()
