const { z } = require('zod');

const stageFields = {
  charge_sheet_issued_date: z.string().nullable().optional(),
  charge_sheet_issued_notes: z.string().nullable().optional(),
  reply_to_charges_date: z.string().nullable().optional(),
  reply_to_charges_notes: z.string().nullable().optional(),
  inquiry_commenced_date: z.string().nullable().optional(),
  inquiry_commenced_notes: z.string().nullable().optional(),
  io_report_submitted_date: z.string().nullable().optional(),
  io_report_submitted_notes: z.string().nullable().optional(),
  da_notice_date: z.string().nullable().optional(),
  da_notice_notes: z.string().nullable().optional(),
  reply_to_da_notice_date: z.string().nullable().optional(),
  reply_to_da_notice_notes: z.string().nullable().optional(),
  da_penalty_order_date: z.string().nullable().optional(),
  da_penalty_order_notes: z.string().nullable().optional(),
  upsc_advice_date: z.string().nullable().optional(),
  upsc_advice_notes: z.string().nullable().optional(),
  appeal_oa_filed_date: z.string().nullable().optional(),
  appeal_oa_filed_notes: z.string().nullable().optional(),
  counter_affidavit_filed_date: z.string().nullable().optional(),
  counter_affidavit_filed_notes: z.string().nullable().optional(),
  cat_court_order_date: z.string().nullable().optional(),
  cat_court_order_notes: z.string().nullable().optional(),
  writ_petition_filed_date: z.string().nullable().optional(),
  writ_petition_filed_notes: z.string().nullable().optional(),
};

const caseSchema = z.object({
  case_ref_no: z.string().min(1, 'Case reference number is required'),
  railway: z.string().nullable().optional(),
  applicant: z.string().nullable().optional(),
  respondent: z.string().nullable().optional(),
  employee_designation: z.string().nullable().optional(),
  case_type: z.string().nullable().optional(),
  case_number: z.string().nullable().optional(),
  case_year: z.union([z.number().int().positive(), z.string()]).nullable().optional(),
  forum: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  file_no: z.string().nullable().optional(),
  link_file_no: z.string().nullable().optional(),
  last_date_reply: z.string().nullable().optional(),
  date_filing_reply: z.string().nullable().optional(),
  present_status: z.string().nullable().optional(),
  last_date_appeal_implementation: z.string().nullable().optional(),
  nodal_officer_name: z.string().nullable().optional(),
  nodal_officer_contact: z.string().nullable().optional(),
  advocate_name: z.string().nullable().optional(),
  advocate_contact: z.string().nullable().optional(),
  original_oa_no: z.string().nullable().optional(),
  original_oa_forum: z.string().nullable().optional(),
  original_oa_date_disposal: z.string().nullable().optional(),
  original_oa_status: z.string().nullable().optional(),
  court_link: z.string().url().nullable().optional().or(z.literal('')),
  ...stageFields,
});

const hearingSchema = z.object({
  hearing_date: z.string().min(1, 'Hearing date is required'),
  order_raw_text: z.string().nullable().optional(),
});

const citationSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  where_to_cite: z.string().nullable().optional(),
});

const personnelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  designation: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  contact_no: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
});

const physicalFileSchema = z.object({
  file_number: z.string().min(1, 'File number is required'),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().nullable().optional(),
  currently_with_id: z.number().int().nullable().optional(),
  zonal_railway: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).nullable().optional(),
});

const bulkOperationSchema = z.object({
  ids: z.array(z.number().int()).min(1, 'At least one ID is required'),
  action: z.enum(['update_status', 'update_railway', 'delete']),
  value: z.string().nullable().optional(),
});

const viewPresetSchema = z.object({
  name: z.string().min(1, 'Preset name is required'),
  columns: z.array(z.object({
    id: z.string(),
    label: z.string(),
    visible: z.boolean(),
    minWidth: z.string().optional(),
  })),
  filters: z.object({}).passthrough().nullable().optional(),
});

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        return res.status(400).json({
          error: 'Validation failed',
          details: issues.map(e => ({ field: (e.path || []).join('.'), message: e.message }))
        });
      }
      next(err);
    }
  };
}

module.exports = {
  validate,
  caseSchema,
  hearingSchema,
  citationSchema,
  personnelSchema,
  physicalFileSchema,
  bulkOperationSchema,
  viewPresetSchema,
};
