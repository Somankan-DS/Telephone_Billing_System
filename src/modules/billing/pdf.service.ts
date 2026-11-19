import PDFDocument from 'pdfkit';

export class PdfService {
  /**
   * Generate vector-quality downloadable PDF invoice buffer
   */
  public static async generateInvoicePdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `TeleBill Pro Invoice - ${invoice.invoiceNumber}`,
            Author: 'TeleBill Pro Telecom Management System',
            Subject: 'Telecom Monthly Service Invoice',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Primary Brand Colors
        const primaryColor = '#1e3a8a'; // Deep Navy
        const accentColor = '#0284c7';  // Telecom Cyan
        const textColor = '#1f2937';    // Charcoal Dark
        const lightGray = '#f3f4f6';
        const borderGray = '#e5e7eb';

        // --- COMPANY HEADER ---
        doc
          .fillColor(primaryColor)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('TELEBILL PRO', 40, 40)
          .fontSize(9)
          .font('Helvetica')
          .fillColor(accentColor)
          .text('Smart Telecom Billing & Customer Management System', 40, 65)
          .fillColor(textColor)
          .text('University of Engineering & Management, Kolkata', 40, 78)
          .text('Telecom Towers, Sector V, Salt Lake, Kolkata, WB 700091', 40, 90)
          .text('GSTIN: 19AAACT0001Z1Z0 | Support: 1800-TELE-BILL', 40, 102);

        // --- INVOICE BADGE & METADATA ---
        doc
          .rect(380, 40, 175, 75)
          .fill(lightGray)
          .stroke(borderGray);

        doc
          .fillColor(primaryColor)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('TAX INVOICE', 390, 48);

        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(textColor)
          .text(`Invoice No: `, 390, 68)
          .font('Helvetica')
          .text(invoice.invoiceNumber, 450, 68)
          .font('Helvetica-Bold')
          .text(`Cycle Code: `, 390, 80)
          .font('Helvetica')
          .text(invoice.billingCycleCode, 450, 80)
          .font('Helvetica-Bold')
          .text(`Issue Date: `, 390, 92)
          .font('Helvetica')
          .text(new Date(invoice.issueDate).toLocaleDateString(), 450, 92)
          .font('Helvetica-Bold')
          .text(`Due Date: `, 390, 104)
          .font('Helvetica')
          .text(new Date(invoice.dueDate).toLocaleDateString(), 450, 104);

        // Horizontal Separator
        doc.moveTo(40, 125).lineTo(555, 125).strokeColor(borderGray).stroke();

        // --- CUSTOMER & PLAN INFORMATION ---
        const customer = invoice.customer || {};
        const customerName = `${customer.firstName || 'Valued'} ${customer.lastName || 'Customer'}`;
        const phone = customer.phone || 'N/A';
        const address = `${customer.address || ''}, ${customer.city || 'Kolkata'}, ${customer.state || 'WB'} ${customer.postalCode || ''}`;
        const planName = customer.tariffPlan?.name || 'Postpaid Telecom Plan';

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('BILLED TO (SUBSCRIBER)', 40, 135)
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(textColor)
          .text(customerName, 40, 150)
          .font('Helvetica')
          .text(`Account No: ${customer.accountNumber || 'N/A'}`, 40, 162)
          .text(`Registered Mobile: ${phone}`, 40, 174)
          .text(`Address: ${address}`, 40, 186, { width: 250 });

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('PLAN & BILLING STATUS', 320, 135)
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(textColor)
          .text(`Subscribed Plan: `, 320, 150)
          .font('Helvetica')
          .text(planName, 410, 150)
          .font('Helvetica-Bold')
          .text(`Payment Status: `, 320, 162)
          .font('Helvetica-Bold')
          .fillColor(invoice.status === 'PAID' ? '#16a34a' : '#dc2626')
          .text(invoice.status, 410, 162)
          .font('Helvetica-Bold')
          .fillColor(textColor)
          .text(`Paid Amount: `, 320, 174)
          .font('Helvetica')
          .text(`INR ${parseFloat(invoice.paidAmount?.toString() || '0').toFixed(2)}`, 410, 174);

        // --- LINE ITEMS TABLE ---
        const tableTop = 220;
        doc
          .rect(40, tableTop, 515, 22)
          .fill(primaryColor);

        doc
          .fillColor('#ffffff')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('Category', 50, tableTop + 6)
          .text('Description', 130, tableTop + 6)
          .text('Units', 350, tableTop + 6, { width: 50, align: 'right' })
          .text('Rate (INR)', 410, tableTop + 6, { width: 60, align: 'right' })
          .text('Amount (INR)', 480, tableTop + 6, { width: 65, align: 'right' });

        let currentY = tableTop + 26;
        const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
          { category: 'RENTAL', description: `Monthly Fixed Rental - ${planName}`, quantity: 1, unitRate: invoice.rentalAmount, amount: invoice.rentalAmount },
          { category: 'USAGE', description: 'Telecom Call Usage Charges (Rated CDRs)', quantity: 1, unitRate: invoice.callCharges, amount: invoice.callCharges },
          { category: 'TAX', description: 'Statutory GST (18.00%)', quantity: 1, unitRate: invoice.taxAmount, amount: invoice.taxAmount },
        ];

        items.forEach((item: any, index: number) => {
          if (index % 2 === 1) {
            doc.rect(40, currentY - 2, 515, 20).fill(lightGray);
          }

          doc
            .fillColor(textColor)
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .text(item.category || 'CHARGE', 50, currentY + 2)
            .font('Helvetica')
            .text(item.description || 'Service Charge', 130, currentY + 2, { width: 215 })
            .text(parseFloat(item.quantity?.toString() || '1').toFixed(2), 350, currentY + 2, { width: 50, align: 'right' })
            .text(parseFloat(item.unitRate?.toString() || '0').toFixed(2), 410, currentY + 2, { width: 60, align: 'right' })
            .font('Helvetica-Bold')
            .text(parseFloat(item.amount?.toString() || '0').toFixed(2), 480, currentY + 2, { width: 65, align: 'right' });

          currentY += 22;
        });

        // Separator Line
        doc.moveTo(40, currentY + 5).lineTo(555, currentY + 5).strokeColor(borderGray).stroke();
        currentY += 15;

        // --- FINANCIAL SUMMARY BOX ---
        const summaryX = 330;
        const summaryWidth = 225;

        doc
          .rect(summaryX, currentY, summaryWidth, 110)
          .fill('#f8fafc')
          .stroke(borderGray);

        const rowY = currentY + 8;
        doc
          .fillColor(textColor)
          .fontSize(9)
          .font('Helvetica')
          .text('Rental Charges:', summaryX + 10, rowY)
          .text(`INR ${parseFloat(invoice.rentalAmount?.toString() || '0').toFixed(2)}`, summaryX + 110, rowY, { width: 100, align: 'right' })
          .text('Call Usage Charges:', summaryX + 10, rowY + 16)
          .text(`INR ${parseFloat(invoice.callCharges?.toString() || '0').toFixed(2)}`, summaryX + 110, rowY + 16, { width: 100, align: 'right' })
          .text('Goods & Services Tax (18%):', summaryX + 10, rowY + 32)
          .text(`INR ${parseFloat(invoice.taxAmount?.toString() || '0').toFixed(2)}`, summaryX + 110, rowY + 32, { width: 100, align: 'right' })
          .text('Previous Arrears / Balance:', summaryX + 10, rowY + 48)
          .text(`INR ${parseFloat(invoice.previousArrears?.toString() || '0').toFixed(2)}`, summaryX + 110, rowY + 48, { width: 100, align: 'right' });

        // Total Line
        doc.rect(summaryX, currentY + 70, summaryWidth, 40).fill(primaryColor);
        doc
          .fillColor('#ffffff')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('TOTAL AMOUNT PAYABLE:', summaryX + 10, currentY + 83)
          .fontSize(13)
          .text(`INR ${parseFloat(invoice.totalAmount?.toString() || '0').toFixed(2)}`, summaryX + 110, currentY + 81, { width: 105, align: 'right' });

        // --- FOOTER & COMPLIANCE ---
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .fillColor('#64748b')
          .text(
            'This is a computer-generated tax invoice generated by TeleBill Pro and requires no physical signature. ' +
            'Please pay before the due date to avoid service interruption and late fee penalties.',
            40,
            740,
            { align: 'center', width: 515 }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
