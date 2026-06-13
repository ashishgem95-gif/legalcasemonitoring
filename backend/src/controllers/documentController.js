const path = require('path');
const fs = require('fs');
const { run, get, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');

const STORAGE_DIR = path.resolve(__dirname, '..', '..', '..', 'document_archive');

// Ensure storage directory exists
try {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
} catch (err) {
  console.error(`[DocumentController] Failed to create storage directory ${STORAGE_DIR}:`, err.message);
}

// POST /api/cases/:id/documents
exports.uploadDocument = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const allowedMimeTypes = ['application/pdf'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `Invalid file type. Only PDF files are allowed. Received: ${req.file.mimetype}` });
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File too large. Maximum size is 20MB.` });
    }

    const caseId = req.params.id;
    const caseRecord = get('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const storagePath = path.join(STORAGE_DIR, filename);

    fs.writeFileSync(storagePath, req.file.buffer);

    const result = run(
      `INSERT INTO case_documents (case_id, filename, original_name, mime_type, file_size, storage_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [caseId, filename, req.file.originalname, req.file.mimetype, req.file.size, storagePath, req.user?.id || 'system']
    );

    const auditService = require('../services/auditService');
    auditService.logAudit({
      userId: req.user?.id,
      action: 'UPLOAD_DOCUMENT',
      targetType: 'document',
      targetId: result.id,
      details: { case_id: caseId, original_name: req.file.originalname, uploaded_by: req.user?.id },
    });

    logger.info({ caseId, filename: req.file.originalname }, 'Document archived');
    res.status(201).json({
      id: result.id,
      case_id: parseInt(caseId),
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
    });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to archive document' });
  }
};

// GET /api/cases/:id/documents
exports.getDocuments = (req, res) => {
  try {
    const docs = all(
      `SELECT id, case_id, original_name, mime_type, file_size, storage_path, uploaded_by, created_at
       FROM case_documents WHERE case_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(docs);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
};

// GET /api/documents/:id/download
exports.downloadDocument = (req, res) => {
  try {
    const doc = get('SELECT * FROM case_documents WHERE id = ?', [req.params.id]);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // If storage_path is an external URL, redirect
    if (doc.storage_path && doc.storage_path.startsWith('http')) {
      return res.redirect(doc.storage_path);
    }

    if (!fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ error: 'Document file missing from storage' });
    }

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
    res.sendFile(doc.storage_path);
  } catch (err) {
    console.error('Error downloading document:', err);
    res.status(500).json({ error: 'Failed to download document' });
  }
};
