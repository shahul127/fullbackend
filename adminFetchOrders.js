async function adminFetchOrders(pool, filterOption, res) {

    try {
        let query = `
      SELECT o.order_id, o.quote_number, o.total_price, o.status, o.order_date,
        s.name AS salesperson
      FROM orders o
      JOIN quotes q ON o.quote_number = q.quote_number
      JOIN sales_person s ON q.sales_person_id = s.user_id
      WHERE 1=1
    `;
        const { startDate, endDate, status, salespersonId } = filterOption;
        const params = [];
        let i = 1;

        if (startDate) {
            query += ` AND o.order_date >= $${i++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND o.order_date <= $${i++}`;
            params.push(endDate);
        }
        if (status) {
            query += ` AND o.status = $${i++}`;
            params.push(status);
        }
        if (salespersonId) {
            query += ` AND q.sales_person_id = $${i++}`;
            params.push(salespersonId);
        }

        query += ` ORDER BY o.order_date DESC`;

        const result = await pool.query(query, params);
        const orders = result.rows.map(row => ({
            orderId: row.order_id,
            quoteNumber: row.quote_number,
            totalPrice: parseFloat(row.total_price),
            orderStatus: row.status,
            orderDate: row.order_date,
            salesperson: row.salesperson,
        }));

        res.status(200).json(orders);
    }

    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
}

export default adminFetchOrders;