import PDFDocument from "pdfkit";

// Helper to generate the PDF
function generateInvoice(invoiceData, res) {
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${invoiceData.order_id}.pdf`
  );
  doc.pipe(res);

  // Invoice header
  doc.fontSize(20).text("INVOICE", { align: "center" }).moveDown();

  doc.fontSize(12).text(`Invoice No: ${invoiceData.order_id}`);
  doc.text(`Order ID: ${invoiceData.order_id}`);
  doc.text(`Date: ${invoiceData.payment_date}`);
  doc.text(`Due Date: ${invoiceData.delivery_date}`).moveDown();

  doc.text(`BILL TO: ${invoiceData.salesperson_name}`);
  doc.text(`Email: ${invoiceData.email_id}`);
  doc.text(`Contact: ${invoiceData.contact_number}`);
  doc.text(
    `Address: ${invoiceData.street}, ${invoiceData.city} - ${invoiceData.pincode}`
  ).moveDown();

  doc.text("ITEMS", { underline: true }).moveDown(0.5);
  invoiceData.items.forEach((item) => {
    doc.text(
      `${item.rice_name} - ${item.quantity} quintals @ ₹${item.quoted_price} = ₹${item.amount}`
    );
  });

  doc.moveDown();

  // Ensure numeric calculations
  const totalPrice = parseFloat(invoiceData.total_price) || 0;
  const cgst = parseFloat((totalPrice * 0.05).toFixed(2));
  const sgst = parseFloat((totalPrice * 0.05).toFixed(2));
  const grandTotal = parseFloat((totalPrice + cgst + sgst).toFixed(2));

  doc.text(`Total: ₹${totalPrice}`);
  doc.text(`CGST (5%): ₹${cgst}`);
  doc.text(`SGST (5%): ₹${sgst}`);
  doc.text(`Grand Total: ₹${grandTotal}`);
  doc.text(`Dispatch Date: ${invoiceData.dispatch_date}`);
  doc.text(`Delivery Date: ${invoiceData.delivery_date}`).moveDown();

  doc.text("Terms & Conditions: Goods once sold will not be taken back.");
  doc.text("Payment Mode: UPI / Bank Transfer");
  doc.text("Seal & Signature: __________________");

  doc.end();
}

// Fetch invoice data and call generateInvoice
export async function fetchInvoice(pool, userId, orderId, res) {
  try {
    // Fetch order + payment + customer info
    const orderRes = await pool.query(
      `SELECT 
  o.order_id, o.quote_number, o.total_price, o.status, o.order_date,
  a.street, a.city, a.pincode,
  s.name AS salesperson_name, s.email_id,
  c.contact_number,
  p.pay_date AS payment_date,
  d.start_date AS dispatch_date,
  d.delivered_date AS delivery_date
FROM orders o
JOIN quotes q ON o.quote_number = q.quote_number
JOIN sales_person s ON q.sales_person_id = s.user_id
LEFT JOIN address_details a ON o.address_id = a.address_id
LEFT JOIN contact_details c ON s.user_id = c.user_id
LEFT JOIN payment_details p ON o.order_id = p.order_id
LEFT JOIN dispatches d ON o.order_id = d.order_id
WHERE o.order_id = $1 AND s.user_id = $2
`,
      [orderId, userId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = orderRes.rows[0];

    // Fetch items for this quote
    const itemsRes = await pool.query(
      `SELECT qi.rice_id, r.rice_name, qi.quantity, qi.quoted_price, (qi.quantity * qi.quoted_price) AS amount
       FROM quote_items qi
       JOIN quotes q ON qi.quote_number = q.quote_number
       JOIN rice_details r ON qi.rice_id = r.rice_id
       JOIN orders o ON q.quote_number = o.quote_number
       WHERE o.order_id = $1`,
      [orderId]
    );

    invoice.items = itemsRes.rows || [];

    generateInvoice(invoice, res);
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
}

export default fetchInvoice;
