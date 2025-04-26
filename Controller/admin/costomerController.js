let customer = require('../../Model/userSchema')



const loadUsers = async (req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
     console.log(skip);
     
    const users = await customer.find().skip(skip).limit(limit) 
    
    const totalUsers = await customer.countDocuments()
    const totalPages = Math.ceil(totalUsers / limit)

    // Pass the users, currentPage, and totalPages to the view
    res.render('Admin/costomer', {
      users,  // Ensure you're passing the 'users' array here
      currentPage: page,
      totalPages,
    })
  } catch (error) {
        res.redirect('/user/error404')
    }
}

const loadProfile = async (req,res)=>{
    try {

        const userId = req.params.id;  
        const user = await customer.findById(userId); 
        console.log(user);
        
        if (!user) {
          return res.redirect('/admin/users');  
        }
        res.render('Admin/userProfile',{ 
            user,
            orders:null,
        
        })
    } catch (error) {
        res.redirect('/user/error404')
    }
}

const profile = async (req,res)=>{
    try {
        const userId =  req.params.id;
        const { fullname, email, isBlocked } = req.body;

        await customer.findByIdAndUpdate(userId, {
          fullname,
          email,
          isBlocked: isBlocked === 'true'
        });
        res.redirect(`/admin/userprofile/${userId}`);
    } catch (error) {
        console.error(error);
        res.redirect('/user/error404');
    }
}

const block = async (req,res)=>{
    try {
        const user = await customer.findById(req.params.id)
        if(!user){
            return res.status(404).render('error404')
        }
        user.isBlocked = !user.isBlocked
        await user.save()
        res.status(200).json({
            success: true,
            isBlocked: user.isBlocked
          });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
        
    }
}



module.exports = {
    loadUsers,
    loadProfile,
    profile,
    block
}