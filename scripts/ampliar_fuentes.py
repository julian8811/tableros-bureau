# -*- coding: utf-8 -*-
"""Agrega cortes nuevos. Wikipedia queda fuera. GDELT/Trends solo con cuota estable."""
import json
import traceback
from pathlib import Path

import preparar_fuentes as p

OUT = Path(__file__).resolve().parents[1] / "data" / "open"


def guardar_manifiesto(errores_extra):
    piezas = []
    errores = list(errores_extra or [])
    for nombre, clave in (
        ("conectividad.json", "serie"),
        ("mincit_vnr.json", "serie"),
        ("migracion_entradas.json", "serie"),
        ("trm_banrep.json", "serie"),
        ("gdelt.json", "serie"),
        ("tendencias.json", "serie"),
        ("ema.json", "serie"),
        ("medata_tarifas.json", "serie"),
        ("icca.json", "ciudades"),
        ("evi.json", "olas"),
        ("huella.json", "serie"),
    ):
        path = OUT / nombre
        if not path.exists():
            if nombre in ("gdelt.json", "tendencias.json"):
                errores.append(nombre + ": pendiente de cuota estable")
            else:
                errores.append(nombre + ": no está en disco")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        piezas.append({
            "archivo": "data/open/" + nombre,
            "id": payload.get("id"),
            "estado": payload.get("estado", "ok"),
            "n": len(payload.get(clave) or []),
        })
    doc = {
        "generado": p.HOY,
        "piezas": piezas,
        "errores": errores,
        "mercados": p.MERCADOS,
        "destinos_comparables": p.DESTINOS,
        "nota": "Agregados para el tablero. Sin Wikipedia. Sin CRM. Sin filas de encuesta ni XLSX crudos.",
    }
    (OUT / "manifiesto.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print("manifiesto", [(x["id"], x["n"]) for x in piezas])


if __name__ == "__main__":
    errores = []

    cortes = p.cortes_aerocivil()
    con = json.loads((OUT / "conectividad.json").read_text(encoding="utf-8"))
    con.update(cortes)
    p.write("conectividad.json", con)
    print("aero", len(cortes["aeropuertos"]), len(cortes["aerolineas"]), len(cortes["carga"]))

    for nombre, fn in (
        ("mincit_vnr.json", p.mincit_vnr),
        ("migracion_entradas.json", p.migracion_entradas),
        ("trm_banrep.json", p.trm_banrep),
    ):
        try:
            payload = fn()
            p.write(nombre, payload)
            print(nombre, len(payload.get("serie") or []))
        except Exception:
            errores.append(nombre + ": " + traceback.format_exc(limit=2))
            print(nombre, "fallo")

    evi = p.agregar_evi()
    for ola in evi.get("olas") or []:
        ola.pop("paises_peso", None)
    p.write("evi.json", evi)
    print("evi olas", len(evi.get("olas") or []), "meses", len(evi.get("meses") or []))

    ema = p.ema()
    p.write("ema.json", ema)
    print("ocupacion", len((ema.get("ocupacion") or {}).get("serie") or []))

    for nombre, fn in (("gdelt.json", p.gdelt), ("tendencias.json", p.tendencias_google)):
        try:
            payload = fn()
            p.write(nombre, payload)
            print(nombre, len(payload.get("serie") or []))
        except Exception:
            errores.append(nombre + ": " + traceback.format_exc(limit=2))
            print("pendiente cuota", nombre)

    guardar_manifiesto(errores)
