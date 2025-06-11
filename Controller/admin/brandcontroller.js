const Brand = require("../../Model/brandschema");
const Product = require("../../Model/productSchema");

// Get all brands with pagination
const getBrands = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const [brands, totalBrands] = await Promise.all([
            Brand.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Brand.countDocuments()
        ]);

        const totalPages = Math.ceil(totalBrands / limit);
        const admin = req.session.admin;

        res.render("Admin/brand", {
            admin,
            data: brands.reverse(), // Reverse for display if needed
            currentPage: page,
            totalPages,
            totalBrands,
            messages: req.flash()
        });

    } catch (error) {
        console.error("Error fetching brands:", error);
        req.flash('error', 'Failed to load brands');
        res.redirect('/admin/dashboard');
    }
};

// Add new brand
const addBrand = async (req, res) => {
    try {
        const { name } = req.body;
        const image = req.file;

        // Validation
        if (!name?.trim()) {
            req.flash('error', 'Brand name is required');
            return res.redirect("/admin/brand");
        }

        if (!image) {
            req.flash('error', 'Brand image is required');
            return res.redirect("/admin/brand");
        }

        // Check for existing brand (case-insensitive)
const trimmedName = name.trim();

const existingBrand = await Brand.findOne({ 
    name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } 
});

if (existingBrand) {
    req.flash('error', 'Brand already exists');
    return res.redirect("/admin/brand");
}


        // Create new brand
        const newBrand = new Brand({
            name: name.trim(),
            image: image.path
        });

        await newBrand.save();

        req.flash('success', 'Brand added successfully');
        res.redirect("/admin/brand");

    } catch (error) {
        console.error("Error adding brand:", error);
        req.flash('error', 'Failed to add brand');
        res.redirect("/admin/brand");
    }
};

// Toggle brand status
const toggleBrandStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.query; // ✅ fixed here

        if (!id || !['block', 'unblock'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid brand ID or action' 
            });
        }

        const isListed = action === 'unblock';
        await Brand.findByIdAndUpdate(id, { isListed });

        // Optional: Update related products
        await Product.updateMany({ brand: id }, { isListed });

        res.status(200).json({ success: true });

    } catch (error) {
        console.error(`Error toggling brand status:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};


// Delete brand
const deleteBrand = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Brand ID is required' 
            });
        }

        // Check if brand has associated products
        const productsCount = await Product.countDocuments({ brand: id });
        
        if (productsCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete brand with associated products'
            });
        }

        await Brand.findByIdAndDelete(id);

        res.status(200).json({ success: true });

    } catch (error) {
        console.error("Error deleting brand:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

module.exports = {
    getBrands,
    addBrand,
    toggleBrandStatus,
    deleteBrand
};