require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { connectDB } = require('./utils/db');

// Connect to MongoDB (non-blocking)
connectDB();

const jdRoutes = require('./routes/jd');
const assessmentRoutes = require('./routes/assessment');
const reportRoutes = require('./routes/report');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads (optional local preview)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/jd', jdRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/report', reportRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
