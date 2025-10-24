async function adminFetchQuotes(pool, res) {
   try {
    const quotesResult = await pool.query(`
      SELECT 
        q.quote_number,
        q.sales_person_id,
        q.status,
        json_agg(
          json_build_object(
            'rice_name', r.rice_name,
            'quantity', qi.quantity,
            'quoted_price', qi.quoted_price
          )
        ) AS items,
        COALESCE(SUM(qi.quantity), 0) AS total_items,
        COALESCE(SUM(qi.quantity * qi.quoted_price), 0) AS total_price
      FROM quotes q
      LEFT JOIN quote_items qi ON q.quote_number = qi.quote_number
      LEFT JOIN rice_details r ON qi.rice_id = r.rice_id
      GROUP BY q.quote_number
      ORDER BY 
        CASE WHEN q.status = 'Pending' THEN 0 ELSE 1 END, 
        q.quote_number DESC
    `);

    res.status(200).json(quotesResult.rows);
  } catch (err) {
    console.error('Error fetching quotes:', err);
    res.status(500).json({ message: 'Error fetching quotes' });
  }
}

export default adminFetchQuotes;