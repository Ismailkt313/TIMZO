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
router.get('/userprofile/:id',adminAuth,costomerController.loadProfile)
router.post('/updateuser/:id',adminAuth,costomerController.profile)
router.patch('/toggle-user-status/:id',adminAuth,costomerController.block)
router.get('/categories',adminAuth,categoyController.loadcategories)
router.post('/addCategory',adminAuth,categoyController.addcategory)
router.get('/addcategories',adminAuth,categoyController.loadaddcategory)
router.post('/addCategoryOffer',adminAuth,categoyController.addcategoryOffer)
router.post('/removeCategoryOfffer',adminAuth,categoyController.removecategoryoffer)
router.get("/listcategory",adminAuth,categoyController.getlistcategory)
router.get("/unlistcategory",adminAuth,categoyController.getunlistcategory)
router.get('/editcategory/',adminAuth, categoyController.loadeditcategory);
router.post('/editcategory/:id',adminAuth, categoyController.editcategory);
router.get("/brand",adminAuth,brandcontroller.getbrand)
router.post('/addbrand',adminAuth,uploadBrand.single("images"),brandcontroller.addbrand)
router.get("/blockBrand",adminAuth,brandcontroller.blockBrand)
router.get("/unblockBrand",adminAuth,brandcontroller.unblockBrand)
router.get("/deleteBrand",adminAuth,brandcontroller.deleteBrand)
router.get("/product",adminAuth,productController.loadProducts)
router.post("/addproducts",adminAuth,uploadProducts.array("images",4),productController.addProducts)
router.get("/getProduct",adminAuth,productController.getProduct)

    

module.exports = router   