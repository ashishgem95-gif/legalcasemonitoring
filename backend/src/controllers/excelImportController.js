const { readAndImportExcel, getFileInfo, getImportHistory } = require('../services/excelImportService');
const { logger } = require('../config/logger');

let importInProgress = false;

// GET /api/excel-import/file-info
exports.getFileInfo = (req, res) => {
  try {
    const info = getFileInfo();
    res.json(info);
  } catch (err) {
    logger.error({ err: err.message }, 'Excel import file-info error');
    res.status(500).json({ error: 'Failed to get file info' });
  }
};

// POST /api/excel-import/check — manual trigger
exports.triggerImport = async (req, res) => {
  if (importInProgress) {
    return res.status(409).json({ error: 'An import is already running. Please wait.' });
  }

  importInProgress = true;

  try {
    const result = await readAndImportExcel('manual');
    importInProgress = false;
    res.json(result);
  } catch (err) {
    importInProgress = false;
    logger.error({ err: err.message }, 'Excel import trigger error');
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
};

// GET /api/excel-import/history
exports.getHistory = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = getImportHistory(limit);
    res.json(history);
  } catch (err) {
    logger.error({ err: err.message }, 'Excel import history error');
    res.status(500).json({ error: 'Failed to get import history' });
  }
};

// Startup auto-import (called from index.js, non-blocking)
exports.runStartupImport = async () => {
  try {
    const info = getFileInfo();
    if (!info.found) {
      logger.info('Excel import: no file found at startup, skipping');
      return;
    }
    logger.info({ path: info.path, modifiedAt: info.modifiedAt }, 'Excel import: checking on startup');
    const result = await readAndImportExcel('startup');
    if (result.newCases > 0 || result.updatedCases > 0) {
      logger.info({ newCases: result.newCases, updatedCases: result.updatedCases }, 'Excel import: startup import processed changes');
    } else {
      logger.info('Excel import: startup check — no changes to import');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Excel import: startup import failed');
  }
};
