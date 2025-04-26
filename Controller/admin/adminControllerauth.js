const Admin = require('../../Model/userSchema');
const bcrypt = require('bcrypt');

// Load admin login page
const loadsign = async (req, res) => {
    try {
        res.render('Admin/adminlogin', { error: null });
    } catch (error) {
        res.redirect('/user/error404');
    }
};

// Admin login logic
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

        req.session.admin = admin; // Store admin session
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.redirect('/user/error404');
    }
};

// Admin logout
const logout = async (req, res) => {
    try {
        delete req.session.admin; // Only destroy admin session part
        res.redirect('/admin/login'); // Redirect to login
    } catch (error) {
        res.redirect('/user/error404');
    }
};
 
// Admin dashboard
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
    logout,        // Make sure to export logout!
    loaddashboard
};
