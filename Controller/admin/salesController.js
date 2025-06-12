const mongoose = require('mongoose');
const Order = require('../../Model/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

async function getSalesData(reportType, startDate, endDate) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const nowInIST = new Date(now.getTime() + istOffset);

    let dateFilter = {};

    switch (reportType) {
        case 'daily': {
            const start = new Date(nowInIST.getFullYear(), nowInIST.getMonth(), nowInIST.getDate());
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            dateFilter.orderDate = {
                $gte: new Date(start.getTime() - istOffset),
                $lte: new Date(end.getTime() - istOffset),
            };
            break;
        }
        case 'weekly': {
            const start = new Date(nowInIST);
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            dateFilter.orderDate = {
                $gte: new Date(start.getTime() - istOffset),
                $lte: new Date(end.getTime() - istOffset),
            };
            break;
        }
        case 'last-week': {
            const start = new Date(nowInIST);
            start.setDate(start.getDate() - start.getDay() - 7);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            dateFilter.orderDate = {
                $gte: new Date(start.getTime() - istOffset),
                $lte: new Date(end.getTime() - istOffset),
            };
            break;
        }
        case 'yearly': {
            const start = new Date(nowInIST.getFullYear(), 0, 1);
            const end = new Date(nowInIST.getFullYear(), 11, 31, 23, 59, 59, 999);
            dateFilter.orderDate = {
                $gte: new Date(start.getTime() - istOffset),
                $lte: new Date(end.getTime() - istOffset),
            };
            break;
        }
        case 'custom': {
            if (!startDate || !endDate) {
                throw new Error('Please provide both start and end dates for a custom range');
            }
            const start = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            dateFilter.orderDate = { $gte: start, $lte: end };
            break;
        }
        default:
            throw new Error('Invalid report type');
    }

    const salesData = await Order.aggregate([
        {
            $match: {
                ...dateFilter,
                orderStatus: { $in: ['Delivered'] }
            }
        },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
                totalDiscount: { $sum: '$discount' },
            },
        },
    ]);

    const report = salesData[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalDiscount: 0,
    };

    const orders = await Order.find(dateFilter)
        .populate('user', 'name email')
        .sort({ orderDate: -1 })
        .lean();

    return { report, orders, dateFilter };
}

const generateAdminSalesReport = async (req, res) => {
    try {
        const adminId = req.session.admin?.id;
        if (!adminId) {
            return res.status(401).render('error404', {
                message: 'Please log in as an admin to view the sales report',
            });
        }

        const { reportType: queryReportType, reportTypeHidden, startDate, endDate, page } = req.query;
        const reportType = reportTypeHidden || queryReportType || 'daily';
        const currentPage = parseInt(page) || 1;
        const limit = 10;

        const { report, orders } = await getSalesData(reportType, startDate, endDate);

        const totalOrders = await Order.countDocuments((await getSalesData(reportType, startDate, endDate)).dateFilter);
        const totalPages = Math.ceil(totalOrders / limit);
        const skip = (currentPage - 1) * limit;

        const paginatedOrders = orders.slice(skip, skip + limit);

        res.render('admin/salesReport', {
            report,
            orders: paginatedOrders,
            reportType,
            startDate: startDate || '',
            endDate: endDate || '',
            admin: req.session.admin,
            currentPage,
            totalPages,
            totalOrders,
        });
    } catch (error) {
        console.error('Error generating admin sales report:', error);
        res.status(500).render('error404', {
            message: 'Failed to generate sales report: ' + error.message,
        });
    }
};


const generateSalesReportPDF = async (req, res) => {
    try {
        const adminId = req.session.admin?.id;
        if (!adminId) return res.status(401).send('Unauthorized');

        const { reportType, startDate, endDate } = req.query;
        const { report, orders } = await getSalesData(reportType, startDate, endDate);

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 10, size: 'A4' });

        const filename = `Sales_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Timzo Sales Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).text(`Report Type: ${reportType.toUpperCase()}`, { align: 'center' });
        if (startDate && endDate) {
            doc.text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
        }
        doc.moveDown(1.5);

        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Total Orders: ${report.totalOrders}`);
        doc.text(`Total Amount: ${report.totalAmount.toFixed(2)}`);
        doc.text(`Total Discount: ${report.totalDiscount.toFixed(2)}`);
        doc.moveDown(1.5);

        doc.fontSize(14).text('Order Details', { underline: true });
        doc.moveDown(0.5);

        const startX = doc.page.margins.left;
        let y = doc.y;
        const colWidths = [70, 90, 60, 140, 60, 60, 60, 80];
        const headers = ['Order ID', 'User', 'Date', 'Items', 'Subtotal', 'Discount', 'Total', 'Status'];
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);

        const renderHeader = () => {
            let x = startX;
            doc.font('Helvetica-Bold').fontSize(10);
            headers.forEach((header, i) => {
                doc.text(header, x, y, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });
            y += 15;
            doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
            y += 5;
        };

        const checkPageBreak = (height) => {
            if (y + height > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                y = doc.y;
                renderHeader();
            }
        };

        renderHeader();
        doc.font('Helvetica').fontSize(9);

        for (const order of orders) {
            const itemsText = order.items.map(i => `${i.productName} (Qty: ${i.quantity})`).join('\n');
            const email = order.user?.email || 'N/A';
            const status = order.orderStatus;

            const rowHeight = Math.max(
                doc.heightOfString(itemsText, { width: colWidths[3] }),
                doc.heightOfString(email, { width: colWidths[1] }),
                doc.heightOfString(status, { width: colWidths[7] }),
                20
            );

            checkPageBreak(rowHeight + 5);

            let x = startX;
            const row = [
                order.orderId,
                email,
                new Date(order.orderDate).toLocaleDateString('en-IN'),
                itemsText,
                `${order.subtotal.toFixed(2)}`,
                `${order.discount.toFixed(2)}`,
                `${order.totalAmount.toFixed(2)}`,
                status
            ];

            row.forEach((text, i) => {
                doc.text(text, x, y, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });

            y += rowHeight + 5;
            doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
            y += 5;
        }

        doc.end();
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).send('Failed to generate PDF');
    }
};



const generateSalesReportExcel = async (req, res) => {
    try {
        const adminId = req.session.admin?.id;
        if (!adminId) {
            return res.status(401).send('Unauthorized');
        }

        const { reportType, startDate, endDate } = req.query;
        const { report, orders } = await getSalesData(reportType, startDate, endDate);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.addRow(['Timzo Sales Report']).getCell(1).font = { size: 16, bold: true };
        worksheet.addRow([`Report Type: ${reportType.toUpperCase()}`]).getCell(1).font = { size: 12 };
        if (startDate && endDate) {
            const row = worksheet.addRow([`Period: ${endDate}`]);
            row.getCell(1).value = `${startDate} to ${endDate}`;
        }
        worksheet.addRow();


        worksheet.addRow(['Summary']).getCell(1).font = { size: 14, bold: true };

        worksheet.addRow(['Total Orders', report.totalOrders]);
        worksheet.addRow(['Total Amount', `₹${report.totalAmount.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `₹${report.totalDiscount.toFixed(2)}`]);
        worksheet.addRow();

        const headerRow = worksheet.addRow(['Order ID', 'User', 'Date', 'Items', 'Subtotal', 'AmountDiscount', 'Total', 'Status']);

        headerRow.font = { bold: true, size: 10 };

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F3F5' }
            };
        });

        headerRow.height = 20;


        orders.forEach((order) => {
            const items = order.items.map(item => `${item.productName} (Qty: ${item.quantity})`).join('; ');
            worksheet.addRow([
                order.orderId,
                order.user ? order.user.email : 'N/A',
                new Date(order.orderDate).toLocaleDateString('en-IN'),
                items,
                `₹${order.subtotal.toFixed(2)}`,
                `₹${order.discount.toFixed(2)}`,
                `₹${order.totalAmount.toFixed(2)}`,
                order.orderStatus,
            ]);
        });

        worksheet.columns.forEach((column, index) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                maxLength = Math.max(maxLength, columnLength);
            });
            column.width = Math.min(maxLength + 40, 2);
        });

        const filename = `Sales_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).send('Failed to generate Excel');
    }
};

module.exports = { generateAdminSalesReport, generateSalesReportPDF, generateSalesReportExcel };