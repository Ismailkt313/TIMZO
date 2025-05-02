const User = require(".././Model/userSchema")

const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user._id)
            .then(data => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    req.session.destroy(() => {
                        res.redirect("/login");
                    });
                }
            })
            .catch(error => {
                console.log("error in userAuth middleware:", error);
                res.status(500).send("Internal server error"); 
            });
    } else {
        res.redirect("/login");
    }
};




const adminAuth = (req,res,next)=>{
    if(req.session.admin){
    const Admin = User.findOne({isAdmin:true})
    
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error auth in adninauth middleware",error)
        res.status(500).send("internal server error")
    })
  }else{
    res.redirect("/admin/login")
  }
}

module.exports={
    userAuth,
    adminAuth
}