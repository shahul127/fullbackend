import PDFDocument from 'pdfkit';

function generateInvoice(invoiceData, res) {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceData.invoice_id}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();

    doc.fontSize(12).text(`Invoice No: ${invoiceData.invoice_id}`);
    doc.text(`Order ID: ${invoiceData.order_id}`);
    doc.text(`Date: ${invoiceData.payment_date}`);
    doc.text(`Due Date: ${invoiceData.delivery_date}`).moveDown();

    doc.text(`BILL TO: ${invoiceData.salesperson_name}`);
    doc.text(`Email: ${invoiceData.email_id}`);
    doc.text(`Contact: ${invoiceData.contact_number}`);
    doc.text(`Address: ${invoiceData.address}`).moveDown();

    doc.text('ITEMS', { underline: true }).moveDown(0.5);
    invoiceData.items.forEach(item => {
        doc.text(`${item.rice_name} - ${item.quantity} quintals @ ₹${item.quoted_price} = ₹${item.amount}`);
    });

    doc.moveDown();
    doc.text(`Total: ₹${invoiceData.total_price}`);
    doc.text(`CGST (5%): ₹${invoiceData.cgst}`);
    doc.text(`SGST (5%): ₹${invoiceData.sgst}`);
    doc.text(`Grand Total: ₹${invoiceData.grand_total}`);
    doc.text(`Dispatch Date: ${invoiceData.dispatch_date}`);
    doc.text(`Delivery Date: ${invoiceData.delivery_date}`).moveDown();

    doc.text('Terms & Conditions: Goods once sold will not be taken back.');
    doc.text('Payment Mode: UPI / Bank Transfer');
    doc.text('Seal & Signature: __________________');

    doc.end();
}

export default generateInvoice;