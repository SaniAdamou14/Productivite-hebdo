const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const router = express.Router();
const usersFile = path.join(__dirname, '..', process.env.USERS_FILE);

const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

async function readUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(usersFile, JSON.stringify([], null, 2));
      return [];
    }
    throw error;
  }
}

async function saveUsers(users) {
  try {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
  } catch (error) {
    throw new Error('Erreur lors de l’écriture du fichier users.json');
  }
}

router.post('/register', async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, password } = req.body;
    const users = await readUsers();

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Utilisateur existe déjà' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), name, email, password: hashedPassword, totalCheckedDays: 0 };

    users.push(newUser);
    await saveUsers(users);

    res.status(201).json({ message: 'Inscription réussie', userId: newUser.id, email });
  } catch (error) {
    console.error('Erreur lors de l’inscription :', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de l’inscription' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await readUsers();
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    res.json({ message: 'Connexion réussie', userId: user.id, email, totalCheckedDays: user.totalCheckedDays });
  } catch (error) {
    console.error('Erreur lors de la connexion :', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la connexion' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find(u => u.id === req.params.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json({ id: user.id, name: user.name, email: user.email, totalCheckedDays: user.totalCheckedDays });
  } catch (error) {
    console.error('Erreur lors de la récupération de l’utilisateur :', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

module.exports = router;