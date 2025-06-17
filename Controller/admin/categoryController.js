const Category = require('../../Model/categorySchema');
const mongoose = require('mongoose');
const Product = require('../../Model/productSchema');

const loadcategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const showDeleted = req.query.showDeleted === 'true';

        const query = {};
        query.isDeleted = showDeleted;

        let categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalcategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalcategories / limit);

        const stock = await Product.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: '$category', totalstock: { $sum: '$stock' } } }
        ]);

        const stockMap = {};
        stock.forEach(item => {
            stockMap[item._id.toString()] = item.totalstock;
        });

        const categoriesWithStock = categories.map(category => {
            return {
                ...category.toObject(),
                stock: stockMap[category._id.toString()] || 0
            };
        });

        res.render('Admin/categories', {
            categories: categoriesWithStock,
            currentpage: page,
            totalPage: totalPages,
            totalcategories: totalcategories,
            showDeleted,
        });

    } catch (error) {
        console.log(error);
        res.redirect('/error404');
    }
};

const loadaddcategory = async (req, res) => {
    try {
        const itemsPerPage = 5;
        const page = parseInt(req.query.page) || 1;

        const totalItems = await Category.countDocuments({ isDeleted: false });
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const categories = await Category.find({ isDeleted: false })
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        res.render('Admin/addCategory', {
            search:req.query.search || '',
            categories,
            currentPage: page,
            totalPages,
            errorMessage: null
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const addcategory = async (req, res) => {
    let { name, description } = req.body;

    try {
        name = name.trim();
        const existingCategory = await Category.find({
            name: { $regex: `^${name}$`, $options: 'i' },
            isDeleted: false
        });

        if (existingCategory.length > 0) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name,
            description,
            isDeleted: false
        });

        await newCategory.save();
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const addcategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        console.log(req.body)
        const categoryId = req.body.categoryId;

        const category = await Category.findById(categoryId);
        if (!category || category.isDeleted) {
            return res.status(404).json({ status: false, message: "Category not found or has been deleted" });
        }

        const products = await Product.find({ category: category._id });

        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        let updatedCount = 0;

        for (const product of products) {
            if (product.ProductOffer === 0 || product.ProductOffer < percentage) {
                product.ProductOffer = percentage;
                product.salePrice = Math.floor(product.regularPrice * (1 - (percentage / 100)));
                await product.save();
                updatedCount++;
            }
        }

        res.json({
            status: true,
            message: `Category offer applied to ${updatedCount} product(s). Skipped products with higher existing offers.`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

const removecategoryoffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        console.log('Received categoryId:', categoryId);

        if (!categoryId) {
            return res.status(400).json({ status: false, message: "Category ID is required" });
        }

        const category = await Category.findById(categoryId);
        console.log('Found category:', category);

        if (!category || category.isDeleted) {
            return res.status(404).json({ status: false, message: "Category not found or has been deleted" });
        }

        if (!category.categoryOffer || category.categoryOffer === 0) {
            return res.status(400).json({ status: false, message: "No offer to remove for this category" });
        }

        const products = await Product.find({ category: category._id });
        console.log('Found products:', products.length);

        if (products.length > 0) {
            const updatedProducts = await Promise.all(
                products.map(async (product) => {
                    console.log(`Updating product ${product._id}: salePrice from ${product.salePrice} to ${product.regularPrice}`);
                    product.salePrice = product.regularPrice;
                    product.ProductOffer = 0;
                    await product.save();
                    return product;
                })
            );
            console.log('Updated products:', updatedProducts.length);
        }

        const updateResult = await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: 0 } }
        );
        console.log('Category update result:', updateResult);

        const updatedCategory = await Category.findById(categoryId);
        console.log('Updated category:', updatedCategory);

        if (updatedCategory.categoryOffer !== 0) {
            return res.status(500).json({ status: false, message: "Failed to remove category offer" });
        }

        res.json({ status: true, message: "Category offer removed successfully" });
    } catch (error) {
        console.error('Error in removecategoryoffer:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

const getlistcategory = async (req, res) => {
    try {
        let id = req.query.id;
        const category = await Category.findById(id);
        if (!category || category.isDeleted) {
            return res.status(404).json({ success: false, message: "Category not found or has been deleted" });
        }
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

const getunlistcategory = async (req, res) => {
    try {
        let id = req.query.id;
        const category = await Category.findById(id);
        if (!category || category.isDeleted) {
            return res.status(404).json({ success: false, message: "Category not found or has been deleted" });
        }
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

const softDeleteCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.isDeleted = true;
        category.deletedAt = new Date();
        await category.save();

        res.status(200).json({ success: true, message: 'Category soft-deleted successfully' });
    } catch (error) {
        console.error('Error soft-deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to soft-delete category' });
    }
};

const undoDeleteCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.isDeleted = false;
        category.deletedAt = null;
        await category.save();

        res.status(200).json({ success: true, message: 'Category restored successfully' });
    } catch (error) {
        console.error('Error restoring category:', error);
        res.status(500).json({ success: false, message: 'Failed to restore category' });
    }
};

const permanentlyDeleteCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        if (!category.isDeleted) {
            return res.status(400).json({ success: false, message: 'Category must be soft-deleted before permanent deletion' });
        }

        const products = await Product.find({ category: category._id });
        if (products.length > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete category with associated products' });
        }

        await Category.findByIdAndDelete(categoryId);

        res.status(200).json({ success: true, message: 'Category permanently deleted' });
    } catch (error) {
        console.error('Error permanently deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to permanently delete category' });
    }
};
const loadeditcategory = async (req, res) => {
    try {
        const id = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Find the specific category to edit
        const category = await Category.findById(id);
        
        if (!category) {
            return res.redirect('/error404');
        }

        // Query for category list
        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalcategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalcategories / limit);

        res.render("Admin/editcategory", {
            category, // Pass the specific category for prefilling
            categories,
            currentPage: page,
            totalPages,
            search,
            error: null,
            admin: req.session.admin // Assuming admin data is stored in session
        });
    } catch (error) {
        console.error(error);
        res.render('error404');
    }
};
const editcategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;

        console.log('hey',req.body)

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid category ID" });
        }

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: "Category name is required" });
        }

        const trimmedName = name.trim();

        const category = await Category.findById(id);
        if (!category || category.isDeleted) {
            return res.status(404).json({ error: "Category not found or has been deleted" });
        }

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            isDeleted: false,
            _id: { $ne: category._id }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category name already exists, please choose another one" });
        }

        category.name = trimmedName;
        category.description = description?.trim() || "";
        await category.save();

        return res.status(200).json({ message: "Category updated successfully" });

    } catch (error) {
        console.error('🔴 Internal Server Error:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


module.exports = {
    loadcategories,
    loadaddcategory,
    addcategory,
    addcategoryOffer,
    removecategoryoffer,
    getlistcategory,
    getunlistcategory,
    loadeditcategory,
    editcategory,
    softDeleteCategory,
    undoDeleteCategory,
    permanentlyDeleteCategory
}; 