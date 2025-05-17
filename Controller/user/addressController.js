const Address = require("../../Model/addressSchema");
const User = require("../../Model/userSchema");

const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Loading addresses for user:', userId);
        if (!userId) {
            return res.status(401).render('user/login', { message: 'Please log in to view your addresses' });
        }

        const user = await User.findById(userId);
        if (!user) {
            req.session.user = null;
            return res.status(404).render('user/login', { message: 'User not found' });
        }

        const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
        res.render('user/address', {
            user: req.session.user,
            userId,
            addresses,
            currentPage: "address"
        });
    } catch (error) {
        console.error('Error loading addresses:', error);
        res.status(500).render('user/error', { message: 'Error loading addresses', user: req.session.user });
    }
};

const createAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Creating address for user:', userId, 'Data:', req.body);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const { fullName, addressLine1, addressLine2, city, state, postalCode, country, phone, addressType, landmark, isDefault } = req.body;

        // Validate required fields
        if (!fullName || !addressLine1 || !city || !state || !postalCode || !country || !phone) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled' });
        }

        // Validate phone (basic regex for 10-digit numbers)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
        }

        // Validate postal code (basic regex for 6-digit Indian PIN)
        if (!/^\d{6}$/.test(postalCode)) {
            return res.status(400).json({ success: false, message: 'Postal code must be 6 digits' });
        }


        // If setting as default, unset other defaults
        if (isDefault === 'true' || isDefault === true) {
            await Address.updateMany({ userId, isDefault: true }, { isDefault: false });
        }

        const address = new Address({
            userId,
            fullName,
            addressLine1,
            addressLine2: addressLine2 || '',
            city,
            state,
            postalCode,
            country,
            phone,
            addressType: addressType || 'Home',
            landmark: landmark || '',
            isDefault: isDefault === 'true' || isDefault === true
        });

        await address.save();
        res.status(200).json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Create address error:', error);
        res.status(500).json({ success: false, message: 'Error adding address' });
    }
};

const getAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Fetching address for user:', userId, 'Address ID:', req.params.addressId);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const addressId = req.params.addressId;
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.status(200).json(address);
    } catch (error) {
        console.error('Get address error:', error);
        res.status(500).json({ success: false, message: 'Error fetching address' });
    }
};

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Editing address for user:', userId, 'Address ID:', req.params.addressId, 'Data:', req.body);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const addressId = req.params.addressId;
        const { fullName, addressLine1, addressLine2, city, state, postalCode, country, phone, addressType, landmark, isDefault } = req.body;

        // Validate required fields
        if (!fullName || !addressLine1 || !city || !state || !postalCode || !country || !phone) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled' });
        }

        // Validate phone
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
        }

        // Validate postal code
        if (!/^\d{6}$/.test(postalCode)) {
            return res.status(400).json({ success: false, message: 'Postal code must be 6 digits' });
        }

        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Update address fields
        address.fullName = fullName;
        address.addressLine1 = addressLine1;
        address.addressLine2 = addressLine2 || '';
        address.city = city;
        address.state = state;
        address.postalCode = postalCode;
        address.country = country;
        address.phone = phone;
        address.addressType = addressType || 'Home';
        address.landmark = landmark || '';
        address.isDefault = isDefault === 'true' || isDefault === true;

        // If setting as default, unset other defaults
        if (address.isDefault) {
            await Address.updateMany({ userId, isDefault: true, _id: { $ne: addressId } }, { isDefault: false });
        }

        await address.save();
        res.status(200).json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        console.error('Error editing address:', error); 
        res.status(500).json({ success: false, message: 'Failed to update address' });
    }
};


const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Deleting address for user:', userId, 'Address ID:', req.params.addressId);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const addressId = req.params.addressId;
        const address = await Address.findOneAndDelete({ _id: addressId, userId });
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, message: 'Failed to delete address' });
    }
};

module.exports = {
    loadAddress,
    createAddress,
    getAddress,
    editAddress,
    deleteAddress
};
