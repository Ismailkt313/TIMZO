const Category =require ('../../Model/categorySchema')
const Product = require('../../Model/productSchema');

const loadcategories = async (req,res)=>{
    try {

        const page = parseInt(req.query.page)||1
        const limit = 10;
        const skip = (page-1)*limit

        let products = await Category.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalcategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalcategories/limit);
        res.render('Admin/categories',{
            categories: products,
            currentpage :page,
            totalPage : totalPages,
            totalcategories : totalcategories
        })
    } catch (error) { 
        console.log(error)
        res.redirect('/error404')
    }
}

const  addcategory = async(req,res)=>{
    const {name , description} = req.body
    try {
        const existingcategory = await Category.find({name})
        if(existingcategory.length > 0){
            return res.status(400).json({error:"catogery already exists"})
        }
        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message:"category added successfully"})

    } catch (error) {
        return res.json({message:'Internal Server error'})
    }
}
const loadaddcategory = async(req,res)=>{
    try {
        const itemsPerPage = 5;
        const page = parseInt(req.query.page) || 1;

        const totalItems = await Category.countDocuments();
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const categories = await Category.find()
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        res.render('Admin/addCategory', {
            categories,
            currentPage: page,
            totalPages,
            errorMessage: null
        });

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
}

const addcategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        const hasProductOffer = products.some(product => product.ProductOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: "Product within the category already has higher product offers" });
        }

        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        for (const product of products) {
            product.ProductOffer = 0;
            product.saleprice = Math.floor(product.regularPrice * (1 - (percentage / 100)));
            await product.save();
        }

        res.json({ status: true, message: "Category offer applied successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};
const removecategoryoffer = async (req, res) => {
    try {
      const { categoryId } = req.body;
  
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ status: false, message: "Category not found" });
      }
  
      const products = await Product.find({ category: category._id });
  
      if (products.length > 0) {
        await Promise.all(
          products.map(product => {
            product.saleprice = product.regularPrice;
            product.ProductOffer = 0;
            return product.save();
          })
        );
      }
  
      category.categoryOffer = 0;
      await category.save();
  
      res.json({ status: true, message: "Category offer removed successfully" });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: 'Internal server error' });
    }
  };
  
const getlistcategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.redirect('/error404');
    }
};



const getunlistcategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.redirect('/error404');
    }
};
    
const loadeditcategory = async (req,res)=>{
    try {
        const id = req.query.id
    const category = await Category.findOne({_id:id})
    res.render("Admin/editcategory",{category:category})
    } catch (error) {
        res.redirect('/error404')
    }
}
const editcategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const existingcategory = await Category.findOne({ name: categoryName });

        if (existingcategory) {
            return res.status(400).json({ error: "Category exists, please choose another one" });
        }

        const updatecategory = await Category.findByIdAndUpdate(
            id,
            {
                name: categoryName,
                description: description,
            },
            { new: true }
        );

        if (updatecategory) {
            res.redirect('/admin/categories'); 
        } else {
            res.status(404).json({ error: "Category not found" });
        }

    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
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
    editcategory
}