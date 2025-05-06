const { parse } = require("dotenv")
const Brand = require("../../Model/brandschema")
const product = require("../../Model/productSchema")


const getbrand = async (req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 5
        const skip = (page-1)*limit
        const branddata = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalbrands = await Brand.countDocuments()
        const totalPages = Math.ceil(totalbrands/limit)
        const revercebrand = branddata.reverse()
        res.render("Admin/brand",{
            data:revercebrand,
            currentPage:page,
            totalPages:totalPages,
            totalbrands:totalbrands
        })
    } catch (error) {
        res.redirect('/error404')

    }
}

const addbrand = async (req, res) => {
    try {
        const brandName = req.body.name;  

        const findBrand = await Brand.findOne({ name: brandName });  

        if (!findBrand) {  
            const imageUrl = req.file.path; 

            const newBrand = new Brand({
                name: brandName,
                image: imageUrl
            });

            await newBrand.save();
            res.redirect("/admin/brand");
        } else {
            res.redirect("/admin/brand"); 
        }
    } catch (error) {
        console.error(error); 
        res.redirect('/error404');
    }
};

const blockBrand = async (req,res)=>{
    try {
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isListed:false}})
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const unblockBrand = async (req,res)=>{
    try {
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isListed:true}})
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const deleteBrand = async (req,res)=>{
    try {

        const {id} = req.query;
        if(!id){
            res.status(400).redirect('/error404')
        }
       
        await Brand.deleteOne({_id:id})
        res.status(200).json({ success: true });
        
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports={
    getbrand,
    addbrand,
    blockBrand,
    unblockBrand,
    deleteBrand
    
}