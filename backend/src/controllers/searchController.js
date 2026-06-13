const { all } = require('../config/dbHelper');

// GET /api/search?q=keyword&type=cases|hearings|citations
exports.search = (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = {};
    const scopeFilter = req._railwayScope ? ' AND c.railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    if (!type || type === 'cases') {
      try {
        results.cases = all(
          `SELECT c.* FROM cases c
           JOIN cases_fts f ON c.id = f.rowid
           WHERE cases_fts MATCH ? ${scopeFilter}
           ORDER BY rank
           LIMIT 50`,
          [q, ...scopeParams]
        );
      } catch (e) {
        results.cases = all(
          `SELECT * FROM cases
           WHERE (case_ref_no LIKE ? OR applicant LIKE ? OR respondent LIKE ? OR synopsis LIKE ? OR file_no LIKE ?) ${scopeFilter.replace(/c\./g, '')}
           LIMIT 50`,
          [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, ...scopeParams]
        );
      }
    }

    if (!type || type === 'hearings') {
      results.hearings = all(
        `SELECT h.*, c.case_ref_no FROM hearing_history h
         JOIN cases c ON h.case_id = c.id
         WHERE (h.order_summary LIKE ? OR h.order_raw_text LIKE ? OR c.case_ref_no LIKE ?) ${scopeFilter}
         LIMIT 20`,
        [`%${q}%`, `%${q}%`, `%${q}%`, ...scopeParams]
      );
    }

    if (!type || type === 'citations') {
      results.citations = all(
        `SELECT * FROM citations
         WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
         LIMIT 20`,
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );
    }

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};
