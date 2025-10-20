import allocateVehicle from "./allocateVehicle.js";

async function orderPayment(pool, userId, orderId, action, addressId, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const orderRes = await client.query(
            `SELECT o.status, q.sales_person_id, o.total_price
            FROM orders o
            JOIN quotes q ON o.quote_number = q.quote_number
            WHERE o.order_id = $1 FOR UPDATE`,
            [orderId]
        );

        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        };

        const { status, sales_person_id, total_price } = orderRes.rows[0];
        if (parseInt(sales_person_id) !== parseInt(userId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        if (action === 'Pay') {
            if (status !== 'Waiting') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Order is already ${status}` });
            }

            await client.query(
                `UPDATE orders 
            SET address_id = $1, status = 'Paid' WHERE order_id = $2`,
                [addressId, orderId]
            );

            await client.query('INSERT INTO payment_details (order_id, amount, pay_date) VALUES ($1, $2, NOW()::TIMESTAMP(0))', [orderId, total_price]);

            const dispatchResult = await allocateVehicle(client, orderId);

            if (!dispatchResult.success) {
                await client.query('ROLLBACK');
                return res.status(500).json({
                    message: dispatchResult.message + ' Transaction rolled back.'
                });
            }

            await client.query('COMMIT');
            return res.status(200).json({
                message: 'Order paid and dispatch scheduled for the assigned address',
                orderId,
                vehicleNumber: dispatchResult.vehicleNumber,
                driverId: dispatchResult.driverId,
                startDate: dispatchResult.startDate,
                deliveryDate: dispatchResult.deliveryDate
            });
        }

    }

    catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Action failed' });
    }

    finally {
        client.release();
    }
}

export default orderPayment;