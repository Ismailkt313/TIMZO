const customer = require('../../Model/userSchema');

const loadUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const filter = req.query.filter || 'all';


        console.log('Skip value:', skip);

        const User = await customer.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const now = new Date();

        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const totalUsers = await customer.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        const newUsers = await customer.countDocuments({
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
        });

        const lastMonthUsers = await customer.countDocuments({
            createdAt: { $gte: firstDayOfLastMonth, $lte: lastDayOfLastMonth },
        });

        const newUsersGrowth = lastMonthUsers > 0
            ? Math.round(((newUsers - lastMonthUsers) / lastMonthUsers) * 100)
            : newUsers > 0 ? 100 : 0;

        const newUsersPercent = totalUsers > 0
            ? Math.round((newUsers / totalUsers) * 100)
            : 0;

        const blockedUsers = await customer.countDocuments({ isBlocked: true });
        const activeUsers = await customer.countDocuments({ isBlocked: false });

        const blockedUsersPercent = totalUsers > 0
            ? Math.round((blockedUsers / totalUsers) * 100)
            : 0;

        const activeUsersPercent = totalUsers > 0
            ? Math.round((activeUsers / totalUsers) * 100)
            : 0;

        res.render('Admin/costomer', {
            activeClass: filter,
            searchQuery:req.query.search || '',
            newUsersGrowth,
            newUsers,
            blockedUsersPercent,
            activeUsersPercent,
            activeUsers,
            totalUsers,
            newUsersPercent,
            blockedUsers,
            users: User,
            currentPage: page,
            totalPages,
        });

    } catch (error) {
        console.error('Error loading users:', error);
        res.redirect('/user/error404');
    }
};


const loadProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await customer.findById(userId);
        console.log('User profile:', user);

        if (!user) {
            return res.redirect('/admin/users');
        }
        res.render('Admin/userProfile', {
            user,
            orders: null,
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.redirect('/user/error404');
    }
};

const profile = async (req, res) => {
    try {
        const userId = req.params.id;
        const { fullname, email, isBlocked, mobile, address } = req.body;

        await customer.findByIdAndUpdate(userId, {
            fullname,
            mobile,
            email,
            address,
            isBlocked: isBlocked === 'true'
        });
        res.redirect(`/admin/userprofile/${userId}`);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/user/error404');
    }
};

const searchUsers = async (req, res) => {
    try {
      const query = req.query.query || '';
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
  
      const searchQuery = {
        $or: [
          { fullname: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      };
  
      const users = await customer.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      res.json({ success: true, users, currentPage: page });
    } catch (error) {
      console.error('Error searching users:', error);
      res.json({ success: false, message: 'Search failed' });
    }
  };

const block = async (req, res) => {
    try {
        const user = await customer.findById(req.params.id);
        if (!user) {
            return res.status(404).render('error404');
        }
        user.isBlocked = !user.isBlocked;
        await user.save();
        res.status(200).json({
            success: true,
            isBlocked: user.isBlocked
        });
        console.log('User block status updated:', user.isBlocked);
    } catch (error) {
        console.error('Error toggling block status:', error);
        res.status(500).json({ success: false });
    }
};

module.exports = {
    loadUsers,
    loadProfile,
    profile,
    block,
    searchUsers
};