# Backtest Lab — frontend Node.js independiente

Este repositorio contiene **solo el frontend Node.js**. No incluye Python, estrategias, cliente Bitunix ni archivos del bot. Consume por HTTP la API REST del backend Python que ya tienes desplegado en Render.

## Requisitos

- Node.js 18 o superior (usa `fetch` nativo; no necesita dependencias externas).
- URL pública de tu backend Python en Render.

## Ejecutar en local

1. Descomprime este proyecto.
2. Configura la URL del backend.

Linux/macOS:

```bash
export BACKEND_URL="https://TU-BACKEND.onrender.com"
npm start
```

Windows PowerShell:

```powershell
$env:BACKEND_URL="https://TU-BACKEND.onrender.com"
npm start
```

3. Abre `http://localhost:3000`.

También puedes copiar `.env.example` como referencia. Node.js no carga archivos `.env` automáticamente; exporta la variable en la terminal o configura `BACKEND_URL` en el panel de despliegue.

## Desplegar el frontend en Render

1. Sube **esta carpeta del frontend** a un repositorio Git independiente del backend.
2. En Render crea un servicio **Web Service** conectado a ese repositorio.
3. Runtime: Node. Build command: `npm install`; Start command: `npm start`.
4. Añade la variable de entorno `BACKEND_URL` con la URL HTTPS pública del backend Python, sin una ruta final; por ejemplo `https://mi-api.onrender.com`.
5. Despliega. Render asigna `PORT` automáticamente y el servidor escucha en `0.0.0.0`.

Este proyecto incluye `render.yaml` como configuración de referencia. Define `BACKEND_URL` en el panel de Render para no dejar la URL del backend escrita en el código.

## Qué hace el servidor Node.js

- Sirve los archivos estáticos de `public/`.
- Reenvía `POST /api/backtest` y `GET /api/health` al backend configurado. Así el navegador llama al frontend y no necesita acceso CORS directo al servicio Python.
- Guarda, abre y elimina sesiones en `data/sessions.json`.
- Expone `GET /healthz` para comprobaciones de salud del frontend.

## Contrato esperado del backend Python

El backend ya desplegado debe exponer:

- `GET /api/health` — idealmente devuelve JSON con `ok: true`.
- `POST /api/backtest` — recibe JSON con `strategy`, `symbol`, `interval` y opcionalmente `candles`, `startDate`, `endDate`, `horizon` y `params`; devuelve JSON con `summary`, `trades`, `equity` y metadatos.

No se incluye ni se modifica ningún archivo del backend Python. Si la API desplegada usa otras rutas o un esquema de respuesta distinto, adapta únicamente el proxy en `server.js` o solicita por separado los cambios necesarios al backend.

## Funciones de la interfaz

- Formularios para estrategia, activo, temporalidad y parámetros.
- Rango de fechas UTC o número de velas.
- Gráfico SVG de evolución de capital (si la API devuelve `equity`).
- Comparación de hasta ocho variantes de parámetros.
- Historial local de sesiones, apertura y eliminación.
- Exportación CSV de operaciones.

## Persistencia de sesiones al desplegar

Por defecto, las sesiones se guardan en `data/sessions.json`. En despliegues con sistema de archivos efímero (incluido Render sin disco persistente), las sesiones pueden perderse al reiniciar o desplegar. Para conservarlas en producción, conecta un disco persistente y configura `SESSIONS_FILE` a una ruta dentro de ese disco, o cambia el almacenamiento a una base de datos.

La curva de capital representa una estimación a partir de los datos que devuelve el backend; su precisión depende de que el motor incluya en el PnL las comisiones, el tamaño de posición y otros costes relevantes. La interfaz no ejecuta órdenes reales.


## Conexión con el backend Python

El frontend es un proyecto independiente. Define `BACKEND_URL` con la URL del Web Service Python que ejecuta `api_server.py`, no con un endpoint de webhook de Telegram. Si el backend usa `BACKTEST_API_KEY`, configura también `BACKEND_API_KEY` con el mismo valor en el frontend. El frontend envía la clave en `X-API-Key` desde su servidor Node, no desde el navegador.

Rutas consumidas: `GET /api/health` y `POST /api/backtest`. La API Python se entrega por separado en el ZIP del backend.


La estrategia **Trend Trader-Remastered (TTR)** está disponible en el selector cuando se utiliza junto con el backend actualizado. Parámetros configurables: dirección, PSAR Start/Inc/Max, lookbacks fractales, proximidad de reentrada, permisos de reentrada sin TP y costos.
