const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let userId = localStorage.getItem('userId');

const challenges = [
  { id: 1, description: '5 jours consécutifs', goal: 5, reward: 'Badge Endurance' }
];

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM chargé, version script.js avec délégation sur document');

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const goalForm = document.getElementById('goal-form');
  const themeToggle = document.getElementById('theme-toggle');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
      themeToggle.textContent = document.body.classList.contains('dark') ? '☀️ Mode clair' : '🌙 Mode sombre';
    });
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
      themeToggle.textContent = '☀️ Mode clair';
    }
  }

  if (Notification.permission !== 'granted') Notification.requestPermission();

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      if (!email.includes('@') || password.length < 8) {
        alert('Email ou mot de passe invalide');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('userId', data.userId);
          localStorage.setItem('email', data.email);
          window.location.href = 'dashboard.html';
        } else {
          alert(data.error);
        }
      } catch (error) {
        alert('Erreur réseau ou serveur indisponible');
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('userId', data.userId);
          localStorage.setItem('email', data.email);
          window.location.href = 'dashboard.html';
        } else {
          alert(data.error);
        }
      } catch (error) {
        alert('Erreur réseau ou serveur indisponible');
      }
    });
  }

  if (goalForm) {
    if (!userId) {
      window.location.href = 'login.html';
      return;
    }

    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const description = document.getElementById('goal-description').value;
      try {
        const response = await fetch(`${API_BASE_URL}/goals/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, description })
        });
        const data = await response.json();
        if (response.ok) {
          console.log('Nouvel objectif ajouté :', data.goal);
          document.getElementById('goal-description').value = '';
          await renderGoals();
        } else {
          alert(data.error);
        }
      } catch (error) {
        alert('Erreur réseau ou serveur indisponible');
      }
    });

    renderGoals();

    setInterval(async () => {
      const goals = await fetch(`${API_BASE_URL}/goals/${userId}`).then(res => res.json());
      const unchecked = goals.some(g => Object.values(g.days).some(d => !d));
      if (unchecked && new Date().getHours() >= 20) {
        new Notification('Productivité Hebdo', {
          body: 'Vous avez des objectifs non cochés aujourd’hui !',
        });
      }
    }, 3600000);
  }

  // Délégation d'événements au niveau du document
  document.addEventListener('change', async (e) => {
    if (e.target.matches('#goals-table input[type="checkbox"]')) {
      const goalId = e.target.dataset.goalId;
      const day = e.target.dataset.day;
      const checked = e.target.checked;
      console.log('Checkbox cliqué :', { goalId, day, checked });
      try {
        const response = await fetch(`${API_BASE_URL}/goals/update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId, day, checked })
        });
        let data;
        const text = await response.text();
        console.log('Réponse brute du serveur :', text);
        if (response.status === 429) {
          throw new Error('Trop de requêtes, réessayez plus tard');
        }
        try {
          data = JSON.parse(text);
        } catch (jsonError) {
          throw new Error(`Réponse invalide du serveur : ${text}`);
        }
        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors de la mise à jour');
        }
        console.log('Mise à jour réussie :', data);
        await renderGoals();
      } catch (error) {
        console.error('Erreur lors de la mise à jour :', error);
        alert('Impossible de mettre à jour : ' + error.message);
        e.target.checked = !checked;
      }
    }
  });
});

async function renderGoals() {
  try {
    const goalsResponse = await fetch(`${API_BASE_URL}/goals/${userId}`);
    if (!goalsResponse.ok) throw new Error('Erreur lors de la récupération des objectifs');
    const goals = await goalsResponse.json();
    console.log('Objectifs récupérés pour affichage :', goals);

    const userResponse = await fetch(`${API_BASE_URL}/auth/${userId}`);
    if (!userResponse.ok) throw new Error('Erreur lors de la récupération des données utilisateur');
    const userData = await userResponse.json();

    const tbody = document.querySelector('#goals-table tbody');
    tbody.innerHTML = '';

    if (goals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">Aucun objectif pour le moment. Ajoutez-en un !</td></tr>';
    }

    let totalChecked = 0;
    const totalPossible = goals.length * 7;
    let totalPoints = goals.reduce((sum, g) => sum + (g.points || 0), 0);

    // Réinitialisation hebdomadaire
    const lastReset = localStorage.getItem('lastReset') || 0;
    const now = new Date();
    const monday = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    if (monday.getTime() > lastReset) {
      for (const goal of goals) {
        for (const day of Object.keys(goal.days)) {
          if (goal.days[day]) {
            await fetch(`${API_BASE_URL}/goals/update`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ goalId: goal.id, day, checked: false })
            });
            goal.days[day] = false;
          }
        }
      }
      localStorage.setItem('lastReset', monday.getTime());
    }

    goals.forEach(goal => {
      const row = document.createElement('tr');
      row.classList.add('new');
      setTimeout(() => row.classList.remove('new'), 500);
      row.innerHTML = `
        <td>${goal.description}</td>
        ${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(day => {
          totalChecked += goal.days[day] ? 1 : 0;
          return `
            <td><input type="checkbox" ${goal.days[day] ? 'checked' : ''} data-goal-id="${goal.id}" data-day="${day}"></td>
          `;
        }).join('')}
        <td>
          <button class="edit-btn" data-goal-id="${goal.id}">✏️</button>
          <button class="delete-btn" data-goal-id="${goal.id}">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`${API_BASE_URL}/goals/${btn.dataset.goalId}`, { method: 'DELETE' });
        await renderGoals();
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newDescription = prompt('Modifier l’objectif :', goals.find(g => g.id === btn.dataset.goalId).description);
        if (newDescription) {
          await fetch(`${API_BASE_URL}/goals/${btn.dataset.goalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: newDescription })
          });
          await renderGoals();
        }
      });
    });

    const progress = (totalChecked / totalPossible) * 100 || 0;
    document.getElementById('progress').style.width = `${progress}%`;

    const badges = document.getElementById('badges');
    const message = document.getElementById('message');
    badges.innerHTML = '';
    message.innerHTML = `Points : ${totalPoints}`;

    if (totalChecked > 0) badges.innerHTML += '<span class="badge">Débutant</span>';
    if (totalChecked >= 7) badges.innerHTML += '<span class="badge">Productif</span>';
    if (progress === 100) badges.innerHTML += '<span class="badge">Champion</span>';

    const level = Math.floor((userData.totalCheckedDays || 0) / 10);
    message.innerHTML += `<br>Niveau ${level}`;

    const consecutiveDays = goals.every(g => g.days.lun && g.days.mar && g.days.mer && g.days.jeu && g.days.ven);
    if (consecutiveDays) badges.innerHTML += `<span class="badge">${challenges[0].reward}</span>`;
  } catch (error) {
    console.error('Erreur renderGoals :', error);
    alert('Erreur lors du chargement des données : ' + error.message);
  }
}