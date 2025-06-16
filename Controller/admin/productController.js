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
        const admin = req.session.admin
        res.render('Admin/addProduct', {
            admin,
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
        const {
            productName,
            description,
            brand,
            category,
            regularPrice,
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

        const trimmedProductName = productName.trim();

        const existingProduct = await Product.find({
            name: { $regex: `^${trimmedProductName}$`, $options: 'i' },
            isDeleted: false
        });

        if (existingProduct.length > 0) {
            const categories = await Category.find({ isListed: true });
            const brands = await Brand.find({ isListed: true });
            return res.render('Admin/addProduct', {
                cat: categories,
                brand: brands,
                error: 'Watch with this name already exists',
                formData: req.body
            });
        }


        if (
            !productName ||
            !description ||
            !brand ||
            !category ||
            !regularPrice ||
            !stock ||
            !color ||
            !movementType
        ) {
            throw new Error('All required fields must be provided');
        }

        const parsedRegularPrice = parseFloat(regularPrice);
        const parsedStock = parseInt(stock);

        if (isNaN(parsedRegularPrice) || isNaN(parsedStock)) {
            throw new Error('Regular price and Stock must be valid numbers');
        }

        const categoryExists = await Category.findById(category);
        const brandExists = await Brand.findById(brand);
        if (!categoryExists || !brandExists) {
            throw new Error('Invalid category or brand');
        }

        if (!req.files || req.files.length === 0) {
            throw new Error('At least one image is required');
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

        for (const file of req.files) {
            if (!allowedTypes.includes(file.mimetype)) {
                throw new Error('Only JPG, JPEG, and PNG image formats are allowed');
            }
        }


        const imageUrls = req.files.map(file => file.path);

        const salePrice = parsedRegularPrice;

        const newProduct = new Product({
            name: productName,
            description,
            brand,
            category,
            regularPrice: parsedRegularPrice,
            salePrice: salePrice,
            stock: parsedStock,
            color,
            material: material || '',
            waterResistance: waterResistance || 'Not specified',
            warranty: warranty || '',
            movementType,
            images: imageUrls,
            status: 'available',
            isDeleted: false,
            isListed: true,
            ProductOffer: 0
        });

        await newProduct.save();
        console.log('✅ Product saved successfully:', productName);
        res.redirect('/admin/getProduct');

    } catch (error) {
        console.error('❌ Error adding product:', error.message);
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
        const search = req.query.query ? req.query.query.trim() : '';
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const showDeleted = req.query.showDeleted === 'true';

        if (page < 1) {
            return res.status(400).render('Admin/error404', { error: 'Invalid page number' });
        }

        const brandIds = await Brand.find({
            name: { $regex: new RegExp(search, 'i') }
        }).select('_id');

        const query = {
            $or: [
                { name: { $regex: new RegExp(search, 'i') } },
                { brand: { $in: brandIds.map(id => id._id) } }
            ],
            isDeleted: showDeleted
        };

        const productData = await Product.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .populate('brand')
            .exec();

        const count = await Product.countDocuments(query);

        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });

        if (!categories || !brands) {
            return res.status(500).render('Admin/error404', { error: 'Failed to load categories or brands' });
        }
        const admin = req.session.admin;

        res.status(200).render('Admin/products', {
            admin,
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: categories,
            brand: brands,
            search,
            showDeleted
        });
    } catch (error) {
        console.error('Error listing products:', error);
        res.status(500).render('Admin/error404', { error: 'An error occurred while loading products' });
    }
};


const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        const product = await Product.findById(productId);

        if (!product || product.isDeleted) {
            return res.status(404).json({ status: false, message: "Product not found or has been deleted" });
        }

        const category = await Category.findById(product.category);
        if (category && category.categoryOffer > percentage) {
            return res.json({ status: false, message: "Category offer is higher than the product offer" });
        }

        product.ProductOffer = parseInt(percentage);
        product.salePrice = Math.floor(product.regularPrice * (1 - (percentage / 100)));
        await product.save();

        res.json({ status: true, message: "Product offer applied successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        const product = await Product.findById(productId);

        if (!product || product.isDeleted) {
            return res.status(404).json({ status: false, message: "Product not found or has been deleted" });
        }

        const category = await Category.findById(product.category);
        const categoryOffer = category ? category.categoryOffer : 0;

        product.ProductOffer = 0;
        product.salePrice = Math.floor(product.regularPrice * (1 - (categoryOffer / 100)));
        await product.save();

        res.json({ status: true, message: "Product offer removed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

const blockProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: 'Product not found or has been deleted' });
        }

        product.isListed = false;
        await product.save();

        res.status(200).json({ success: true, message: 'Product blocked successfully' });
    } catch (error) {
        console.error('Error blocking product:', error);
        res.status(500).json({ success: false, message: 'Failed to block product' });
    }
};

const unblockProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: 'Product not found or has been deleted' });
        }

        product.isListed = true;
        await product.save();

        res.status(200).json({ success: true, message: 'Product unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking product:', error);
        res.status(500).json({ success: false, message: 'Failed to unblock product' });
    }
};

const softDeleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        product.isDeleted = true;
        product.deletedAt = new Date();
        await product.save();

        res.status(200).json({ success: true, message: 'Product soft-deleted successfully' });
    } catch (error) {
        console.error('Error soft-deleting product:', error);
        res.status(500).json({ success: false, message: 'Failed to soft-delete product' });
    }
};

const undoDeleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        product.isDeleted = false;
        product.deletedAt = null;
        await product.save();

        res.status(200).json({ success: true, message: 'Product restored successfully' });
    } catch (error) {
        console.error('Error restoring product:', error);
        res.status(500).json({ success: false, message: 'Failed to restore product' });
    }
};

const permanentlyDeleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (!product.isDeleted) {
            return res.status(400).json({ success: false, message: 'Product must be soft-deleted before permanent deletion' });
        }

        await Product.findByIdAndDelete(productId);

        res.status(200).json({ success: true, message: 'Product permanently deleted' });
    } catch (error) {
        console.error('Error permanently deleting product:', error);
        res.status(500).json({ success: false, message: 'Failed to permanently delete product' });
    }
};

const loadEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').populate('brand');
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });
        const admin = req.session.admin
        if (!product || product.isDeleted) {
            return res.redirect('/admin/error404');
        }

        res.render('Admin/editProduct', {
            admin,
            product,
            cat: categories,
            brand: brands,
            error: null
        });
    } catch (error) {
        console.error('Error loading edit product page:', error);
        res.redirect('/admin/error404');
    }
};

const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
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

        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            const categories = await Category.find({ isListed: true });
            const brands = await Brand.find({ isListed: true });
            return res.render('Admin/editProduct', {
                product,
                cat: categories,
                brand: brands,
                error: 'Product not found or has been deleted'
            });
        }

        const trimmedProductName = productName.trim();

        const existingProduct = await Product.findOne({
            name: { $regex: `^${trimmedProductName}$`, $options: 'i' },
            _id: { $ne: productId }
        });

        if (existingProduct) {
            const categories = await Category.find({ isListed: true });
            const brands = await Brand.find({ isListed: true });
            return res.render('Admin/editProduct', {
                product,
                cat: categories,
                brand: brands,
                error: 'Watch with this name already exists'
            });
        }

        const categoryExists = await Category.findById(category);
        const brandExists = await Brand.findById(brand);
        if (!categoryExists || !brandExists) {
            throw new Error('Invalid category or brand');
        }

        let imageUrls = product.images;
        if (req.files && req.files.length > 0) {
            imageUrls = [];
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                imageUrls.push(file.path);
            }
        }

        product.name = productName;
        product.description = description;
        product.brand = brand;
        product.category = category;
        product.regularPrice = parseFloat(regularPrice);
        product.salePrice = parseFloat(salePrice);
        product.stock = parseInt(stock);
        product.color = color;
        product.material = material || '';
        product.waterResistance = waterResistance;
        product.warranty = warranty;
        product.movementType = movementType;
        product.images = imageUrls;



        const categoryData = await Category.findById(category);
        const categoryOffer = categoryData ? categoryData.categoryOffer : 0;

        if (!product.ProductOffer || product.ProductOffer < categoryOffer) {
            product.ProductOffer = categoryOffer;
            product.salePrice = Math.floor(product.regularPrice * (1 - (categoryOffer / 100)));
        } else {
            product.salePrice = Math.floor(product.regularPrice * (1 - (product.ProductOffer / 100)));
        }


        await product.save();
        res.redirect('/admin/getProduct');
    } catch (error) {
        console.error('Error editing product:', error);
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').populate('brand');
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });
        res.render('Admin/editProduct', {
            product,
            cat: categories,
            brand: brands,
            error: error.message
        });
    }
};

module.exports = {
    loadProducts,
    addProducts,
    getProduct,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    softDeleteProduct,
    undoDeleteProduct,
    permanentlyDeleteProduct,
    loadEditProduct,
    editProduct
};