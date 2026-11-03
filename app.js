(function () {
  "use strict";

  var state = {
    tab: "mercados",
    anio: 2025,
    pais: "Todos",
    vistaOwid: 'top',
    pronostico: "",
    ficha: null,
    volverFicha: "",
    calc: { inspecciones: "", confirmadas: "", stockInicial: "", cuota: "", anos: "" },
    informesSel: null,
    informeGen: "",
    informeError: "",
    llmProviders: null,
    llmModes: null,
    llmChain: null,
    informeProvider: "cadena",
    informeModel: "",
    pieza: "infografia"
  };

  var PAIS_DE_MERCADO = { Colombia: "COLOMBIA", "Estados Unidos": "ESTADOS UNIDOS", "México": "MEXICO", Brasil: "BRASIL" };
  var CIUDAD_DE_PAIS = {
    PANAMA: "Ciudad de Panamá",
    "REPUBLICA DOMINICANA": "Santo Domingo",
    ECUADOR: "Quito",
    ARGENTINA: "Buenos Aires",
    CHILE: "Santiago",
    ESPANA: "Madrid",
    PERU: "Lima",
    COLOMBIA: "Medellín",
    MEXICO: "Ciudad de México",
    BRASIL: "São Paulo"
  };

  var DATA = {};
  var MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  var MERCADOS = ["Colombia", "Estados Unidos", "México", "Brasil", "Europa"];
  var DESTINOS = ["Medellín", "Bogotá", "Cartagena", "Ciudad de México", "São Paulo", "Lima"];
  var COLOR = {
    /* Colores de serie visibles sobre fondo navy (evitar #172139 en líneas) */
    Colombia: "#FBBB28", "Estados Unidos": "#E9901E", "México": "#00AEAC", Brasil: "#B4C42C", Europa: "#108181",
    MDE: "#108181", EOH: "#E9901E", CENTRO: "#FBBB28", LAURELES: "#108181", POBLADO: "#E9901E"
  };

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function num(value, digits) {
    if (value == null || isNaN(value)) return "—";
    return Number(value).toLocaleString("es-CO", { maximumFractionDigits: digits == null ? 0 : digits, minimumFractionDigits: digits == null ? 0 : digits });
  }

  function pesos(value) {
    if (value == null) return "—";
    return "$" + num(value, 0);
  }

  function usd(value) {
    if (value == null) return "—";
    return "USD " + num(value, value >= 100 ? 0 : 2);
  }

  function pastilla(id) {
    var ficha = window.fichaPorId(id);
    return '<span class="pastilla ' + ficha.clase + '">' + esc(ficha.pastilla) + "</span>";
  }

  function kpi(id, label, value, meta) {
    return '<article class="kpi"><button class="hit" type="button" data-ficha="' + id + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div><div class="meta">' + pastilla(id) + (meta ? " · " + esc(meta) : "") + "</div></button></article>";
  }

  function block(title, hint, body) {
    return '<section class="block"><h3>' + esc(title) + '</h3>' + (hint ? '<span class="hint">' + hint + "</span>" : "") + body + "</section>";
  }

  function grupo(titulo, celdas) {
    return '<section class="grupo"><h2>' + esc(titulo) + '</h2><div class="lienzo">' + celdas + "</div></section>";
  }

  function celda(clase, html) {
    return '<div class="' + clase + '">' + html + "</div>";
  }

  function hueco(titulo, texto) {
    return '<div class="hueco"><strong>' + esc(titulo) + "</strong><p>" + texto + "</p></div>";
  }

  function pie(texto) {
    return '<p class="src">Fuente: ' + esc(texto) + "</p>";
  }

  function cobertura(serie) {
    var meses = (serie || []).filter(function (row) { return row.anio === state.anio && row.mes; }).map(function (row) { return row.mes; });
    if (!meses.length) return "sin meses en " + state.anio;
    return MESES[Math.min.apply(null, meses) - 1] + "–" + MESES[Math.max.apply(null, meses) - 1] + " " + state.anio;
  }

  function extraido(clave) {
    var d = String((DATA[clave] || {}).descarga || "");
    return d ? " · extraído " + d : "";
  }

  function notaSim(supuesto) {
    return '<p class="nota-sim"><span class="pastilla simulacion">Simulación</span> Simulación. No es una cifra del Bureau ni de una base abierta. Supuesto: ' + supuesto + "</p>";
  }

  function fold(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  }

  function etiquetaPais(pais) {
    if (!pais || pais === "Todos") return "Todos";
    return String(pais).toLowerCase().replace(/(^|\s)\S/g, function (letra) { return letra.toUpperCase(); });
  }

  function mercadoDe(pais) {
    if (!pais || pais === "Todos") return "";
    var fila = ((DATA.conectividad && DATA.conectividad.paises) || []).find(function (row) {
      return row.pais === pais && row.mercado;
    });
    return fila ? fila.mercado : "";
  }

  function leerUrl() {
    var q = new URLSearchParams(location.search);
    var tabs = ["mercados", "visitante", "captacion", "miembros", "informes"];
    if (tabs.indexOf(q.get("tab")) >= 0) state.tab = q.get("tab");
    var anio = Number(q.get("anio"));
    if (anio) state.anio = anio;
    if (q.get("pais")) state.pais = q.get("pais");
    if (q.get("serie")) state.pronostico = q.get("serie");
    var piezas = ["infografia", "boletin", "informe"];
    if (piezas.indexOf(q.get("pieza")) >= 0) state.pieza = q.get("pieza");
  }

  function escribirUrl() {
    var q = new URLSearchParams();
    q.set("tab", state.tab);
    q.set("anio", String(state.anio));
    q.set("pais", state.pais);
    if (state.pronostico) q.set("serie", state.pronostico);
    if (state.tab === "informes") q.set("pieza", state.pieza || "infografia");
    var siguiente = "?" + q.toString();
    if (location.search !== siguiente) history.replaceState({ tab: state.tab, anio: state.anio, pais: state.pais }, "", siguiente);
  }

  function filasAnio(serie, anio) {
    return (serie || []).filter(function (row) { return row.anio === anio; });
  }

  function trimestre(mes) {
    return Math.floor((mes - 1) / 3) + 1;
  }

  function olaPara(anio) {
    var olas = (DATA.evi && DATA.evi.olas) || [];
    var nombre = anio <= 2024 ? "Agosto 2023 – julio 2024" : "Enero – junio 2025";
    var cobertura = { "Agosto 2023 – julio 2024": [2023, 2024], "Enero – junio 2025": [2025] };
    var hallada = olas.find(function (ola) { return ola.ola === nombre; });
    if (hallada) {
      var cubre = (cobertura[hallada.ola] || []).indexOf(anio) >= 0;
      return { ola: hallada, aviso: cubre ? "" : "Última ola publicada (" + hallada.ola + "). " + anio + " no tiene microdato en el catálogo 869." };
    }
    if (olas.length) return { ola: olas[olas.length - 1], aviso: "Se muestra la última ola publicada." };
    return { ola: null, aviso: "" };
  }

  function sumaMercado(filas, campo) {
    var cubo = {};
    MERCADOS.forEach(function (m) { cubo[m] = 0; });
    filas.forEach(function (row) {
      if (cubo[row.mercado] != null) cubo[row.mercado] += row[campo] || 0;
    });
    return cubo;
  }

  function puntosMes(filas, campo, mercado) {
    var puntos = [];
    for (var mes = 1; mes <= 12; mes++) {
      var y = filas.filter(function (row) {
        return row.mes === mes && (!mercado || row.mercado === mercado);
      }).reduce(function (s, row) { return s + (row[campo] || 0); }, 0);
      if (y) puntos.push({ x: MESES[mes - 1], y: y });
    }
    return puntos;
  }

  function rankingPaises() {
    var filas = filasAnio(DATA.conectividad.paises || [], state.anio);
    var cubo = {};
    filas.forEach(function (row) {
      if (!cubo[row.pais]) cubo[row.pais] = { pais: row.pais, llegadas: 0, priorizado: false, mercado: row.mercado || "" };
      cubo[row.pais].llegadas += row.llegadas || 0;
      if (row.priorizado) cubo[row.pais].priorizado = true;
      if (row.mercado) cubo[row.pais].mercado = row.mercado;
    });
    return Object.keys(cubo).map(function (k) { return cubo[k]; }).sort(function (a, b) { return b.llegadas - a.llegadas; });
  }

  function bloquePronostico(tab) {
    var data = DATA.bureauPronostico || {};
    var series = (data.series || []).filter(function (item) { return item.tab === tab; });
    if (!series.length) return hueco("Pronóstico", "El ETL todavía no publica pronosticos.json.");
    if (!series.some(function (item) { return item.id === state.pronostico; })) state.pronostico = series[0].id;
    var s = series.filter(function (item) { return item.id === state.pronostico; })[0];
    var corto = { estacional: "Mes anterior", holt_winters: "Holt-Winters", sarima: "SARIMA", gradiente: "Gradiente", lightgbm: "LightGBM" };
    var etiquetas = {
      llegadas_colombia: "Colombia", llegadas_estados_unidos: "Estados Unidos", llegadas_mexico: "México",
      llegadas_brasil: "Brasil", llegadas_europa: "Europa", llegadas_cinco: "Cinco mercados",
      trm_mensual: "TRM",
      ocupacion_antioquia: "Antioquia", ocupacion_nacional: "Nacional", tarifa_antioquia: "Tarifa",
      ingresos_reales: "Ingresos", homicidios: "Homicidios", hurtos: "Hurtos"
    };
    function etq(periodo) {
      var m = Number(String(periodo).slice(5, 7));
      return (MESES[m - 1] || periodo) + " " + String(periodo).slice(2, 4);
    }
    function fmt(valor) { return num(valor, s.decimales || 0); }
    function digMae(valor) { return Math.abs(valor) >= 100 ? 1 : 2; }
    var hist = (s.historico || []).slice(-18);
    var fut = s.pronostico || [];
    var ancla = hist.length ? [{ x: etq(hist[hist.length - 1].periodo), y: hist[hist.length - 1].valor }] : [];
    var chart = Charts.multiLine([
      { name: "Observado", color: "#195855", points: hist.map(function (p) { return { x: etq(p.periodo), y: p.valor }; }) },
      { name: "Pronóstico", color: "#E9901E", points: ancla.concat(fut.map(function (p) { return { x: etq(p.periodo), y: p.valor }; })) }
    ], { xLabel: "Mes", yLabel: s.unidad || "Valor" });
    var botones = series.map(function (item) {
      return '<button type="button" class="tab' + (item.id === s.id ? " active" : "") + '" data-pronostico="' + esc(item.id) + '">' + esc(etiquetas[item.id] || item.nombre) + "</button>";
    }).join("");
    var filas = (s.comparacion || []).map(function (c) {
      return "<tr><td>" + esc(c.etiqueta) + (c.modelo === s.modelo ? " · publicado" : "") + "</td><td class=\"num\">" + num(c.mae, digMae(c.mae)) + "</td><td class=\"num\">" + (c.mape == null ? "—" : num(c.mape, 1) + " %") + "</td></tr>";
    }).join("");
    var ultimo = fut[fut.length - 1];
    var notasRaw = s.notas || [];
    var notasTitulos = ["Qué mide", "Modelo elegido", "Banda del ensayo", "Qué no mide"];
    var notasCards = notasRaw.map(function (n, i) {
      return '<article class="note-card"><b>' + esc(notasTitulos[i] || ("Nota " + (i + 1))) + "</b>" + esc(n) + "</article>";
    }).join("");
    var notesRail = notasRaw.length
      ? '<div class="notes-rail" aria-label="Notas del modelo"><div class="notes-track">' + notasCards + notasCards + "</div></div>"
      : "";
    var cierre = ultimo ? " a " + esc(ultimo.periodo) + ": " + fmt(ultimo.valor) + " (" + fmt(ultimo.bajo) + " a " + fmt(ultimo.alto) + ")" : "";
    return '<p class="aviso">' + esc((data.resumen || {}).frase || "") + "</p>" +
      '<div class="kpi-row">' +
      kpi("bureau-pronostico", "Modelo publicado", esc(corto[s.modelo] || s.modelo), s.supera_estacional ? "mejora el mes anterior" : "se queda el mes anterior") +
      kpi("bureau-pronostico", "MAE del ensayo", num(s.mae, digMae(s.mae)), "mes anterior " + num(s.mae_estacional, digMae(s.mae_estacional))) +
      kpi("bureau-pronostico", "Corte observado", esc(s.corte), "6 meses hacia adelante") +
      kpi("bureau-pronostico", "Banda del ensayo", "±" + fmt(s.banda), s.unidad) +
      "</div>" +
      block(s.nombre, "Últimos 18 meses observados y 6 de pronóstico. La línea punteada no es una meta.",
        '<div class="tabs" role="tablist">' + botones + "</div>" + chart +
        "<p class=\"hint\">" + esc(s.nombre) + cierre + ". MAE en " + esc(s.unidad) + " sobre los últimos 6 meses. El MAPE de conteos bajos, como los homicidios, se infla y no elige el modelo.</p>" +
        "<table class=\"table\"><thead><tr><th>Modelo</th><th>MAE</th><th>MAPE</th></tr></thead><tbody>" + filas + "</tbody></table>" +
        notesRail +
        "<p class=\"hint\">" + esc(data.fuera || "") + "</p>" +
        pie("ETL Bureau · ensayo de 6 meses sobre la serie observada, corte " + (s.corte || "") + extraido("bureauPronostico")));
  }

  function vistaMercados() {
    var con = filasAnio(DATA.conectividad.serie, state.anio);
    var ema = filasAnio(DATA.ema.serie, state.anio);
    var ultimo = ema[ema.length - 1];
    var totalP;
    var totalL;
    var movimiento;
    var titulo;
    var pista;
    if (state.pais === "Todos") {
      var pasajeros = sumaMercado(con, "pasajeros");
      var llegadas = sumaMercado(con, "llegadas");
      totalP = MERCADOS.reduce(function (s, m) { return s + (pasajeros[m] || 0); }, 0);
      totalL = MERCADOS.reduce(function (s, m) { return s + (llegadas[m] || 0); }, 0);
      movimiento = Charts.multiLine(MERCADOS.map(function (m) {
        return { name: m, color: COLOR[m], pais: PAIS_DE_MERCADO[m] || "", points: puntosMes(con, "pasajeros", m) };
      }).filter(function (s) { return s.points.length; }), { xLabel: "Mes", yLabel: "Pasajeros" });
      titulo = "Pasajeros por mercado y mes";
      pista = "Aerocivil. Los cinco mercados de la lista. Un clic en el punto elige el país.";
    } else {
      var delPais = filasAnio(DATA.conectividad.paises || [], state.anio).filter(function (row) { return row.pais === state.pais; });
      totalP = delPais.reduce(function (s, row) { return s + (row.pasajeros || 0); }, 0);
      totalL = delPais.reduce(function (s, row) { return s + (row.llegadas || 0); }, 0);
      var fichaPais = delPais[0] || {};
      movimiento = Charts.stacked([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (mes) {
        var fila = delPais.filter(function (row) { return row.mes === mes; })[0] || {};
        return {
          label: MESES[mes - 1],
          pais: state.pais,
          parts: [
            { name: "Llegadas", value: fila.llegadas || 0, color: "#E9901E", pais: state.pais },
            { name: "Salidas", value: fila.salidas || 0, color: "#108181", pais: state.pais }
          ]
        };
      }).filter(function (item) { return item.parts[0].value || item.parts[1].value; }), { xLabel: "Mes", yLabel: "Pasajeros" });
      titulo = "Llegadas y salidas";
      pista = "Aerocivil. " + etiquetaPais(state.pais) + (fichaPais.priorizado ? " · lista Bureau" + (fichaPais.mercado ? " · " + fichaPais.mercado : "") : " · fuera de la lista") + ".";
    }
    var html = '<div class="kpi-row">' +
      kpi("conectividad", "Pasajeros del año", num(totalP), state.pais === "Todos" ? "cinco mercados" : etiquetaPais(state.pais)) +
      kpi("reservas", "Llegadas del año", num(totalL), "realizadas, no reservas") +
      kpi("tarifas", "Antioquia vs regiones", ultimo ? num(ultimo.indice_100, 1) : "—", ultimo ? MESES[ultimo.mes - 1] + " " + state.anio : "sin corte") +
      kpi("icca", "Reuniones ICCA Medellín", "26", "puesto 103 · 2025") +
      "</div>";
    html += grupo("Mapa mundi · emisores", celda("span-12", bloqueMapaEmisores()));
    html += grupo("Conectividad", 
      celda("span-12", block(titulo, pista, (movimiento || hueco("Sin mes", "Este año no tiene pasajeros de ese país en el agregado.")) + pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad")))) +
      celda("span-7", otrosOrigenes()) +
      celda("span-5", aeropuertos()) +
      celda("span-7", aerolineas()) +
      celda("span-5", carga()));
    html += grupo("Destino y precios",
      celda("span-12", tarifas()) +
      celda("span-12", regionesOcupacion()) +
      celda("span-8", vozDigital()) +
      celda("span-4", icca()) +
      celda("span-12", medataFigura()) +
      celda("span-12", marcaLLM()) +
      celda("span-12", bloqueConectividad()) +
      celda("span-12", bloqueOwid()) +
      celda("span-12", bloqueSit()));
    html += grupo("Contexto MinCIT · visitantes no residentes", celda("span-12", bloqueMincitVnr()));
    html += grupo("Contexto Migración Colombia", celda("span-12", bloqueMigracion()));
    html += grupo("Contexto cambiario", celda("span-12", bloqueTrm()));
    html += grupo("Participación Aerocivil", celda("span-12", conversion()));
    html += grupo("Pronóstico", celda("span-12", bloquePronostico("mercados")));
    return html;
  }

  function filasMapaEmisores() {
    var anio = String(state.anio);
    var mincit = ((DATA.mincitVnr || {}).top_paises && (DATA.mincitVnr.top_paises[anio] || DATA.mincitVnr.top_paises[state.anio])) || [];
    var mig = ((DATA.migracion || {}).top_paises && (DATA.migracion.top_paises[anio] || DATA.migracion.top_paises[state.anio])) || [];
    var ola = ((DATA.evi || {}).olas && DATA.evi.olas[0]) || DATA.evi || {};
    var eviRes = ola.residencia || ((DATA.evi || {}).residencia) || [];
    if (!eviRes.length && DATA.evi && DATA.evi.ultima) eviRes = DATA.evi.ultima.residencia || [];
    if (window.Mapas && Mapas.mergeEmisores) {
      return Mapas.mergeEmisores([
        { rows: mig.map(function (r) { return { pais: r.pais, visitantes: r.entradas || r.visitantes }; }), weight: 1 },
        { rows: mincit.map(function (r) { return { pais: r.pais, visitantes: r.visitantes }; }), weight: 0.9 },
        { rows: eviRes.map(function (r) { return { pais: r.nombre || r.pais, visitantes: r.peso || r.visitantes, participacion: r.participacion }; }), weight: 0.7 }
      ]);
    }
    return mincit.concat(mig.map(function (r) {
      return { pais: r.pais, visitantes: r.entradas || r.visitantes };
    }));
  }

  function bloqueMapaEmisores() {
    if (!window.Mapas || !Mapas.shell) {
      return hueco("Mapa no cargado", "Falta mapas.js en el bundle.");
    }
    if (!filasMapaEmisores().length) {
      return hueco("Sin emisores para el mapa", "Sin top_paises MinCIT/Migración ni EVI residencia en el corte " + state.anio + ".");
    }
    return Mapas.shell({
      id: "mapa-dash-emisores",
      height: 480,
      titulo: "Mapa mundi · densidad de países emisores (" + state.anio + ")",
      pista: "Unión Migración Colombia + MinCIT Medellín + EVI residencia. Glass Bureau/V7 · Natural Earth + Leaflet (sin API key)."
    });
  }

  function montarMapas() {
    if (!window.Mapas || !Mapas.mount) return;
    var specs = [];
    if (document.getElementById("mapa-dash-emisores")) {
      specs.push({
        id: "mapa-dash-emisores",
        rows: filasMapaEmisores(),
        titulo: "Emisores " + state.anio,
        fuente: "migracion + mincit_vnr + evi · " + state.anio
      });
    }
    if (document.getElementById("mapa-informe-emisores")) {
      specs.push({
        id: "mapa-informe-emisores",
        rows: filasMapaEmisores(),
        titulo: "Emisores internacionales",
        fuente: "pack dashboard · " + state.anio
      });
    }
    if (specs.length) Mapas.mountAll(specs);
  }

  function bloqueMincitVnr() {
    var data = DATA.mincitVnr || {};
    var serie = (data.serie || []).filter(function (row) { return row.anio === state.anio; });
    var anual = ((data.anual || []).find(function (row) { return row.anio === state.anio; }) || {}).visitantes;
    var share = ((data.shares && data.shares.anual) || []).find(function (row) { return row.anio === state.anio; });
    var rioAnual = ((((data.rionegro || {}).anual) || []).find(function (row) { return row.anio === state.anio; }) || {}).visitantes;
    var antAnual = ((((data.antioquia || {}).anual) || []).find(function (row) { return row.anio === state.anio; }) || {}).visitantes;
    var mercados = (data.mercados && data.mercados[String(state.anio)]) || [];
    var tops = (data.top_paises && data.top_paises[String(state.anio)]) || [];
    var detalle = (data.paises && data.paises[String(state.anio)]) || [];
    var peers = (data.comparables || []).filter(function (row) { return row.anio === state.anio; });
    var rioSerie = (((data.rionegro || {}).serie) || []).filter(function (row) { return row.anio === state.anio; });
    if (!serie.length && anual == null) {
      return hueco(
        "Sin corte MinCIT",
        "Corra scripts/ampliar_fuentes.py o la extracción MinCIT VNR. El dataset de Migración por José María Córdova sigue sin acceso estable (403)."
      );
    }
    if (state.pais !== "Todos") {
      var filaPais = detalle.find(function (row) { return fold(row.pais) === fold(state.pais); });
      if (!filaPais) {
        filaPais = detalle.find(function (row) {
          return mercadoDe(state.pais) && fold(row.mercado || "") === fold(mercadoDe(state.pais));
        });
      }
      tops = detalle.filter(function (row) {
        if (fold(row.pais) === fold(state.pais)) return true;
        var m = mercadoDe(state.pais);
        return m && fold(row.mercado || "") === fold(m);
      }).slice(0, 12).map(function (row) {
        return { pais: row.pais, visitantes: row.visitantes };
      });
      if (!tops.length && filaPais) tops = [{ pais: filaPais.pais, visitantes: filaPais.visitantes }];
    }
    var puntos = serie.slice().sort(function (a, b) { return a.mes - b.mes; }).map(function (row) {
      return { x: MESES[row.mes - 1], y: row.visitantes };
    });
    var puntosRio = rioSerie.slice().sort(function (a, b) { return a.mes - b.mes; }).map(function (row) {
      return { x: MESES[row.mes - 1], y: row.visitantes };
    });
    var sharesMes = ((data.shares && data.shares.mensual) || []).filter(function (row) { return row.anio === state.anio; });
    var puntosShare = sharesMes.slice().sort(function (a, b) { return a.mes - b.mes; }).map(function (row) {
      return { x: MESES[row.mes - 1], y: (row.share_colombia || 0) * 100 };
    });
    var barrasMercado = Charts.bars(mercados.map(function (row) {
      return {
        label: row.mercado,
        value: row.visitantes,
        text: num(row.visitantes),
        color: row.mercado === "Otros" ? "#195855" : (COLOR[row.mercado] || "#108181")
      };
    }), "#108181", { xLabel: "Visitantes" });
    var barrasPais = tops.length ? Charts.bars(tops.map(function (row) {
      return { label: etiquetaPais(row.pais), value: row.visitantes, text: num(row.visitantes), color: "#00AEAC" };
    }), "#00AEAC", { xLabel: "Visitantes" }) : "";
    var barrasPeer = peers.length ? Charts.bars(peers.map(function (row) {
      return {
        label: row.ciudad,
        value: row.visitantes,
        text: num(row.visitantes),
        color: fold(row.ciudad) === "MEDELLIN" ? "#E9901E" : "#195855"
      };
    }), "#E9901E", { xLabel: "Visitantes" }) : "";
    var universo = data.universo || "Extranjeros no residentes con destino Medellín (MinCIT VNR).";
    return block(
      "Visitantes no residentes · MinCIT",
      pastilla("mincit-vnr") + (state.pais !== "Todos" ? " · filtro " + esc(etiquetaPais(state.pais)) : ""),
      '<p class="hint">' + esc(universo) + "</p>" +
      '<div class="kpi-row" style="margin-bottom:12px">' +
        kpi("mincit-vnr", "Medellín " + state.anio, anual != null ? num(anual) : "—", "destino ciudad") +
        kpi("mincit-vnr", "Share Colombia", share && share.share_colombia != null ? num(share.share_colombia * 100, 1) + " %" : "—", "Medellín / país") +
        kpi("mincit-vnr", "Share Antioquia", share && share.share_antioquia != null ? num(share.share_antioquia * 100, 1) + " %" : "—", "Medellín / dpto") +
        kpi("mincit-vnr", "Rionegro " + state.anio, rioAnual != null ? num(rioAnual) : "—", "otra ciudad · no sumar") +
      "</div>" +
      (puntos.length ? Charts.line(puntos, "#00AEAC", { xLabel: "Mes", yLabel: "Visitantes Medellín" }) : hueco("Sin meses", "Este año no trae serie mensual en el agregado.")) +
      (puntosShare.length ? "<h3 class='mt'>Participación mensual Medellín / Colombia (%)</h3>" + Charts.line(puntosShare, "#FBBB28", { xLabel: "Mes", yLabel: "%" }) : "") +
      "<h3 class='mt'>Mercados priorizados vs otros (Medellín)</h3>" + barrasMercado +
      (barrasPais ? "<h3 class='mt'>Países de residencia" + (state.pais !== "Todos" ? " · filtro activo" : "") + "</h3>" + barrasPais : "") +
      (barrasPeer ? "<h3 class='mt'>Misma operación · ciudades comparables</h3>" + barrasPeer : "") +
      "<h3 class='mt'>Rionegro (universo aparte)</h3>" +
      '<p class="hint">Antioquia ' + state.anio + ": " + (antAnual != null ? num(antAnual) : "—") + ". Rionegro no se suma a Medellín.</p>" +
      (puntosRio.length ? Charts.line(puntosRio, "#195855", { xLabel: "Mes", yLabel: "Visitantes Rionegro" }) : hueco("Sin meses Rionegro", "Sin serie mensual para Rionegro en este año.")) +
      (data.nota_migracion ? '<p class="hint">' + esc(data.nota_migracion) + "</p>" : "") +
      pie((data.fuente || "MinCIT VNR") + " · " + (data.descarga || "") + " · dataset 7wm8-w5ad")
    );
  }

  function bloqueMigracion() {
    var data = DATA.migracion || {};
    var serie = (data.serie || []).filter(function (row) { return row.anio === state.anio; });
    var anual = ((data.anual || []).find(function (row) { return row.anio === state.anio; }) || {}).entradas;
    var tops = (data.top_paises && data.top_paises[String(state.anio)]) || [];
    var mercados = (data.mercados && data.mercados[String(state.anio)]) || [];
    var mincitAnual = ((((DATA.mincitVnr || {}).anual) || []).find(function (row) { return row.anio === state.anio; }) || {}).visitantes;
    if (!serie.length && anual == null) {
      return hueco("Sin corte Migración", "Corra la extracción de Entradas de extranjeros (96sh-4v8d).");
    }
    var puntos = serie.slice().sort(function (a, b) { return a.mes - b.mes; }).map(function (row) {
      return { x: MESES[row.mes - 1], y: row.entradas };
    });
    var contraste = Charts.bars([
      { label: "Migración nacional", value: anual || 0, text: num(anual || 0), color: "#E9901E" },
      { label: "MinCIT Medellín", value: mincitAnual || 0, text: num(mincitAnual || 0), color: "#00AEAC" }
    ], "#E9901E", { xLabel: "Personas / movimientos" });
    return block(
      "Entradas de extranjeros · Migración Colombia",
      pastilla("migracion-entradas"),
      '<p class="hint">' + esc(data.universo || "Cruces nacionales de entrada. No es destino Medellín.") + "</p>" +
      '<div class="kpi-row" style="margin-bottom:12px">' +
        kpi("migracion-entradas", "Colombia " + state.anio, anual != null ? num(anual) : "—", "cruces de entrada") +
      "</div>" +
      (puntos.length ? Charts.line(puntos, "#E9901E", { xLabel: "Mes", yLabel: "Entradas" }) : "") +
      "<h3 class='mt'>Contraste de universos (no son la misma cifra)</h3>" + contraste +
      "<h3 class='mt'>Mercados priorizados (nacionalidad)</h3>" + Charts.bars(mercados.map(function (row) {
        return { label: row.mercado, value: row.entradas, text: num(row.entradas), color: COLOR[row.mercado] || "#195855" };
      }), "#195855", { xLabel: "Entradas" }) +
      (tops.length ? "<h3 class='mt'>Top nacionalidades</h3>" + Charts.bars(tops.map(function (row) {
        return { label: etiquetaPais(row.pais), value: row.entradas, text: num(row.entradas), color: "#108181" };
      }), "#108181", { xLabel: "Entradas" }) : "") +
      pie((data.fuente || "Migración Colombia") + " · " + (data.descarga || "") + " · dataset 96sh-4v8d")
    );
  }

  function bloqueTrm() {
    var data = DATA.trm || {};
    var serie = (data.serie || []).filter(function (row) { return row.anio === state.anio; });
    if (!serie.length) {
      return hueco("Sin TRM", "Corra la extracción TRM (32sa-8pi3) o revise data/open/trm_banrep.json.");
    }
    var orden = serie.slice().sort(function (a, b) { return a.mes - b.mes; });
    var ultimo = orden[orden.length - 1];
    var prevAnio = ((data.serie || []).filter(function (row) {
      return row.anio === state.anio - 1 && row.mes === (ultimo ? ultimo.mes : 0);
    })[0] || null);
    var delta = ultimo && prevAnio ? ((ultimo.trm - prevAnio.trm) / prevAnio.trm) * 100 : null;
    var puntos = orden.map(function (row) { return { x: MESES[row.mes - 1], y: row.trm }; });
    return block(
      "TRM promedio mensual",
      pastilla("trm-banrep"),
      '<p class="hint">' + esc(data.universo || "Promedio mensual COP/USD. Contexto de gasto, no causa de llegadas.") + "</p>" +
      '<div class="kpi-row" style="margin-bottom:12px">' +
        kpi("trm-banrep", "Último mes", ultimo ? num(ultimo.trm, 0) : "—", ultimo ? MESES[ultimo.mes - 1] + " " + state.anio : "") +
        kpi("trm-banrep", "Vs mismo mes año ant.", delta == null ? "—" : ((delta >= 0 ? "+" : "") + num(delta, 1) + " %"), prevAnio ? num(prevAnio.trm, 0) + " COP" : "sin base") +
      "</div>" +
      Charts.line(puntos, "#FBBB28", { xLabel: "Mes", yLabel: "COP por USD" }) +
      pie((data.fuente || "Superfinanciera TRM") + " · " + (data.descarga || "") + " · dataset 32sa-8pi3")
    );
  }

  function otrosOrigenes() {
    var top = rankingPaises().slice(0, 12);
    if (!top.length) return hueco("Países", "El agregado no trae la serie por país.");
    return block("Países con más llegadas", "Año " + state.anio + ". El clic deja el país en todo el tablero. Lista Bureau cuando el origen está priorizado.", Charts.bars(top.map(function (row) {
      return {
        label: etiquetaPais(row.pais),
        value: row.llegadas,
        text: num(row.llegadas),
        pais: row.pais,
        color: row.priorizado ? "#E9901E" : "#195855"
      };
    }), "#195855") + pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad")));
  }

  function aeropuertos() {
    var filas = (DATA.conectividad.aeropuertos || []).filter(function (row) { return row.anio === state.anio; });
    var suma = {};
    filas.forEach(function (row) { suma[row.aeropuerto] = (suma[row.aeropuerto] || 0) + row.llegadas; });
    var items = Object.keys(suma).map(function (k) {
      return {
        label: k === "MDE" ? "José María Córdova (MDE)" : "Enrique Olaya Herrera (EOH)",
        value: suma[k],
        color: COLOR[k] || "#108181",
        text: num(suma[k])
      };
    });
    return block("Llegadas por aeropuerto", items.length ? "Año " + state.anio + ". Pasajeros desembarcados en cada terminal de Medellín." : "Corte pendiente.", (items.length ? Charts.donut(items) : hueco("Sin corte", "Vuelva a correr el script de fuentes.")) + pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad")));
  }

  function aerolineas() {
    var filas = (DATA.conectividad.aerolineas || []).filter(function (row) { return row.anio === state.anio; });
    return block("Aerolíneas con más llegadas", filas.length ? "Ocho primeras del año." : "Corte pendiente.", (filas.length ? Charts.bars(filas.map(function (row) {
      return { label: row.sigla || row.nombre, value: row.llegadas, text: num(row.llegadas) };
    }), "#E9901E") : hueco("Sin corte", "Vuelva a correr el script de fuentes.")) + pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad")));
  }

  function carga() {
    var filas = (DATA.conectividad.carga || []).filter(function (row) { return row.anio === state.anio; });
    var puntos = filas.map(function (row) { return { x: MESES[row.mes - 1], y: row.kg }; });
    return block(
      "Carga y correo",
      "Peso total (kg) de carga + correo en vuelos que aterrizan o despegan en José María Córdova (MDE) o Enrique Olaya Herrera (EOH). No son pasajeros: mide mercancía aérea del sistema Medellín.",
      (puntos.length ? Charts.line(puntos, "#195855", { xLabel: "Mes", yLabel: "Kilogramos" }) : hueco("Sin corte", "Vuelva a correr el script de fuentes.")) +
      pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad"))
    );
  }

  function medataFigura() {
    var serie = (DATA.medata && DATA.medata.serie) || [];
    var periodos = [];
    serie.forEach(function (row) {
      if (row.tar_periodo && periodos.indexOf(row.tar_periodo) < 0) periodos.push(row.tar_periodo);
    });
    periodos.sort();
    var delAnio = periodos.filter(function (per) { return per.indexOf(String(state.anio)) === 0; });
    if (!delAnio.length) return block("Tarifa por zona", "Medata, pesos corrientes. La ficha se modificó el 14 de diciembre de 2023.", hueco("Sin corte", "Medata no trae meses de " + state.anio + ". Último período publicado: " + periodos[periodos.length - 1] + ".") + pie("DANE EMA + MEData (corte dic-2023)"));
    var grupos = delAnio.slice(-6).map(function (periodo) {
      return {
        label: MESES[Number(periodo.slice(4)) - 1] + " " + periodo.slice(2, 4),
        bars: serie.filter(function (row) { return row.tar_periodo === periodo; }).map(function (row) {
          return { name: row.tar_zona, value: Number(row.tar_valor), color: COLOR[row.tar_zona] || "#108181" };
        })
      };
    });
    return block("Tarifa por zona", "Medata, pesos corrientes. La ficha se modificó el 14 de diciembre de 2023.", (grupos.length ? Charts.grouped(grupos) : hueco("Medata", "Sin serie de zonas.")) + pie("DANE EMA + MEData (corte dic-2023) · Año " + state.anio));
  }

  function marcaLLM() {
    var data = DATA.bureauMarca || {};
    var serie = data.serie || [];
    if (!serie.length) return hueco("Marca por LLM", "Corra scripts/alimentar_bureau.py para traer la clasificación del ETL.");
    var ventanaTxt = data.ventana || "ventana corriente";
    if (Array.isArray(data.ventana_anios) && data.ventana_anios.length) {
      if (data.ventana_anios.indexOf(state.anio) < 0) return hueco("Marca por LLM", "La clasificación LLM cubre " + ventanaTxt + ". Cambie el filtro a " + data.ventana_anios.join(", ") + " para verla.");
    } else {
      var mVent = String(data.ventana || data.fuente || "").match(/20\d{2}/);
      var ventanaAnio = mVent ? Number(mVent[0]) : null;
      if (ventanaAnio && ventanaAnio !== state.anio) return hueco("Marca por LLM", "La clasificación LLM cubre la ventana " + (data.ventana || mVent[0] + " (ver fuente)") + ". Cambie el filtro a " + ventanaAnio + " para verla.");
    }
    var total = serie.reduce(function (s, row) { return s + (row.n || 0); }, 0);
    var items = serie.map(function (row, i) {
      return { label: row.categoria, value: row.n, text: num(row.n) + " · " + num((row.share || 0) * 100, 1) + "%", color: Charts.palette[i % Charts.palette.length] };
    });
    return kpi("marca-llm", "Menciones LLM", num(total), esc(data.ventana || "ventana corriente")) + block("Conversación por tema (LLM)", "Tópico global: " + esc(data.top_topico_global || "—") + ".", Charts.bars(items, "#00AEAC") + pie("ETL Bureau, titulares RSS clasificados con LLM · " + esc(data.ventana || "ventana corriente")));
  }

  function vozDigital() {
    var data = DATA.bureauPrensa || {};
    var serie = data.serie || [];
    var gdelt = DATA.gdelt || {};
    var gdeltSerie = (gdelt.serie || []).filter(function (row) {
      return row.anio === state.anio && fold(row.destino) === "MEDELLIN";
    });
    var cuerpoPrensa = "";
    if (serie.length) {
      var puntos = serie.map(function (row) { return { x: row.semana, y: row.n }; });
      var filas = (data.titulares || []).map(function (t) {
        return "<tr><td>" + esc(t.fecha) + "</td><td>" + esc(t.titulo) + "</td><td>" + esc(t.medio) + "</td></tr>";
      }).join("");
      var ventana = (data.ventana_serie || []).join(" a ");
      var sentTxt = (data.sentimiento_neto == null) ? "sin dato" : ((data.sentimiento_neto >= 0 ? "+" : "") + num(data.sentimiento_neto, 3));
      cuerpoPrensa = Charts.line(puntos, "#108181") +
        "<h3>Últimos titulares</h3><table><tr><th>Fecha</th><th>Titular</th><th>Búsqueda</th></tr>" + filas + "</table>" +
        pie("ETL Bureau · Google News RSS + Reddit · sem " + ventana + " · extraído " + (data.descarga || ""));
    } else {
      cuerpoPrensa = hueco("Menciones en prensa", "Corra scripts/alimentar_bureau.py para traer las menciones del ETL.");
    }
    var peersGdelt = (gdelt.serie || []).filter(function (row) { return row.anio === state.anio; });
    var porDestino = {};
    peersGdelt.forEach(function (row) {
      porDestino[row.destino] = (porDestino[row.destino] || 0) + (row.menciones || 0);
    });
    var barrasPeers = Object.keys(porDestino).map(function (destino) {
      return { label: destino, value: porDestino[destino], text: num(porDestino[destino]), color: fold(destino) === "MEDELLIN" ? "#E9901E" : "#195855" };
    }).sort(function (a, b) { return b.value - a.value; });
    var cuerpoGdelt = gdeltSerie.length
      ? "<h3 class='mt'>GDELT · menciones Medellín " + state.anio + "</h3>" +
        '<p class="hint">' + esc(gdelt.universo || "Proxy de medios GDELT. No es búsqueda ni Wikipedia.") + "</p>" +
        Charts.line(gdeltSerie.sort(function (a, b) { return a.mes - b.mes; }).map(function (row) {
          return { x: MESES[row.mes - 1], y: row.menciones };
        }), "#E9901E", { xLabel: "Mes", yLabel: "Menciones" }) +
        (barrasPeers.length ? "<h3 class='mt'>GDELT · destinos de la ventana</h3>" + Charts.bars(barrasPeers, "#195855", { xLabel: "Menciones" }) : "") +
        pie((gdelt.fuente || "GDELT") + " · " + (gdelt.descarga || ""))
      : "<h3 class='mt'>GDELT / Google Trends</h3>" +
        hueco(
          "Cuota pendiente",
          "GDELT se reintenta en preparar_fuentes / ampliar_fuentes. Google Trends solo con TRENDS_API_KEY o SERPAPI_KEY. Sin cuota no se inventa serie."
        );
    return block(
      "Voz digital de contexto",
      pastilla("busqueda") + " Google News RSS + Reddit, sin login. GDELT/Trends solo con cuota estable.",
      cuerpoPrensa + cuerpoGdelt
    );
  }

  function bloqueOferta() {
    var data = DATA.bureauOferta || {};
    var rnt = data.rnt || {};
    var serie = data.serie || [];
    var cortes = data.cortes || {};
    if (!serie.length && !rnt.prestadores) return hueco("Oferta", "Corra scripts/alimentar_bureau.py para traer la oferta del ETL.");
    var cats = (rnt.por_categoria || []).slice(0, 10).map(function (row, i) {
      var nombre = row.categoria || "";
      if (nombre.length > 34) nombre = nombre.slice(0, 33) + "…";
      return { label: nombre, value: row.prestadores, text: num(row.prestadores), color: Charts.palette[i % Charts.palette.length] };
    });
    var munis = (rnt.top_municipios || []).slice(0, 8).map(function (row, i) {
      return { label: etiquetaPais(row.municipio), value: row.prestadores, text: num(row.prestadores), color: Charts.palette[i % Charts.palette.length] };
    });
    var porc = serie.filter(function (r) { return r.concepto === "Porcentaje de personas que realizaron turismo interno"; })
      .map(function (r) { return { x: r.trimestre, y: r.valor }; });
    var pobTur = serie.filter(function (r) { return r.concepto === "Población total que realizó turismo interno"; })
      .map(function (r) { return { x: r.trimestre, y: r.valor }; });
    var ultimo = porc.length ? porc[porc.length - 1] : null;
    var ultimoPob = pobTur.length ? pobTur[pobTur.length - 1] : null;
    var medellin = ((rnt.top_municipios || []).find(function (m) { return fold(m.municipio) === "MEDELLIN"; }) || {}).prestadores;
    var shareMde = (medellin != null && rnt.prestadores) ? (medellin / rnt.prestadores) * 100 : null;
    var ambito = "RNT: prestadores con domicilio en municipios de Antioquia (corte " + esc(cortes.rnt || rnt.corte || "—") + "). "
      + "Medellín distrito concentra " + (medellin != null ? num(medellin) : "—") + " de " + num(rnt.prestadores)
      + " (" + (shareMde != null ? num(shareMde, 1) + "%" : "—") + "). "
      + "EGIT es turismo interno nacional (residentes colombianos), no visitante internacional EVI.";
    return '<div class="kpi-row">' +
      kpi("bureau-oferta", "RNT Antioquia", num(rnt.prestadores), "corte " + esc(cortes.rnt || data.ventana || "")) +
      kpi("bureau-oferta", "RNT Medellín distrito", medellin != null ? num(medellin) : "—", shareMde != null ? num(shareMde, 1) + " % del dpto" : "municipio MEDELLIN") +
      kpi("bureau-oferta", "Turismo interno EGIT", ultimo ? num(ultimo.y, 1) + "%" : "—", "nacional · " + esc(cortes.turismo_interno || "")) +
      kpi("bureau-oferta", "Población con viaje interno", ultimoPob ? num(ultimoPob.y, 0) : "—", "miles · EGIT nacional") +
      "</div>" +
      block("Oferta y territorio", ambito,
      "<h3>Prestadores por categoría (Antioquia)</h3>" + Charts.bars(cats, "#108181", { xLabel: "Prestadores" }) +
      (munis.length ? "<h3>Top municipios (incluye Medellín distrito)</h3>" + Charts.bars(munis, "#00AEAC", { xLabel: "Prestadores" }) : "") +
      "<h3>Turismo interno nacional EGIT (%)</h3>" +
      '<p class="hint">No mezclar con EVI (no residente en MDE). Universo: residentes en Colombia que viajaron dentro del país.</p>' +
      Charts.line(porc, "#00AEAC", { xLabel: "Trimestre", yLabel: "% personas" }) +
      (pobTur.length ? "<h3>Población que realizó turismo interno (miles)</h3>" + Charts.line(pobTur, "#108181", { xLabel: "Trimestre", yLabel: "Miles" }) : "") +
      pie("ETL Bureau · RNT datos.gov.co + DANE EGIT" + extraido("bureauOferta")));
  }

  function bloqueSeguridad() {
    var data = DATA.bureauSeguridad || {};
    var serie = data.serie || [];
    if (!serie.length) return hueco("Seguridad", "Corra scripts/alimentar_bureau.py para traer la serie de seguridad del ETL.");
    var puntos = serie.map(function (row) { return { x: row.periodo, y: row.homicidios }; });
    var mods = (data.top_modalidades || []).map(function (row, i) {
      return { label: row.modalidad, value: row.n, text: num(row.n), color: Charts.palette[i % Charts.palette.length] };
    });
    return block("Seguridad ciudadana", "Homicidios por mes (" + esc(data.ventana || "ventana corriente") + "). Los hurtos no traen desagregación por zona (null, no 0).",
      Charts.line(puntos, "#108181") +
      "<h3>Modalidades con más casos</h3>" + Charts.bars(mods, "#E9901E") +
      pie("ETL Bureau · SIEDCO Policía Nacional" + extraido("bureauSeguridad")));
  }

  function promedioDiarioPm25(filas) {
    var cubo = {};
    (filas || []).forEach(function (row) {
      var dia = String(row.fecha || "").slice(0, 10);
      if (!dia) return;
      if (!cubo[dia]) cubo[dia] = { suma: 0, n: 0 };
      cubo[dia].suma += Number(row.pm2_5) || 0;
      cubo[dia].n += 1;
    });
    return Object.keys(cubo).sort().map(function (dia) {
      return { x: dia, y: cubo[dia].suma / cubo[dia].n };
    });
  }

  function bloqueClima() {
    var data = DATA.bureauClima || {};
    var serie = data.serie || [];
    var pm25 = data.pm25_serie || [];
    var sisaire = data.sisaire_pm25 || [];
    var pron = data.pronostico || [];
    if (!serie.length && !pm25.length && !pron.length && !sisaire.length) return "";
    var lluviaUtil = serie.filter(function (row) { return Number(row.mm_prom) > 0; });
    var aire = promedioDiarioPm25(pm25);
    if (!aire.length) aire = pm25.map(function (row) { return { x: row.fecha, y: row.pm2_5 }; });
    var medido = sisaire.map(function (row) { return { x: row.fecha, y: row.pm2_5 }; });
    var futuro = pron.map(function (row) { return { x: row.date, y: row.prec_mean }; });
    if (!lluviaUtil.length && !aire.length && !medido.length && !futuro.length) return "";
    var partes = [];
    if (lluviaUtil.length) {
      partes.push("<h3>Lluvia mensual (mm promedio)</h3>" + Charts.line(lluviaUtil.map(function (row) {
        return { x: row.periodo, y: row.mm_prom };
      }), "#108181", { xLabel: "Mes", yLabel: "mm" }));
    } else {
      partes.push(hueco("Lluvia IDEAM", "En la ventana " + esc(data.ventana || "") + " el agregado solo trae meses en 0 mm o sin serie útil. No se grafica una línea vacía."));
    }
    if (aire.length > 1) {
      partes.push("<h3>PM2.5 modelado (promedio diario · Open-Meteo)</h3>" + Charts.line(aire, "#E9901E", { xLabel: "Día", yLabel: "µg/m³" }));
    }
    if (medido.length > 1) {
      partes.push("<h3>PM2.5 medido (SISAIRE · AMVA)</h3>" + Charts.line(medido, "#B4C42C", { xLabel: "Día", yLabel: "µg/m³" }));
    } else if (medido.length === 1) {
      partes.push(hueco("PM2.5 medido", "SISAIRE solo trae un día en el corte; no alcanza para una serie."));
    }
    if (futuro.length) {
      partes.push("<h3>Pronóstico de precipitación media (7 días)</h3>" + Charts.line(futuro, "#00AEAC", { xLabel: "Día", yLabel: "mm" }));
    }
    return block(
      "Clima y calidad del aire",
      "Series abiertas para Medellín / Valle de Aburrá. Ventana ETL: " + esc(data.ventana || "—") + ".",
      partes.join("") + pie("ETL Bureau · IDEAM + Open-Meteo + SISAIRE" + extraido("bureauClima"))
    );
  }

  function bloqueCalendario() {
    var data = DATA.bureauCalendario || {};
    var festivos = data.serie || [];
    var est = data.estaciones || {};
    var avisos = data.avisos_viaje || [];
    var emisores = data.festivos_emisores || [];
    if (!festivos.length && !est.total && !avisos.length && !emisores.length) return hueco('Calendario', 'Corra scripts/alimentar_bureau.py para traer el calendario del ETL.');
    var porEstado = est.por_estado || {};
    var barras = Object.keys(porEstado).map(function (k, i) {
      return { label: k, value: porEstado[k], text: num(porEstado[k]), color: Charts.palette[i % Charts.palette.length] };
    });
    var MESES = {'01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic'};
    var porMes = {};
    festivos.forEach(function (f) {
      var k = String(f.date || '').slice(0, 7);
      if (!k) return;
      if (!porMes[k]) porMes[k] = [];
      porMes[k].push(f);
    });
    var tarjetas = Object.keys(porMes).sort().map(function (k) {
      var partes = k.split('-');
      var titulo = (MESES[partes[1]] || partes[1]) + ' ' + partes[0];
      var items = porMes[k].map(function (f) {
        return '<li><span class="pastilla">' + esc(String(f.date).slice(8, 10)) + '</span> ' + esc(f.nombre) + '</li>';
      }).join('');
      return '<article class="cal-card"><h4>' + esc(titulo) + ' <span class="pastilla">' + porMes[k].length + '</span></h4><ul>' + items + '</ul></article>';
    }).join('');
    var rail = tarjetas
      ? '<div class="notes-rail cal-rail" aria-label="Feriados por mes"><div class="notes-track">' + tarjetas + tarjetas + '</div></div>'
      : '';
    var porPais = {};
    emisores.forEach(function (f) {
      var k = f.pais || "?";
      porPais[k] = (porPais[k] || 0) + 1;
    });
    var paises = Object.keys(porPais).sort().map(function (k) {
      return "<li><span>" + esc(k) + "</span><strong>" + num(porPais[k]) + "</strong></li>";
    }).join("");
    var listaAvisos = avisos.map(function (a) {
      return "<li><span>" + esc(a.pais) + "</span><strong>" + esc(a.nivel || a.titulo) + "</strong><p class='hint'>" + esc(a.resumen || "") + "</p></li>";
    }).join("");
    return '<div class="kpi-row">' +
      kpi('bureau-calendario', 'Feriados', num(festivos.length), esc(data.ventana || '')) +
      kpi('bureau-calendario', 'Estaciones IDEAM', num(est.total || 0), 'red con reporte') +
      kpi('bureau-calendario', 'Avisos de viaje', num(avisos.length), 'EE. UU., Canadá, Reino Unido') +
      '</div>' +
      block('Calendario y contexto', 'Feriados nacionales de Colombia, recuento en mercados emisores y avisos de viaje. Ventana ' + esc(data.ventana || '') + '.',
      '<h3>Feriados por mes</h3>' + rail +
      (paises ? "<h3>Feriados de mercados emisores</h3><ul class='lista'>" + paises + "</ul>" : "") +
      (listaAvisos ? "<h3>Avisos de viaje hacia Colombia</h3><ul class='lista'>" + listaAvisos + "</ul>" : "") +
      '<h3>Estaciones IDEAM por estado</h3>' + Charts.bars(barras, '#108181', { xLabel: 'Estaciones' }) +
      pie('ETL Bureau · festivos CO + IDEAM + avisos de viaje' + extraido('bureauCalendario')));
  }
  function bloqueSit() {
    var data = DATA.bureauSit || {};
    var serie = data.serie || [];
    if (!serie.length) return hueco("Emisores SIT", "Corra scripts/alimentar_bureau.py para traer los perfiles SIT del ETL.");
    var barras = serie.map(function (row, i) {
      return { label: row.mercado, value: row.llegadas, text: num(row.llegadas), color: Charts.palette[i % Charts.palette.length] };
    });
    var filas = serie.map(function (row) {
      return "<tr><td>" + esc(row.mercado) + "</td><td>" + num(row.llegadas) + "</td><td>" +
        (row.yoy_pct == null ? "—" : num(row.yoy_pct, 1) + "%") + "</td><td>" + esc(row.motivo_top || "—") + "</td><td>" +
        (row.ticket_prom_cop == null ? "—" : num(row.ticket_prom_cop)) + "</td></tr>";
    }).join("");
    return '<div class="kpi-row">' +
      kpi("bureau-sit", "Mercados", num(serie.length), "corte " + esc(data.corte || "")) +
      "</div>" +
      block("Perfiles emisores SIT", "Llegadas 2025 por mercado auditado.",
      "<h3>Llegadas</h3>" + Charts.bars(barras, "#00AEAC", { xLabel: "Llegadas", yLabel: "Mercado" }) +
      "<h3>Cifras clave</h3><div class=\"table-wrap\"><table class=\"table table-sit\"><thead><tr><th>Mercado</th><th>Llegadas</th><th>YoY</th><th>Motivo top</th><th>Ticket COP</th></tr></thead><tbody>" + filas + "</tbody></table></div>" +
      pie("ETL Bureau · SIT Medellín perfiles de mercado" + extraido("bureauSit")));
  }

  function bloqueOwid() {
    var data = DATA.bureauOwid || {};
    var serie = data.serie || [];
    var col = data.colombia_serie || [];
    var cortes = data.cortes || {};
    if (!serie.length && !col.length) return "";
    // Vista por defecto: Top 5 del último año publicado (2024). Colombia OWID solo llega a 2022.
    var vista = state.vistaOwid || "top";
    var tabs = [["top", "Top 5 · 2024"], ["reg", "Regiones · 2024"], ["co", "Colombia · hasta 2022"]].map(function (t) {
      return '<button type="button" class="tab' + (vista === t[0] ? " active" : "") + '" data-vistaowid="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    var cuerpo = "";
    if (vista === "reg") cuerpo = Charts.bars((data.regiones || []).map(function (r) {
      return { label: r.region, value: r.valor, text: num(r.valor) };
    }), "#00AEAC", { xLabel: "Llegadas internacionales", yLabel: "Región" });
    else if (vista === "co") {
      if (!col.length) cuerpo = hueco("Colombia OWID", "La serie nacional de UN Tourism en OWID todavía no llega a 2024.");
      else cuerpo = Charts.line(col.map(function (r) { return { x: String(r.anio), y: r.valor }; }), "#00AEAC", { xLabel: "Año", yLabel: "Llegadas internacionales" });
    } else cuerpo = Charts.bars(serie.slice(0, 5).map(function (r) {
      return { label: r.pais, value: r.valor, text: num(r.valor) };
    }), "#E9901E", { xLabel: "Llegadas internacionales", yLabel: "País" });
    return kpi("bureau-owid", "Top 1 mundial", serie.length ? serie[0].pais : "—", serie.length ? num(serie[0].valor) + " · " + serie[0].anio : "") +
      block(
        "Benchmark mundial (llegadas)",
        "Comparativo OWID/UN Tourism. El top mundial y las regiones usan el corte " + esc(cortes.mundial || "2024") + ". La serie de Colombia en esa fuente solo llega a " + esc(cortes.colombia || "2022") + ".",
        '<div class="vtabs" role="tablist">' + tabs + "</div>" + cuerpo +
        pie("ETL Bureau · Our World in Data (UN Tourism)" + extraido("bureauOwid"))
      );
  }
  function bloqueConectividad() {
    var data = DATA.bureauConectividad || {};
    var serie = data.serie || [];
    var wiki = data.wikimedia_serie || [];
    var trm = data.trm_serie || [];
    var cortes = data.cortes || {};
    if (!serie.length) return hueco("Conectividad ampliada", "Corra scripts/alimentar_bureau.py para traer la conectividad del ETL.");
    var ops = serie.map(function (row) { return { x: row.periodo, y: row.operaciones }; });
    var ultimoOp = ops.length ? ops[ops.length - 1] : null;
    var ultimoTrm = trm.length ? trm[trm.length - 1] : null;
    var dig = wiki.map(function (row) { return { x: row.periodo, y: row.views }; });
    var bts = data.bts_colombia || [];
    var ipc = data.ipc_colombia || [];
    var ultimoBts = bts.length ? bts[bts.length - 1] : null;
    var ultimoIpc = ipc.length ? ipc[ipc.length - 1] : null;
    var corteTxt = "operaciones " + esc(cortes.operaciones || "—") + " · TRM " + esc(cortes.trm || "—") +
      " · UE " + esc(cortes.benchmark_eu || "—") + " · digital " + esc(cortes.wikimedia || "—");
    var extra = "";
    if (ultimoBts) extra += "<p class='hint'>EE. UU.–Colombia " + esc(ultimoBts.year) + (ultimoBts.mes ? "-" + esc(ultimoBts.mes) : "") + ": " + num(ultimoBts.llegadas_sillas) + " sillas de llegada y " + num(ultimoBts.llegadas_pax) + " pasajeros (BTS T-100, país, no el aeropuerto).</p>";
    if (ultimoIpc) extra += "<p class='hint'>IPC nacional " + esc(ultimoIpc.anio) + "-" + esc(ultimoIpc.mes) + ": " + num(ultimoIpc.indice, 2) + ". Es el total del país, no la tarifa de Medellín.</p>";
    return '<div class="kpi-row">' +
      kpi("bureau-conectividad", "Operaciones", ultimoOp ? num(ultimoOp.y) : "—", ultimoOp ? ultimoOp.x : "") +
      kpi("bureau-conectividad", "TRM", ultimoTrm ? num(ultimoTrm.cop_per_usd, 0) : "—", ultimoTrm ? String(ultimoTrm.date).slice(0, 10) : "") +
      "</div>" +
      block("Conectividad", corteTxt + ".",
      "<h3>Operaciones aéreas</h3>" + Charts.line(ops, "#108181", { xLabel: "Periodo", yLabel: "Operaciones" }) +
      "<h3>Señal digital (vistas)</h3>" + Charts.line(dig, "#00AEAC", { xLabel: "Periodo", yLabel: "Vistas" }) +
      extra +
      pie("ETL Bureau · Aerocivil/Eurostat/Wikimedia/BTS" + extraido("bureauConectividad")));
  }

  function tarifas() {
    var ema = filasAnio(DATA.ema.serie, state.anio);
    var ocup = DATA.ema && DATA.ema.ocupacion && DATA.ema.ocupacion.serie;
    var ocupAnio = filasAnio(ocup, state.anio);
    var lineaTarifa = Charts.line(ema.map(function (row) { return { x: MESES[row.mes - 1], y: row.indice_100 }; }), "#108181", { mark: 100, xLabel: "Mes", yLabel: "Índice (100 = promedio)" });
    var ocupacionClara = "";
    if (ocupAnio.length) {
      ocupacionClara = Charts.multiLine([
        { name: "Antioquia", color: "#108181", points: ocupAnio.map(function (row) { return { x: MESES[row.mes - 1], y: row.antioquia }; }) },
        { name: "Bogotá", color: "#E9901E", points: ocupAnio.map(function (row) { return { x: MESES[row.mes - 1], y: row.bogota }; }) },
        { name: "Cartagena", color: "#FBBB28", points: ocupAnio.map(function (row) { return { x: MESES[row.mes - 1], y: row.cartagena }; }) }
      ], { xLabel: "Mes", yLabel: "Ocupación hotelera %" });
    }
    return block(
      "Tarifa y ocupación",
      "Arriba: índice de tarifa hotelera de Antioquia (EMA). La línea lima en 100 es el promedio regional del mes; por encima de 100 la tarifa está cara frente a ese promedio. Abajo: ocupación hotelera (%) de Antioquia, Bogotá y Cartagena en el mismo año.",
      lineaTarifa + ocupacionClara + pie("DANE EMA · " + cobertura((DATA.ema || {}).serie) + extraido("ema"))
    );
  }

  function regionesOcupacion() {
    var ocup = DATA.ema && DATA.ema.ocupacion && DATA.ema.ocupacion.serie;
    var ocupAnio = filasAnio(ocup, state.anio);
    if (!ocupAnio.length || !ocupAnio[ocupAnio.length - 1].regiones) {
      return block("Ocupación regional", "Hoja 4.2.", hueco("Sin regiones", "El agregado todavía no trae las doce regiones.") + pie("DANE EMA hoja 4.2 · Año " + state.anio));
    }
    var corte = ocupAnio[ocupAnio.length - 1];
    var nombres = Object.keys(corte.regiones);
    return block("Ocupación de las regiones", "Porcentaje de la hoja 4.2 en " + MESES[corte.mes - 1] + " " + state.anio + ". Antioquia no es la ciudad de Medellín.", Charts.bars(nombres.map(function (nombre, i) {
      return { label: nombre, value: corte.regiones[nombre], text: num(corte.regiones[nombre], 1) + " %", color: Charts.palette[i % Charts.palette.length] };
    })) + pie("DANE EMA hoja 4.2 · " + MESES[corte.mes - 1] + " " + state.anio));
  }

  function icca() {
    var colores = ["#E9901E", "#108181", "#172139"];
    var dona = Charts.donut(DATA.icca.ciudades.map(function (c, i) {
      return { label: c.ciudad, value: c.reuniones, color: colores[i], text: "puesto " + c.puesto };
    }));
    return block("ICCA 2025", "Reuniones elegibles de las tres ciudades citadas. No es la participación sobre el mundo.", dona + hueco("No ICCA", "UFI publica barómetros globales, no la participación de Medellín.") + pie("ICCA · corte 2025"));
  }

  function conversion() {
    var con = filasAnio(DATA.conectividad.serie, state.anio);
    var llegadas = sumaMercado(con, "llegadas");
    var total = MERCADOS.reduce(function (s, m) { return s + (llegadas[m] || 0); }, 0) || 1;
    var items = MERCADOS.map(function (m, i) {
      var parte = (llegadas[m] || 0) / total * 100;
      return {
        label: m,
        value: parte,
        text: num(parte, 1) + " %",
        color: Charts.palette[i % Charts.palette.length],
        pais: PAIS_DE_MERCADO[m] || ""
      };
    });
    return block(
      "Participación de llegadas por mercado",
      "Dato Aerocivil (no CRM): porcentaje de las llegadas realizadas del año " + state.anio + " que aporta cada mercado priorizado sobre el total de los cinco. No es conversión comercial ni tasa del CRM.",
      Charts.bars(items, "#00AEAC", { xLabel: "% de llegadas", yLabel: "Mercado" }) +
      pie("Aerocivil gb6w-ynu4 · " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad") + " · derivado")
    );
  }

  function vistaVisitante() {
    var paquete = olaPara(state.anio);
    var ola = paquete.ola;
    if (!ola) {
      return hueco("EVI", "El agregado de la encuesta no tiene olas. Vuelva a correr el script de fuentes.");
    }
    var gastoPais = (ola.gasto_por_pais || []).find(function (row) { return fold(row.pais) === state.pais; });
    var mercado = mercadoDe(state.pais);
    var gastoMercado = (ola.gasto_por_mercado || []).find(function (row) { return row.mercado === mercado; });
    var gasto = gastoPais ? gastoPais.gasto_estadia_usd : (gastoMercado ? gastoMercado.gasto_estadia_usd : ola.gasto_estadia_usd);
    var gastoMeta = state.pais === "Todos" ? "todos los orígenes" : (gastoPais ? etiquetaPais(state.pais) : (gastoMercado ? mercado : "todos los orígenes"));
    var huella = ((DATA.huella && DATA.huella.serie) || []).find(function (row) { return row.ola === ola.ola; });
    var html = "";
    if (paquete.aviso || state.anio !== 2025) {
      html += '<p class="aviso">Ola mostrada en las composiciones: ' + esc(ola.ola) + ". " + esc(paquete.aviso) + "</p>";
    }
    var todosMeses = (DATA.evi && DATA.evi.meses) || [];
    var meses = todosMeses.filter(function (row) { return row.anio === state.anio; });
    var anioSerie = state.anio;
    if (!meses.length && todosMeses.length) {
      anioSerie = todosMeses[todosMeses.length - 1].anio;
      meses = todosMeses.filter(function (row) { return row.anio === anioSerie; });
    }
    var pistaGasto = meses.length
      ? (anioSerie === state.anio
        ? "Promedio ponderado (EVI) del gasto de estadía en USD de no residentes encuestados en José María Córdova, por mes de " + anioSerie + "."
        : "El filtro " + state.anio + " no tiene serie mensual EVI. Se muestra la última serie disponible (" + anioSerie + "). Las composiciones de abajo siguen la ola " + ola.ola + ".")
      : "No hay serie mensual EVI en el agregado.";
    var movimiento = meses.length
      ? Charts.line(meses.map(function (row) {
        return { x: MESES[row.mes - 1], y: row.gasto_estadia_usd };
      }), "#FBBB28", { xLabel: "Mes", yLabel: "USD por persona" })
      : hueco("Sin serie mensual", "La EVI publicada no trae gasto por mes para este corte.");
    html += '<div class="kpi-row">' +
      kpi("gasto", "Gasto de la estadía", usd(gasto), gastoMeta) +
      kpi("gasto", "Gasto diario", state.pais === "Todos" ? usd(ola.gasto_diario_usd) : "—", state.pais === "Todos" ? "por persona" : "el diario no está partido por país") +
      kpi("grupo", "Noches del destino principal", num(ola.noches, 1), "n ponderada " + num(ola.n_noches, 0)) +
      kpi("huella", "Huella estimada", huella && huella.kg_total != null ? num(huella.kg_total, 1) + " kg" : "—", "ida + alojamiento") +
      "</div>";
    html += grupo("Estadía",
      celda("span-12", block("Gasto mensual de la estadía", pistaGasto, movimiento + pie("EVI · serie mensual " + anioSerie + extraido("evi")))) +
      celda("span-6", block("Grupo de viaje", "Ponderado con el factor de expansión. n de encuestas: " + num(ola.n) + ".", Charts.donut((ola.grupo || []).map(function (g, i) {
        return { label: g.nombre, value: g.participacion, color: Charts.palette[i], text: num(g.participacion, 1) + "%" };
      })) + pie("EVI " + ola.ola + extraido("evi")))) +
      celda("span-6", block("Motivo del viaje", "Ola completa.", Charts.donut((ola.motivos || []).map(function (g, i) {
        return { label: g.nombre, value: g.participacion, color: Charts.palette[i], text: num(g.participacion, 1) + "%" };
      })) + pie("EVI " + ola.ola + extraido("evi")))) +
      celda("span-12", block(
        "Residencia del visitante",
        "De dónde vienen los no residentes encuestados en José María Córdova en la ola " + ola.ola + ". La barra es el % del peso muestral (factor de expansión), no el % de pasajeros Aerocivil. Solo países con al menos 0,5 %. Un clic filtra el tablero.",
        Charts.bars((ola.residencia || []).map(function (g) {
          var codigo = fold(g.nombre);
          return { label: g.nombre, value: g.participacion, text: num(g.participacion, 1) + "%", pais: codigo, color: codigo === state.pais ? "#E9901E" : "#108181" };
        }), "#108181", { xLabel: "% del peso de la ola" }) + pie("EVI " + ola.ola + extraido("evi"))
      )));
    html += grupo("Huella y contexto",
      celda("span-6", compararOlas()) +
      celda("span-6", huellaBloque(huella, ola)) +
      celda("span-12", npsDestino()) +
      celda("span-12", bloqueOferta()) +
      celda("span-12", bloqueSeguridad()) +
      celda("span-12", bloqueClima()) +
      celda("span-12", bloqueCalendario()));
    html += grupo("Pronóstico", celda("span-12", bloquePronostico("visitante")));
    return html;
  }

  function npsDestino() {
    // No hay extracto de NPS de destino ni desglose promotores/detractores en EVI.
    // No se simula. La satisfacción 4,9 del informe es de miembros, no de visitante.
    return block(
      "Satisfacción y NPS del destino",
      pastilla("nps"),
      hueco(
        "Sin extracto",
        "La EVI publicada no trae promotores, pasivos ni detractores. Tampoco hay microdato de la encuesta de destino del Bureau o del SIT. Por eso no se grafica un NPS inventado. La calificación 4,9 / 5 del informe de gestión está en el tablero Miembros y no se mezcla aquí."
      ) + pie("Catálogo · NPS pendiente de extracto")
    );
  }

  function compararOlas() {
    var olas = (DATA.evi && DATA.evi.olas) || [];
    if (olas.length < 2) return block("Olas", "Hace falta más de una ola para comparar.", "" + pie("EVI" + extraido("evi")));
    return block(
      "Gasto de las dos olas",
      "Comparación del gasto medio de estadía (USD por persona) entre las dos olas EVI publicadas. Cada barra es el promedio de toda su ola, no un mes suelto.",
      Charts.bars(olas.map(function (ola, i) {
        return { label: ola.ola, value: ola.gasto_estadia_usd, text: usd(ola.gasto_estadia_usd), color: i ? "#FBBB28" : "#E9901E" };
      }), "#E9901E", { xLabel: "USD por persona" }) + pie("EVI · por ola" + extraido("evi"))
    );
  }

  function huellaBloque(huella, ola) {
    if (!huella || huella.kg_total == null) {
      var estado = (DATA.huella && DATA.huella.estado) || "Sin factores.";
      return block("Huella", pastilla("huella"), hueco("Sin estimación", esc(estado) + " Las noches de la ola sí están en la tarjeta de estadía: " + num(ola.noches, 1) + ".") + pie("Huella Bureau · factores propios" + extraido("huella")));
    }
    var pista = "Estimación de CO₂ del visitante medio de la ola (solo ida + noches de alojamiento). Distancia media de vuelo: " +
      num(huella.km_ida, 0) + " km. No incluye trayecto de regreso ni desplazamientos en ciudad.";
    return block("Huella de carbono de la ola", pista, Charts.bars([
      { label: "Vuelo (ida)", value: huella.kg_vuelo, text: num(huella.kg_vuelo, 1) + " kg CO₂" },
      { label: "Alojamiento", value: huella.kg_alojamiento, text: num(huella.kg_alojamiento, 1) + " kg CO₂" }
    ], "#195855", { xLabel: "kg CO₂ por visitante" }) + pie("Huella Bureau · factores propios" + extraido("huella")));
  }

  function vistaCaptacion() {
    var inf = window.INFORME;
    var aporteEvento = inf.impactoUsd / inf.captados;
    var aporteAsistente = inf.impactoUsd / inf.asistentes;
    var html = "";
    if (state.anio !== 2025) html += '<p class="aviso">El informe citado es el corte 2025. El filtro de año no fabrica otro corte.</p>';
    if (state.anio === 2026) html += '<p class="aviso">El gasto EVI del índice usa la última ola (enero – junio 2025). 2026 no tiene microdato.</p>';
    html += '<div class="stocks">' + inf.flujo.map(function (item) {
      return '<article class="stock"><div class="k">' + esc(item.etiqueta) + '</div><div class="v">' + esc(item.valor) + '</div><p>' + esc(item.detalle || item.universo) + "</p></article>";
    }).join("") + "</div>";
    html += '<p class="hint mt">Tres stocks de universos distintos. No hay tasa entre ellos: los captados superan a las candidaturas.</p>';
    html += '<div class="kpi-row mt">' +
      kpi("roi", "Aporte por evento", usd(aporteEvento), "156.168.654 / 103") +
      kpi("roi", "Aporte por asistente", usd(aporteAsistente), "sobre 242.019 proyectados") +
      kpi("roi", "Cuartos noche", num(inf.cuartosNoche), "publicados con los 103") +
      kpi("flujo", "Internacionales", num(inf.internacionales), "de 103 captados y apoyados") +
      "</div>";
    html += grupo("Captados",
      celda("span-12", prioridad()) +
      celda("span-5", block("Dentro de los 103", "59 internacionales y 44 nacionales. Los dólares no se reparten.", Charts.donut([
        { label: "Internacionales", value: inf.internacionales, color: "#108181", text: String(inf.internacionales) },
        { label: "Nacionales", value: inf.nacionales, color: "#E9901E", text: String(inf.nacionales) }
      ]) + pie("Informe gestión 2025 · corte 2025"))) +
      celda("span-7", impactoPublicado(aporteEvento)) +
      celda("span-12", calculadoraInspeccion()));
    html += grupo("Después de la candidatura",
      celda("span-7", perdidas()) +
      celda("span-5", block("Eventos realizados", "Otro universo. No se suma al flujo de captación.", "<p>Medellín recibió <strong>" + num(inf.realizados.eventos) + "</strong> eventos, con " + num(inf.realizados.asistentes) + " asistentes y una derrama estimada de USD " + inf.realizados.derramaMillonesUsd + " millones.</p>" + pie("Informe gestión 2025 · corte 2025"))));
    return html;
  }

  function prioridad() {
    var con = filasAnio(DATA.conectividad.serie, state.anio === 2025 ? 2025 : state.anio);
    var pasajeros = sumaMercado(con, "pasajeros");
    var llegadas = sumaMercado(con, "llegadas");
    var paquete = olaPara(state.anio === 2026 ? 2025 : state.anio);
    var gasto = {};
    ((paquete.ola && paquete.ola.gasto_por_mercado) || []).forEach(function (row) { gasto[row.mercado] = row.gasto_estadia_usd; });
    function escala(mapa) {
      var max = Math.max.apply(null, MERCADOS.map(function (m) { return mapa[m] || 0; }).concat([1]));
      var out = {};
      MERCADOS.forEach(function (m) { out[m] = ((mapa[m] || 0) / max) * 100; });
      return out;
    }
    var a = escala(pasajeros), b = escala(llegadas), c = escala(gasto);
    var corto = { Colombia: "Colombia", "Estados Unidos": "EE. UU.", "México": "México", Brasil: "Brasil", Europa: "Europa" };
    var grupos = MERCADOS.map(function (m) {
      var codigo = PAIS_DE_MERCADO[m] || "";
      var activo = state.pais !== "Todos" && (state.pais === codigo || mercadoDe(state.pais) === m);
      return {
        label: corto[m],
        pais: activo ? state.pais : "",
        bars: [
          { name: "Pasajeros", value: a[m], color: "#E9901E", pais: activo ? state.pais : "" },
          { name: "Llegadas", value: b[m], color: "#108181", pais: activo ? state.pais : "" },
          { name: "Gasto EVI", value: c[m], color: "#FBBB28", pais: activo ? state.pais : "" }
        ]
      };
    });
    return block("Prioridad de mercado", "Cada barra va de 0 a 100 dentro de su componente. El índice usa 40 % pasajeros, 30 % llegadas y 30 % gasto EVI. Colombia no tiene gasto en esa encuesta. No es el scoring de organizadores.", Charts.grouped(grupos) + pie("Aerocivil " + cobertura((DATA.conectividad || {}).serie) + extraido("conectividad") + " + EVI " + (paquete.ola ? paquete.ola.ola : "sin ola") + extraido("evi")));
  }

  function impactoPublicado(aporteEvento) {
    var inf = window.INFORME;
    var aporteAsistente = inf.impactoUsd / inf.asistentes;
    return block(
      "Impacto publicado",
      pastilla("roi"),
      "<p class=\"hint\">Cifras del informe de gestión 2025. El aporte por evento es el impacto estimado dividido entre los 103 captados. No hay costo de captación publicado, así que no se calcula ROI ni se inventa un costo.</p>" +
      Charts.bars([
        { label: "Impacto total", value: inf.impactoUsd, text: usd(inf.impactoUsd), color: "#00AEAC" },
        { label: "Aporte por evento", value: aporteEvento, text: usd(aporteEvento), color: "#108181" },
        { label: "Aporte por asistente", value: aporteAsistente, text: usd(aporteAsistente), color: "#FBBB28" }
      ], "#108181", { xLabel: "USD" }) +
      hueco("Sin costo de captación", "El informe no publica el costo por evento ni el presupuesto de captación. Sin ese extracto no hay barra de costo ni ROI.") +
      pie("Informe gestión 2025 · corte 2025")
    );
  }

  function calculadoraInspeccion() {
    var ins = Number(state.calc.inspecciones);
    var conf = Number(state.calc.confirmadas);
    var tieneIns = state.calc.inspecciones !== "" && !isNaN(ins) && ins >= 0;
    var tieneConf = state.calc.confirmadas !== "" && !isNaN(conf) && conf >= 0;
    var tasa = tieneIns && tieneConf && ins > 0 ? conf / ins : null;
    var figura = (tieneIns && tieneConf)
      ? Charts.bars([
        { label: "Inspecciones", value: ins, text: num(ins), color: "#108181" },
        { label: "Confirmaciones", value: conf, text: num(conf), color: "#00AEAC" }
      ], "#108181", { xLabel: "Cantidad" }) +
        '<p class="hint">Tasa del ejercicio: <strong>' + (tasa == null ? "—" : num(tasa * 100, 1) + " %") + '</strong>. Solo usa lo que usted digita; no se guarda al recargar.</p>'
      : hueco(
        "Sin registro publicado",
        "No hay extracto del registro de inspecciones del Bureau. Los fam trips vacacionales de 2025 no son inspecciones de sede. Digite abajo solo si tiene el conteo real del Bureau."
      );
    return block(
      "Visitas de inspección",
      pastilla("inspeccion"),
      figura +
      '<div class="calc"><label>Inspecciones<input data-calc="inspecciones" inputmode="numeric" value="' + esc(state.calc.inspecciones) + '"></label>' +
      '<label>Confirmadas<input data-calc="confirmadas" inputmode="numeric" value="' + esc(state.calc.confirmadas) + '"></label></div>' +
      pie("Registro de inspecciones · pendiente de extracto")
    );
  }

  function perdidas() {
    var motivos = ["Precio", "Fechas", "Recinto", "Conectividad", "Decisión de la asociación", "Otro"];
    return block(
      "Motivos de pérdida",
      pastilla("perdidas"),
      hueco(
        "Sin conteo en el CRM",
        "El informe y las bases abiertas no traen candidaturas perdidas por motivo. No se reparte la taxonomía en partes iguales ni se inventa un ranking."
      ) +
      '<p class="hint">Categorías de referencia (sin frecuencias): ' + motivos.map(function (m) { return esc(m); }).join(" · ") + '.</p>' +
      pie("CRM de candidaturas · pendiente de extracto")
    );
  }

  function vistaMiembros() {
    var inf = window.INFORME;
    var r = inf.rueda;
    var porCita = r.expectativa / r.citas;
    var porRueda = r.expectativa / r.miembros;
    var porActivo = r.expectativa / inf.miembros;
    var participacion = r.miembros / inf.miembros;
    var efectividad = r.cumplieron / r.citas;
    var altas = inf.altas / inf.miembros;
    var html = "";
    if (state.anio !== 2025) html += '<p class="aviso">El informe citado es el corte 2025.</p>';
    html += '<div class="kpi-row">' +
      kpi("oportunidades", "Expectativa por cita", pesos(porCita), "7.925.390.000 / 433") +
      kpi("oportunidades", "Expectativa por miembro de la rueda", pesos(porRueda), "entre 68 participantes") +
      kpi("engagement", "Participación en la rueda", num(participacion * 100, 1) + " %", "68 / 200") +
      kpi("satisfaccion", "Satisfacción de la gestión", num(inf.satisfaccion, 1) + " / " + inf.satisfaccionEscala, "n no publicada") +
      "</div>";
    html += grupo("Rueda y padrón",
      celda("span-5", block("Citas de la rueda", "418 cumplieron expectativas y 15 no, sobre las mismas 433 citas. El informe redondea la efectividad a 96,5 %.", Charts.donut([
        { label: "Cumplieron", value: r.cumplieron, color: "#108181", text: String(r.cumplieron) },
        { label: "No cumplieron", value: r.citas - r.cumplieron, color: "#FBBB28", text: String(r.citas - r.cumplieron) }
      ]) + pie("Informe gestión 2025 · corte 2025"))) +
      celda("span-7", block("Padrón de la rueda", "68 de los 200 activos fueron a la rueda. El resto del padrón no es deserción.", Charts.bars([
        { label: "En la rueda", value: r.miembros, text: String(r.miembros), color: "#00AEAC" },
        { label: "Activos sin rueda", value: inf.miembros - r.miembros, text: String(inf.miembros - r.miembros), color: "#172139" }
      ]) + pie("Informe gestión 2025 · corte 2025"))) +
      celda("span-6", block("Padrón", pastilla("retencion"), "<ul class='lista'><li><span>Activos al cierre</span><strong>" + inf.miembros + "</strong></li><li><span>Altas del año</span><strong>" + inf.altas + "</strong></li><li><span>Altas sobre el cierre</span><strong>" + num(altas * 100, 1) + " %</strong></li></ul><p class='hint'>23 / 200 no es la deserción. Falta el padrón de apertura.</p><p>Segmentos de las altas, sin conteo: " + esc(inf.segmentosAltas.join(", ")) + ".</p>" + pie("Informe gestión 2025 · corte 2025"))) +
      celda("span-6", block("Expectativa del año", "Dos denominadores publicados. No es el valor de vida.", "<ul class='lista'><li><span>Por cita</span><strong>" + pesos(porCita) + "</strong></li><li><span>Por quien fue a la rueda</span><strong>" + pesos(porRueda) + "</strong></li><li><span>Por activo</span><strong>" + pesos(porActivo) + "</strong></li></ul>" + pie("Informe gestión 2025 · corte 2025"))));
    html += grupo("Padrón publicado y ejercicio",
      celda("span-6", valorYDesercionPublicados()) +
      celda("span-6", calculadoraMiembros()) +
      celda("span-12", satisfaccionPublicada()));
    return html;
  }

  function figuraInformeBarras(titulo, labels, values, unidad) {
    if (!labels || !values || !labels.length) return "";
    var items = labels.map(function (label, i) {
      var v = Number(values[i]);
      if (isNaN(v)) v = 0;
      var digits = Math.abs(v) >= 100 ? 0 : (Math.abs(v) >= 10 ? 1 : 2);
      return {
        label: String(label || "").length > 28 ? String(label).slice(0, 27) + "…" : String(label || ""),
        value: Math.abs(v),
        text: num(v, digits),
        color: Charts.palette[i % Charts.palette.length]
      };
    });
    return "<h4 class='mt'>" + esc(titulo || "Gráfico") + "</h4>" +
      Charts.bars(items, "#108181", { xLabel: unidad || "Valor" });
  }

  function figuraInforme(g) {
    if (!g || !g.labels || !g.values || !g.labels.length) return "";
    var unidad = String(g.unidad || "");
    var mixto = /mixto/i.test(unidad);
    if (mixto && g.labels.length >= 4) {
      var mitad = Math.ceil(g.labels.length / 2);
      return figuraInformeBarras(g.titulo + " · grupo A", g.labels.slice(0, mitad), g.values.slice(0, mitad), unidad) +
        figuraInformeBarras(g.titulo + " · grupo B", g.labels.slice(mitad), g.values.slice(mitad), unidad);
    }
    if (mixto && g.labels.length >= 2) {
      var mid = Math.floor(g.labels.length / 2) || 1;
      return figuraInformeBarras(g.titulo + " · escala 1", g.labels.slice(0, mid), g.values.slice(0, mid), unidad) +
        figuraInformeBarras(g.titulo + " · escala 2", g.labels.slice(mid), g.values.slice(mid), unidad);
    }
    return figuraInformeBarras(g.titulo, g.labels, g.values, unidad);
  }

  function listaInforme(items, clase) {
    if (!items || !items.length) return "";
    return "<ul class='lista informe-lista " + (clase || "") + "'>" + items.map(function (b) {
      var texto = b.texto || "";
      var extra = b.implicacion ? " <em class='implicacion'>" + esc(b.implicacion) + "</em>" : "";
      return "<li><span>" + esc(texto) + "</span>" + extra +
        (b.fuente ? " <span class='src'>(" + esc(b.fuente) + ")</span>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function tablaInforme(t) {
    if (!t || !t.columnas || !t.filas || !t.filas.length) return "";
    var head = "<tr>" + t.columnas.map(function (c) {
      return "<th>" + esc(c) + "</th>";
    }).join("") + "</tr>";
    var body = t.filas.map(function (fila) {
      return "<tr>" + (fila || []).map(function (cel, i) {
        var v = cel;
        if (typeof v === "number") {
          v = i > 0 && Math.abs(v) <= 1 && String(t.columnas[i] || "").indexOf("%") >= 0
            ? num(v * (Math.abs(v) <= 1 ? 100 : 1), 1) + (Math.abs(cel) <= 1 ? " %" : "")
            : num(v, Math.abs(v) >= 100 ? 0 : 1);
        }
        return "<td>" + esc(v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return "<div class='tec-tabla-wrap'><h4>" + esc(t.titulo || "Tabla") + "</h4>" +
      "<table class='tec-tabla'><thead>" + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }

  function logosInforme(modo) {
    var dark = modo === "dark";
    var col = dark ? "assets/logo_colmayor_blanco.png?v=5" : "assets/logo_colmayor_light.png?v=5";
    return '<div class="tec-logos tec-logos-' + (dark ? "dark" : "light") + '">' +
      '<img class="tec-logo-bureau" src="assets/logo_bureau.svg" alt="Greater Medellín Convention &amp; Visitors Bureau">' +
      '<img class="tec-logo-colmayor" src="' + col + '" alt="Colegio Mayor de Antioquia">' +
      "</div>";
  }

  function cuerpoSeccionInforme(sec, idx) {
    var nHall = (sec.bullets || []).length;
    var nIns = (sec.insights || []).length;
    var nAna = (sec.analisis || []).length;
    var lead = sec.lead ? "<p class='tec-lead'>" + esc(sec.lead) + "</p>" : "";
    var mapaHtml = "";
    if ((sec.id === "emisores" || sec.id === "receptivo") && window.Mapas && Mapas.shell && filasMapaEmisores().length) {
      mapaHtml = Mapas.shell({
        id: "mapa-informe-emisores",
        height: 400,
        titulo: "Mapa mundi · densidad de emisores",
        pista: "Misma figura del dashboard · Migración + MinCIT + EVI."
      });
    }
    var figura = mapaHtml + tablaInforme(sec.tabla) + figuraInforme(sec.grafico);
    var insightTitulo = (sec.insights && sec.insights[0] && sec.insights[0].texto)
      ? '<p class="tec-insight-title">' + esc(sec.insights[0].texto) + "</p>"
      : "";
    var cols =
      '<div class="tec-cols">' +
      '<div class="tec-col">' +
      (nHall ? "<h4>Hallazgos</h4>" + listaInforme(sec.bullets) : "") +
      "</div>" +
      '<div class="tec-col">' +
      (nAna ? "<h4>Análisis</h4>" + listaInforme(sec.analisis) : "") +
      (nIns ? "<h4 class='mt'>Insights</h4>" + listaInforme(sec.insights, "insights") : "") +
      "</div></div>";
    return '<article class="tec-sec" id="sec-' + esc(sec.id) + '">' +
      '<header class="tec-sec-head">' +
      '<span class="tec-sec-num">' + ("0" + (idx + 1)).slice(-2) + "</span>" +
      "<div><h3>" + esc(sec.titulo || "Sección") + "</h3>" +
      pastilla("informe-llm") + " " + nHall + " hallazgos" + (nIns ? " · " + nIns + " insights" : "") +
      "</div></header>" +
      insightTitulo +
      (figura ? '<div class="tec-anchor"><p class="tec-fig-label">Figura ' + (idx + 1) + " · fuente dashboard</p>" + figura + "</div>" : "") +
      lead +
      cols +
      pie("Informe TEC-Bureau · Colmayor V7 · corte " + ((DATA.informe && DATA.informe.corte) || "—") +
        (DATA.informeLive ? " · generado en sesión" : "")) +
      "</article>";
  }

  function portadaInforme(inf) {
    if (!inf) return "";
    var banco = inf.banco_imagenes || {};
    var portada = banco.portada || { url: "assets/tec-photos/cover.png" };
    var resumen = (inf.resumen_ejecutivo || []).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");
    var toc = (inf.secciones || []).map(function (s) {
      return '<li><a href="#sec-' + esc(s.id) + '">' + esc(s.titulo || s.id) + "</a></li>";
    }).join("");
    return '<section class="tec-portada">' +
      (portada && portada.url ? '<div class="tec-hero" style="background-image:url(\'' + esc(portada.url) + '\')"></div>' : "") +
      "<div class='tec-portada-top'>" + logosInforme("dark") +
      '<span class="tec-turismo-tag">Turismo <i></i></span></div>' +
      "<div class='tec-portada-copy'>" +
      "<p class='tec-kicker'>Bureau Medellín · Colmayor · Manual V7</p>" +
      "<h2>" + esc(inf.titulo || "Informe de inteligencia turística") + "</h2>" +
      '<p class="tec-period">' + esc(inf.subtitulo || ("Corte " + (inf.corte || "—"))) + "</p>" +
      "</div><div class='tec-portada-bar'></div></section>" +
      (resumen ? "<section class='tec-resumen block'><h3>Resumen ejecutivo</h3><ul class='lista'>" + resumen + "</ul></section>" : "") +
      (toc ? "<section class='tec-toc block'><div class='tec-toc-head'>" + logosInforme("light") +
        "</div><h3>Contenido</h3><ol>" + toc + "</ol></section>" : "");
  }

  function modosLlm() {
    if (state.llmModes && state.llmModes.length) return state.llmModes;
    var providers = state.llmProviders || [];
    var any = providers.some(function (p) { return p.configured; });
    return [{
      id: "cadena",
      label: "Cadena (Groq → FreeLLM)",
      configured: any,
      models: [],
      defaultModel: "",
      nota: "Modelo a modelo; FreeLLMAPI es fallback."
    }].concat(providers);
  }

  function proveedorLlmActivo() {
    var modos = modosLlm();
    var id = state.informeProvider || "cadena";
    var hit = null;
    for (var i = 0; i < modos.length; i++) {
      if (modos[i].id === id) hit = modos[i];
    }
    if (hit && hit.configured) return hit;
    for (var j = 0; j < modos.length; j++) {
      if (modos[j].configured) return modos[j];
    }
    return hit || { id: "cadena", label: "Cadena", configured: false, models: [], defaultModel: "" };
  }

  function modelosParaModo(modo) {
    if (!modo) return [];
    if (modo.id === "cadena") {
      var groq = null;
      var lista = state.llmProviders || [];
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === "groq" && lista[i].configured) groq = lista[i];
      }
      if (groq && groq.models && groq.models.length) {
        return { models: groq.models.slice(), defaultModel: groq.defaultModel || groq.models[0] };
      }
      if (state.llmChain && state.llmChain.length) {
        var first = String(state.llmChain[0] || "").split("/")[1] || "";
        return { models: first ? [first] : ["auto"], defaultModel: first || "auto" };
      }
      return { models: ["auto"], defaultModel: "auto" };
    }
    var models = (modo.models && modo.models.length) ? modo.models.slice() : [modo.defaultModel || "auto"];
    return { models: models, defaultModel: modo.defaultModel || models[0] || "" };
  }

  function selectoresLlm() {
    cargarLlmProviders();
    var lista = state.llmProviders;
    if (!lista) {
      return '<span class="src">Cargando proveedores LLM…</span>';
    }
    var modos = modosLlm().filter(function (p) { return p.configured; });
    if (!modos.length) {
      return '<span class="src">Sin proveedor LLM configurado (GROQ_API_KEY o FREELLM_*).</span>';
    }
    var activo = proveedorLlmActivo();
    if (activo && activo.id) state.informeProvider = activo.id;
    var provOpts = modos.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === state.informeProvider ? " selected" : "") + ">" +
        esc(p.label) + "</option>";
    }).join("");
    var pack = modelosParaModo(activo);
    if (!state.informeModel || pack.models.indexOf(state.informeModel) < 0) {
      state.informeModel = pack.defaultModel || pack.models[0] || "";
    }
    var modelOpts = pack.models.map(function (m) {
      return '<option value="' + esc(m) + '"' + (m === state.informeModel ? " selected" : "") + ">" + esc(m) + "</option>";
    }).join("");
    var hint = state.informeProvider === "cadena"
      ? '<span class="src">Cadena: prueba modelo a modelo; FreeLLMAPI entra al final si está configurado.</span>'
      : "";
    return '<label class="llm-sel">Modo <select data-llm="provider"' +
      (state.informeGen === "cargando" ? " disabled" : "") + ">" + provOpts + "</select></label>" +
      '<label class="llm-sel">Preferir <select data-llm="model"' +
      (state.informeGen === "cargando" ? " disabled" : "") + ">" + modelOpts + "</select></label>" +
      hint;
  }

  function cargarLlmProviders() {
    if (state.llmProviders || state._llmProvidersLoading) return;
    state._llmProvidersLoading = true;
    fetch("/api/generar-informe", { method: "GET", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        state.llmProviders = (body && body.providers) || [];
        state.llmModes = (body && body.modes) || null;
        state.llmChain = (body && body.chain) || null;
        var def = (body && body.defaultProvider) || "cadena";
        state.informeProvider = def;
        var activo = proveedorLlmActivo();
        state.informeProvider = activo.id || "cadena";
        var pack = modelosParaModo(activo);
        state.informeModel = pack.defaultModel || "";
        state._llmProvidersLoading = false;
        if (state.tab === "informes") render();
      })
      .catch(function () {
        state.llmProviders = [];
        state.llmModes = null;
        state._llmProvidersLoading = false;
        if (state.tab === "informes") render();
      });
  }

  function resumenAttempts(attempts) {
    if (!attempts || !attempts.length) return "";
    return attempts.map(function (a) {
      return (a.provider || "?") + "/" + (a.model || "?") + (a.ok ? " ✓" : " ✗");
    }).join(" → ");
  }

  function navPiezas() {
    var items = [
      ["infografia", "Infográficos"],
      ["boletin", "Boletines"],
      ["informe", "Informe TEC"]
    ];
    return '<div class="opts no-print pieza-nav" role="tablist" aria-label="Tipo de pieza">' +
      items.map(function (it) {
        var on = state.pieza === it[0];
        return '<button type="button" class="tab pieza-tab' + (on ? " active" : "") + '" data-pieza="' + it[0] + '" role="tab" aria-selected="' + on + '">' + it[1] + "</button>";
      }).join("") + "</div>";
  }

  function vistaInfografia() {
    if (!window.Piezas) return hueco("Piezas", "Falta piezas.js");
    var d = Piezas.datosEmisores(DATA, state.anio);
    if (!d.top.length) {
      return navPiezas() +
        '<p class="aviso">Infografía A (Hero KPI) · opción implementada. Sin top_paises en el corte ' + esc(String(state.anio)) + ".</p>" +
        hueco("Sin emisores", "Cargue Migración o MinCIT para el año seleccionado.");
    }
    return navPiezas() +
      '<p class="aviso"><strong>Infografía A · Hero KPI</strong> implementada con datos vivos del pack (' + esc(String(state.anio)) +
      "). Descargue HTML autónomo o PDF (diálogo de impresión).</p>" +
      Piezas.botonesDescarga({ kind: "infografia" }) +
      '<div class="pieza-live">' + Piezas.htmlInfografiaA(d) + "</div>" +
      '<p class="hint no-print">Variantes B/C siguen en <a href="design-options/infografia-index.html">design-options/infografia-index.html</a>.</p>';
  }

  function vistaBoletin() {
    if (!window.Piezas) return hueco("Piezas", "Falta piezas.js");
    var d = Piezas.datosEmisores(DATA, state.anio);
    return navPiezas() +
      '<p class="aviso"><strong>Boletín A · email 600px</strong> con datos del pack. PDF vía impresión del navegador.</p>' +
      Piezas.botonesDescarga({ kind: "boletin" }) +
      '<div class="pieza-live">' + Piezas.htmlBoletinA(d) + "</div>" +
      '<p class="hint no-print">Variante A4 en <a href="design-options/boletin-index.html">design-options/boletin-index.html</a>.</p>';
  }

  function vistaInformeTec() {
    var inf = DATA.informe;
    var llmSel = selectoresLlm();
    var genBtn = '<button class="btn btn-gen" type="button" data-action="generar-informe"' +
      (state.informeGen === "cargando" ? " disabled" : "") + ">" +
      (state.informeGen === "cargando" ? "Generando…" : "Generar informe TEC") + "</button>";
    var genEstado = "";
    if (state.informeGen === "cargando") {
      var modoLbl = state.informeProvider === "cadena" ? "cadena Groq→FreeLLM" : (state.informeProvider || "llm");
      genEstado = '<p class="aviso">Generando (' + esc(modoLbl) +
        "), preferir " + esc(state.informeModel || "modelo") + ". Puede tardar hasta 120 s.</p>";
    } else if (state.informeGen === "error") {
      genEstado = '<p class="aviso">' + esc(state.informeError || "No se pudo generar.") +
        " Se mantiene el informe cargado. Configure GROQ_API_KEY; FreeLLMAPI es fallback (FREELLM_BASE_URL + FREELLM_API_KEY, URL pública).</p>";
    } else if (state.informeGen === "ok") {
      var meta = (inf && inf.meta_generacion) || {};
      var cadenaTxt = resumenAttempts(meta.attempts);
      genEstado = '<p class="aviso">Informe regenerado · corte ' + esc((inf && inf.corte) || "—") +
        " · sirvió " + esc(meta.provider || "llm") +
        " / " + esc(meta.model || "—") +
        (meta.mode === "cadena" ? " (modo cadena)" : "") +
        (((meta.banco) ? " · imágenes " + meta.banco : "")) +
        (cadenaTxt ? " · intentos: " + esc(cadenaTxt) : "") +
        ". Descargue HTML, PDF o JSON.</p>";
    }
    var barraLlm = '<div class="opts no-print"><span>LLM:</span> ' + llmSel + " " + genBtn + "</div>";
    var shell = navPiezas() + genEstado + barraLlm;
    if (!inf || !inf.secciones || !inf.secciones.length) {
      return shell +
        '<p class="aviso">Generar usa todo data/open (agregados de Mercados, Visitante, Captación y Miembros).</p>' +
        hueco("Sin informe LLM", "Publique data/open/informe_llm.json o pulse Generar informe TEC.");
    }
    var secs = inf.secciones.filter(function (sec) {
      return !state.informesSel || state.informesSel.indexOf(sec.id) >= 0;
    });
    var checks = inf.secciones.map(function (sec) {
      var on = !state.informesSel || state.informesSel.indexOf(sec.id) >= 0;
      return '<label class="check"><input type="checkbox" data-infsec="' + esc(sec.id) + '"' + (on ? " checked" : "") + "> " + esc(sec.titulo || sec.id) + "</label>";
    }).join("");
    var descargaJson = DATA.informeLive
      ? '<button class="btn" type="button" data-action="descargar-informe">JSON</button>'
      : '<a class="btn" href="data/open/informe_llm.json" download="informe_' + esc(inf.corte || "llm") + '.json">JSON</a>';
    return shell +
      '<p class="aviso">Formato TEC-Bureau. Corte ' + esc(inf.corte || "—") + ".</p>" +
      '<div class="opts no-print"><span>Secciones:</span> ' + checks +
      " " + descargaJson +
      ' <button class="btn" type="button" data-action="descargar-html" data-kind="informe">HTML</button>' +
      ' <button class="btn" type="button" data-action="descargar-pdf" data-kind="informe">PDF</button>' +
      ' <button class="btn" type="button" data-ficha="informe-llm">Ficha</button></div>' +
      '<div class="tec-doc" id="pieza-export">' +
      portadaInforme(inf) +
      secs.map(function (sec, i) { return cuerpoSeccionInforme(sec, i); }).join("") +
      "</div>";
  }

  function vistaInformes() {
    if (state.pieza === "boletin") return vistaBoletin();
    if (state.pieza === "informe") return vistaInformeTec();
    return vistaInfografia();
  }

  function generarInformeOnDemand() {
    if (state.informeGen === "cargando") return;
    var activo = proveedorLlmActivo();
    if (!activo.configured) {
      state.informeGen = "error";
      state.informeError = "Ningún proveedor LLM configurado en el servidor.";
      render();
      return;
    }
    var modoPedido = activo.id || state.informeProvider || "cadena";
    state.informeProvider = modoPedido;
    var pack = modelosParaModo(activo);
    if (!state.informeModel) state.informeModel = pack.defaultModel || "";
    state.informeGen = "cargando";
    state.informeError = "";
    render();
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 120000);
    fetch("/api/generar-informe", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({
        provider: modoPedido,
        model: state.informeModel
      })
    }).then(function (resp) {
      return resp.json().then(function (body) {
        return { ok: resp.ok, status: resp.status, body: body };
      }).catch(function () {
        return { ok: false, status: resp.status, body: { error: "Respuesta no JSON (" + resp.status + ")" } };
      });
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var intentos = resumenAttempts(res.body && res.body.attempts);
        var msg = (res.body && res.body.error) || ("Error HTTP " + res.status);
        if (intentos) msg += " · " + intentos;
        throw new Error(msg);
      }
      if (!res.body || !res.body.secciones || !res.body.secciones.length) {
        throw new Error("La API no devolvió secciones.");
      }
      DATA.informe = res.body;
      DATA.informeLive = true;
      state.informeGen = "ok";
      state.informesSel = null;
      if (res.body.meta_generacion && res.body.meta_generacion.mode) {
        state.informeProvider = res.body.meta_generacion.mode;
      } else {
        state.informeProvider = modoPedido;
      }
      render();
    }).catch(function (err) {
      clearTimeout(timer);
      state.informeGen = "error";
      state.informeError = err && err.name === "AbortError"
        ? "Tiempo agotado (120 s)."
        : String((err && err.message) || err || "Fallo de red o API ausente.");
      render();
    });
  }

  function descargarInformeLive() {
    var blob = new Blob([JSON.stringify(DATA.informe || {}, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "informe_" + (((DATA.informe || {}).corte) || "live") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function valorYDesercionPublicados() {
    var inf = window.INFORME;
    var altasSobreCierre = inf.altas / inf.miembros * 100;
    return block(
      "Valor de vida y deserción",
      pastilla("valor") + " " + pastilla("retencion"),
      Charts.bars([
        { label: "Activos al cierre", value: inf.miembros, text: num(inf.miembros), color: "#00AEAC" },
        { label: "Altas del año", value: inf.altas, text: num(inf.altas), color: "#108181" },
        { label: "Altas / cierre", value: altasSobreCierre, text: num(altasSobreCierre, 1) + " %", color: "#FBBB28" }
      ], "#108181", { xLabel: "Cifra publicada" }) +
      '<p class="hint">23 / 200 es la participación de las altas en el cierre, no la deserción. La expectativa de la rueda es un flujo de un año y está en otra tarjeta.</p>' +
      hueco("Sin deserción ni valor de vida", "Falta el padrón con el que abrió 2025, la cuota anual y los años de permanencia. Sin esos extractos no se calcula deserción ni LTV.") +
      pie("Informe gestión 2025 · corte 2025")
    );
  }

  function satisfaccionPublicada() {
    var inf = window.INFORME;
    return block(
      "Satisfacción de la gestión",
      pastilla("satisfaccion"),
      Charts.columns([
        { label: "Satisfacción", value: inf.satisfaccion, text: num(inf.satisfaccion, 1), color: "#108181" }
      ], { yLabel: "Escala 1–5", xLabel: "Indicador", max: inf.satisfaccionEscala }) +
      '<p class="hint">Calificación publicada: ' + num(inf.satisfaccion, 1) + " / " + inf.satisfaccionEscala + ". La n de respuestas no aparece en el informe.</p>" +
      hueco("Sin escala de confianza", "El informe menciona la confianza y no le asigna número. No hay NPS ni segunda marca inventada.") +
      pie("Informe gestión 2025 · corte 2025")
    );
  }

  function calculadoraMiembros() {
    var stock = Number(state.calc.stockInicial);
    var cuota = Number(state.calc.cuota);
    var anos = Number(state.calc.anos);
    var bajas = state.calc.stockInicial === "" ? null : stock + window.INFORME.altas - window.INFORME.miembros;
    var desercion = stock > 0 && bajas != null && bajas >= 0 ? bajas / stock : null;
    var ltv = cuota > 0 && anos > 0 ? cuota * anos : null;
    var notaBajas = "";
    if (bajas != null && bajas < 0) notaBajas = "<p class='hint'>Ese padrón de apertura no cierra con 23 altas y 200 activos.</p>";
    return block("Deserción y valor de vida", '<span class="pastilla usuario">Ejercicio del usuario</span>',
      '<p class="hint">Bajas = padrón de apertura + 23 − 200. Valor de vida de ejercicio = cuota × años. Se borra al recargar.</p>' +
      '<div class="calc"><label>Padrón al abrir 2025<input data-calc="stockInicial" inputmode="numeric" value="' + esc(state.calc.stockInicial) + '"></label>' +
      '<label>Cuota anual<input data-calc="cuota" inputmode="numeric" value="' + esc(state.calc.cuota) + '"></label>' +
      '<label>Años<input data-calc="anos" inputmode="numeric" value="' + esc(state.calc.anos) + '"></label></div>' +
      "<p class='mt'><strong>Deserción: " + (desercion == null ? "sin cálculo" : num(desercion * 100, 1) + " %") + "</strong></p>" + notaBajas +
      "<p><strong>Valor de vida de ejercicio: " + (ltv == null ? "sin cálculo" : pesos(ltv)) + "</strong></p>" + pie("Ejercicio del usuario · no se guarda"));
  }

  function modal() {
    if (!state.ficha) return "";
    var ficha = window.fichaPorId(state.ficha);
    if (!ficha) return "";
    return '<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo"><h3 id="ficha-titulo">' + esc(ficha.nombre) + "</h3><dl>" +
      "<dt>Fórmula</dt><dd>" + esc(ficha.formula) + "</dd>" +
      "<dt>Fuente</dt><dd>" + esc(ficha.fuenteTipo) + ". " + esc(ficha.fuente) + "</dd>" +
      "<dt>Periodicidad pedida</dt><dd>" + esc(ficha.pedida) + "</dd>" +
      "<dt>Grano real</dt><dd>" + esc(ficha.grano) + "</dd>" +
      "<dt>Unidad</dt><dd>" + esc(ficha.unidad) + "</dd>" +
      "<dt>Universo</dt><dd>" + esc(ficha.universo) + "</dd>" +
      "<dt>Licencia</dt><dd>" + esc(ficha.licencia) + "</dd>" +
      "<dt>Qué no mide</dt><dd>" + esc(ficha.noMide) + "</dd></dl>" +
      '<button class="btn mt" type="button" data-action="cerrar">Cerrar</button></div></div>';
  }

  function render() {
    Charts.setFoco(state.pais === "Todos" ? "" : state.pais);
    var preguntas = {
      mercados: ["¿Cómo se mueve la demanda de los mercados priorizados hacia Medellín?", "Pasajeros, interés digital, llegadas, ICCA y tarifas."],
      visitante: ["¿Quién llega, cuánto gasta, cuánto se queda y cómo evalúa el destino?", "Ola de la EVI en José María Córdova."],
      captacion: ["¿Qué organizadores avanzan, dónde se cae la candidatura y qué retorno deja cada segmento?", "Corte anual del informe de gestión 2025."],
      miembros: ["¿Cuánto vale, cuánto participa y cuánto se queda cada miembro?", "Rueda de Negocios y padrón publicados en 2025."],
      informes: state.pieza === "infografia"
        ? ["¿Cómo comunicar el top de emisores en una pieza social?", "Infografía A · Hero KPI con datos vivos Migración + MinCIT."]
        : state.pieza === "boletin"
          ? ["¿Qué resumen cabe en un boletín para stakeholders?", "Boletín A · email con KPIs y ranking corto."]
          : ["¿Qué dice el informe redactado por LLM sobre el corte?", "Narrativa verificada contra el warehouse, con fuente por hallazgo."]
    };
    var anos = [];
    (DATA.conectividad.serie || []).forEach(function (row) {
      if (anos.indexOf(row.anio) < 0) anos.push(row.anio);
    });
    anos.sort();
    var pregunta = preguntas[state.tab];
    var vista = { mercados: vistaMercados, visitante: vistaVisitante, captacion: vistaCaptacion, miembros: vistaMiembros, informes: vistaInformes }[state.tab]();
    var nombresTab = { mercados: "Mercados", visitante: "Visitante", captacion: "Captación B2B", miembros: "Miembros", informes: "Informes" };
    var ids = ["mercados", "visitante", "captacion", "miembros", "informes"];
    document.body.dataset.tablero = state.tab;
    document.getElementById("app").innerHTML =
      '<div class="mando"><div class="tabs" role="tablist" aria-label="Tableros">' + ids.map(function (id) {
        var activo = state.tab === id;
        return '<button type="button" role="tab" class="tab ' + id + (activo ? " active" : "") + '" id="tab-' + id + '" data-tab="' + id + '" aria-selected="' + activo + '" aria-controls="panel" tabindex="' + (activo ? "0" : "-1") + '">' + nombresTab[id] + "</button>";
      }).join("") + "</div>" +
      '<div class="filters"><label class="filter">Año<select data-filtro="anio">' + anos.map(function (anio) {
        return '<option' + (anio === state.anio ? " selected" : "") + ">" + anio + "</option>";
      }).join("") + '</select></label><label class="filter">País<select data-filtro="pais"><option value="Todos"' + (state.pais === "Todos" ? " selected" : "") + ">Todos</option>" +
      opcionesPais().map(function (row) {
        var marca = row.priorizado ? " · lista Bureau" : "";
        return '<option value="' + esc(row.pais) + '"' + (row.pais === state.pais ? " selected" : "") + ">" + esc(etiquetaPais(row.pais) + marca) + "</option>";
      }).join("") + "</select></label><span class='corte'>Agregados del " + esc((DATA.manifiesto && DATA.manifiesto.generado) || "—") + "</span></div></div>" +
      '<p class="qbox"><strong>' + esc(pregunta[0]) + "</strong><span>" + esc(pregunta[1]) + "</span></p>" +
      '<div id="panel" role="tabpanel" aria-labelledby="tab-' + state.tab + '">' + vista + "</div>" + modal();
    var estado = document.getElementById("estado");
    if (estado) estado.textContent = nombresTab[state.tab] + ", " + state.anio + ", " + etiquetaPais(state.pais);
    escribirUrl();
    montarMapas();
    if (state.ficha) {
      var cerrar = document.querySelector("[data-action='cerrar']");
      if (cerrar) cerrar.focus();
    } else if (state.volverFicha) {
      var origen = document.querySelector('[data-ficha="' + state.volverFicha + '"]');
      state.volverFicha = "";
      if (origen) origen.focus();
    }
  }

  function opcionesPais() {
    var lista = rankingPaises().slice(0, 20);
    if (state.pais !== "Todos" && !lista.some(function (row) { return row.pais === state.pais; })) {
      var extra = rankingPaises().find(function (row) { return row.pais === state.pais; });
      if (extra) lista.push(extra);
      else lista.push({ pais: state.pais, priorizado: !!mercadoDe(state.pais) });
    }
    return lista;
  }

  document.getElementById("app").addEventListener("click", function (event) {
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      state.tab = tab.getAttribute("data-tab");
      state.ficha = null;
      if (state.tab === "informes") cargarLlmProviders();
      render();
      return;
    }
    var pais = event.target.closest("[data-pais]");
    if (pais && pais.getAttribute("data-pais")) {
      state.pais = pais.getAttribute("data-pais");
      state.ficha = null;
      render();
      return;
    }
    var ficha = event.target.closest("[data-ficha]");
    if (ficha) {
      state.volverFicha = "";
      state.ficha = ficha.getAttribute("data-ficha");
      render();
      return;
    }
    var vista = event.target.closest('[data-vistaowid]');
    if (vista) { state.vistaOwid = vista.getAttribute('data-vistaowid'); render(); return; }
    var pron = event.target.closest("[data-pronostico]");
    if (pron) { state.pronostico = pron.getAttribute("data-pronostico"); render(); return; }
    var piezaBtn = event.target.closest("[data-pieza]");
    if (piezaBtn && piezaBtn.getAttribute("data-pieza")) {
      state.pieza = piezaBtn.getAttribute("data-pieza");
      state.ficha = null;
      render();
      return;
    }
    if (event.target.closest("[data-action='imprimir']")) { window.print(); return; }
    if (event.target.closest("[data-action='descargar-html']")) {
      if (window.Piezas) Piezas.descargarHtml(event.target.getAttribute("data-kind") || state.pieza, state.anio);
      return;
    }
    if (event.target.closest("[data-action='descargar-pdf']")) {
      if (window.Piezas) Piezas.descargarPdf();
      else window.print();
      return;
    }
    if (event.target.closest("[data-action='generar-informe']")) { generarInformeOnDemand(); return; }
    if (event.target.closest("[data-action='descargar-informe']")) { descargarInformeLive(); return; }
    if (event.target.closest("[data-action='cerrar']") || event.target.classList.contains("modal-back")) {
      state.volverFicha = state.ficha || "";
      state.ficha = null;
      render();
    }
  });

  document.getElementById("app").addEventListener("keydown", function (event) {
    var pestanas = ["mercados", "visitante", "captacion", "miembros"];
    if (event.target.closest && event.target.closest("[role='tab']") && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      var indice = pestanas.indexOf(state.tab);
      var paso = event.key === "ArrowRight" ? 1 : -1;
      state.tab = pestanas[(indice + paso + pestanas.length) % pestanas.length];
      state.ficha = null;
      render();
      var siguiente = document.getElementById("tab-" + state.tab);
      if (siguiente) siguiente.focus();
      event.preventDefault();
      return;
    }
    if (!state.ficha) return;
    if (event.key === "Escape") {
      state.volverFicha = state.ficha;
      state.ficha = null;
      render();
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    var dialogo = document.querySelector(".modal");
    if (!dialogo) return;
    var focos = dialogo.querySelectorAll("button, a, input, select, textarea");
    if (!focos.length) return;
    var primero = focos[0];
    var ultimo = focos[focos.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
      ultimo.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      primero.focus();
      event.preventDefault();
    }
  });

  document.getElementById("app").addEventListener("change", function (event) {
    var filtro = event.target.getAttribute("data-filtro");
    if (filtro === "anio") state.anio = Number(event.target.value);
    if (filtro === "pais") state.pais = event.target.value;
    if (filtro) { state.ficha = null; render(); }
    var sec = event.target.getAttribute && event.target.getAttribute("data-infsec");
    if (sec) {
      var todas = ((DATA.informe || {}).secciones || []).map(function (x) { return x.id; });
      var sel = state.informesSel || todas.slice();
      var i = sel.indexOf(sec);
      if (event.target.checked && i < 0) sel.push(sec);
      if (!event.target.checked && i >= 0) sel.splice(i, 1);
      state.informesSel = sel.length === todas.length ? null : sel;
      render();
    }
    var llm = event.target.getAttribute && event.target.getAttribute("data-llm");
    if (llm === "provider") {
      state.informeProvider = event.target.value;
      var packModo = modelosParaModo(proveedorLlmActivo());
      state.informeModel = packModo.defaultModel || "";
      render();
    }
    if (llm === "model") {
      state.informeModel = event.target.value;
    }
  });

  var tip = document.createElement("div");
  tip.id = "tip";
  tip.hidden = true;
  document.body.appendChild(tip);
  function mostrarTip(nodo) {
    if (!nodo) { tip.hidden = true; return; }
    tip.textContent = nodo.getAttribute("data-tip");
    tip.hidden = false;
    var caja = nodo.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(8, caja.left), window.innerWidth - 240) + "px";
    tip.style.top = Math.min(caja.bottom + 8, window.innerHeight - 48) + "px";
  }
  document.addEventListener("mouseover", function (event) {
    var nodo = event.target.closest && event.target.closest("[data-tip]");
    if (!nodo) { tip.hidden = true; return; }
    mostrarTip(nodo);
  });
  document.addEventListener("mousemove", function (event) {
    if (tip.hidden) return;
    tip.style.left = Math.min(event.clientX + 14, window.innerWidth - 240) + "px";
    tip.style.top = (event.clientY + 18) + "px";
  });
  document.addEventListener("focusin", function (event) {
    var grafico = event.target.closest && event.target.closest(".marco");
    if (!grafico) return;
    mostrarTip(grafico.querySelector("[data-tip]"));
  });
  document.addEventListener("keydown", function (event) {
    var grafico = document.activeElement && document.activeElement.closest && document.activeElement.closest(".marco");
    if (!grafico || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
    var puntos = grafico.querySelectorAll("[data-tip]");
    if (!puntos.length) return;
    var actual = Number(grafico.getAttribute("data-punto") || 0);
    var paso = event.key === "ArrowRight" ? 1 : -1;
    actual = (actual + paso + puntos.length) % puntos.length;
    grafico.setAttribute("data-punto", String(actual));
    mostrarTip(puntos[actual]);
    event.preventDefault();
  });

  document.getElementById("app").addEventListener("input", function (event) {
    var campo = event.target.getAttribute("data-calc");
    if (!campo) return;
    state.calc[campo] = event.target.value.replace(/[^\d]/g, "");
    render();
    var siguiente = document.querySelector('[data-calc="' + campo + '"]');
    if (siguiente) {
      var pos = state.calc[campo].length;
      siguiente.focus();
      siguiente.setSelectionRange(pos, pos);
    }
  });

  function cargar(nombre) {
    return fetch("data/open/" + nombre).then(function (resp) {
      if (!resp.ok) throw new Error(nombre);
      return resp.json();
    }).catch(function () { return null; });
  }

  Promise.all([
    cargar("conectividad.json"),
    cargar("bureau_prensa.json"),
    cargar("ema.json"),
    cargar("medata_tarifas.json"),
    cargar("icca.json"),
    cargar("evi.json"),
    cargar("huella.json"),
    cargar("manifiesto.json"),
    cargar("bureau_marca_llm.json"),
    cargar("bureau_paises_2025_2026.json"),
    cargar("informe_llm.json"),
    cargar("bureau_oferta.json"),
    cargar("bureau_seguridad.json"),
    cargar("bureau_clima.json"),
    cargar("bureau_conectividad.json"),
    cargar("bureau_calendario.json"),
    cargar("bureau_owid.json"),
    cargar("bureau_sit.json"),
    cargar("bureau_pronostico.json"),
    cargar("mincit_vnr.json"),
    cargar("gdelt.json"),
    cargar("migracion_entradas.json"),
    cargar("trm_banrep.json")
  ]).then(function (piezas) {
    DATA.conectividad = piezas[0];
    DATA.bureauPrensa = piezas[1];
    DATA.ema = piezas[2];
    DATA.medata = piezas[3];
    DATA.icca = piezas[4];
    DATA.evi = piezas[5];
    DATA.huella = piezas[6];
    DATA.manifiesto = piezas[7];
    DATA.bureauMarca = piezas[8];
    DATA.bureauPaises = piezas[9];
    DATA.informe = piezas[10];
    DATA.bureauOferta = piezas[11];
    DATA.bureauSeguridad = piezas[12];
    DATA.bureauClima = piezas[13];
    DATA.bureauConectividad = piezas[14];
    DATA.bureauCalendario = piezas[15];
    DATA.bureauOwid = piezas[16];
    DATA.bureauSit = piezas[17];
    DATA.bureauPronostico = piezas[18];
    DATA.mincitVnr = piezas[19];
    DATA.gdelt = piezas[20];
    DATA.migracion = piezas[21];
    DATA.trm = piezas[22];
    leerUrl();
    if (!DATA.conectividad || !DATA.ema || !DATA.icca) {
      document.getElementById("app").innerHTML = hueco("Faltan agregados", "Abra esta carpeta con un servidor local después de correr scripts/preparar_fuentes.py.");
      return;
    }
    render();
  });
}());
