// ===== SETUP =====
require('dotenv').config();
require('express-async-errors');

const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');

// ===== DB =====
const connectDB = require('./db/connect');

// ===== AUTH =====
const authenticateUser = require('./middleware/auth');
const authorizedPermission = require('./middleware/permission');

// ===== ROUTES =====
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const userManagementRouter = require('./routes/user-management');
const cartRouter = require('./routes/cart');

// ===== MIDDLEWARES =====
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

const app = express();

const allowedOrigins = [
  'http://localhost:5500',
  'https://store-frontend-amber.vercel.app/login.html',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// ===== GLOBAL MIDDLEWARE =====
app.use(express.json());
app.use(cookieParser());

// ===== API ROUTES =====
app.use('/api/v1/auth', authRouter);

app.use('/api/v1/dashboard', authenticateUser, dashboardRouter);
app.use('/api/v1/products', authenticateUser, productsRouter);
app.use(
  '/api/v1/orders',
  authenticateUser,
  authorizedPermission('admin', 'inventory'),
  ordersRouter
);
app.use(
  '/api/v1/user-management',
  authenticateUser,
  authorizedPermission('admin'),
  userManagementRouter
);
app.use(
  '/api/v1/cart',
  authenticateUser,
  authorizedPermission('admin', 'cashier'),
  cartRouter
);

// ===== ERROR HANDLING =====
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// ===== START SERVER =====
const start = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI missing');
    }

    await connectDB(process.env.MONGO_URI);
    // console.log('MongoDB connected');

    const port = process.env.PORT || 3000;
    app.listen(port, () =>
      console.log(`Server running on port ${port}`)
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
