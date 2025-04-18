const express = require ('express')
const app = express()
const path = require('path')
const env = require("dotenv").config()
const db = require ("./Config/db")
const userRouter = require('./Routes/userRouter')
const PORT = process.env.PORT || 3000;

db()

app.set('view engine','ejs')
app.set('views', path.join(__dirname, 'views'))



app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname, 'public')))


app.use('/',userRouter)
   
 

app.listen(PORT, ()=>{
    console.log(`server runnning as on :  http://localhost:3000/`);
    
})


module.exports = app  