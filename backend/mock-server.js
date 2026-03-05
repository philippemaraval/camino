const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/login', (req, res) => res.json({ token: 'fake-token' }));
app.get('/api/profile', (req, res) => res.json({ username: 'testuser' }));

app.get('/api/leaderboards', (req, res) => {
    res.json({
        'rues-celebres|classique|null': [
            { username: 'Alice', high_score: 150, games_played: 10 },
            { username: 'Bob', high_score: 140, games_played: 12 },
            { username: 'Charlie', high_score: 130, games_played: 8 },
            { username: 'Dave', high_score: 120, games_played: 5 }
        ],
        'quartier|classique|Le Panier': [
            { username: 'Alice', high_score: 120, games_played: 5 },
            { username: 'Eve', high_score: 80, games_played: 2 }
        ],
        'quartier|classique|Belsunce': [
            { username: 'Bob', high_score: 110, games_played: 4 },
            { username: 'Frank', high_score: 90, games_played: 3 },
            { username: 'Grace', high_score: 70, games_played: 1 },
            { username: 'Heidi', high_score: 60, games_played: 1 }
        ]
    });
});

app.listen(3000, () => console.log('Mock server running on 3000'));
