const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('./Config/passport');
const dotenv = require('dotenv');
const nocache = require('nocache');
const flash = require('connect-flash');
const morgan = require('morgan');

const db = require('./Config/db');
const adminRouter = require('./Routes/adminRoute/adminRouter');
const userRouter = require('./Routes/userRoute/userRouter');
const errorHandler = require('./MiddleWares/errorHandler');
const cartCountMiddleware = require('./MiddleWares/cartCount')

const app = express();
dotenv.config();

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

const PORT = process.env.PORT || 3000;

db();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cartCountMiddleware);

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

app.use('/', userRouter);
app.use('/user', userRouter);
app.use('/admin', adminRouter);

app.use((req, res, next) => {
    res.status(404);
    next(new Error('Page Not Found'));
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}/`);
});

module.exports = app;