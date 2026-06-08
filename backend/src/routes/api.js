const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { login, logout } = require('../controllers/authController');

// Configure multer to store uploaded files in memory buffers
const upload = multer({ storage: multer.memoryStorage() });

const {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  parseCase,
  parsePdfCaseFile,
  extractPdfText
} = require('../controllers/caseController');

const {
  getAlerts,
  markAlertAsRead,
  triggerManualCrawl,
  checkDueCases
} = require('../controllers/alertController');

const {
  getHearingsForCase,
  addHearingToCase
} = require('../controllers/hearingController');

const {
  getCitations,
  createCitation,
  updateCitation,
  deleteCitation
} = require('../controllers/citationController');

const {
  getAffidavitsForCase,
  addAffidavitToCase,
  deleteAffidavit
} = require('../controllers/affidavitController');

const {
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel
} = require('../controllers/personnelController');

const {
  getFiles,
  getFileById,
  createFile,
  updateFile,
  deleteFile
} = require('../controllers/fileRegistryController');

const {
  getMovements,
  createMovement
} = require('../controllers/movementController');

// Auth Endpoints
router.post('/auth/login', login);

// Apply auth middleware to protect all subsequent routes
router.use(authenticateToken);

router.post('/auth/logout', logout);

// Cases Endpoints
router.get('/cases', getCases);
router.post('/cases/parse-file', parseCase);
router.post('/cases/parse-pdf', upload.single('file'), parsePdfCaseFile);
router.post('/extract-pdf', upload.single('file'), extractPdfText);
router.get('/cases/:id', getCaseById);
router.post('/cases', createCase);
router.put('/cases/:id', updateCase);
router.delete('/cases/:id', deleteCase);
router.post('/cases/trigger-crawl', triggerManualCrawl);
router.post('/cases/check-due-cases', checkDueCases);

// Alerts Endpoints
router.get('/alerts', getAlerts);
router.put('/alerts/:id/read', markAlertAsRead);

// Hearings Endpoints (linked to specific case)
router.get('/cases/:id/hearings', getHearingsForCase);
router.post('/cases/:id/hearings', addHearingToCase);

// Citations Endpoints
router.get('/citations', getCitations);
router.post('/citations', createCitation);
router.put('/citations/:id', updateCitation);
router.delete('/citations/:id', deleteCitation);

// Affidavits Endpoints
router.get('/cases/:id/affidavits', getAffidavitsForCase);
router.post('/cases/:id/affidavits', addAffidavitToCase);
router.delete('/affidavits/:id', deleteAffidavit);

// Personnel Endpoints
router.get('/personnel', getPersonnel);
router.post('/personnel', createPersonnel);
router.put('/personnel/:id', updatePersonnel);
router.delete('/personnel/:id', deletePersonnel);

// Physical Files Endpoints
router.get('/physical-files', getFiles);
router.get('/physical-files/:id', getFileById);
router.post('/physical-files', createFile);
router.put('/physical-files/:id', updateFile);
router.delete('/physical-files/:id', deleteFile);

// File Movements Endpoints
router.get('/file-movements', getMovements);
router.post('/file-movements', createMovement);

module.exports = router;
