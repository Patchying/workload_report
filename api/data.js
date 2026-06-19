const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const BUCKET_COLS = [
  'Communication & Meetings',
  'Documentation & Content',
  'Data Operations',
  'System & Portal Management',
  'Issue Handling',
  'Strategic Initiatives',
];

const SUB_MAP = {
  '1.1_Internal_team_meeting':           '1.1 Internal team meeting',
  '1.2_Management_meeting':              '1.2 Management meeting',
  '1.3_Cross-functional_meeting':        '1.3 Cross-functional meeting',
  '1.4_Rollout_meeting':                 '1.4 Rollout meeting',
  '1.5_Client_meeting':                  '1.5 Client meeting',
  '1.6_Business_partner_meeting':        '1.6 Business partner meeting',
  '1.7_Training_session':                '1.7 Training session',
  '1.8_Contact_Customer':                '1.8 Contact Customer',
  '1.9_Pitching_/_Negotiating_Customer': '1.9 Pitching / Negotiating Customer',
  '1.10_Contact_Partner':                '1.10 Contact Partner',
  '1.11_Coaching_team_/_1:1_Session':    '1.11 Coaching team / 1:1 Session',
  '2.1_Create_presentation_slides':      '2.1 Create presentation slides',
  '2.2_Create_report_/_dashboard':       '2.2 Create report / dashboard',
  '2.3_Write_/_Approve_email':           '2.3 Write / Approve email',
  '2.4_Document_meeting_minutes':        '2.4 Document meeting minutes',
  '2.5_Create_contract_/_legal_document':'2.5 Create contract / legal document',
  '2.6_Marketing_-_Artwork_brief':       '2.6 Marketing – Artwork brief',
  '2.7_Marketing_-_Artwork_creation':    '2.7 Marketing – Artwork creation',
  '2.8_Marketing_-_Other_visualisation': '2.8 Marketing – Other visualisation',
  '3.1_Input_/_Record_data':             '3.1 Input / Record data',
  '3.2_Update_data':                     '3.2 Update data',
  '3.3_Transfer_data':                   '3.3 Transfer data',
  '3.4_Analyse_/_Calculate_data':        '3.4 Analyse / Calculate data',
  '3.5_Reconcile_/_Cross-check_data':    '3.5 Reconcile / Cross-check data',
  '3.6_Validate_/_QA_data':             '3.6 Validate / QA data',
  '3.7_Generate_data':                   '3.7 Generate data',
  '3.8_Dispatch_data':                   '3.8 Dispatch data',
  '4.1_Enter_/_Upload_into_system':      '4.1 Enter / Upload into system',
  '4.2_Configure_system':                '4.2 Configure system',
  '4.3_Monitor_/_Maintain_system':       '4.3 Monitor / Maintain system',
  '4.4_Test_system_/_feature':           '4.4 Test system / feature',
  '5.1_Investigate_issue':               '5.1 Investigate issue',
  '5.2_Resolve_issue':                   '5.2 Resolve issue',
  '5.3_Escalate_issue':                  '5.3 Escalate issue',
  '6.1_Design_/_Improve_process_/_workflow': '6.1 Design / Improve process / workflow',
  '6.2_Develop_automation_/_tool':       '6.2 Develop automation / tool',
  '6.3_Plan_project_/_initiative':       '6.3 Plan project / initiative',
  '6.4_Market_Research':                 '6.4 Market Research',
  '6.5_Customer_Survey':                 '6.5 Customer Survey',
};

function parseNum(v) {
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function parseYear(v) {
  const n = parseInt(String(v).trim(), 10);
  return isNaN(n) || n < 2000 ? null : n;
}

function yearFromDate(v) {
  if (!v) return null;
  // Try parsing "DD/MM/YYYY", "MM/DD/YYYY", or ISO
  const parts = String(v).split(/[\/\-]/);
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (n >= 2000) return n;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) return d.getFullYear();
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!rawKey) return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set' });
    let keyJson;
    try {
      keyJson = JSON.parse(rawKey);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse service account key: ' + parseErr.message, keyLength: rawKey.length });
    }
    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Accum',
    });

    const rows = result.data.values || [];

    // Find header row: first row where any cell trims to "team(Reconciled)"
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some(c => String(c).trim() === 'team(Reconciled)')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx < 0) {
      return res.status(500).json({ error: 'Header row not found' });
    }

    const headers = rows[headerIdx];
    const colMap = {};
    headers.forEach((h, i) => {
      colMap[String(h).trim()] = i;
    });

    // Identify subcategory columns present in this sheet
    const subCols = []; // { colIdx, label }
    Object.entries(SUB_MAP).forEach(([key, label]) => {
      if (colMap[key] !== undefined) subCols.push({ colIdx: colMap[key], label });
    });

    const data = [];
    const currentYear = new Date().getFullYear();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const team = String(row[colMap['team(Reconciled)']] || '').trim();
      if (!team || team === 'team(Reconciled)' || team === 'team') continue;

      const monthRaw = colMap['Month'] !== undefined ? row[colMap['Month']] : '';
      const month = parseInt(String(monthRaw).trim(), 10);
      if (isNaN(month) || month < 1 || month > 12) continue;

      // Year
      let year = null;
      if (colMap['Year'] !== undefined) year = parseYear(row[colMap['Year']]);
      if (!year && colMap['Submission Date'] !== undefined) year = yearFromDate(row[colMap['Submission Date']]);
      if (!year) year = colMap['Year'] !== undefined ? parseYear(row[0]) : currentYear;
      if (!year) year = currentYear;

      const group = colMap['Group'] !== undefined ? String(row[colMap['Group']] || '').trim() : '';
      const level = colMap['Level'] !== undefined ? String(row[colMap['Level']] || '').trim() : '';

      // Buckets
      const buckets = {};
      let bucketSum = 0;
      for (const b of BUCKET_COLS) {
        const v = colMap[b] !== undefined ? parseNum(row[colMap[b]]) : 0;
        buckets[b] = v;
        bucketSum += v;
      }

      // Subcategories
      const subs = {};
      let subSum = 0;
      for (const { colIdx, label } of subCols) {
        const v = parseNum(row[colIdx]);
        if (v !== 0) subs[label] = v;
        subSum += v;
      }

      // If bucket sum is 0 but we have subs, aggregate buckets from subs
      if (bucketSum === 0 && subSum > 0) {
        // Re-aggregate: each sub label starts with "X.Y" — bucket prefix
        // We skip this approach and just leave buckets as 0; frontend handles subs fallback
      }

      const record = { t: team, g: group, l: level, m: month, y: year, subs };
      for (const b of BUCKET_COLS) record[b] = buckets[b];

      data.push(record);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, code: err.code, status: err.status });
  }
};
