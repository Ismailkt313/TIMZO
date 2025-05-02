const Admin = require('../../Model/userSchema');
const bcrypt = require('bcrypt');

const loadsign = async (req, res) => {
    try {
        res.render('Admin/adminlogin', { error: null });
    } catch (error) {
        res.redirect('/user/error404');
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (!admin || !admin.isAdmin) {
            return res.render('Admin/adminlogin', { error: 'Admin not found' });
        }

        const ismatch = await bcrypt.compare(password, admin.password);
        if (!ismatch) {
            return res.render('Admin/adminlogin', { error: 'Invalid credentials' });
        }

        req.session.admin = { id: admin._id, email: admin.email };
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.redirect('/user/error404');
    }
};


const logout = async (req, res) => {
    try {
        delete req.session.admin; 
        res.redirect('/admin/login'); 
    } catch (error) {
        res.redirect('/user/error404');
    }
};
 

const loaddashboard = async (req, res) => {
    try {
        res.render('Admin/admindashbord');
    } catch (error) {
        res.redirect('/user/error404');
    }
};



module.exports = {
    loadsign,
    login,
    logout,        
    loaddashboard
};
