const Product = require('../../Model/productSchema');
const Brand = require('../../Model/brandschema');
const Category = require('../../Model/categorySchema');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads/products');
if (!fs.existsSync(uploadDir)) {
    console.log('Creating upload directory:', uploadDir);
    fs.mkdirSync(uploadDir, { recursive: true });
}

const tempUploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempUploadDir)) {
    console.log('Creating temp upload directory:', tempUploadDir);
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

const loadProducts = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });

        res.render('Admin/addProduct', {
            cat: categories,
            brand: brands,
            error: null,
            formData: {}
        });
    } catch (error) {
        console.error('Error loading products page:', error);
        res.redirect('/admin/error404');
    }
};

const addProducts = async (req, res) => {
    try {
        console.log('Received addProducts request');
        console.log('Request body:', req.body);
        console.log('Uploaded files:', req.files);

        const {
            productName,
            description,
            brand,
            category,
            regularPrice,
            salePrice,
            stock,
            color,
            material,
            waterResistance,
            warranty,
            movementType,
            cropData1,
            cropData2,
            cropData3,
            cropData4
        } = req.body;

        const cropDataArray = [cropData1, cropData2, cropData3, cropData4].map(data => {
            try {
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.log('Invalid crop data:', data);
                return null;
            }
        });

        const existingProduct = await Product.findOne({ name: productName });
        if (existingProduct) {
            console.log('Product already exists:', productName);
            const categories = await Category.find({ isListed: true });
            const brands = await Brand.find({ isListed: true });
            return res.render('Admin/addProduct', {
                cat: categories,
                brand: brands,
                error: 'Watch with this name already exists',
                formData: req.body
            });
        }

        if (!productName || !description || !brand || !category || !regularPrice || !salePrice || !stock || !color || !movementType) {
            console.log('Missing required fields');
            throw new Error('All required fields must be provided');
        }

        const categoryExists = await Category.findById(category);
        const brandExists = await Brand.findById(brand);
        if (!categoryExists || !brandExists) {
            console.log('Invalid category or brand');
            throw new Error('Invalid category or brand');
        }

        if (!req.files || req.files.length === 0) {
            console.log('No images uploaded');
            throw new Error('At least one image is required');
        }

        const croppedImages = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const cropData = cropDataArray[i];
            console.log(`Processing file ${i + 1}:`, file.originalname);
            console.log('Temporary file path:', file.path);
            console.log('Crop data:', cropData);

            const timestamp = new Date().getTime();
            const fileName = `timzo-watch-${timestamp}-${path.basename(file.originalname, path.extname(file.originalname))}.jpg`;
            const outputPath = path.join(uploadDir, fileName);

            try {
                let sharpInstance = sharp(file.path);

                // Get original image dimensions
                const metadata = await sharpInstance.metadata();
                console.log('Original image dimensions:', metadata.width, 'x', metadata.height);

                // Calculate scaling factor (based on canvas size in frontend)
                const canvasWidth = 300; // As set in frontend
                const canvasHeight = 200; // As set in frontend
                const scaleX = metadata.width / canvasWidth;
                const scaleY = metadata.height / canvasHeight;

                // Apply crop if coordinates are provided
                if (cropData) {
                    const cropX = Math.round(cropData.x * scaleX);
                    const cropY = Math.round(cropData.y * scaleY);
                    const cropWidth = Math.round(cropData.width * scaleX);
                    const cropHeight = Math.round(cropData.height * scaleY);

                    console.log('Applying crop:', { cropX, cropY, cropWidth, cropHeight });

                    sharpInstance = sharpInstance.extract({
                        left: cropX,
                        top: cropY,
                        width: cropWidth,
                        height: cropHeight
                    });
                }

                // Resize to final dimensions
                await sharpInstance
                    .resize({
                        width: 300,
                        height: 300,
                        fit: 'cover',
                        position: 'center'
                    })
                    .toFormat('jpeg')
                    .jpeg({ quality: 80 })
                    .toFile(outputPath);

                console.log('Image cropped and saved to:', outputPath);

                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log('Deleted temporary file:', file.path);
                } else {
                    console.log('Temporary file not found for deletion:', file.path);
                }

                croppedImages.push(`/uploads/products/${fileName}`);
            } catch (sharpError) {
                console.error('Error processing image with sharp:', sharpError);
                throw new Error(`Failed to process image: ${file.originalname}`);
            }
        }

        const newProduct = new Product({
            name: productName,
            description,
            brand,
            category,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            stock: parseInt(stock),
            color,
            material: material || '',
            waterResistance,
            warranty,
            movementType,
            images: croppedImages,
            status: 'available'
        });

        await newProduct.save();
        console.log('Product saved successfully:', productName);
        res.redirect('/admin/getProduct');
    } catch (error) {
        console.error('Error adding product:', error);
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });
        res.render('Admin/addProduct', {
            cat: categories,
            brand: brands,
            error: error.message,
            formData: req.body
        });
    }
};

const getProduct = async (req, res) => {
    try {
        const search = req.query.search ? req.query.search.trim() : '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        if (page < 1) {
            return res.status(400).render('Admin/error404', { error: 'Invalid page number' });
        }

        const brandIds = await Brand.find({
            name: { $regex: new RegExp('.*' + search + '.*', 'i') }
        }).select('_id');

        const productData = await Product.find({
            $or: [
                { name: { $regex: new RegExp('.*' + search + '.*', 'i') } },
                { brand: { $in: brandIds.map(id => id._id) } }
            ]
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .populate('brand')
            .exec();

        const count = await Product.countDocuments({
            $or: [
                { name: { $regex: new RegExp('.*' + search + '.*', 'i') } },
                { brand: { $in: brandIds.map(id => id._id) } }
            ]
        });

        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });

        if (!categories || !brands) {
            return res.status(500).render('Admin/error404', { error: 'Failed to load categories or brands' });
        }

        res.status(200).render('Admin/products', {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: categories,
            brand: brands,
            search
        });
    } catch (error) {
        console.error('Error listing products:', error);
        res.status(500).render('Admin/error404', { error: 'An error occurred while loading products' });
    }
};

module.exports = {
    loadProducts,
    addProducts,
    getProduct
};