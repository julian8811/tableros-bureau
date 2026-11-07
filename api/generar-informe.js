/**
 * GET  /api/generar-informe → { providers } (meta, sin generar)
 * POST /api/generar-informe → informe TEC + línea gráfica Colmayor V7
 *
 * Env:
 *   GROQ_API_KEY / GROQ_MODEL
 *   FREELLM_BASE_URL / FREELLM_API_KEY / FREELLM_MODEL (opcional)
 */
const { armarPaqueteDashboard } = require("./evidencia");
const { getCookie, sesionValida } = require("./auth-check");
const { listProviders, chatCompletions, describeChain } = require("./llm-client");

/** Catálogo TEC-Bureau. Se emiten solo las que tengan evidencia en el pack. */
const SECCIONES_TEC = [
  { id: "tendencias", titulo: "1. Tendencias", packKeys: ["ema_ult6", "medata_zonas", "owid_top", "trm_ultimo"] },
  { id: "receptivo", titulo: "2. Turismo receptivo", packKeys: ["mincit_vnr"] },
  { id: "emisores", titulo: "2.1 Emisores internacionales", packKeys: ["migracion", "mincit_vnr"] },
  { id: "destinos", titulo: "2.2 Destinos / ciudades", packKeys: ["mincit_vnr"] },
  { id: "reuniones", titulo: "2.3 Reuniones y negocios", packKeys: ["icca"] },
  { id: "visitante", titulo: "3. Perfil del visitante (EVI)", packKeys: ["evi_ola", "huella"] },
  { id: "oferta", titulo: "3.1 Oferta turística", packKeys: ["oferta_n"] },
  { id: "conectividad", titulo: "4. Conectividad aérea", packKeys: ["conectividad_anual"] },
  { id: "marca", titulo: "5. Marca y conversación", packKeys: ["marca_llm", "prensa_n", "sit"] },
  { id: "territorio", titulo: "6. Territorio, clima y seguridad", packKeys: ["seguridad_muestra", "clima"] },
  { id: "gestion", titulo: "7. Gestión Bureau (captación y miembros)", packKeys: ["informe_gestion_2025"] },
  { id: "pronostico", titulo: "8. Pronóstico", packKeys: ["pronostico"] }
];

/** Portada + slots Wikimedia Commons (assets/colombia-photos). */
const PORTADA_CURADA = {
  url: "/assets/colombia-photos/cover.jpg",
  credito: "Wikimedia Commons · Murallas de Cartagena",
  fuente_banco: "colombia-photos"
};

const FOTO_SECCION = {
  tendencias: "tendencias",
  receptivo: "receptivo",
  emisores: "emisores",
  destinos: "destinos",
  reuniones: "reuniones",
  visitante: "visitante",
  oferta: "oferta",
  conectividad: "conectividad",
  marca: "marca",
  territorio: "territorio",
  gestion: "gestion",
  pronostico: "pronostico",
  salidas: "emisores",
  aereo: "conectividad"
};

function packTiene(pack, key) {
  if (!pack) return false;
  var v = pack[key];
  if (v == null) return false;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return Boolean(v);
}

function seccionesEsperadas(pack) {
  return SECCIONES_TEC.filter(function (s) {
    return (s.packKeys || []).some(function (k) { return packTiene(pack, k); });
  });
}

function resolverImagenes() {
  var secciones = {};
  Object.keys(FOTO_SECCION).forEach(function (id) {
    var slot = FOTO_SECCION[id];
    secciones[id] = {
      url: "/assets/colombia-photos/" + slot + ".jpg",
      credito: "Wikimedia Commons · Colombia · " + slot,
      fuente_banco: "colombia-photos",
      slot: slot
    };
  });
  return {
    portada: PORTADA_CURADA,
    toc: {
      url: "/assets/colombia-photos/toc.jpg",
      credito: "Wikimedia Commons · Cartagena",
      fuente_banco: "colombia-photos"
    },
    resumen: {
      url: "/assets/colombia-photos/resumen.jpg",
      credito: "Wikimedia Commons · Medellín",
      fuente_banco: "colombia-photos"
    },
    secciones: secciones
  };
}

function validarInforme(doc, esperadas) {
  if (!doc || typeof doc !== "object") return "No es un objeto JSON.";
  if (!doc.corte || typeof doc.corte !== "string") return "Falta corte.";
  if (!Array.isArray(doc.secciones) || !doc.secciones.length) {
    return "Faltan secciones.";
  }
  var need = (esperadas || []).map(function (s) { return s.id; });
  if (!need.length && doc.secciones.length < 6) {
    return "Se requieren al menos 6 secciones.";
  }
  var have = {};
  for (var i = 0; i < doc.secciones.length; i++) {
    var s = doc.secciones[i];
    if (!s.id || !s.titulo) return "Sección sin id/titulo.";
    if (!Array.isArray(s.bullets)) return "Sección " + s.id + " sin bullets.";
    if (!Array.isArray(s.analisis)) return "Sección " + s.id + " sin analisis.";
    if (!Array.isArray(s.insights)) return "Sección " + s.id + " sin insights (array).";
    have[s.id] = true;
  }
  var missing = need.filter(function (id) { return !have[id]; });
  if (missing.length) {
    return "Faltan secciones del dashboard: " + missing.join(", ") + ".";
  }
  return null;
}

function extraerJson(texto) {
  if (!texto) throw new Error("Respuesta vacía del modelo.");
  var limpio = String(texto).trim();
  if (limpio.indexOf("```") >= 0) {
    limpio = limpio.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  var ini = limpio.indexOf("{");
  var fin = limpio.lastIndexOf("}");
  if (ini < 0 || fin <= ini) throw new Error("No se encontró JSON en la respuesta.");
  return JSON.parse(limpio.slice(ini, fin + 1));
}

async function leerBodyJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return new Promise(function (resolve) {
    var raw = "";
    req.on("data", function (chunk) { raw += chunk; });
    req.on("end", function () {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on("error", function () { resolve({}); });
  });
}

async function llamarLLM(pack, opts, esperadas) {
  opts = opts || {};
  var maxTokens = Number(process.env.GROQ_MAX_TOKENS) || 4500;
  var lista = (esperadas && esperadas.length) ? esperadas : SECCIONES_TEC;
  var ids = lista.map(function (s) {
    return s.id + " (" + s.titulo + ")";
  }).join(", ");

  var system = [
    "Eres inteligencia del Greater Medellín CVB + Colmayor (línea gráfica Manual V7).",
    "Informe estilo TEC (estructura ProColombia) con datos SOLO del paquete.",
    "SOLO JSON: {corte,titulo,subtitulo,resumen_ejecutivo:[],secciones:[{id,titulo,lead,bullets:[{texto,fuente}],analisis:[{texto,fuente}],insights:[{texto,implicacion,fuente}],tabla:{titulo,columnas,filas}|null,grafico:{titulo,labels,values,unidad}|null}]}.",
    "Genera EXACTAMENTE estas secciones (todas, en este orden): " + ids + ".",
    "2-4 bullets, 1-2 analisis, 1-2 insights por sección.",
    "Si el bloque tiene ranking o serie, incluye tabla o grafico (no dejes ambos null).",
    "Cifras solo del paquete. Español CO. No inventar. Sin imagen_query."
  ].join(" ");

  var user = "Paquete dashboard (compacto):\n" + JSON.stringify(pack) +
    "\n\nGenera el informe TEC-Bureau completo con cobertura total de las secciones listadas.";

  var result = await chatCompletions({
    provider: opts.provider || "cadena",
    model: opts.model,
    max_tokens: maxTokens,
    temperature: 0.2,
    jsonObject: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  var informe = extraerJson(result.content);
  return {
    informe: informe,
    provider: result.provider,
    model: result.model,
    requestedModel: result.requestedModel,
    attempts: result.attempts || [],
    chain: result.chain || []
  };
}

function normalizarSecciones(informe) {
  var alias = [
    ["tendencias", "tendencias"], ["receptivo", "receptivo"],
    ["emisores", "emisores"], ["destinos", "destinos"], ["reuniones", "reuniones"],
    ["visitante", "visitante"], ["oferta", "oferta"], ["conectividad", "conectividad"],
    ["marca", "marca"], ["territorio", "territorio"], ["gestion", "gestion"], ["pronostico", "pronostico"]
  ];
  (informe.secciones || []).forEach(function (s) {
    if (!Array.isArray(s.bullets)) s.bullets = [];
    if (!Array.isArray(s.analisis)) s.analisis = [];
    if (!Array.isArray(s.insights)) s.insights = [];
    if (s.tabla && (!Array.isArray(s.tabla.columnas) || !Array.isArray(s.tabla.filas))) {
      s.tabla = null;
    }
    if (s.grafico && (!Array.isArray(s.grafico.labels) || !Array.isArray(s.grafico.values))) {
      s.grafico = null;
    }
    delete s.imagen;
    delete s.imagen_query;
    var blob = String(s.id || "") + " " + String(s.titulo || "");
    blob = blob.toLowerCase();
    for (var i = 0; i < alias.length; i++) {
      if (blob.indexOf(alias[i][0]) >= 0) {
        s.id = alias[i][1];
        break;
      }
    }
  });
  if (!Array.isArray(informe.resumen_ejecutivo)) informe.resumen_ejecutivo = [];
  return informe;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === "GET") {
    var providers = listProviders();
    var groqProv = null;
    for (var gi = 0; gi < providers.length; gi++) {
      if (providers[gi].id === "groq") groqProv = providers[gi];
    }
    var packMeta = null;
    try { packMeta = armarPaqueteDashboard(); } catch (e) { packMeta = null; }
    var esperadas = seccionesEsperadas(packMeta);
    res.statusCode = 200;
    res.end(JSON.stringify({
      providers: providers,
      defaultProvider: "cadena",
      chain: describeChain(),
      secciones_esperadas: esperadas.map(function (s) { return { id: s.id, titulo: s.titulo }; }),
      linea_grafica: "colmayor_v7",
      modes: [
        {
          id: "cadena",
          label: "Cadena (Groq → FreeLLM)",
          configured: providers.some(function (p) { return p.configured; }),
          defaultModel: (groqProv && groqProv.defaultModel) || "",
          models: (groqProv && groqProv.models) || [],
          nota: "Prueba modelo a modelo; FreeLLMAPI es fallback si está configurado."
        }
      ].concat(providers)
    }));
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Use GET (providers) o POST (generar)." }));
    return;
  }
  // POST genera con LLM (costo): exige sesión. GET de providers queda abierto.
  if (!(await sesionValida(getCookie(req.headers.cookie, "bureau_token")))) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "sin sesión" }));
    return;
  }

  try {
    var body = await leerBodyJson(req);
    var provider = body.provider === "freellm" || body.provider === "groq" || body.provider === "cadena"
      ? body.provider
      : "cadena";
    var model = body.model ? String(body.model).trim() : "";
    var pack = armarPaqueteDashboard();
    var esperadas = seccionesEsperadas(pack);
    var llm = await llamarLLM(pack, { provider: provider, model: model }, esperadas);
    var informe = normalizarSecciones(llm.informe);
    var fallo = validarInforme(informe, esperadas);
    if (fallo) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        error: "Informe inválido: " + fallo,
        esperadas: esperadas.map(function (s) { return s.id; }),
        attempts: llm.attempts || []
      }));
      return;
    }
    if (!informe.corte) informe.corte = pack.meta.corte_sugerido;
    if (!informe.titulo) {
      informe.titulo = "Turismo e inteligencia de destino · Medellín";
    }
    if (!informe.subtitulo) {
      informe.subtitulo = "Corte " + informe.corte + " · Bureau + Colmayor · Manual V7";
    }
    informe.banco_imagenes = resolverImagenes();
    informe.meta_generacion = {
      cobertura_dashboard: true,
      secciones_esperadas: esperadas.map(function (s) { return s.id; }),
      banco: "portada_local_curada",
      modelo_referencia: "TEC estructura + Colmayor V7",
      linea_grafica: "colmayor_v7",
      provider: llm.provider,
      model: llm.model,
      requestedModel: llm.requestedModel,
      mode: provider,
      chain: llm.chain,
      attempts: llm.attempts
    };
    res.statusCode = 200;
    res.end(JSON.stringify(informe));
  } catch (err) {
    var status = err && err.status ? err.status : 502;
    res.statusCode = status;
    res.end(JSON.stringify({
      error: String((err && err.message) || err),
      attempts: (err && err.attempts) || []
    }));
  }
};
