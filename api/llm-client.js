/**
 * Cliente OpenAI-compatible para generar-informe.
 * Cadena por defecto: modelos Groq uno a uno → FreeLLMAPI (si está configurado).
 */

function normalizeBaseUrl(url) {
  var u = String(url || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  if (!/\/v1$/i.test(u)) u = u + "/v1";
  return u;
}

function unique(arr) {
  return (arr || []).filter(function (m, i, a) {
    return m && a.indexOf(m) === i;
  });
}

function providerConfig(id) {
  if (id === "groq") {
    var key = process.env.GROQ_API_KEY || "";
    var preferred = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    var extra = String(process.env.GROQ_FALLBACK_MODELS || "")
      .split(/[,;\s]+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return {
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: key,
      defaultModel: preferred,
      models: unique([preferred, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].concat(extra)),
      configured: Boolean(key),
      supportsJsonObject: true
    };
  }
  if (id === "freellm") {
    var base = normalizeBaseUrl(process.env.FREELLM_BASE_URL || "");
    var fkey = process.env.FREELLM_API_KEY || "";
    var fmodel = process.env.FREELLM_MODEL || "auto";
    var fextra = String(process.env.FREELLM_FALLBACK_MODELS || "")
      .split(/[,;\s]+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return {
      id: "freellm",
      label: "FreeLLMAPI",
      baseUrl: base,
      apiKey: fkey,
      defaultModel: fmodel,
      models: unique([fmodel, "auto"].concat(fextra)),
      configured: Boolean(base && fkey),
      supportsJsonObject: true,
      nota: "Fallback tras Groq. URL debe ser alcanzable desde Vercel (no localhost)."
    };
  }
  return null;
}

function listProviders() {
  return ["groq", "freellm"].map(providerConfig).filter(Boolean).map(function (p) {
    return {
      id: p.id,
      label: p.label,
      configured: p.configured,
      defaultModel: p.defaultModel,
      models: p.models,
      nota: p.nota || null
    };
  });
}

/**
 * Cadena de intentos: cada ítem es { provider, model }.
 * - provider "cadena" / vacío: todos los modelos Groq configurados, luego FreeLLM.
 * - provider groq|freellm: ese proveedor primero (modelo pedido primero), luego el resto de la cadena.
 */
function buildFallbackChain(opts) {
  opts = opts || {};
  var groq = providerConfig("groq");
  var freellm = providerConfig("freellm");
  var prefer = opts.provider === "freellm" ? "freellm"
    : (opts.provider === "groq" ? "groq" : "cadena");
  var wantModel = String(opts.model || "").trim();

  var steps = [];
  function push(provider, model) {
    if (!provider || !model) return;
    var cfg = provider === "freellm" ? freellm : groq;
    if (!cfg || !cfg.configured) return;
    var key = provider + "::" + model;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].provider + "::" + steps[i].model === key) return;
    }
    steps.push({ provider: provider, model: model });
  }

  function appendProvider(cfg) {
    if (!cfg || !cfg.configured) return;
    var models = cfg.models.slice();
    if (wantModel && prefer === cfg.id) {
      models = unique([wantModel].concat(models));
    }
    models.forEach(function (m) { push(cfg.id, m); });
  }

  if (prefer === "freellm") {
    appendProvider(freellm);
    appendProvider(groq);
  } else if (prefer === "groq") {
    appendProvider(groq);
    appendProvider(freellm);
  } else {
    // Cadena: Groq modelo a modelo, luego FreeLLM.
    appendProvider(groq);
    appendProvider(freellm);
  }

  return steps;
}

function describeChain() {
  return buildFallbackChain({ provider: "cadena" }).map(function (s) {
    return s.provider + "/" + s.model;
  });
}

function resolveProvider(providerId) {
  var id = providerId === "freellm" ? "freellm" : "groq";
  var cfg = providerConfig(id);
  if (!cfg || !cfg.configured) {
    var err = new Error(
      id === "freellm"
        ? "FreeLLMAPI no configurado. Defina FREELLM_BASE_URL y FREELLM_API_KEY."
        : "Falta GROQ_API_KEY en el entorno del servidor."
    );
    err.status = 503;
    throw err;
  }
  return cfg;
}

function allowModel(cfg, model) {
  var m = String(model || "").trim() || cfg.defaultModel;
  if (cfg.id === "freellm") {
    if (!m || m.length > 120) return cfg.defaultModel;
    return m;
  }
  if (cfg.models.indexOf(m) >= 0) return m;
  return cfg.defaultModel;
}

function isRetryableError(err) {
  if (!err) return false;
  var status = err.status || 0;
  if (status === 429 || status === 502 || status === 503 || status >= 500) return true;
  var msg = String(err.message || "").toLowerCase();
  if (msg.indexOf("rate limit") >= 0) return true;
  if (msg.indexOf("tpm") >= 0) return true;
  if (msg.indexOf("tokens per minute") >= 0) return true;
  if (msg.indexOf("too large") >= 0) return true;
  if (msg.indexOf("does not exist") >= 0) return true;
  if (msg.indexOf("not have access") >= 0) return true;
  if (msg.indexOf("overloaded") >= 0) return true;
  if (msg.indexOf("timeout") >= 0) return true;
  // 400 de cuota/modelo: seguir cadena
  if (status === 400) return true;
  return false;
}

/**
 * Un intento contra un proveedor/modelo.
 */
async function chatCompletionsOnce(opts) {
  opts = opts || {};
  var cfg = resolveProvider(opts.provider);
  var model = allowModel(cfg, opts.model);
  var maxTokens = Number(opts.max_tokens) || Number(process.env.GROQ_MAX_TOKENS) || 3500;
  var body = {
    model: model,
    temperature: opts.temperature == null ? 0.2 : opts.temperature,
    max_tokens: maxTokens,
    messages: opts.messages || []
  };
  if (cfg.supportsJsonObject && opts.jsonObject !== false) {
    body.response_format = { type: "json_object" };
  }

  var resp = await fetch(cfg.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  var data = await resp.json().catch(function () {
    return {};
  });
  if (!resp.ok) {
    var msg = (data && data.error && data.error.message) ||
      (cfg.label + " HTTP " + resp.status);
    var e = new Error(msg);
    e.status = resp.status >= 500 ? 502 : (resp.status === 429 ? 429 : 400);
    e.provider = cfg.id;
    e.model = model;
    throw e;
  }

  var content = data.choices && data.choices[0] && data.choices[0].message &&
    data.choices[0].message.content;
  if (!content) {
    var empty = new Error("Respuesta vacía de " + cfg.id + "/" + model);
    empty.status = 502;
    empty.provider = cfg.id;
    empty.model = model;
    throw empty;
  }

  return {
    content: content,
    model: (data.model || model),
    provider: cfg.id,
    requestedModel: model,
    raw: data
  };
}

/**
 * Intenta la cadena modelo a modelo. FreeLLM queda como fallback tras Groq.
 */
async function chatCompletions(opts) {
  opts = opts || {};
  var chain = buildFallbackChain({
    provider: opts.provider,
    model: opts.model
  });
  if (!chain.length) {
    var none = new Error(
      "Ningún proveedor LLM configurado. Defina GROQ_API_KEY y/o FREELLM_BASE_URL + FREELLM_API_KEY."
    );
    none.status = 503;
    throw none;
  }

  var attempts = [];
  var lastErr = null;
  for (var i = 0; i < chain.length; i++) {
    var step = chain[i];
    try {
      var result = await chatCompletionsOnce({
        provider: step.provider,
        model: step.model,
        messages: opts.messages,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature,
        jsonObject: opts.jsonObject
      });
      attempts.push({
        provider: step.provider,
        model: step.model,
        ok: true,
        served: result.model
      });
      result.attempts = attempts;
      result.chain = chain.map(function (s) { return s.provider + "/" + s.model; });
      return result;
    } catch (err) {
      lastErr = err;
      attempts.push({
        provider: step.provider,
        model: step.model,
        ok: false,
        error: String(err.message || err)
      });
      if (!isRetryableError(err)) {
        err.attempts = attempts;
        throw err;
      }
      // sigue al siguiente modelo/proveedor
    }
  }

  var fail = lastErr || new Error("Todos los modelos de la cadena fallaron.");
  fail.status = fail.status || 502;
  fail.attempts = attempts;
  throw fail;
}

module.exports = {
  listProviders: listProviders,
  chatCompletions: chatCompletions,
  chatCompletionsOnce: chatCompletionsOnce,
  buildFallbackChain: buildFallbackChain,
  describeChain: describeChain,
  resolveProvider: resolveProvider,
  allowModel: allowModel,
  providerConfig: providerConfig
};
