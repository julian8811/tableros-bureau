/**
 * Paquete de evidencia = toda la información que el dashboard presenta,
 * agregada (no dumps crudos de series enormes). Usado por generar-informe.
 */
const fs = require("fs");
const path = require("path");

function openDir() {
  const candidates = [
    path.join(process.cwd(), "api", "_data", "open"),
    path.join(__dirname, "_data", "open"),
    path.join(process.cwd(), "data", "open"),
    path.join(__dirname, "..", "data", "open")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function leer(nombre) {
  const p = path.join(openDir(), nombre);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    return null;
  }
}

function ultimo(arr, n) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(-n);
}

function topN(arr, n) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, n);
}

function redondear(valor, profundidad) {
  if (profundidad <= 0) return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    if (Math.abs(valor) >= 100) return Math.round(valor);
    if (Math.abs(valor) >= 10) return Math.round(valor * 10) / 10;
    return Math.round(valor * 100) / 100;
  }
  if (Array.isArray(valor)) {
    return valor.map(function (x) {
      return redondear(x, profundidad - 1);
    });
  }
  if (valor && typeof valor === "object") {
    var out = {};
    Object.keys(valor).forEach(function (k) {
      out[k] = redondear(valor[k], profundidad - 1);
    });
    return out;
  }
  return valor;
}

function yoyMap(anual, campoValor) {
  if (!Array.isArray(anual)) return [];
  var sorted = anual.slice().sort(function (a, b) {
    return (a.anio || 0) - (b.anio || 0);
  });
  return sorted.map(function (f, i) {
    var prev = i > 0 ? sorted[i - 1] : null;
    var v = Number(f[campoValor]);
    var row = Object.assign({}, f);
    if (prev && Number(prev[campoValor]) > 0 && Number.isFinite(v)) {
      row.yoy_pct = Math.round(((v / Number(prev[campoValor])) - 1) * 1000) / 10;
    }
    return row;
  });
}

function agregaConectividad(doc) {
  if (!doc || !Array.isArray(doc.serie)) return null;
  var porMercadoAnio = {};
  var porMercadoMes = {};
  doc.serie.forEach(function (f) {
    var m = f.mercado || "—";
    var ya = m + "|" + f.anio;
    if (!porMercadoAnio[ya]) {
      porMercadoAnio[ya] = { mercado: m, anio: f.anio, llegadas: 0, salidas: 0, pasajeros: 0 };
    }
    porMercadoAnio[ya].llegadas += Number(f.llegadas) || 0;
    porMercadoAnio[ya].salidas += Number(f.salidas) || 0;
    porMercadoAnio[ya].pasajeros += Number(f.pasajeros) || 0;
    var ym = (f.anio * 100) + (f.mes || 0);
    var key = m + "|" + ym;
    porMercadoMes[key] = {
      mercado: m, anio: f.anio, mes: f.mes,
      llegadas: Number(f.llegadas) || 0,
      salidas: Number(f.salidas) || 0,
      pasajeros: Number(f.pasajeros) || 0
    };
  });
  var anual = Object.keys(porMercadoAnio).map(function (k) { return porMercadoAnio[k]; });
  var mensual = Object.keys(porMercadoMes).map(function (k) { return porMercadoMes[k]; })
    .sort(function (a, b) { return (a.anio - b.anio) || (a.mes - b.mes); });
  return {
    fuente: doc.fuente,
    mercados: doc.mercados,
    aeropuertos: doc.aeropuertos,
    anual_por_mercado: anual,
    serie_mensual_reciente: ultimo(mensual, 60),
    nota: "Serie completa del tablero agregada; no se envían las 270 filas crudas al LLM."
  };
}

function agregaMedata(doc) {
  if (!doc || !Array.isArray(doc.serie)) return null;
  var porZona = {};
  doc.serie.forEach(function (f) {
    var z = f.tar_zona || "—";
    var per = Number(f.tar_periodo) || 0;
    var val = Number(f.tar_valor);
    if (!porZona[z] || per >= porZona[z].periodo) {
      porZona[z] = { zona: z, periodo: per, tarifa: val };
    }
  });
  var zonas = Object.keys(porZona).map(function (k) { return porZona[k]; });
  var ultimos = doc.serie.slice().sort(function (a, b) {
    return Number(a.tar_periodo) - Number(b.tar_periodo);
  });
  return {
    fuente: doc.fuente,
    corte_publicacion: doc.corte_publicacion,
    ultimo_por_zona: zonas,
    serie_reciente: ultimo(ultimos, 48)
  };
}

function agregaPaises(doc) {
  if (!doc || !Array.isArray(doc.serie)) return null;
  var porAnio = {};
  doc.serie.forEach(function (f) {
    var y = f.anio;
    if (!porAnio[y]) porAnio[y] = [];
    porAnio[y].push(f);
  });
  var tops = {};
  Object.keys(porAnio).forEach(function (y) {
    tops[y] = porAnio[y]
      .slice()
      .sort(function (a, b) { return (Number(b.llegadas) || 0) - (Number(a.llegadas) || 0); })
      .slice(0, 20);
  });
  var mercadosPrior = ["ESTADOS UNIDOS", "MEXICO", "BRASIL", "COLOMBIA", "ESPANA", "PERU", "ARGENTINA", "CHILE", "ECUADOR", "PANAMA"];
  var priorizados = doc.serie.filter(function (f) {
    return mercadosPrior.indexOf(String(f.pais || "").toUpperCase()) >= 0 ||
      mercadosPrior.indexOf(String(f.mercado || "").toUpperCase()) >= 0;
  });
  return {
    fuente: doc.fuente,
    top20_por_anio: tops,
    mercados_priorizados: priorizados,
    n_filas_totales: doc.serie.length
  };
}

function agregaSeguridad(doc) {
  if (!doc || !Array.isArray(doc.serie)) return null;
  var porAnioTipo = {};
  doc.serie.forEach(function (f) {
    var y = f.anio || f.periodo || "—";
    var t = f.tipo || f.delito || f.categoria || "total";
    var key = y + "|" + t;
    if (!porAnioTipo[key]) porAnioTipo[key] = { anio: y, tipo: t, valor: 0 };
    porAnioTipo[key].valor += Number(f.valor != null ? f.valor : f.casos != null ? f.casos : f.n) || 0;
  });
  return {
    fuente: doc.fuente,
    agregados: Object.keys(porAnioTipo).map(function (k) { return porAnioTipo[k]; }),
    muestra_reciente: ultimo(doc.serie, 24)
  };
}

function agregaPronostico(doc) {
  if (!doc) return null;
  return {
    fuente: doc.fuente,
    generado: doc.generado,
    horizonte_meses: doc.horizonte_meses,
    resumen: doc.resumen,
    fuera: doc.fuera,
    series: (doc.series || []).map(function (s) {
      return {
        id: s.id || s.serie || s.nombre,
        mercado: s.mercado || s.pais,
        metrica: s.metrica,
        modelo: s.modelo,
        mape: s.mape || s.error,
        puntos: ultimo(s.puntos || s.serie || s.forecast || [], 12)
      };
    })
  };
}

function agregaCalendario(doc) {
  if (!doc) return null;
  return {
    fuente: doc.fuente,
    serie: doc.serie || doc.feriados || [],
    estaciones: doc.estaciones || null,
    resumen: doc.resumen || null
  };
}

function cifasInformeGestion() {
  return {
    fuente: "Informe de gestión 2025, Greater Medellín Convention & Visitors Bureau",
    url: "https://bureaumedellin.com/wp-content/uploads/2026/02/INFORME-2_Entrega3.pdf",
    anio: 2025,
    flujo: [
      { etiqueta: "Eventos investigados", valor: "más de 370" },
      { etiqueta: "Candidaturas presentadas", valor: "30" },
      { etiqueta: "Eventos captados y apoyados", valor: "103", detalle: "59 internacionales y 44 nacionales" }
    ],
    captados: 103,
    internacionales: 59,
    nacionales: 44,
    impactoUsd: 156168654,
    asistentes: 242019,
    cuartosNoche: 752214,
    realizados: { eventos: 111, asistentes: 266875, derramaMillonesUsd: 167 },
    miembros: 200,
    altas: 23,
    segmentosAltas: ["Agencias de viaje receptivo", "Alojamientos", "Operadores de eventos", "Recintos", "Proveedores de servicios"],
    rueda: { miembros: 68, citas: 433, cumplieron: 418, expectativa: 7925390000, efectividadInforme: 0.965 },
    satisfaccion: 4.9,
    satisfaccionEscala: 5
  };
}

/**
 * Paquete compacto para cuentas Groq de bajo TPM (~8k).
 * Cubre todos los tableros con agregados cortos (no series largas).
 */
function armarPaqueteCompacto() {
  var mincit = leer("mincit_vnr.json");
  var migracion = leer("migracion_entradas.json");
  var trm = leer("trm_banrep.json");
  var evi = leer("evi.json");
  var ema = leer("ema.json");
  var icca = leer("icca.json");
  var conect = leer("conectividad.json");
  var medata = leer("medata_tarifas.json");
  var marca = leer("bureau_marca_llm.json");
  var sit = leer("bureau_sit.json");
  var prensa = leer("bureau_prensa.json");
  var oferta = leer("bureau_oferta.json");
  var seguridad = leer("bureau_seguridad.json");
  var clima = leer("bureau_clima.json");
  var owid = leer("bureau_owid.json");
  var pronostico = leer("bureau_pronostico.json");
  var huella = leer("huella.json");

  var conectAgg = agregaConectividad(conect);
  var ola = evi && Array.isArray(evi.olas) ? evi.olas[0] : null;
  var pack = {
    meta: {
      corte_sugerido: new Date().toISOString().slice(0, 10),
      modo: "compacto_tpm",
      cobertura: "Todos los tableros, agregados cortos (límite Groq TPM)"
    },
    mincit_vnr: mincit ? {
      shares_anual: ultimo(mincit.shares && mincit.shares.anual, 4),
      top_paises_2025: topN((mincit.top_paises && mincit.top_paises["2025"]) || [], 10),
      top_paises_2026: topN((mincit.top_paises && mincit.top_paises["2026"]) || [], 10),
      serie_ult6: ultimo(mincit.serie, 6)
    } : null,
    migracion: migracion ? {
      anual: ultimo(yoyMap(migracion.anual, "entradas"), 4),
      top_paises: topN(migracion.top_paises, 8)
    } : null,
    trm_ultimo: trm && trm.serie ? trm.serie[trm.serie.length - 1] : null,
    ema_ult6: ema ? ultimo(ema.serie, 6) : null,
    medata_zonas: (agregaMedata(medata) || {}).ultimo_por_zona || null,
    icca: icca ? { anio: icca.anio, ciudades: icca.ciudades } : null,
    conectividad_anual: conectAgg ? conectAgg.anual_por_mercado : null,
    marca_llm: marca ? {
      ventana: marca.ventana,
      n_total: marca.n_total,
      top_topico_global: marca.top_topico_global,
      serie: marca.serie
    } : null,
    prensa_n: prensa && prensa.serie ? prensa.serie.length : 0,
    sit: sit ? sit.serie : null,
    evi_ola: ola ? {
      ola: ola.ola,
      n: ola.n,
      gasto_estadia_usd: ola.gasto_estadia_usd,
      gasto_diario_usd: ola.gasto_diario_usd,
      noches: ola.noches,
      motivos: topN(ola.motivos, 5),
      residencia: topN(ola.residencia, 6)
    } : null,
    huella: huella,
    oferta_n: oferta && oferta.serie ? oferta.serie.length : 0,
    seguridad_muestra: seguridad ? topN(seguridad.serie, 8) : null,
    clima: clima ? { fuente: clima.fuente, resumen: clima.resumen || clima.serie && topN(clima.serie, 3) } : null,
    owid_top: owid ? topN(owid.serie, 8) : null,
    pronostico: pronostico ? {
      generado: pronostico.generado,
      series: topN((pronostico.series || []).map(function (s) {
        return { id: s.id || s.nombre, mercado: s.mercado, mape: s.mape, modelo: s.modelo };
      }), 6)
    } : null,
    informe_gestion_2025: cifasInformeGestion()
  };
  return redondear(pack, 8);
}

function armarPaqueteDashboard(opts) {
  opts = opts || {};
  if (opts.compacto !== false) {
    // Por defecto compacto: la cuenta Groq on_demand tiene TPM bajo.
    return armarPaqueteCompacto();
  }
  var mincit = leer("mincit_vnr.json");
  var migracion = leer("migracion_entradas.json");
  var trm = leer("trm_banrep.json");
  var evi = leer("evi.json");
  var ema = leer("ema.json");
  var icca = leer("icca.json");
  var conect = leer("conectividad.json");
  var medata = leer("medata_tarifas.json");
  var huella = leer("huella.json");
  var bConect = leer("bureau_conectividad.json");
  var marca = leer("bureau_marca_llm.json");
  var paises = leer("bureau_paises_2025_2026.json");
  var sit = leer("bureau_sit.json");
  var prensa = leer("bureau_prensa.json");
  var oferta = leer("bureau_oferta.json");
  var seguridad = leer("bureau_seguridad.json");
  var clima = leer("bureau_clima.json");
  var owid = leer("bureau_owid.json");
  var calendario = leer("bureau_calendario.json");
  var pronostico = leer("bureau_pronostico.json");
  var manifiesto = leer("manifiesto.json");

  var pack = {
    meta: {
      corte_sugerido: new Date().toISOString().slice(0, 10),
      modelo_referencia: "TEC Primer Semestre 2026 (ProColombia) — adaptar a Medellín / Bureau con datos del tablero",
      cobertura: "Todos los tableros del dashboard (Mercados, Visitante, Captación, Miembros) vía agregados data/open + informe gestión 2025",
      exclusiones_crudas: [
        "conectividad.json filas crudas (se envía agregado anual/mensual)",
        "bureau_conectividad.benchmark_eu completo (solo top)",
        "Wikipedia / CRM"
      ],
      reglas: [
        "Cite solo claves de este paquete en fuente.",
        "No mezcle MinCIT VNR, Migración Colombia y Aerocivil.",
        "Redondeo: enteros grandes sin decimales; % a 1 decimal.",
        "Cada sección debe traer insights accionables (qué implica para el Bureau), no solo describir la cifra.",
        "Incluya tablas estilo TEC (país/ciudad, año base, año corte, % part, % var) cuando los datos lo permitan."
      ]
    },
    tablero_mercados: {
      conectividad_aerocivil: agregaConectividad(conect),
      mincit_vnr: mincit ? {
        fuente: mincit.fuente,
        universo: mincit.universo,
        shares_anual: mincit.shares && mincit.shares.anual,
        anual_medellin: yoyMap(mincit.anual, "visitantes"),
        anual_antioquia: mincit.antioquia,
        anual_rionegro: mincit.rionegro,
        anual_colombia: mincit.colombia,
        serie_mensual: ultimo(mincit.serie, 24),
        top_paises: mincit.top_paises,
        mercados: mincit.mercados,
        comparables: mincit.comparables
      } : null,
      migracion_entradas: migracion ? {
        fuente: migracion.fuente,
        universo: migracion.universo,
        anual: yoyMap(migracion.anual, "entradas"),
        serie_mensual: ultimo(migracion.serie, 24),
        top_paises: migracion.top_paises,
        mercados: migracion.mercados
      } : null,
      trm_banrep: trm ? {
        fuente: trm.fuente,
        serie_completa: trm.serie,
        ultimo: trm.serie && trm.serie[trm.serie.length - 1]
      } : null,
      icca: icca ? { fuente: icca.fuente, anio: icca.anio, ciudades: icca.ciudades, nota: icca.nota } : null,
      ema: ema ? {
        fuente: ema.fuente,
        ocupacion: ema.ocupacion,
        serie: ema.serie
      } : null,
      medata_tarifas: agregaMedata(medata),
      marca_llm: marca,
      prensa: prensa ? { fuente: prensa.fuente, serie: prensa.serie } : null,
      paises_etl: agregaPaises(paises),
      sit: sit,
      owid: owid ? {
        fuente: owid.fuente,
        serie_top: topN(owid.serie, 25),
        colombia_serie: owid.colombia_serie,
        regiones: owid.regiones,
        cortes: owid.cortes
      } : null,
      bureau_conectividad: bConect ? {
        fuente: bConect.fuente,
        ventana: bConect.ventana,
        cortes: bConect.cortes,
        serie: bConect.serie,
        trm_serie: bConect.trm_serie,
        benchmark_eu_top: topN(
          (bConect.benchmark_eu || []).slice().sort(function (a, b) {
            return (Number(b.sillas || b.asientos || b.capacidad || b.valor) || 0) -
              (Number(a.sillas || a.asientos || a.capacidad || a.valor) || 0);
          }),
          25
        ),
        bts_colombia: bConect.bts_colombia,
        ipc_colombia: bConect.ipc_colombia,
        retiradas: bConect.retiradas,
        skips: bConect.skips
      } : null,
      pronostico: agregaPronostico(pronostico)
    },
    tablero_visitante: {
      evi: evi ? {
        fuente: evi.fuente,
        universo: evi.universo,
        aeropuertos_en_la_base: evi.aeropuertos_en_la_base,
        olas: evi.olas
      } : null,
      huella: huella,
      oferta: oferta ? { fuente: oferta.fuente, serie: oferta.serie } : null,
      seguridad: agregaSeguridad(seguridad),
      clima: clima,
      calendario: agregaCalendario(calendario)
    },
    tablero_captacion_miembros: {
      informe_gestion_2025: cifasInformeGestion()
    },
    manifiesto: manifiesto ? {
      generado: manifiesto.generado,
      piezas: (manifiesto.piezas || []).map(function (p) {
        return { id: p.id, archivo: p.archivo, estado: p.estado, n: p.n };
      }),
      nota: manifiesto.nota
    } : null
  };

  return redondear(pack, 10);
}

module.exports = { armarPaqueteDashboard, armarPaqueteCompacto, openDir, leer };
