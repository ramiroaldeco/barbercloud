// logger.js — Logger liviano con timestamp ISO y niveles. Zero dependencias.
// Uso: const log = require('./logger');
//      log.info('mensaje')  → [2026-04-13T20:11:00.000Z] [INFO]  mensaje
//      log.warn('aviso')    → [2026-04-13T20:11:00.000Z] [WARN]  aviso
//      log.error('fallo')   → [2026-04-13T20:11:00.000Z] [ERROR] fallo
"use strict";

function ts() {
  return new Date().toISOString();
}

const logger = {
  info:  (...args) => console.log( `[${ts()}] [INFO] `, ...args),
  warn:  (...args) => console.warn( `[${ts()}] [WARN] `, ...args),
  error: (...args) => console.error(`[${ts()}] [ERROR]`, ...args),
};

module.exports = logger;
