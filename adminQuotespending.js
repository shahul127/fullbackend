async function adminQuotespending(pool,res){
try {
    const quotesResult = await pool.query(
      `SELECT q.quote_number, q.sales_person_id, s.name AS salesperson_name
       FROM quotes q
       JOIN sales_person s ON q.sales_person_id = s.user_id
       WHERE q.status='Pending'`
    );
    const quotes = quotesResult.rows;

    const quotesWithItems = await Promise.all(
      quotes.map(async (quote) => {
        const itemsResult = await pool.query(
          `SELECT qi.*, rd.rice_name 
           FROM quote_items qi 
           JOIN rice_details rd ON qi.rice_id = rd.rice_id
           WHERE qi.quote_number = $1`,
          [quote.quote_number]
        );

        return {
          quoteNumber: quote.quote_number,
          salespersonName: quote.salesperson_name,
          items: itemsResult.rows,
          totalPrice: itemsResult.rows.reduce((sum, i) => sum + i.quoted_price * i.quantity, 0)
        };
      })
    );

    res.status(200).json(quotesWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching pending quotes' });
  }

}
export default adminQuotespending;