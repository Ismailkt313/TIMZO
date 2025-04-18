const express = require ('express')
const app = express()
const env = require("dotenv").config()
const db = require ("./Config/db")
db()
 
const PORT = process.env.PORT || 3000;


app.listen(process.env.PORT, ()=>{
    console.log(`server runnning as on :  http://localhost:3000/`);
    
})


module.exports = app