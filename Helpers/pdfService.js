const puppeteer = require("puppeteer");
const path = require("path");

async function generateInvoicePDF(order, outputPath) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  const calculatedSubtotal = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const shippingAddress = order.shippingAddress ? `
    ${order.shippingAddress.fullName}<br>
    ${order.shippingAddress.addressLine1}<br>
    ${order.shippingAddress.addressLine2 ? order.shippingAddress.addressLine2 + '<br>' : ''}
    ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
    ${order.shippingAddress.country}<br>
    Phone: ${order.shippingAddress.phone}
  ` : 'N/A';

  const html = `
    <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            padding: 40px;
            color: #333;
            line-height: 1.6;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #e0e0e0;
            padding: 20px;
            background-color: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #28a745;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header img {
            max-height: 60px;
          }
          .company-info {
            text-align: right;
            font-size: 14px;
          }
          .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 10px;
          }
          .invoice-details, .customer-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 14px;
          }
          .table th, .table td {
            border: 1px solid #e0e0e0;
            padding: 10px;
            text-align: left;
          }
          .table th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #343a40;
          }
          .table tbody tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .summary {
            margin-top: 20px;
            font-size: 14px;
            text-align: right;
          }
          .summary table {
            width: 50%;
            float: right;
            border-collapse: collapse;
          }
          .summary td {
            padding: 5px 10px;
            border: none;
          }
          .summary .label {
            font-weight: bold;
            color: #343a40;
          }
          .summary .total {
            font-size: 16px;
            font-weight: bold;
            color: #28a745;
            border-top: 2px solid #28a745;
            padding-top: 10px;
          }
          .payment-info {
            margin-top: 20px;
            font-size: 14px;
            border-top: 1px solid #e0e0e0;
            padding-top: 10px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div>
                <h2>TIMZO<h2>
            </div>
            <div class="company-info">
              <strong>Timzo Pvt. Ltd.</strong><br>
              123 Business Avenue, Kannur, Kerala 670613, India<br>
              Email: support@timzo.com | Phone: +91 8089471532<br>
              GSTIN: 32AAACT1234A1ZB
            </div>
          </div>

          <!-- Invoice Title -->
          <div class="invoice-title">INVOICE</div>

          <!-- Invoice and Customer Details -->
          <div class="invoice-details">
            <div>
              <strong>Invoice Number:</strong> ${order.orderId}<br>
              <strong>Issue Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}<br>
              <strong>Due Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}
            </div>
            <div class="customer-info">
              <div>
                <strong>Bill To:</strong><br>
                ${order.user ? `${order.user.name}<br>${order.user.email}` : 'N/A'}
              </div>
              <div>
                <strong>Ship To:</strong><br>
                ${shippingAddress}
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.productId?.name || 'N/A'}</td>
                  <td>${item.quantity}</td>
                  <td>₹${item.price.toFixed(2)}</td>
                  <td>₹${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Summary Breakdown -->
          <div class="summary">
            <table>
              <tr>
                <td class="label">Subtotal:</td>
                <td>₹${calculatedSubtotal.toFixed(2)}</td>
              </tr>
              ${order.discount > 0 ? `
                <tr>
                  <td class="label">Discount:</td>
                  <td>-₹${order.discount.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${order.shippingFee > 0 ? `
                <tr>
                  <td class="label">Shipping Fee:</td>
                  <td>₹${order.shippingFee.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${order.tax > 0 ? `
                <tr>
                  <td class="label">Tax:</td>
                  <td>₹${order.tax.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr class="total">
                <td class="label">Total Amount:</td>
                <td>₹${order.totalAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <!-- Payment Information -->
          <div class="payment-info">
            <strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}<br>
            <strong>Payment Status:</strong> ${order.paymentStatus || 'N/A'}
          </div>

          <!-- Footer -->
          <div class="footer">
            Thank you for shopping with Timzo! For support, contact us at support@timzo.com.<br>
            © ${new Date().getFullYear()} Timzo Pvt. Ltd. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
  });

  await browser.close();
  return outputPath;
}

module.exports = { generateInvoicePDF };