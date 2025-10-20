async function userDetails(pool, userId, res) {

    try {
        const personalQuery = await pool.query('SELECT name, email_id FROM sales_person WHERE user_id = $1', [userId]);

        if (personalQuery.rows.length === 0) {
            return res.status(404).json({ message: 'Salesperson not found' });
        }

        const { name, email_id: emailId } = personalQuery.rows[0];

        const contactRes = await pool.query('SELECT contact_number FROM contact_details WHERE user_id = $1', [userId]);
        const contactNumbers = contactRes.rows.map(row => row.contact_number);

        const addressRes = await pool.query('SELECT street, city, pincode FROM address_details WHERE user_id = $1', [userId]);
        const addresses = addressRes.rows.map(row => ({ street: row.street, city: row.city, pincode: row.pincode }));

        const quoteQuery = `
            SELECT 
              q.quote_number,
              qi.rice_id,
              r.rice_name,
              qi.quoted_price,
              qi.quantity,
              q.status
            FROM quotes q
            JOIN quote_items qi ON q.quote_number = qi.quote_number
            JOIN rice_details r ON qi.rice_id = r.rice_id
            WHERE q.sales_person_id = $1
            ORDER BY q.quote_number;
        `;

        const quoteRes = await pool.query(quoteQuery, [userId]);
        const quotes = quoteRes.rows.map(row => ({
            quoteNumber: row.quote_number,
            riceId: row.rice_id,
            riceName: row.rice_name,
            quotedPrice: row.quoted_price,
            quantity: row.quantity,
            status: row.status
        }));

        const orderQuery = `
            SELECT 
            o.order_id,
            o.quote_number,
            o.total_price,
            o.status AS order_status,
            o.order_date,
            o.address_id,
            a.street,
            a.city,
            a.pincode,
            COUNT(qi.rice_id) AS item_count
            FROM orders o
            JOIN quotes q ON o.quote_number = q.quote_number
            JOIN quote_items qi ON q.quote_number = qi.quote_number
            LEFT JOIN address_details a ON o.address_id = a.address_id
            WHERE q.sales_person_id = $1
            GROUP BY 
            o.order_id, o.quote_number, o.total_price, o.status, o.order_date, 
            o.address_id, a.street, a.city, a.pincode
            ORDER BY o.order_date DESC;
        `;

        const orderRes = await pool.query(orderQuery, [userId]);
        const orders = orderRes.rows.map(row => ({
            orderId: row.order_id,
            quoteNumber: row.quote_number,
            orderStatus: row.order_status,
            orderDate: row.order_date,
            itemCount: parseInt(row.item_count),
            totalPrice: parseFloat(row.total_price),
            address: row.address_id
                ? {
                    addressId: row.address_id,
                    street: row.street,
                    city: row.city,
                    pincode: row.pincode
                }
                : null
        }));

        res.status(200).json({
            salesperson: { userId, name, emailId, contactNumbers, addresses, quotes, orders }
        });
    }

    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to retrieve salesperson information' });
    }
}

export default userDetails;