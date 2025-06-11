const Wallet = require("../../Model/walletSchema");
const User = require("../../Model/userSchema");
const bcrypt = require("bcrypt");

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user session found:', req.session);
            return res.status(401).render('user/login', { message: 'Please log in to view your wallet' });
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            req.session.user = null;
            return res.status(401).render('user/login', { message: 'User not found or blocked' });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            console.log('Creating new wallet for user:', userId);
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
            await wallet.save();
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const startIndex = (page - 1) * limit;

        console.log('Transactions before sorting:', wallet.transactions);

        wallet.transactions.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (isNaN(dateA) || isNaN(dateB)) {
                console.warn('Invalid date detected:', { a: a.date, b: b.date });
                return 0;
            }
            return dateB - dateA;
        });

        console.log('Transactions after sorting:', wallet.transactions);

        const totalTransactions = wallet.transactions.length;
        const paginatedTransactions = wallet.transactions.slice(startIndex, startIndex + limit);
        const totalPages = Math.ceil(totalTransactions / limit);

        console.log('Pagination:', { page, limit, startIndex, totalTransactions, totalPages });

        res.render('user/wallet', {
            user,
            wallet: {
                ...wallet.toObject(),
                transactions: paginatedTransactions
            },
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        console.error("Wallet loading error occurred:", error);
        res.status(500).json({ success: false, message: "Wallet loading error" });
    }
};

const addToWallet = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { amount } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }
        const amountValue = parseFloat(amount);
        if (amountValue > 100000) {
            return res.status(400).json({ success: false, message: "Amount exceeds maximum limit" });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        wallet.balance += amountValue;
        wallet.transactions.push({
            type: 'credit',
            amount: amountValue,
            description: 'Amount added to wallet',
            date: new Date()
        });

        await wallet.save();
        res.status(200).json({ success: true, message: "Amount added successfully", balance: wallet.balance });
    } catch (error) {
        console.error("Error adding amount:", error);
        res.status(500).json({ success: false, message: "Failed to add amount" });
    }
};

const withdraw = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { amount } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }
        const amountValue = parseFloat(amount);

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }
        if (wallet.balance < amountValue) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }

        wallet.balance -= amountValue;
        wallet.transactions.push({
            type: 'debit',
            amount: amountValue,
            description: 'Amount withdrawn from wallet',
            date: new Date()
        });

        await wallet.save();
        return res.status(200).json({ success: true, message: "Amount withdrawn successfully", balance: wallet.balance });
    } catch (error) {
        console.error("Error withdrawing amount:", error);
        res.status(500).json({ success: false, message: "Failed to withdraw amount" });
    }
};

const loadnewpassword = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).render('user/login', { message: 'Please log in to change your password' });
        }
        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            req.session.user = null;
            return res.status(401).render('user/login', { message: 'User not found or blocked' });
        }
        res.render("user/newpassword", {
            user,
            currentpage: "changepassword"
        });
    } catch (error) {
        console.error("Error loading new password page:", error);
        res.status(500).render('user/error', { message: 'Failed to load password change page' });
    }
};

const verifyOldpassword = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { oldPassword } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Valid old password required (minimum 6 characters)" });
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return res.status(400).json({ success: false, message: "User not found or blocked" });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect old password" });
        }

        res.status(200).json({ success: true, message: "Old password verified" });
    } catch (error) {
        console.error("Error verifying old password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const newPassword = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return res.status(401).json({ success: false, message: "User not found or blocked" });
        }

        const { newPassword, confirmPassword } = req.body;
        console.log('puthiya passwordukal',req.body)
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadWallet,
    addToWallet,
    withdraw,
    loadnewpassword,
    verifyOldpassword,
    newPassword
};