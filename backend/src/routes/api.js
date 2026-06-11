const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { validate, caseSchema, hearingSchema, citationSchema, personnelSchema, physicalFileSchema, bulkOperationSchema, viewPresetSchema } = require('../config/validator');

const upload = multer({ storage: multer.memoryStorage() });

// ── Auth Endpoints (public) ──
const { login, logout } = require('../controllers/authController');
router.post('/auth/login', login);
router.use(authenticateToken);
router.post('/auth/logout', logout);

// ── Cases ──
const {
  getCases, getCaseById, createCase, updateCase, deleteCase,
  parseCase, parsePdfCaseFile, extractPdfText
} = require('../controllers/caseController');
router.get('/cases', getCases);
router.post('/cases/parse-file', parseCase);
router.post('/cases/parse-pdf', upload.single('file'), parsePdfCaseFile);
router.post('/extract-pdf', upload.single('file'), extractPdfText);
router.get('/cases/:id', getCaseById);
router.post('/cases', validate(caseSchema), createCase);
router.put('/cases/:id', validate(caseSchema), updateCase);
router.delete('/cases/:id', deleteCase);

// ── Alerts ──
const { getAlerts, markAlertAsRead, markAllAlertsAsRead, triggerManualCrawl, checkDueCases } = require('../controllers/alertController');
router.get('/alerts', getAlerts);
router.put('/alerts/:id/read', markAlertAsRead);
router.put('/alerts/read-all', markAllAlertsAsRead);
router.post('/alerts/trigger-crawl', triggerManualCrawl);
router.post('/alerts/check-due-cases', checkDueCases);

// ── Hearings ──
const { getHearingsForCase, addHearingToCase } = require('../controllers/hearingController');
router.get('/cases/:id/hearings', getHearingsForCase);
router.post('/cases/:id/hearings', validate(hearingSchema), addHearingToCase);

// ── Citations ──
const { getCitations, createCitation, updateCitation, deleteCitation } = require('../controllers/citationController');
router.get('/citations', getCitations);
router.post('/citations', validate(citationSchema), createCitation);
router.put('/citations/:id', validate(citationSchema), updateCitation);
router.delete('/citations/:id', deleteCitation);

// ── Affidavits ──
const { getAffidavitsForCase, addAffidavitToCase, deleteAffidavit } = require('../controllers/affidavitController');
router.get('/cases/:id/affidavits', getAffidavitsForCase);
router.post('/cases/:id/affidavits', addAffidavitToCase);
router.delete('/affidavits/:id', deleteAffidavit);

// ── Personnel ──
const { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel } = require('../controllers/personnelController');
router.get('/personnel', getPersonnel);
router.post('/personnel', validate(personnelSchema), createPersonnel);
router.put('/personnel/:id', validate(personnelSchema), updatePersonnel);
router.delete('/personnel/:id', deletePersonnel);

// ── Physical Files ──
const { getFiles, getFileById, createFile, updateFile, deleteFile } = require('../controllers/fileRegistryController');
router.get('/physical-files', getFiles);
router.get('/physical-files/:id', getFileById);
router.post('/physical-files', validate(physicalFileSchema), createFile);
router.put('/physical-files/:id', validate(physicalFileSchema), updateFile);
router.delete('/physical-files/:id', deleteFile);

// ── File Movements ──
const { getMovements, createMovement } = require('../controllers/movementController');
router.get('/file-movements', getMovements);
router.post('/file-movements', createMovement);

// ── Reporting ──
const { getCaseSummary, getHearingCalendar, getZoneDistribution, exportCases } = require('../controllers/reportController');
router.get('/reports/case-summary', getCaseSummary);
router.get('/reports/hearing-calendar', getHearingCalendar);
router.get('/reports/zone-distribution', getZoneDistribution);
router.get('/reports/export', exportCases);

// ── Analytics ──
const { getDashboard, getSystemHealth } = require('../controllers/analyticsController');
router.get('/analytics/dashboard', getDashboard);
router.get('/analytics/health', getSystemHealth);

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
router.get('/search', search);

// ── Document Archival ──
const { uploadDocument, getDocuments, downloadDocument } = require('../controllers/documentController');
router.post('/cases/:id/documents', upload.single('file'), uploadDocument);
router.get('/cases/:id/documents', getDocuments);
router.get('/documents/:id/download', downloadDocument);

// ── Pleadings ──
const { getPleadings, addPleading, updatePleading, deletePleading } = require('../controllers/pleadingController');
router.get('/cases/:id/pleadings', getPleadings);
router.post('/cases/:id/pleadings', addPleading);
router.put('/pleadings/:id', updatePleading);
router.delete('/pleadings/:id', deletePleading);

// ── Audit Log ──
const { getAuditLog } = require('../controllers/auditLogController');
router.get('/audit-log', getAuditLog);

// ── Batch Sync ──
const { triggerBatchSync, triggerPlaywrightSync, triggerOrderSync, triggerSmartSync, getSyncStatus } = require('../controllers/syncController');
router.post('/sync/start', triggerBatchSync);
router.post('/sync/playwright', triggerPlaywrightSync);
router.post('/sync/orders', triggerOrderSync);
router.post('/sync/smart', triggerSmartSync);
router.get('/sync/status', getSyncStatus);

module.exports = router;
