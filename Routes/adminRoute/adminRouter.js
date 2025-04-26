const express = require('express')
const router = express.Router()
const adminControllerauth = require('../../Controller/admin/adminControllerauth')
const costomerController = require('../../Controller/admin/costomerController')
const categoyController = require('../../Controller/admin/categoryController')

router.get('/login', adminControllerauth.loadsign)
router.post('/login',adminControllerauth.login) 
router.get('/dashboard',adminControllerauth.loaddashboard)
router.get('/logout',adminControllerauth.logout)
router.get('/users',costomerController.loadUsers)
router.get('/userprofile/:id',costomerController.loadProfile)
router.post('/updateuser/:id',costomerController.profile)
router.patch('/toggle-user-status/:id',costomerController.block)
router.get('/categories',categoyController.loadcategories)
router.post('/addcategories',categoyController.addcategory)
router.get('/addcategories',categoyController.loadaddcategory)

module.exports = router 