const path = require('path');
const fs = require('fs');
const { readAndImportHcExcel, getFileInfo } = require('../services/hcExcelImportService');
const { logger } = require('../config/logger');

let importInProgress = false;

// GET /api/hc-excel-import/file-info
exports.getFileInfo = (req, res) => {
  try {
    const info = getFileInfo();
    res.json(info);
  } catch (err) {
    logger.error({ err: err.message }, 'HC/SC Excel import file-info error');
    res.status(500).json({ error: 'Failed to get HC/SC Excel file info' });
  }
};

// POST /api/hc-excel-import/check — manual trigger for HC/SC import
exports.triggerImport = async (req, res) => {
  if (importInProgress) {
    return res.status(409).json({ error: 'An HC/SC import is already running. Please wait.' });
  }

  importInProgress = true;

  try {
    const result = await readAndImportHcExcel('manual');
    importInProgress = false;
    res.json(result);
  } catch (err) {
    importInProgress = false;
    logger.error({ err: err.message }, 'HC/SC Excel import trigger error');
    res.status(500).json({ error: 'HC/SC import failed: ' + err.message });
  }
};

// POST /api/hc-excel-import/upload — upload Excel file and import immediately
exports.uploadAndImport = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a .xlsx file as "file".' });
  }

  if (importInProgress) {
    return res.status(409).json({ error: 'An HC/SC import is already running. Please wait.' });
  }

  importInProgress = true;

  try {
    const destPath = process.env.HC_EXCEL_IMPORT_PATH ||
      path.resolve(__dirname, '..', '..', '..', 'root', 'hc_legal_cases.xlsx');
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, req.file.buffer);
    logger.info({ path: destPath, size: req.file.size, originalName: req.file.originalname }, 'HC/SC Excel uploaded');

    const result = await readAndImportHcExcel('upload');
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, 'HC/SC Excel upload+import error');
    res.status(500).json({ error: 'Upload+import failed: ' + err.message });
  } finally {
    importInProgress = false;
  }
};

// POST /api/hc-excel-import/startup (called from index.js, non-blocking)
exports.runStartupImport = async () => {
  try {
    const info = getFileInfo();
    if (!info.found) {
      logger.info('HC/SC Excel import: no file found at startup, skipping');
      return;
    }
    logger.info({ path: info.path, modifiedAt: info.modifiedAt }, 'HC/SC Excel import: checking on startup');
    const result = await readAndImportHcExcel('startup');
    if (result.updatedCases > 0) {
      logger.info({ updatedCases: result.updatedCases }, 'HC/SC Excel import: startup import processed updates');
    } else {
      logger.info('HC/SC Excel import: startup check — no changes to import');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'HC/SC Excel import: startup import failed');
  }
};
