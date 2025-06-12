const Order = require('../../Model/orderSchema');
const Product = require('../../Model/productSchema');
const Category = require('../../Model/categorySchema');
const Brand = require('../../Model/brandschema');
const asyncHandler = require('express-async-handler');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('Created public directory:', publicDir);
}

const loadAdminDashboard = async (req, res) => {
  try {
    let bestSellingProducts = [];
    try {
      bestSellingProducts = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },
        {
          $group: {
            _id: '$items.productId',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: '$product.name',
            image: '$product.image',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
      console.log('Best Selling Products:', bestSellingProducts);
    } catch (err) {
      console.error('Error in Best Selling Products aggregation:', err);
    }

    let bestSellingCategories = [];
    try {
      bestSellingCategories = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$productInfo.category',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        {
          $project: {
            _id: 0,
            name: '$categoryInfo.name',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
      console.log('Best Selling Categories:', bestSellingCategories);
    } catch (err) {
      console.error('Error in Best Selling Categories aggregation:', err);
    }

    let bestSellingBrands = [];
    try {
      bestSellingBrands = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$productInfo.brand',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'brands',
            localField: '_id',
            foreignField: '_id',
            as: 'brandInfo'
          }
        },
        { $unwind: '$brandInfo' },
        {
          $project: {
            _id: 0,
            name: '$brandInfo.name',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
      console.log('Best Selling Brands:', bestSellingBrands);
    } catch (err) {
      console.error('Error in Best Selling Brands aggregation:', err);
    }

    const chartData = {
      daily: { labels: [], values: [] },
      weekly: { labels: [], values: [] },
      monthly: { labels: [], values: [] },
      yearly: { labels: [], values: [] }
    };

    try {
      const dailySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.daily.labels = dailySales.map(sale => sale._id);
      chartData.daily.values = dailySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Daily Sales aggregation:', err);
    }

    try {
      const weeklySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $isoWeek: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.weekly.labels = weeklySales.map((sale, index) => `Week ${index + 1}`);
      chartData.weekly.values = weeklySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Weekly Sales aggregation:', err);
    }

    try {
      const monthlySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $month: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      chartData.monthly.labels = monthlySales.map(sale => monthNames[sale._id - 1]);
      chartData.monthly.values = monthlySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Monthly Sales aggregation:', err);
    }

    try {
      const yearlySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $year: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.yearly.labels = yearlySales.map(sale => sale._id.toString());
      chartData.yearly.values = yearlySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Yearly Sales aggregation:', err);
    }

    console.log('Data passed to template:', {
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
      chartData
    });

    res.render('admin/admindashbord', {
      activePage : 'dashboard',
      bestSellingProducts: bestSellingProducts || [],
      bestSellingCategories: bestSellingCategories || [],
      bestSellingBrands: bestSellingBrands || [],
      chartData
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('Admin/error', {
      message: 'An error occurred while loading the dashboard.'
    });
  }
};

const generateLedgerReport = async (req, res) => {
  try {
    let bestSellingProducts = [];
    try {
      bestSellingProducts = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },
        {
          $group: {
            _id: '$items.productId',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            _id: 0,
            name: '$product.name',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
    } catch (err) {
      console.error('Error in Best Selling Products aggregation:', err);
    }

    let bestSellingCategories = [];
    try {
      bestSellingCategories = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$productInfo.category',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        {
          $project: {
            _id: 0,
            name: '$categoryInfo.name',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
    } catch (err) {
      console.error('Error in Best Selling Categories aggregation:', err);
    }

    let bestSellingBrands = [];
    try {
      bestSellingBrands = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $ne: 'Cancelled' } } },  
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$productInfo.brand',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        {
          $lookup: {
            from: 'brands',
            localField: '_id',
            foreignField: '_id',
            as: 'brandInfo'
          }
        },
        { $unwind: '$brandInfo' },
        {
          $project: {
            _id: 0,
            name: '$brandInfo.name',
            totalSold: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);
    } catch (err) {
      console.error('Error in Best Selling Brands aggregation:', err);
    }

    const chartData = {
      daily: { labels: [], values: [] },
      weekly: { labels: [], values: [] },
      monthly: { labels: [], values: [] },
      yearly: { labels: [], values: [] }
    };

    let totalOrders = 0;
    let totalRevenue = 0;
    try {
      const orders = await Order.find({ orderStatus: 'Delivered' });
      totalOrders = orders.length;
      totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    } catch (err) {
      console.error('Error calculating total orders and revenue:', err);
    }

    try {
      const dailySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.daily.labels = dailySales.map(sale => sale._id);
      chartData.daily.values = dailySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Daily Sales aggregation:', err);
    }

    try {
      const weeklySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $isoWeek: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.weekly.labels = weeklySales.map((sale, index) => `Week ${index + 1}`);
      chartData.weekly.values = weeklySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Weekly Sales aggregation:', err);
    }

    try {
      const monthlySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $month: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      chartData.monthly.labels = monthlySales.map(sale => monthNames[sale._id - 1]);
      chartData.monthly.values = monthlySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Monthly Sales aggregation:', err);
    }

    try {
      const yearlySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            orderDate: { $gte: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $year: '$orderDate' },
            total: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      chartData.yearly.labels = yearlySales.map(sale => sale._id.toString());
      chartData.yearly.values = yearlySales.map(sale => sale.total);
    } catch (err) {
      console.error('Error in Yearly Sales aggregation:', err);
    }

    const reportData = {
      totalOrders,
      totalRevenue,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
      chartData
    };

    const doc = new PDFDocument({ margin: 40 });
    const filePath = path.join(__dirname, '../../public/timzo-ledger-report.pdf');
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    let currentPage = 1;

    const addSectionHeader = (title) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        currentPage++;
        addHeader();
      }
      doc.fontSize(16).font('Helvetica-Bold').text(title, 40, doc.y, { underline: true });
      doc.moveDown(1);
    };

    const addTable = (headers, rows, columnWidths) => {
      const table = {
        x: 40,
        y: doc.y,
        columnWidths: columnWidths,
        rowHeight: 25,
        headerHeight: 30
      };
      const tableWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);

      const drawTableHeaders = (y) => {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(table.x, y, tableWidth, table.headerHeight).fill('#f0f0f0').stroke();
        doc.fillColor('#000000');

        let xPos = table.x;
        headers.forEach((header, index) => {
          const width = columnWidths[Object.keys(columnWidths)[index]] - 10;
          const align = header.includes('₹') || header.includes('Sold') ? 'right' : 'left';
          doc.text(header, xPos + 5, y + 10, { width, align });
          xPos += columnWidths[Object.keys(columnWidths)[index]];
        });

        doc.fontSize(10).text(`Page ${currentPage}`, doc.page.width - 100, 20, { align: 'right' });
      };

      drawTableHeaders(table.y);
      table.y += table.headerHeight;

      doc.font('Helvetica').fontSize(10);
      rows.forEach((row, rowIndex) => {
        if (table.y + table.rowHeight > doc.page.height - 50) {
          doc.addPage();
          currentPage++;
          table.y = 40;
          addHeader();
          drawTableHeaders(table.y);
          table.y += table.headerHeight;
        }

        doc.rect(table.x, table.y, tableWidth, table.rowHeight)
          .fill(rowIndex % 2 === 0 ? '#f9f9f9' : '#ffffff')
          .stroke();

        let xPos = table.x;
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key].toString();
          const width = columnWidths[key] - 10;
          const align = key.includes('totalSold') || key.includes('value') ? 'right' : 'left';
          doc.fillColor('#000000');
          doc.text(value, xPos + 5, table.y + 5, { width, align });
          xPos += columnWidths[key];
        });

        table.y += table.rowHeight;
      });

      doc.moveDown(1);
    };

    const addHeader = () => {
      doc.fontSize(20).font('Helvetica-Bold').text('Timzo - Ledger Report', 40, 30, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(
        `Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        40,
        55,
        { align: 'center' }
      );
      doc.moveDown(2);
    };

    addHeader();

    addSectionHeader('Total Sales Summary');
    doc.font('Helvetica').fontSize(12);
    doc.text(`Total Orders: ${reportData.totalOrders}`, 40, doc.y);
    doc.text(`Total Revenue: ₹${reportData.totalRevenue.toFixed(2)}`, 40, doc.y + 15);
    doc.moveDown(2);

    addSectionHeader('Best-Selling Products');
    const productHeaders = ['Product Name', 'Quantity Sold'];
    const productRows = reportData.bestSellingProducts.map(product => ({
      name: product.name,
      totalSold: product.totalSold
    }));
    const productColumnWidths = { name: 400, totalSold: 110 };
    addTable(productHeaders, productRows, productColumnWidths);

    addSectionHeader('Best-Selling Categories');
    const categoryHeaders = ['Category Name', 'Quantity Sold'];
    const categoryRows = reportData.bestSellingCategories.map(category => ({
      name: category.name,
      totalSold: category.totalSold
    }));
    const categoryColumnWidths = { name: 400, totalSold: 110 };
    addTable(categoryHeaders, categoryRows, categoryColumnWidths);

    addSectionHeader('Best-Selling Brands');
    const brandHeaders = ['Brand Name', 'Quantity Sold'];
    const brandRows = reportData.bestSellingBrands.map(brand => ({
      name: brand.name,
      totalSold: product.totalSold
    }));
    const brandColumnWidths = { name: 400, totalSold: 110 };
    addTable(brandHeaders, brandRows, brandColumnWidths);

    addSectionHeader('Sales Data');
    
    doc.fontSize(14).font('Helvetica-Bold').text('Daily Sales', 40, doc.y);
    const dailyHeaders = ['Date', 'Sales (₹)'];
    const dailyRows = reportData.chartData.daily.labels.map((label, index) => ({
      label: label,
      value: reportData.chartData.daily.values[index]?.toFixed(2) || '0.00'
    }));
    const dailyColumnWidths = { label: 255, value: 255 };
    addTable(dailyHeaders, dailyRows, dailyColumnWidths);

    doc.fontSize(14).font('Helvetica-Bold').text('Weekly Sales', 40, doc.y);
    const weeklyHeaders = ['Week', 'Sales (₹)'];
    const weeklyRows = reportData.chartData.weekly.labels.map((label, index) => ({
      label: label,
      value: reportData.chartData.weekly.values[index]?.toFixed(2) || '0.00'
    }));
    const weeklyColumnWidths = { label: 255, value: 255 };
    addTable(weeklyHeaders, weeklyRows, weeklyColumnWidths);

    doc.fontSize(14).font('Helvetica-Bold').text('Monthly Sales', 40, doc.y);
    const monthlyHeaders = ['Month', 'Sales (₹)'];
    const monthlyRows = reportData.chartData.monthly.labels.map((label, index) => ({
      label: label,
      value: reportData.chartData.monthly.values[index]?.toFixed(2) || '0.00'
    }));
    const monthlyColumnWidths = { label: 255, value: 255 };
    addTable(monthlyHeaders, monthlyRows, monthlyColumnWidths);

    doc.fontSize(14).font('Helvetica-Bold').text('Yearly Sales', 40, doc.y);
    const yearlyHeaders = ['Year', 'Sales (₹)'];
    const yearlyRows = reportData.chartData.yearly.labels.map((label, index) => ({
      label: label,
      value: reportData.chartData.yearly.values[index]?.toFixed(2) || '0.00'
    }));
    const yearlyColumnWidths = { label: 255, value: 255 };
    addTable(yearlyHeaders, yearlyRows, yearlyColumnWidths);

    doc.end();

    writeStream.on('finish', () => {
      res.json({
        success: true,
        pdfUrl: '/timzo-ledger-report.pdf'
      });
    });

    writeStream.on('error', (err) => {
      console.error('Error writing PDF file:', err);
      res.status(500).json({
        success: false,
        message: 'Error generating the ledger report PDF: ' + err.message
      });
    });

  } catch (error) {
    console.error('Error generating ledger report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating ledger report: ' + error.message
    });
  }
};

const generateLedger = async (req, res) => {
  try {
    const orders = await Order.find({ orderStatus: 'Delivered' })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category' },
          { path: 'brand' }
        ]
      })
      .populate('user')
      .sort({ orderDate: 1 });

    if (!orders || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No delivered orders found to generate the ledger.'
      });
    }

    const doc = new PDFDocument({ margin: 40 });
    const filePath = path.join(__dirname, '../../public/ledger-book.pdf');
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    let currentPage = 1;

    const addHeader = () => {
      doc.fontSize(20).font('Helvetica-Bold').text('Timzo - Sales Ledger', 40, 30, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(
        `Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        40,
        55,
        { align: 'center' }
      );
      doc.fontSize(10).text(`Page ${currentPage}`, doc.page.width - 100, 20, { align: 'right' });
      doc.moveDown(2);
    };

    addHeader();

    const table = {
      x: 40,
      y: doc.y,
      columnWidths: {
        orderDate: 80,
        orderId: 80,
        customer: 100,
        product: 120,
        quantity: 60,
        price: 60,
        total: 60
      },
      rowHeight: 30,
      headerHeight: 40
    };
    const tableWidth = Object.values(table.columnWidths).reduce((a, b) => a + b, 0);

    const drawTableHeaders = (y) => {
      doc.fontSize(10).font('Helvetica-Bold');
      doc.rect(table.x, y, tableWidth, table.headerHeight).fill('#f0f0f0').stroke();
      doc.fillColor('#000000');

      let xPos = table.x;
      doc.text('Order Date', xPos + 5, y + 10, { width: table.columnWidths.orderDate - 10, align: 'left' });
      xPos += table.columnWidths.orderDate;
      doc.text('Order ID', xPos + 5, y + 10, { width: table.columnWidths.orderId - 10, align: 'left' });
      xPos += table.columnWidths.orderId;
      doc.text('Customer', xPos + 5, y + 10, { width: table.columnWidths.customer - 10, align: 'left' });
      xPos += table.columnWidths.customer;
      doc.text('Product', xPos + 5, y + 10, { width: table.columnWidths.product - 10, align: 'left' });
      xPos += table.columnWidths.product;
      doc.text('Qty', xPos + 5, y + 10, { width: table.columnWidths.quantity - 10, align: 'right' });
      xPos += table.columnWidths.quantity;
      doc.text('Price (₹)', xPos + 5, y + 10, { width: table.columnWidths.price - 10, align: 'right' });
      xPos += table.columnWidths.price;
      doc.text('Total (₹)', xPos + 5, y + 10, { width: table.columnWidths.total - 10, align: 'right' });

      doc.fontSize(10).text(`Page ${currentPage}`, doc.page.width - 100, 20, { align: 'right' });
    };

    drawTableHeaders(table.y);
    table.y += table.headerHeight;

    doc.font('Helvetica').fontSize(10);
    let totalRevenue = 0;
    let itemCount = 0;

    orders.forEach((order, orderIndex) => {
      order.items.forEach((item, itemIndex) => {
        if (item.status === 'Cancelled') return;
        itemCount++;
        const itemTotal = item.quantity * item.price;
        totalRevenue += itemTotal;

        if (table.y + table.rowHeight > doc.page.height - 50) {
          doc.addPage();
          currentPage++;
          table.y = 40;
          addHeader();
          drawTableHeaders(table.y);
          table.y += table.headerHeight;
        }

        doc.rect(table.x, table.y, tableWidth, table.rowHeight)
          .fill(itemCount % 2 === 0 ? '#f9f9f9' : '#ffffff')
          .stroke();

        let xPos = table.x;
        doc.fillColor('#000000');
        doc.text(order.orderDate.toLocaleDateString('en-IN'), xPos + 5, table.y + 5, {
          width: table.columnWidths.orderDate - 10,
          align: 'left'
        });
        xPos += table.columnWidths.orderDate;
        doc.text(order.orderId, xPos + 5, table.y + 5, {
          width: table.columnWidths.orderId - 10,
          align: 'left'
        });
        xPos += table.columnWidths.orderId;
        doc.text(order.user ? order.user.fullname || 'N/A' : 'N/A', xPos + 5, table.y + 5, {
          width: table.columnWidths.customer - 10,
          align: 'left'
        });
        xPos += table.columnWidths.customer;
        doc.text(item.productName || 'N/A', xPos + 5, table.y + 5, {
          width: table.columnWidths.product - 10,
          align: 'left'
        });
        xPos += table.columnWidths.product;
        doc.text(item.quantity.toString(), xPos + 5, table.y + 5, {
          width: table.columnWidths.quantity - 10,
          align: 'right'
        });
        xPos += table.columnWidths.quantity;
        doc.text(item.price.toFixed(2), xPos + 5, table.y + 5, {
          width: table.columnWidths.price - 10,
          align: 'right'
        });
        xPos += table.columnWidths.price;
        doc.text(itemTotal.toFixed(2), xPos + 5, table.y + 5, {
          width: table.columnWidths.total - 10,
          align: 'right'
        });

        table.y += table.rowHeight;
      });
    });

    doc.moveDown(2);
    if (table.y + 50 > doc.page.height - 50) {
      doc.addPage();
      currentPage++;
      table.y = 40;
      addHeader();
      drawTableHeaders(table.y);
      table.y += table.headerHeight;
    }
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Summary`, table.x, table.y);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total Orders: ${orders.length}`, table.x, table.y + 15);
    doc.text(`Total Items Sold: ${itemCount}`, table.x, table.y + 30);
    doc.text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, table.x, table.y + 45);

    doc.end();

    writeStream.on('finish', () => {
      res.json({
        success: true,
        pdfUrl: '/ledger-book.pdf'
      });
    });

    writeStream.on('error', (err) => {
      console.error('Error writing PDF file:', err);
      res.status(500).json({
        success: false,
        message: 'Error generating the ledger PDF: ' + err.message
      });
    });

  } catch (error) {
    console.error('Error generating ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating ledger: ' + error.message
    });
  }
};

module.exports = { loadAdminDashboard, generateLedger, generateLedgerReport };