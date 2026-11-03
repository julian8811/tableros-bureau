# API Tableros Bureau

## `GET /api/generar-informe`

Devuelve modos / proveedores LLM (sin generar):

```json
{
  "providers": [{ "id": "groq", "label": "Groq", "configured": true, "models": [...], "defaultModel": "..." }],
  "defaultProvider": "cadena",
  "chain": ["groq/openai/gpt-oss-120b", "groq/openai/gpt-oss-20b", "..."],
  "modes": [
    { "id": "cadena", "label": "Cadena (Groq → FreeLLM)", "configured": true },
    { "id": "groq", "...": "..." },
    { "id": "freellm", "...": "..." }
  ]
}
```

Solo aparecen como usables los que tengan clave (y base URL) en el entorno. **Hoy en Vercel:** Groq si hay `GROQ_API_KEY`; FreeLLMAPI solo si hay `FREELLM_BASE_URL` + `FREELLM_API_KEY` (URL pública, no localhost).

## `POST /api/generar-informe`

Genera un informe **estilo TEC** (estructura) con **línea gráfica Colmayor V7**, anclado al dashboard. Emite una sección por cada bloque de evidencia presente en el pack (cobertura dinámica). Solo portada fotográfica curada; el cuerpo usa tablas/gráficos.

Body opcional:

```json
{ "provider": "cadena", "model": "openai/gpt-oss-120b" }
```

- `provider`: `cadena` (default), `groq` o `freellm`
- `model`: preferencia inicial; la cadena sigue con el resto si falla
- En modo `cadena`: prueba **modelo a modelo** en Groq y al final FreeLLMAPI (si está configurado)
- En `groq` / `freellm`: ese proveedor primero (modelo pedido primero), luego el resto de la cadena

La respuesta incluye `meta_generacion.attempts` con el recorrido (ok/error por paso).

### Variables de entorno (Vercel)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `GROQ_API_KEY` | Para usar Groq | [console.groq.com](https://console.groq.com) — nunca en el front |
| `GROQ_MODEL` | No | Default `openai/gpt-oss-120b` |
| `GROQ_FALLBACK_MODELS` | No | Extra de modelos Groq (separados por coma) |
| `GROQ_MAX_TOKENS` | No | Default `3500` (cuentas con TPM bajo) |
| `FREELLM_BASE_URL` | Para FreeLLMAPI (fallback) | URL pública del router, ej. `https://tu-host/v1` (o sin `/v1`; se normaliza). **No localhost.** |
| `FREELLM_API_KEY` | Para FreeLLMAPI | Bearer unificado `freellmapi-…` del dashboard FreeLLMAPI |
| `FREELLM_MODEL` | No | Default `auto` |
| `FREELLM_FALLBACK_MODELS` | No | Extra de modelos FreeLLM |
| `PEXELS_API_KEY` | No | Opcional; el mock/local usa Wikimedia Commons (sin key) |

**Nota FreeLLMAPI:** self-hosted ([freellmapi](https://github.com/tashfeenahmed/freellmapi)). En producción la URL debe ser **alcanzable desde Vercel**. Entra como **fallback** tras agotar modelos Groq. Uso experimental / personal.

Local: `vercel dev`. Un `python -m http.server` no sirve `/api`.

Referencia de diagramación: PDF TEC 1S 2026 (ProColombia).
