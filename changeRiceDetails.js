async function changeRiceDetails(pool, updates, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let successfulUpdates = 0;

        for (const update of updates) {
            const { riceId, minPrice, maxPrice, stockAvailable } = update;

            const newRangeQuery = `UPDATE rice_details SET last_changed_date = NOW()::TIMESTAMP(0), min_price = $2, max_price = $3, stock_available = $4 WHERE rice_id = $1`;
            await client.query(newRangeQuery, [riceId, minPrice, maxPrice, stockAvailable]);

            successfulUpdates++;
        }

        await client.query('COMMIT');
        return res.status(200).json({
            message: `Batch update successful. ${successfulUpdates} rice types were updated.`,
            updatedCount: successfulUpdates
        });

    }

    catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ message: 'Transaction failed. No changes were applied.' });
    }

    finally {
        client.release();
    }
};

export default changeRiceDetails;