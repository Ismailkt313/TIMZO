const Category =require ('../../Model/categorySchema')

const loadcategories = async (req,res)=>{
    try {

        const page = parseInt(req.query.page)||1
        const limit = 4;
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

const addcategory = async(req,res)=>{
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


module.exports = {
    loadcategories,
    loadaddcategory,
    addcategory,
}