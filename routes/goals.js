const express = require('express');
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const router = express.Router();
const goalsFile = path.join(__dirname, '..', process.env.GOALS_FILE);
const usersFile = path.join(__dirname, '..', process.env.USERS_FILE);

const goalSchema = Joi.object({
    userId: Joi.string().required(),
    description: Joi.string().required()
});

async function readGoals() {
    try {
        const data = await fs.readFile(goalsFile, 'utf8');
        if (!data.trim()) return [];
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(goalsFile, JSON.stringify([], null, 2));
            return [];
        }
        throw error;
    }
}

async function saveGoals(goals) {
    try {
        await fs.writeFile(goalsFile, JSON.stringify(goals, null, 2));
        console.log('Goals sauvegardés :', goals);
    } catch (error) {
        throw new Error('Erreur lors de l’écriture du fichier goals.json : ' + error.message);
    }
}

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
        console.log('Users sauvegardés :', users);
    } catch (error) {
        throw new Error('Erreur lors de l’écriture du fichier users.json : ' + error.message);
    }
}

router.post('/add', async (req, res) => {
    try {
        const { error } = goalSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { userId, description } = req.body;
        const goals = await readGoals();
        const newGoal = {
            id: Date.now().toString(),
            userId,
            description,
            points: 0,
            days: { lun: false, mar: false, mer: false, jeu: false, ven: false, sam: false, dim: false }
        };
        goals.push(newGoal);
        await saveGoals(goals);
        res.status(201).json({ message: 'Objectif ajouté', goal: newGoal });
    } catch (error) {
        console.error('Erreur lors de l’ajout d’objectif :', error);
        res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const goals = await readGoals();
        const userGoals = goals.filter(g => g.userId === req.params.userId);
        console.log(`Objectifs pour userId ${req.params.userId} :`, userGoals);
        res.json(userGoals);
    } catch (error) {
        console.error('Erreur lors de la récupération des objectifs :', error);
        res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
});

router.patch('/update', async (req, res) => {
    try {
        const { goalId, day, checked } = req.body;
        console.log('Requête PATCH /update reçue :', { goalId, day, checked });
        const goals = await readGoals();
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return res.status(404).json({ error: 'Objectif non trouvé' });

        goal.days[day] = checked;
        goal.points = (goal.points || 0) + (checked ? 10 : -10);

        const users = await readUsers();
        const user = users.find(u => u.id === goal.userId);
        if (user) {
            user.totalCheckedDays = (user.totalCheckedDays || 0) + (checked ? 1 : -1);
            await saveUsers(users);
        }

        await saveGoals(goals);
        res.json({ message: 'Objectif mis à jour' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour :', error);
        res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
});

router.delete('/:goalId', async (req, res) => {
    try {
        const goals = await readGoals();
        const updatedGoals = goals.filter(g => g.id !== req.params.goalId);
        await saveGoals(updatedGoals);
        res.json({ message: 'Objectif supprimé' });
    } catch (error) {
        console.error('Erreur lors de la suppression :', error);
        res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
});

router.put('/:goalId', async (req, res) => {
    try {
        const { description } = req.body;
        const goals = await readGoals();
        const goal = goals.find(g => g.id === req.params.goalId);
        if (!goal) return res.status(404).json({ error: 'Objectif non trouvé' });
        goal.description = description;
        await saveGoals(goals);
        res.json({ message: 'Objectif mis à jour' });
    } catch (error) {
        console.error('Erreur lors de la modification :', error);
        res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
});

module.exports = router;