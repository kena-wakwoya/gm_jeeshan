const express       = require('express');
const cookieParser  = require('cookie-parser');
const dotenv        = require('dotenv');
const cors          = require('cors');
const path          = require('path');

const apiRoutes           = require('./routes');          // routes/index.js
const globalErrorHandler  = require('./middleware/errorHandler');
const AppError            = require('./utils/AppError');
const User = require('./models/User1');
const bcrypt = require('bcryptjs');
// ──────────────────────────────────────────────────────────────
// 1. Load environment variables
// ──────────────────────────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ──────────────────────────────────────────────────────────────
// 2. Create the Express app
// ──────────────────────────────────────────────────────────────
const app = express();

// ──────────────────────────────────────────────────────────────
// 3. Middleware
// ──────────────────────────────────────────────────────────────

const allowedOrigins = ['http://localhost:5173']; // Your React frontend URL here

// app.use(cors({
//   origin: function(origin, callback) {
//     // allow requests with no origin (like mobile apps or curl requests)
//     if(!origin) return callback(null, true);
//     if(allowedOrigins.indexOf(origin) === -1) {
//       const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   },
//   credentials: true, // if you need to allow cookies/auth headers
// }));

app.use(cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.text({ limit: '100mb' }));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ──────────────────────────────────────────────────────────────
// 4. Routes
// ──────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// 404 handler for unknown routes
// app.all('*', (req, res, next) => {
//   next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// Global error handler
app.use(globalErrorHandler);

// ──────────────────────────────────────────────────────────────
// 5. Start-up wrapper – ensures DB is up before listening
// ──────────────────────────────────────────────────────────────
async function startServer() {
  const db = require('./models');        // auto-loads & associates

  try {
    await db.sequelize.authenticate();
    console.log('✅  Database connection established.');
    // During development you can keep alter:true
    await db.sequelize.sync({ alter: true }).then(async () => {
    console.log("Database synced");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { email: process.env.ADMIN_EMAIL } });
    if (!existingAdmin) {
      await User.create(
        {
          first_name: 'Jeeshan',
          last_name: 'Gupta',
          username: 'Jgupta',
          email: process.env.ADMIN_EMAIL,
          password: await bcrypt.hash('password', 10),// hash this!
          role: 'ADMIN'
        }
      );
      console.log("Initial users created");
    }
  })
  .catch(console.error);

    console.log('✅  Models synchronised.');
  } catch (err) {
    console.error('❌  Unable to connect to the database:', err);
    process.exit(1);                     // abort start-up
  }

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀  API server ready at http://localhost:${PORT}`);
    console.log(`🌱  Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
