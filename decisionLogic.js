async function decisionLogic(pool, quoteNumber, action, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const quoteRes = await client.query(
            `SELECT status FROM quotes WHERE quote_number = $1 FOR UPDATE`,
            [quoteNumber]
        );

        if (quoteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Quote not found' });
        }

        const currentStatus = quoteRes.rows[0].status;
        if (currentStatus !== 'Pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quote is not pending' });
        }

        if (action === 'Reject') {
            await client.query(
                `UPDATE quotes SET status = 'Rejected' WHERE quote_number = $1`,
                [quoteNumber]
            );
            await client.query('COMMIT');
            return res.status(200).json({ message: 'Quote rejected successfully' });
        }

        const itemsRes = await client.query(
            `SELECT qi.rice_id, qi.quoted_price, qi.quantity, r.stock_available
            FROM quote_items qi
            JOIN rice_details r ON qi.rice_id = r.rice_id
            WHERE qi.quote_number = $1`,
            [quoteNumber]
        );

        let totalPrice = 0;

       for (const item of itemsRes.rows) {
    const quantityQuintals = parseFloat(item.quantity);
    const currentStock = parseFloat(item.stock_available);

    if (currentStock < quantityQuintals) {
        await client.query(
            `UPDATE quotes SET status = 'Rejected' WHERE quote_number = $1`,
            [quoteNumber]
        );
        await client.query('COMMIT');
        return res.status(400).json({
            message: 'Quote rejected due to insufficient stock',
            riceId: item.rice_id,
            reason: `Requested ${quantityQuintals * 100} kg exceeds available stock (${currentStock * 100} kg)`
        });
    }

    totalPrice += parseFloat(item.quoted_price) * quantityQuintals; // ✅ remove *100

    await client.query(
        `UPDATE rice_details SET stock_available = stock_available - $1 WHERE rice_id = $2`,
        [quantityQuintals, item.rice_id]
    );
}


        await client.query(
            `UPDATE quotes SET status = 'Approved' WHERE quote_number = $1`,
            [quoteNumber]
        );

        await client.query(
            `INSERT INTO orders (quote_number, total_price, status, order_date)
       VALUES ($1, $2, $3, CURRENT_DATE)`,
            [quoteNumber, totalPrice, 'Waiting']
        );

        await client.query('COMMIT');
        return res.status(200).json({
            message: 'Quote approved and order created',
            quoteNumber,
            totalPrice
        });

    }

    catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Approval failed' });
    }

    finally {
        client.release();
    }
}

export default decisionLogic;