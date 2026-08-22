require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { migrate } = require('./db');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const fixedExpenseRoutes = require('./routes/fixedExpenses');
const assetRoutes = require('./routes/assets');
const reportRoutes = require('./routes/reports');
const incomeRoutes = require('./routes/income');
const transferRoutes = require('./routes/transfers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  console.log("Health check endpoint hit");
  res.status(200).json({ message: 'Health check ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/fixed-expenses', fixedExpenseRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/transfers', transferRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Net worth tracker API running on ${process.env.API_ENDPOINT}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to set up the database schema on boot:', err);
    process.exit(1);
  });
