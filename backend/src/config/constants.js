const DISPOSED_STATUSES = [
  'Disposed',
  'Dismissed',
  'Sine Die',
  'Dropped',
  'No Record',
  'Not Found',
  'Not Interested'
];

const VALID_STAGES = [
  'charge_sheet_issued',
  'reply_to_charges',
  'inquiry_commenced',
  'io_report_submitted',
  'da_notice',
  'reply_to_da_notice',
  'da_penalty_order',
  'upsc_advice',
  'appeal_oa_filed',
  'counter_affidavit_filed',
  'cat_court_order',
  'writ_petition_filed'
];

const STAGE_COLUMN_MAP = {
  'charge_sheet_issued': { dateCol: 'charge_sheet_issued_date', notesCol: 'charge_sheet_issued_notes' },
  'reply_to_charges': { dateCol: 'reply_to_charges_date', notesCol: 'reply_to_charges_notes' },
  'inquiry_commenced': { dateCol: 'inquiry_commenced_date', notesCol: 'inquiry_commenced_notes' },
  'io_report_submitted': { dateCol: 'io_report_submitted_date', notesCol: 'io_report_submitted_notes' },
  'da_notice': { dateCol: 'da_notice_date', notesCol: 'da_notice_notes' },
  'reply_to_da_notice': { dateCol: 'reply_to_da_notice_date', notesCol: 'reply_to_da_notice_notes' },
  'da_penalty_order': { dateCol: 'da_penalty_order_date', notesCol: 'da_penalty_order_notes' },
  'upsc_advice': { dateCol: 'upsc_advice_date', notesCol: 'upsc_advice_notes' },
  'appeal_oa_filed': { dateCol: 'appeal_oa_filed_date', notesCol: 'appeal_oa_filed_notes' },
  'counter_affidavit_filed': { dateCol: 'counter_affidavit_filed_date', notesCol: 'counter_affidavit_filed_notes' },
  'cat_court_order': { dateCol: 'cat_court_order_date', notesCol: 'cat_court_order_notes' },
  'writ_petition_filed': { dateCol: 'writ_petition_filed_date', notesCol: 'writ_petition_filed_notes' }
};

module.exports = {
  DISPOSED_STATUSES,
  VALID_STAGES,
  STAGE_COLUMN_MAP
};
