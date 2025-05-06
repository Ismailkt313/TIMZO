const express = require('express')
const router = express.Router()
const multer = require("multer")
const adminControllerauth = require('../../Controller/admin/adminControllerauth')
const costomerController = require('../../Controller/admin/costomerController')
const categoyController = require('../../Controller/admin/categoryController')
const brandcontroller = require("../../Controller/admin/brandcontroller")
const productController = require("../../Controller/admin/productController")
const { uploadProducts, uploadBrand } = require('../../Helpers/multer');
const {userAuth,adminAuth} = require("../../MiddleWares/auth")



router.get('/login', adminControllerauth.loadsign)
router.post('/login',adminControllerauth.login) 
router.get('/dashboard',adminAuth,adminControllerauth.loaddashboard)
router.get('/logout',adminAuth,adminControllerauth.logout)
router.get('/users',adminAuth,costomerController.loadUsers)
router.get('/search-users',adminAuth,costomerController.searchUsers)
router.get('/userprofile/:id',adminAuth,costomerController.loadProfile)
router.post('/updateuser/:id',adminAuth,costomerController.profile)
router.patch('/toggle-user-status/:id',adminAuth,costomerController.block)
router.get('/categories',adminAuth,categoyController.loadcategories) 
router.post('/addCategory',adminAuth,categoyController.addcategory)
router.get('/addcategories',adminAuth,categoyController.loadaddcategory)
router.post('/addCategoryOffer',adminAuth,categoyController.addcategoryOffer)
router.post('/removeCategoryOffer',adminAuth,categoyController.removecategoryoffer)
router.get("/listcategory",adminAuth,categoyController.getlistcategory)
router.patch("/listcategory", adminAuth, categoyController.getunlistcategory);
router.patch("/unlistcategory", adminAuth, categoyController.getlistcategory);
router.get('/editcategory/:id',adminAuth, categoyController.loadeditcategory)
router.post('/editcategory/:id',adminAuth, categoyController.editcategory);
router.post('/softDeleteCategory', adminAuth, categoyController.softDeleteCategory);
router.post('/undoDeleteCategory',adminAuth, categoyController. undoDeleteCategory);
router.post('/permanentlyDeleteCategory',adminAuth, categoyController.permanentlyDeleteCategory);
router.get("/brand",adminAuth,brandcontroller.getbrand)
router.post('/addbrand',adminAuth,uploadBrand.single("images"),brandcontroller.addbrand)
router.patch("/blockBrand",adminAuth,brandcontroller.blockBrand)
router.patch("/unblockBrand",adminAuth,brandcontroller.unblockBrand)
router.delete("/deleteBrand",adminAuth,brandcontroller.deleteBrand) 
router.get("/product",adminAuth,productController.loadProducts)
router.post("/addproducts",adminAuth,uploadProducts.array("images",4),productController.addProducts)
router.get("/getProduct",adminAuth,productController.getProduct)
router.post('/softDeleteProduct',adminAuth,productController.softDeleteProduct);
router.post('/undoDeleteProduct',adminAuth,productController.undoDeleteProduct);
router.post('/permanentlyDeleteProduct',adminAuth,productController. permanentlyDeleteProduct);
router.post('/addProductOffer', adminAuth, productController.addProductOffer); // New route for adding offer
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer); // New route for removing offer
router.post('/blockProduct', adminAuth, productController.blockProduct); // New route for blocking product
router.post('/unblockProduct', adminAuth, productController.unblockProduct); // New route for unblocking product
router.get('/editProduct/:id', adminAuth, productController.loadEditProduct); // New route for loading edit page
router.post('/editProduct/:id', adminAuth, uploadProducts.array("images", 4), productController.editProduct);
    

module.exports = router   