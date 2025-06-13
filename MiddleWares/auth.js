const User = require(".././Model/userSchema")
const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user._id)
      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          delete req.session.user; // ✅ just delete the user key
          res.redirect("/login"); // ✅ then redirect
        }
      })
      .catch((error) => {
        console.log("error in userAuth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    res.redirect("/login");
  }
};


const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/admin/login");
    }
};


module.exports = {
    userAuth,
    adminAuth
}