async function quoteLogic(pool, userId, quotedItems, res) {
  const client = await pool.connect();
  let isAutoApproved = true;
  let totalPrice = 0;

  try {
    await client.query('BEGIN');

    console.log("🔹 Incoming quotedItems:", quotedItems);

    // Process each quoted item
    for (const item of quotedItems) {
      const { riceId, quotedPrice, quantity } = item;
      const quantityQuintals = parseFloat(quantity);       // quantity in quintals
      const pricePerQuintal = parseFloat(quotedPrice);    // price per quintal

      console.log(`➡️  Processing item riceId=${riceId}, pricePerQuintal=${pricePerQuintal}, quantity=${quantityQuintals}`);

      // Fetch rice stock and min/max prices
      const riceResult = await client.query(
        `SELECT stock_available, min_price, max_price 
         FROM rice_details 
         WHERE rice_id = $1 FOR UPDATE`,
        [riceId]
      );

      if (riceResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Rice with ID ${riceId} not found` });
      }

      const { stock_available, min_price, max_price } = riceResult.rows[0];
      const currentStock = parseFloat(stock_available);
      const min = parseFloat(min_price);
      const max = parseFloat(max_price);

      // Stock check
      if (currentStock < quantityQuintals) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Quote rejected due to insufficient stock',
          riceId,
          reason: `Requested quantity (${quantityQuintals} quintals) exceeds available stock (${currentStock} quintals)`
        });
      }

      // Price range check
      if (pricePerQuintal < min || pricePerQuintal > max) {
        isAutoApproved = false;
      }

      // Add to total price
      totalPrice += pricePerQuintal * quantityQuintals;

      // Store processed values in item
      item.pricePerQuintal = pricePerQuintal;
      item.quantityQuintals = quantityQuintals;
    }

    console.log("✅ Total price calculated before insert:", totalPrice);

    // Insert quote
    const quoteStatus = isAutoApproved ? 'Approved' : 'Pending';
    const quoteRes = await client.query(
      `INSERT INTO quotes (sales_person_id, status)
       VALUES ($1, $2) RETURNING quote_number`,
      [userId, quoteStatus]
    );
    const quoteNumber = quoteRes.rows[0].quote_number;
    console.log("📝 Quote inserted:", { quoteNumber, status: quoteStatus });

    // Insert quote items
    for (const item of quotedItems) {
      await client.query(
        `INSERT INTO quote_items (quote_number, rice_id, quoted_price, quantity)
         VALUES ($1, $2, $3::numeric(10,2), $4::numeric(10,2))`,
        [quoteNumber, item.riceId, item.pricePerQuintal, item.quantityQuintals]
      );

      // Deduct stock if auto-approved
      if (isAutoApproved) {
        await client.query(
          `UPDATE rice_details 
           SET stock_available = stock_available - $1 
           WHERE rice_id = $2`,
          [item.quantityQuintals, item.riceId]
        );
      }

      console.log("📝 Quote item inserted:", item);
    }

    // Round total price to 2 decimal places
    const totalPriceRounded = parseFloat(totalPrice.toFixed(2));

    // Insert order if auto-approved
    if (isAutoApproved) {
      await client.query(
        `INSERT INTO orders (quote_number, total_price, status, order_date)
         VALUES ($1, $2, $3, CURRENT_DATE)`,
        [quoteNumber, totalPriceRounded, 'Waiting']
      );
      console.log("📝 Order inserted:", { quoteNumber, totalPrice: totalPriceRounded });
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: isAutoApproved
        ? 'Quote approved and order created'
        : 'Quote submitted for owner approval',
      quoteNumber,
      status: quoteStatus,
      totalPrice: totalPriceRounded
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Database Error:", err);
    return res.status(500).json({ message: 'Database Error', error: err.message });
  } finally {
    client.release();
  }
}

export default quoteLogic;
