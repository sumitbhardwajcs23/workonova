import { jsPDF } from 'jspdf';

export interface ClientInvoiceData {
  orderId: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceCategory: string;
  tier: string;
  totalPrice: number;
  amountPaid: number;
  milestoneStage: number; // 1, 2, 3, 4
  paymentId?: string;
  razorpayOrderId?: string;
  date?: string;
  status?: string;
}

export interface FreelancerPayoutData {
  orderId: number;
  freelancerName: string;
  freelancerEmail: string;
  serviceCategory: string;
  tier: string;
  payoutAmount: number;
  payoutStatus: string;
  payoutReleasedAt?: string;
  date?: string;
}

/**
 * Downloads a high-quality, formatted GST Tax Invoice for Clients
 */
export function downloadClientInvoicePDF(data: ClientInvoiceData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const invoiceNo = `WN-INV-2026-${String(data.orderId).padStart(4, '0')}`;
  const invoiceDate = data.date || new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // ── 1. Top Header Background ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Brand Name & Tagline
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('WORKONOVA', 15, 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('MANAGED CREATIVE & TECH MARKETPLACE', 15, 25);
  doc.text('GSTIN: 07AAACW1234F1Z5 | contact@workonova.com | www.workonova.com', 15, 30);

  // Invoice Title Badge
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.roundedRect(145, 10, 50, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 170, 18, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`ORIGINAL FOR RECIPIENT`, 170, 24, { align: 'center' });

  // ── 2. Invoice Meta Row ──
  doc.setFillColor(248, 250, 252);
  doc.rect(15, 45, 180, 28, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 45, 180, 28, 'S');

  // Left Column: Client Details
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO (CLIENT):', 20, 52);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.clientName || 'Valued Client', 20, 58);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${data.clientEmail || 'client@workonova.com'}`, 20, 64);
  if (data.clientPhone) {
    doc.text(`Phone: ${data.clientPhone}`, 20, 69);
  }

  // Right Column: Invoice Reference
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', 120, 52);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No:`, 120, 58);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceNo, 155, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Order Ref:`, 120, 64);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text(`#WN-${data.orderId}`, 155, 64);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice Date:`, 120, 69);
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceDate, 155, 69);

  // ── 3. Table Header ──
  doc.setFillColor(30, 41, 59);
  doc.rect(15, 80, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 18, 85.5);
  doc.text('DESCRIPTION / SERVICE ITEM', 30, 85.5);
  doc.text('TIER', 110, 85.5);
  doc.text('SAC CODE', 135, 85.5);
  doc.text('AMOUNT (INR)', 175, 85.5, { align: 'right' });

  // ── 4. Table Row Item ──
  doc.setFillColor(255, 255, 255);
  doc.rect(15, 88, 180, 14, 'F');
  doc.setDrawColor(241, 245, 249);
  doc.line(15, 102, 195, 102);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('1', 18, 96);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.serviceCategory} Digital Package`, 30, 95);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('End-to-End Vetted Specialist Delivery with QA Verification', 30, 99);

  doc.setFontSize(8.5);
  doc.setTextColor(99, 102, 241);
  doc.setFont('helvetica', 'bold');
  doc.text((data.tier || 'STANDARD').toUpperCase(), 110, 96);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text('998314', 135, 96);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`₹${Number(data.totalPrice || 0).toLocaleString('en-IN')}`, 190, 96, { align: 'right' });

  // ── 5. Milestone Payment Breakdown ──
  doc.setFillColor(248, 250, 252);
  doc.rect(15, 108, 105, 52, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 108, 105, 52, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3-STAGE MILESTONE ESCROW STATUS:', 20, 115);

  const m1Paid = data.amountPaid >= data.totalPrice * 0.5;
  const m2Paid = data.amountPaid >= data.totalPrice * 0.75;
  const m3Paid = data.amountPaid >= data.totalPrice;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(m1Paid ? 16 : 148, m1Paid ? 185 : 163, m1Paid ? 129 : 184);
  doc.text(`${m1Paid ? '✓' : '○'} Milestone 1 (50% Upfront Kickoff): ₹${Math.round(data.totalPrice * 0.5).toLocaleString('en-IN')}`, 20, 123);

  doc.setTextColor(m2Paid ? 16 : 148, m2Paid ? 185 : 163, m2Paid ? 129 : 184);
  doc.text(`${m2Paid ? '✓' : '○'} Milestone 2 (25% Midpoint 50% Work): ₹${Math.round(data.totalPrice * 0.25).toLocaleString('en-IN')}`, 20, 131);

  doc.setTextColor(m3Paid ? 16 : 148, m3Paid ? 185 : 163, m3Paid ? 129 : 184);
  doc.text(`${m3Paid ? '✓' : '○'} Milestone 3 (25% Final Delivery Release): ₹${Math.round(data.totalPrice * 0.25).toLocaleString('en-IN')}`, 20, 139);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`Cumulative Paid: ₹${(data.amountPaid || 0).toLocaleString('en-IN')} of ₹${(data.totalPrice || 0).toLocaleString('en-IN')}`, 20, 150);

  // ── 6. Price Summary Box (Right) ──
  const basePrice = Math.round((data.totalPrice || 0) / 1.18);
  const gstAmount = (data.totalPrice || 0) - basePrice;
  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;

  doc.setFillColor(255, 255, 255);
  doc.rect(125, 108, 70, 52, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(125, 108, 70, 52, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Taxable Value:', 130, 116);
  doc.setTextColor(15, 23, 42);
  doc.text(`₹${basePrice.toLocaleString('en-IN')}`, 190, 116, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.text('CGST (9%):', 130, 123);
  doc.setTextColor(15, 23, 42);
  doc.text(`₹${cgst.toLocaleString('en-IN')}`, 190, 123, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.text('SGST (9%):', 130, 130);
  doc.setTextColor(15, 23, 42);
  doc.text(`₹${sgst.toLocaleString('en-IN')}`, 190, 130, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(130, 135, 190, 135);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Total (Inc. GST):', 130, 143);
  doc.setTextColor(99, 102, 241);
  doc.text(`₹${(data.totalPrice || 0).toLocaleString('en-IN')}`, 190, 143, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129);
  doc.text(`Paid: ₹${(data.amountPaid || 0).toLocaleString('en-IN')}`, 190, 150, { align: 'right' });

  // ── 7. Payment Transaction Info ──
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 166, 180, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 166, 180, 20, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT & ESCROW AUDIT:', 20, 172);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Gateway: Razorpay Enterprise Gateway`, 20, 178);
  doc.text(`Payment ID: ${data.paymentId || 'rzp_test_secured_escrow'}`, 20, 182);
  if (data.razorpayOrderId) {
    doc.text(`Razorpay Order: ${data.razorpayOrderId}`, 110, 178);
  }
  doc.text(`Payment Status: ${data.amountPaid >= data.totalPrice ? 'FULLY PAID & SETTLED' : 'ACTIVE MILESTONE ESCROW'}`, 110, 182);

  // ── 8. Terms & Notes ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TERMS & CONDITIONS:', 15, 196);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('1. All payments are held in regulated milestone escrow and disbursed in 50% upfront, 25% midpoint, and 25% final delivery batches.', 15, 202);
  doc.text('2. Deliverables are vetted and protected under Workonova 100% Quality Assurance Guarantee.', 15, 207);
  doc.text('3. This is a computer-generated digital tax invoice and does not require a physical signature.', 15, 212);

  // ── 9. Footer & Authorized Signatory ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 275, 210, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('WORKONOVA TECHNOLOGIES PVT. LTD.', 15, 284);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Official Platform Invoice · Generated automatically from verified database ledger.', 15, 289);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signatory', 195, 284, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Finance & Escrow Operations', 195, 289, { align: 'right' });

  // Save the document
  doc.save(`${invoiceNo}.pdf`);
}

/**
 * Downloads a formatted Specialist Payout & Earnings Voucher for Freelancers
 */
export function downloadFreelancerPayoutVoucherPDF(data: FreelancerPayoutData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const voucherNo = `WN-PAYOUT-WN-${data.orderId}`;
  const dateStr = data.payoutReleasedAt || data.date || new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Top Header Background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('WORKONOVA', 15, 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('SPECIALIST CREW OPERATIONS & PAYOUT VOUCHER', 15, 25);
  doc.text('crew@workonova.com | Specialist Earnings Ledger', 15, 30);

  // Voucher Badge
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(145, 10, 50, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYOUT VOUCHER', 170, 18, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ADMIN REGULATED', 170, 24, { align: 'center' });

  // Details Box
  doc.setFillColor(248, 250, 252);
  doc.rect(15, 45, 180, 28, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 45, 180, 28, 'S');

  // Left Column
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BENEFICIARY (SPECIALIST):', 20, 52);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.freelancerName || 'Vetted Specialist', 20, 58);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${data.freelancerEmail || 'specialist@workonova.com'}`, 20, 64);
  doc.text(`Specialization: ${data.serviceCategory}`, 20, 69);

  // Right Column
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('VOUCHER AUDIT:', 120, 52);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Voucher Ref:`, 120, 58);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(voucherNo, 155, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Task Ref:`, 120, 64);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`#WN-${data.orderId}`, 155, 64);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Disbursement Date:`, 120, 69);
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, 155, 69);

  // Table
  doc.setFillColor(30, 41, 59);
  doc.rect(15, 80, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 18, 85.5);
  doc.text('DELIVERABLE / PROJECT MILESTONE', 30, 85.5);
  doc.text('TIER', 120, 85.5);
  doc.text('PAYOUT AMOUNT', 175, 85.5, { align: 'right' });

  // Row
  doc.setFillColor(255, 255, 255);
  doc.rect(15, 88, 180, 14, 'F');
  doc.setDrawColor(241, 245, 249);
  doc.line(15, 102, 195, 102);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('1', 18, 96);
  doc.setFont('helvetica', 'bold');
  doc.text(`Delivered & QA-Approved: ${data.serviceCategory}`, 30, 95);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Verified 50% Midpoint & 100% Final Deliverables approved by Client', 30, 99);

  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.text((data.tier || 'STANDARD').toUpperCase(), 120, 96);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`₹${Number(data.payoutAmount || 0).toLocaleString('en-IN')}`, 190, 96, { align: 'right' });

  // Regulation Box
  doc.setFillColor(240, 253, 244);
  doc.rect(15, 110, 180, 36, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(15, 110, 180, 36, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('ADMIN REGULATION & DISBURSEMENT DETAILS:', 20, 118);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(21, 128, 61);
  doc.text(`• Payout Status: ${data.payoutStatus === 'payout_released' ? 'DISBURSED / RELEASED' : 'ADMIN REGULATED / APPROVED'}`, 20, 125);
  doc.text(`• Total Net Specialist Fee: ₹${(data.payoutAmount || 0).toLocaleString('en-IN')}`, 20, 131);
  doc.text(`• Payment Channel: Registered Bank Account / UPI (Direct Deposit)`, 20, 137);

  // Footer
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 275, 210, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('WORKONOVA CREW PAYOUT SYSTEM', 15, 284);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Official Specialist Payout Record · Regulated and verified by Workonova Operations.', 15, 289);

  doc.save(`${voucherNo}.pdf`);
}
