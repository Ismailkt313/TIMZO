const express = require('express');
const router = express.Router();
const userController = require("../Controller/user/userController")

router.get('/',userController.loadHome);
router.get('/pageNotFound',userController.pageNotFound)

module.exports = router;
