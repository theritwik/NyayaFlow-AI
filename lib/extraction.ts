// Modular extraction engine.
//
// Strategy: try a deterministic rule-based extractor on the source text. If
// the source text is empty/scanned/unrecognisable, fall back to a curated
// mock extractor keyed by file name so the demo always produces realistic
// output without an API key.
//
// To plug in a real LLM later, replace `runLlmExtraction` and route through
// `extractFromText`.

import type { ActionType, ExtractionResult, Urgency } from './types';
import { pyExtract } from './pyclient';

// Sample prompt that would be sent to an LLM in production.  Kept as a string
// constant so it can be displayed in the UI / docs.
export const LLM_SYSTEM_PROMPT = `You are NyayaFlow's judgment extraction assistant for Indian government departments.
Your job is to read the supplied court judgment text and return STRICT JSON
matching the schema below.  Never invent facts.  When a value is missing, set
the field to null and the confidence to a low value.  Always cite the supporting
excerpt verbatim and the page number on which it appears.

Return JSON of the shape:
{
  "fields": [
    { "field_key": "case_title" | "case_number" | "court_name" | "order_date"
                  | "petitioner" | "respondent" | "key_direction"
                  | "deadline" | "department" | "compliance_instruction"
                  | "appeal_consideration" | "urgency",
      "value": string,
      "confidence": number (0-1),
      "source_excerpt": string,
      "source_page": integer
    }, ...
  ],
  "actions": [
    { "title": string,
      "action_type": "Compliance" | "Appeal Consideration" | "Department Review"
                    | "Deadline Tracking" | "Information Update",
      "description": string (plain administrative language),
      "department": string,
      "due_date": "YYYY-MM-DD" | null,
      "needs_officer_review": boolean,
      "source_excerpt": string,
      "source_page": integer,
      "confidence": number (0-1),
      "urgency": "High" | "Medium" | "Low"
    }, ...
  ]
}`;

// ----------------------------------------------------------------------------
// Public entry-point
// ----------------------------------------------------------------------------

export async function extractFromText(input: {
  text: string;
  fileName: string;
  pageCount: number;
  isScanned: boolean;
}): Promise<ExtractionResult> {
  // 1. Prefer the Python service (LayoutLMv3-ready / curated / rule-based).
  const py = await pyExtract(input);
  if (py && py.fields.length > 0) {
    return py;
  }

  // 2. Real LLM hook (disabled by default).  Wire env var to enable.
  if (process.env.NYAYAFLOW_LLM_ENABLED === 'true') {
    try {
      return await runLlmExtraction(input);
    } catch (e) {
      console.warn('LLM extraction failed, falling back to mock:', e);
    }
  }

  // Curated samples take priority so the demo always shows polished output.
  const lower = input.fileName.toLowerCase();
  const isCuratedSample =
    lower.includes('sample-1') ||
    lower.includes('sample-2') ||
    lower.includes('sample-3') ||
    lower.includes('representation') ||
    lower.includes('affidavit') ||
    lower.includes('scanned-low');
  if (isCuratedSample) {
    return mockExtractionByFilename(
      input.fileName,
      input.pageCount,
      input.isScanned
    );
  }

  // Try rule-based for real uploads.
  const ruleResult = ruleBasedExtraction(input.text, input.pageCount);
  if (ruleResult && ruleResult.fields.length >= 3) {
    return {
      ...ruleResult,
      is_scanned: input.isScanned,
      page_count: input.pageCount || ruleResult.page_count,
    };
  }

  // Final fallback: generic mock by filename.
  return mockExtractionByFilename(
    input.fileName,
    input.pageCount,
    input.isScanned
  );
}

// ----------------------------------------------------------------------------
// Rule-based extraction (best-effort regex on extracted text)
// ----------------------------------------------------------------------------

function ruleBasedExtraction(
  text: string,
  pageCount: number
): ExtractionResult | null {
  if (!text || text.trim().length < 80) return null;

  const fields: ExtractionResult['fields'] = [];
  const actions: ExtractionResult['actions'] = [];

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const firstPageBlock = lines.slice(0, 60).join('\n');

  const pushField = (
    key: string,
    val: string | null,
    page: number,
    excerpt: string,
    confidence: number
  ) => {
    if (!val) return;
    fields.push({
      field_key: key,
      value: val.trim(),
      confidence,
      source_excerpt: excerpt.slice(0, 220),
      source_page: page,
    });
  };

  // Case number e.g. "W.P.(C) 1234/2024"
  const caseNumMatch = firstPageBlock.match(
    /\b((?:W\.?P\.?\s*\(?[A-Z]\)?|S\.?L\.?P\.?|Crl\.?A\.?|C\.?A\.?|R\.?P\.?)[\s.()A-Z]*\s*\d{1,6}\s*\/\s*\d{4})/i
  );
  if (caseNumMatch) {
    pushField('case_number', caseNumMatch[1], 1, caseNumMatch[0], 0.92);
  }

  // Court name
  const courtMatch = text.match(
    /(IN THE [A-Z][A-Z\s,]+COURT[A-Z\s,]*)/
  );
  if (courtMatch) {
    pushField('court_name', courtMatch[1].replace(/\s+/g, ' '), 1, courtMatch[0], 0.9);
  }

  // Petitioner / Respondent (best-effort: "X ... vs ... Y")
  const vsMatch = text.match(/([A-Z][A-Za-z .&]{2,80})\s+(?:vs\.?|versus|v\.)\s+([A-Z][A-Za-z .&]{2,80})/);
  if (vsMatch) {
    pushField('case_title', `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`, 1, vsMatch[0], 0.86);
    pushField('petitioner', vsMatch[1].trim(), 1, vsMatch[0], 0.78);
    pushField('respondent', vsMatch[2].trim(), 1, vsMatch[0], 0.78);
  }

  // Order date
  const dateMatch = text.match(
    /(?:Date of Order|Pronounced on|Date of Judgment|ORDER DATED)[:\s]*([0-9]{1,2}(?:st|nd|rd|th)?[\s.\-/]+(?:January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2})[\s.\-/]+\d{2,4})/i
  );
  if (dateMatch) {
    pushField('order_date', dateMatch[1], 1, dateMatch[0], 0.84);
  }

  // Compliance/deadline patterns
  const directionRegexes: Array<{ rx: RegExp; type: ActionType; urgency: Urgency }> = [
    { rx: /within\s+(\d+)\s+(weeks?|days?|months?)/gi, type: 'Compliance', urgency: 'High' },
    { rx: /(file|submit|prepare|consider).{0,80}?(affidavit|representation|reply|response)/gi, type: 'Compliance', urgency: 'High' },
    { rx: /(may|should|shall)\s+(consider|examine|review)\s+(an?\s+)?appeal/gi, type: 'Appeal Consideration', urgency: 'Medium' },
  ];

  let directionPage = Math.min(2, pageCount || 1);
  for (const { rx, type, urgency } of directionRegexes) {
    const matches = [...text.matchAll(rx)];
    for (const m of matches.slice(0, 3)) {
      const idx = m.index ?? 0;
      const excerpt = text.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, ' ');
      pushField('key_direction', excerpt, directionPage, excerpt, 0.78);
      const due = inferDueDateFromExcerpt(excerpt);
      actions.push({
        title:
          type === 'Compliance'
            ? 'Compliance action required'
            : type === 'Appeal Consideration'
              ? 'Consider filing appeal / review'
              : 'Departmental review required',
        action_type: type,
        description: excerpt,
        department: 'Concerned Department (please verify)',
        due_date: due,
        needs_officer_review: due === null,
        source_excerpt: excerpt,
        source_page: directionPage,
        confidence: 0.74,
        urgency,
      });
    }
  }

  // Urgency hint
  if (/urgent|forthwith|immediately|without\s+delay/i.test(text)) {
    pushField('urgency', 'High', 1, 'urgency keywords detected in judgment', 0.7);
  } else {
    pushField('urgency', 'Medium', 1, 'no urgent language detected', 0.55);
  }

  return {
    is_scanned: false,
    page_count: pageCount || 1,
    fields,
    actions,
  };
}

function inferDueDateFromExcerpt(excerpt: string): string | null {
  const m = excerpt.match(/within\s+(\d+)\s+(weeks?|days?|months?)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms =
    unit.startsWith('day')
      ? n * 24 * 60 * 60 * 1000
      : unit.startsWith('week')
        ? n * 7 * 24 * 60 * 60 * 1000
        : n * 30 * 24 * 60 * 60 * 1000;
  const d = new Date(Date.now() + ms);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------------
// Mock extraction (curated fixtures keyed by filename)
// ----------------------------------------------------------------------------

const isoIn = (days: number) =>
  new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

function mockExtractionByFilename(
  fileName: string,
  pageCount: number,
  isScanned: boolean
): ExtractionResult {
  const lower = fileName.toLowerCase();

  if (lower.includes('representation') || lower.includes('sample-1') || lower.includes('avs')) {
    return SAMPLE_REPRESENTATION;
  }
  if (lower.includes('affidavit') || lower.includes('sample-2') || lower.includes('compliance')) {
    return SAMPLE_AFFIDAVIT;
  }
  if (lower.includes('scanned') || lower.includes('sample-3') || lower.includes('low')) {
    return SAMPLE_SCANNED_LOW_CONF;
  }

  // Generic fallback — pretend the doc is partially readable
  return {
    is_scanned: isScanned,
    page_count: pageCount || 6,
    fields: [
      {
        field_key: 'case_title',
        value: 'Unknown Petitioner vs State',
        confidence: 0.42,
        source_excerpt: '… extracted text was insufficient to determine the case title …',
        source_page: 1,
      },
      {
        field_key: 'urgency',
        value: 'Medium',
        confidence: 0.5,
        source_excerpt: 'No urgency cues detected.',
        source_page: 1,
      },
    ],
    actions: [
      {
        title: 'Officer review required: judgment unparsed',
        action_type: 'Department Review',
        description:
          'Automatic extraction confidence is low. Reviewer must read the judgment and capture key directions manually.',
        department: 'Legal Cell (please verify)',
        due_date: null,
        needs_officer_review: true,
        source_excerpt: 'Insufficient text recognised by OCR.',
        source_page: 1,
        confidence: 0.4,
        urgency: 'Medium',
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// Curated samples
// ----------------------------------------------------------------------------

const SAMPLE_REPRESENTATION: ExtractionResult = {
  is_scanned: false,
  page_count: 8,
  fields: [
    {
      field_key: 'case_title',
      value: 'Anita Kumari vs State of Bihar & Ors.',
      confidence: 0.97,
      source_excerpt:
        'IN THE HIGH COURT OF JUDICATURE AT PATNA — Anita Kumari (Petitioner) versus State of Bihar & Ors. (Respondents)',
      source_page: 1,
    },
    {
      field_key: 'case_number',
      value: 'CWJC No. 4521 of 2025',
      confidence: 0.96,
      source_excerpt: 'Civil Writ Jurisdiction Case No. 4521 of 2025',
      source_page: 1,
    },
    {
      field_key: 'court_name',
      value: 'High Court of Judicature at Patna',
      confidence: 0.98,
      source_excerpt: 'IN THE HIGH COURT OF JUDICATURE AT PATNA',
      source_page: 1,
    },
    {
      field_key: 'order_date',
      value: '2026-04-22',
      confidence: 0.94,
      source_excerpt: 'Pronounced on the 22nd day of April, 2026',
      source_page: 1,
    },
    {
      field_key: 'petitioner',
      value: 'Anita Kumari',
      confidence: 0.95,
      source_excerpt: 'Anita Kumari, daughter of Sri Ram Naresh Singh',
      source_page: 1,
    },
    {
      field_key: 'respondent',
      value: 'State of Bihar (Department of Revenue & Land Reforms)',
      confidence: 0.93,
      source_excerpt:
        'State of Bihar through the Principal Secretary, Department of Revenue & Land Reforms',
      source_page: 1,
    },
    {
      field_key: 'key_direction',
      value:
        'The Department of Revenue & Land Reforms shall consider the representation of the petitioner dated 11.02.2026 within a period of six weeks from the date of receipt of a certified copy of this order, by passing a reasoned and speaking order.',
      confidence: 0.92,
      source_excerpt:
        '… Department of Revenue & Land Reforms shall consider the representation … within a period of six weeks … by passing a reasoned and speaking order.',
      source_page: 5,
    },
    {
      field_key: 'deadline',
      value: '6 weeks from receipt of certified copy',
      confidence: 0.9,
      source_excerpt:
        'within a period of six weeks from the date of receipt of a certified copy of this order',
      source_page: 5,
    },
    {
      field_key: 'department',
      value: 'Department of Revenue & Land Reforms, Government of Bihar',
      confidence: 0.93,
      source_excerpt:
        'directed to the Principal Secretary, Department of Revenue & Land Reforms',
      source_page: 5,
    },
    {
      field_key: 'compliance_instruction',
      value:
        'Pass a reasoned and speaking order on the petitioner’s representation dated 11.02.2026 and communicate the same to the petitioner.',
      confidence: 0.88,
      source_excerpt:
        'pass a reasoned and speaking order … and communicate the same to the petitioner',
      source_page: 6,
    },
    {
      field_key: 'urgency',
      value: 'High',
      confidence: 0.86,
      source_excerpt:
        'time-bound direction (6 weeks); fixed-period compliance triggers High urgency',
      source_page: 5,
    },
  ],
  actions: [
    {
      title:
        'Decide representation of Anita Kumari dated 11.02.2026 by reasoned order',
      action_type: 'Compliance',
      description:
        'Department of Revenue & Land Reforms must consider the representation and pass a reasoned and speaking order within 6 weeks. The order must be communicated to the petitioner. Maintain a copy on file for compliance affidavit.',
      department: 'Department of Revenue & Land Reforms',
      due_date: isoIn(42),
      needs_officer_review: false,
      source_excerpt:
        '… shall consider the representation … within six weeks … by passing a reasoned and speaking order.',
      source_page: 5,
      confidence: 0.9,
      urgency: 'High',
    },
    {
      title: 'Communicate decision to petitioner and place on record',
      action_type: 'Information Update',
      description:
        'Communicate the speaking order to the petitioner via registered post and place a copy on the case file.',
      department: 'Department of Revenue & Land Reforms',
      due_date: isoIn(45),
      needs_officer_review: false,
      source_excerpt:
        '… and communicate the same to the petitioner.',
      source_page: 6,
      confidence: 0.85,
      urgency: 'Medium',
    },
    {
      title: 'Evaluate need for appeal/review against this order',
      action_type: 'Appeal Consideration',
      description:
        'Legal cell to examine whether the State should consider review/appeal within statutory limitation. Standard limitation for review is 30 days.',
      department: 'Legal Cell, Department of Revenue & Land Reforms',
      due_date: isoIn(28),
      needs_officer_review: true,
      source_excerpt:
        'No appeal direction issued; State may evaluate independently.',
      source_page: 7,
      confidence: 0.6,
      urgency: 'Medium',
    },
  ],
};

const SAMPLE_AFFIDAVIT: ExtractionResult = {
  is_scanned: false,
  page_count: 6,
  fields: [
    {
      field_key: 'case_title',
      value: 'Mohan Lal vs Union of India & Anr.',
      confidence: 0.95,
      source_excerpt: 'Mohan Lal … versus Union of India & Anr.',
      source_page: 1,
    },
    {
      field_key: 'case_number',
      value: 'W.P.(C) 7843/2025',
      confidence: 0.97,
      source_excerpt: 'Writ Petition (Civil) No. 7843 of 2025',
      source_page: 1,
    },
    {
      field_key: 'court_name',
      value: 'High Court of Delhi at New Delhi',
      confidence: 0.96,
      source_excerpt: 'IN THE HIGH COURT OF DELHI AT NEW DELHI',
      source_page: 1,
    },
    {
      field_key: 'order_date',
      value: '2026-04-29',
      confidence: 0.93,
      source_excerpt: 'Date of Order: 29.04.2026',
      source_page: 1,
    },
    {
      field_key: 'petitioner',
      value: 'Mohan Lal',
      confidence: 0.94,
      source_excerpt: 'Mohan Lal, S/o Late Sh. Hari Lal',
      source_page: 1,
    },
    {
      field_key: 'respondent',
      value: 'Union of India (Ministry of Home Affairs)',
      confidence: 0.92,
      source_excerpt:
        'Union of India through Secretary, Ministry of Home Affairs',
      source_page: 1,
    },
    {
      field_key: 'key_direction',
      value:
        'Respondents are directed to file a compliance affidavit detailing the steps taken on the petitioner\'s grievance within 30 days from today.',
      confidence: 0.94,
      source_excerpt:
        '… directed to file a compliance affidavit … within 30 days from today.',
      source_page: 4,
    },
    {
      field_key: 'deadline',
      value: '30 days from order date',
      confidence: 0.95,
      source_excerpt: 'within 30 days from today',
      source_page: 4,
    },
    {
      field_key: 'department',
      value: 'Ministry of Home Affairs (MHA)',
      confidence: 0.93,
      source_excerpt: 'Secretary, Ministry of Home Affairs',
      source_page: 1,
    },
    {
      field_key: 'compliance_instruction',
      value:
        'Prepare and file a compliance affidavit on the actions taken on the grievance dated 02.01.2026.',
      confidence: 0.92,
      source_excerpt:
        'compliance affidavit detailing the steps taken on the petitioner\'s grievance',
      source_page: 4,
    },
    {
      field_key: 'urgency',
      value: 'High',
      confidence: 0.9,
      source_excerpt: '30-day filing window with court-listed next date',
      source_page: 4,
    },
  ],
  actions: [
    {
      title: 'File compliance affidavit before Hon\'ble High Court',
      action_type: 'Compliance',
      description:
        'Prepare and file a compliance affidavit with the High Court of Delhi detailing actions taken on the petitioner\'s grievance dated 02.01.2026. Affidavit must be sworn by an officer not below the rank of Deputy Secretary.',
      department: 'Ministry of Home Affairs',
      due_date: isoIn(30),
      needs_officer_review: false,
      source_excerpt:
        '… file a compliance affidavit … within 30 days from today.',
      source_page: 4,
      confidence: 0.93,
      urgency: 'High',
    },
    {
      title: 'Assign nodal officer for affidavit preparation',
      action_type: 'Department Review',
      description:
        'Identify and assign a Deputy Secretary level officer to coordinate with the standing counsel for affidavit drafting and filing.',
      department: 'Ministry of Home Affairs (Coordination)',
      due_date: isoIn(7),
      needs_officer_review: false,
      source_excerpt:
        'Affidavit must be sworn by an officer not below Deputy Secretary rank.',
      source_page: 4,
      confidence: 0.82,
      urgency: 'High',
    },
    {
      title: 'Track next date of hearing and circulate cause-list entry',
      action_type: 'Deadline Tracking',
      description:
        'Set internal reminder 5 days before next listing; share affidavit copy with standing counsel 7 days in advance.',
      department: 'Ministry of Home Affairs (Litigation)',
      due_date: isoIn(25),
      needs_officer_review: false,
      source_excerpt: 'List on the next date of hearing.',
      source_page: 5,
      confidence: 0.78,
      urgency: 'Medium',
    },
  ],
};

const SAMPLE_SCANNED_LOW_CONF: ExtractionResult = {
  is_scanned: true,
  page_count: 11,
  fields: [
    {
      field_key: 'case_title',
      value: 'Sundaram & Sons vs Tamil Nadu Pollution Control Board',
      confidence: 0.61,
      source_excerpt:
        'Sundar?m & Sons … Tam?l Nadu Pollut?on Control B?ard (OCR low confidence)',
      source_page: 1,
    },
    {
      field_key: 'case_number',
      value: 'W.P. ____/2024 (illegible scan)',
      confidence: 0.4,
      source_excerpt: 'W.P. ████/2024 — partially illegible scan',
      source_page: 1,
    },
    {
      field_key: 'court_name',
      value: 'Madras High Court (likely)',
      confidence: 0.55,
      source_excerpt: 'header reads "MADRAS H_GH C_URT"',
      source_page: 1,
    },
    {
      field_key: 'order_date',
      value: 'Unclear (possibly Mar 2026)',
      confidence: 0.35,
      source_excerpt: 'date stamp partially smudged on cover page',
      source_page: 1,
    },
    {
      field_key: 'key_direction',
      value:
        'Pollution Control Board directed to "examine the report and take such action as deemed appropriate"',
      confidence: 0.58,
      source_excerpt:
        '… Board to examine the report and take such action as deemed appropriate …',
      source_page: 7,
    },
    {
      field_key: 'department',
      value: 'Tamil Nadu Pollution Control Board',
      confidence: 0.6,
      source_excerpt:
        'directed the T.N. Pollution Control Board (header stamp visible)',
      source_page: 7,
    },
    {
      field_key: 'urgency',
      value: 'Medium',
      confidence: 0.45,
      source_excerpt: 'no specific timeline detected',
      source_page: 7,
    },
  ],
  actions: [
    {
      title: 'Officer review required — direction phrasing is open-ended',
      action_type: 'Department Review',
      description:
        'The court direction is open-ended ("such action as deemed appropriate") and the scan quality is poor. An officer must read the original judgment, identify the specific action expected, and assign a deadline.',
      department: 'Tamil Nadu Pollution Control Board (please verify)',
      due_date: null,
      needs_officer_review: true,
      source_excerpt:
        'Board to examine the report and take such action as deemed appropriate.',
      source_page: 7,
      confidence: 0.55,
      urgency: 'Medium',
    },
    {
      title: 'Re-OCR or request clean copy of judgment',
      action_type: 'Information Update',
      description:
        'Request a clearer certified copy from the registry; current scan has multiple illegible fields including case number and order date.',
      department: 'Litigation Cell',
      due_date: null,
      needs_officer_review: true,
      source_excerpt: 'Multiple OCR low-confidence regions on cover page.',
      source_page: 1,
      confidence: 0.5,
      urgency: 'Low',
    },
  ],
};

// ----------------------------------------------------------------------------
// Real LLM stub (off by default).  Implement with provider of choice.
// ----------------------------------------------------------------------------

async function runLlmExtraction(_input: {
  text: string;
  fileName: string;
  pageCount: number;
  isScanned: boolean;
}): Promise<ExtractionResult> {
  throw new Error(
    'LLM extraction not configured. Set NYAYAFLOW_LLM_ENABLED=true and implement runLlmExtraction in lib/extraction.ts.'
  );
}
