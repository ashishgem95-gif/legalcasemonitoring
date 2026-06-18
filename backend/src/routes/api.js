const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticateToken, enforceScope, enforceScopeBody, requireRole } = require('../middleware/auth');
const { validate, caseSchema, hearingSchema, citationSchema, personnelSchema, physicalFileSchema, bulkOperationSchema, viewPresetSchema } = require('../config/validator');
const { logger } = require('../config/logger');
const { generateReply } = require('../services/promptService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
});

const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { error: 'Too many sync requests. Please wait before trying again.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests. Please slow down (max 10/min).' }
});

// ── Auth Endpoints (public) ──
const { login, logout } = require('../controllers/authController');
router.post('/auth/login', login);
router.use(authenticateToken);
router.post('/auth/logout', logout);

// ── Cases ──
const {
  getCases, getCaseById, createCase, updateCase, deleteCase,
  updateCaseStatus, updateCaseNextHearing,
  parseCase, parsePdfCaseFile, extractPdfText, checkDuplicate
} = require('../controllers/caseController');
router.get('/cases', enforceScope, getCases);
router.get('/cases/check-duplicate', checkDuplicate);
router.post('/cases/parse-file', aiLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), parseCase);
router.post('/cases/parse-pdf', aiLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), upload.single('file'), parsePdfCaseFile);
router.post('/extract-pdf', aiLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), upload.single('file'), extractPdfText);
router.get('/cases/:id', getCaseById);
router.post('/cases', validate(caseSchema), enforceScopeBody, createCase);
router.put('/cases/:id', validate(caseSchema), enforceScopeBody, updateCase);
router.delete('/cases/:id', deleteCase);
router.patch('/cases/:id/status', enforceScopeBody, updateCaseStatus);
router.patch('/cases/:id/next-hearing', enforceScopeBody, updateCaseNextHearing);

// ── Alerts ──
const { getAlerts, markAlertAsRead, markAllAlertsAsRead, triggerManualCrawl, checkDueCases } = require('../controllers/alertController');
router.get('/alerts', enforceScope, getAlerts);
router.put('/alerts/:id/read', markAlertAsRead);
router.put('/alerts/read-all', markAllAlertsAsRead);
router.post('/alerts/trigger-crawl', requireRole('Super Admin / Central Legal Cell', 'admin'), triggerManualCrawl);
router.post('/alerts/check-due-cases', requireRole('Super Admin / Central Legal Cell', 'admin'), checkDueCases);

// ── Hearings ──
const { getHearingsForCase, addHearingToCase, setHearingOrderUploaded } = require('../controllers/hearingController');
router.get('/cases/:id/hearings', enforceScope, getHearingsForCase);
router.post('/cases/:id/hearings', enforceScope, validate(hearingSchema), addHearingToCase);
router.patch('/cases/:caseId/hearings/:hearingId/order-uploaded', setHearingOrderUploaded);

// ── Citations ──
const { getCitations, createCitation, updateCitation, deleteCitation, parseCitationPdf } = require('../controllers/citationController');
router.get('/citations', getCitations);
router.post('/citations', requireRole('Super Admin / Central Legal Cell', 'admin'), validate(citationSchema), createCitation);
router.post('/citations/parse-pdf', aiLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), upload.single('file'), parseCitationPdf);
router.put('/citations/:id', requireRole('Super Admin / Central Legal Cell', 'admin'), validate(citationSchema), updateCitation);
router.delete('/citations/:id', requireRole('Super Admin / Central Legal Cell', 'admin'), deleteCitation);

// ── Affidavits ──
const { getAffidavitsForCase, addAffidavitToCase, deleteAffidavit } = require('../controllers/affidavitController');
router.get('/cases/:id/affidavits', enforceScope, getAffidavitsForCase);
router.post('/cases/:id/affidavits', enforceScope, addAffidavitToCase);
router.delete('/affidavits/:id', deleteAffidavit);

// ── Personnel ──
const { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel } = require('../controllers/personnelController');
router.get('/personnel', getPersonnel);
router.post('/personnel', requireRole('Super Admin / Central Legal Cell', 'admin'), validate(personnelSchema), createPersonnel);
router.put('/personnel/:id', requireRole('Super Admin / Central Legal Cell', 'admin'), validate(personnelSchema), updatePersonnel);
router.delete('/personnel/:id', requireRole('Super Admin / Central Legal Cell', 'admin'), deletePersonnel);

// ── Physical Files ──
const { getFiles, getFileById, createFile, updateFile, deleteFile } = require('../controllers/fileRegistryController');
router.get('/physical-files', enforceScope, getFiles);
router.get('/physical-files/:id', getFileById);
router.post('/physical-files', validate(physicalFileSchema), createFile);
router.put('/physical-files/:id', validate(physicalFileSchema), updateFile);
router.delete('/physical-files/:id', deleteFile);

// ── File Movements ──
const { getMovements, createMovement } = require('../controllers/movementController');
router.get('/file-movements', enforceScope, getMovements);
router.post('/file-movements', createMovement);

// ── Reporting ──
const { getCaseSummary, getHearingCalendar, getZoneDistribution, exportCases } = require('../controllers/reportController');
router.get('/reports/case-summary', enforceScope, getCaseSummary);
router.get('/reports/hearing-calendar', enforceScope, getHearingCalendar);
router.get('/reports/zone-distribution', enforceScope, getZoneDistribution);
router.get('/reports/export', enforceScope, exportCases);

// ── Analytics ──
const { getDashboard, getSystemHealth, getChartData, getInsights } = require('../controllers/analyticsController');
router.get('/analytics/dashboard', enforceScope, getDashboard);
router.get('/analytics/health', getSystemHealth);
router.get('/analytics/charts', enforceScope, getChartData);
router.get('/analytics/insights', enforceScope, getInsights);

// ── Bulk Operations ──
const { bulkUpdate } = require('../controllers/bulkController');
router.post('/bulk/update', validate(bulkOperationSchema), bulkUpdate);

// ── View Presets ──
const { getPresets, createPreset, deletePreset } = require('../controllers/viewPresetController');
router.get('/view-presets', getPresets);
router.post('/view-presets', validate(viewPresetSchema), createPreset);
router.delete('/view-presets/:id', deletePreset);

// ── Full-Text Search ──
const { search } = require('../controllers/searchController');
router.get('/search', enforceScope, search);

// ── Document Archival ──
const { uploadDocument, getDocuments, downloadDocument } = require('../controllers/documentController');
router.post('/cases/:id/documents', enforceScope, upload.single('file'), uploadDocument);
router.get('/cases/:id/documents', enforceScope, getDocuments);
router.get('/documents/:id/download', enforceScope, downloadDocument);

// ── Pleadings ──
const { getPleadings, addPleading, updatePleading, deletePleading } = require('../controllers/pleadingController');
router.get('/cases/:id/pleadings', enforceScope, getPleadings);
router.post('/cases/:id/pleadings', enforceScope, addPleading);
router.put('/pleadings/:id', updatePleading);
router.delete('/pleadings/:id', deletePleading);

// ── Audit Log ──
const { getAuditLog } = require('../controllers/auditLogController');
router.get('/audit-log', requireRole('Super Admin / Central Legal Cell', 'admin'), getAuditLog);

// ── Batch Sync ──
const { triggerBatchSync, triggerPlaywrightSync, triggerOrderSync, triggerSmartSync, getSyncStatus, resyncSingleCase } = require('../controllers/syncController');
router.post('/sync/start', syncLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), triggerBatchSync);
router.post('/sync/playwright', syncLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), triggerPlaywrightSync);
router.post('/sync/orders', syncLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), triggerOrderSync);
router.post('/sync/smart', syncLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), triggerSmartSync);
router.post('/sync/case/:id', syncLimiter, requireRole('Super Admin / Central Legal Cell', 'admin'), resyncSingleCase);
router.get('/sync/status', getSyncStatus);

// ── AI Affidavit Drafting ──
router.post('/ai/draft-reply',
  aiLimiter,
  requireRole('Super Admin / Central Legal Cell', 'admin'),
  async (req, res) => {
    try {
      const { caseType, uploadedText, precedents, customInstructions, promptOverride } = req.body || {};
      if (!uploadedText || !uploadedText.trim()) {
        return res.status(400).json({ error: 'uploadedText is required' });
      }
      if (!Array.isArray(precedents)) {
        return res.status(400).json({ error: 'precedents must be an array' });
      }
      if (precedents.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 precedents allowed' });
      }
      const result = await generateReply({
        provider: req.headers['x-ai-provider'],
        model: req.headers['x-ai-model'],
        apiKey: req.headers['x-ai-api-key'],
        caseType,
        uploadedText,
        precedents,
        customInstructions,
        promptOverride,
      });
      res.json(result);
    } catch (err) {
      logger.error({ error: err.message, stack: err.stack }, 'Draft generation failed');
      res.status(500).json({ error: err.message });
    }
  }
);

const { getFileActivity, markAlertsSeen } = require('../controllers/adminController');

router.get('/admin/file-activity',
  requireRole('Super Admin / Central Legal Cell', 'admin'),
  getFileActivity
);

router.post('/admin/file-activity/seen',
  requireRole('Super Admin / Central Legal Cell', 'admin'),
  markAlertsSeen
);

module.exports = router;
