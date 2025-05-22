const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const goalRoutes = require('./routes/goals');

const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // 1000 requêtes max par IP
}));

app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));