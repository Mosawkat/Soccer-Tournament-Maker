// Tournament Manager - Complete Functional Implementation

class TournamentManager {
    constructor() {
        this.tournament = {
            teams: [],
            groups: [],
            matches: [],
            knockoutBracket: {},
            settings: {
                numTeams: 0,
                playersPerTeam: 0,
                format: '',
                numGroups: 0,
                roundsPerGroup: 1,
                teamsAdvancing: 0,
                groupGameDuration: 0,
                knockoutGameDuration: 0,
                scoringSystem: { win: 3, draw: 1, loss: 0 },
                numFields: 0,
                startTime: null,
                knockoutStages: [],
                matchFormat: 'single',
                extraTime: false
            },
            liveTimer: null,
            currentStage: 'setup'
        };
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateProgress();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.closest('.tab-btn').dataset.tab));
        });

        // Setup tab
        document.getElementById('num-teams')?.addEventListener('input', (e) => this.updateTeamCount(e.target.value));
        document.getElementById('tournament-format')?.addEventListener('change', (e) => this.updateFormat(e.target.value));
        document.getElementById('setup-next')?.addEventListener('click', () => this.validateAndNextSetup());

        // Group stage tab
        document.getElementById('num-groups')?.addEventListener('input', (e) => this.updateGroupCount(e.target.value));
        document.getElementById('rounds-per-group')?.addEventListener('change', (e) => this.updateRounds(e.target.value));
        document.getElementById('teams-advancing')?.addEventListener('change', (e) => this.updateAdvancing(e.target.value));
        document.getElementById('group-game-duration')?.addEventListener('input', (e) => this.updateGroupDuration(e.target.value));
        document.getElementById('win-points')?.addEventListener('input', () => this.updateScoring());
        document.getElementById('draw-points')?.addEventListener('input', () => this.updateScoring());
        document.getElementById('loss-points')?.addEventListener('input', () => this.updateScoring());
        document.getElementById('groups-back')?.addEventListener('click', () => this.switchTab('setup'));
        document.getElementById('groups-next')?.addEventListener('click', () => this.validateAndNextGroups());

        // Knockout tab
        document.getElementById('match-format')?.addEventListener('change', (e) => this.updateMatchFormat(e.target.value));
        document.getElementById('knockout-game-duration')?.addEventListener('input', (e) => this.updateKnockoutDuration(e.target.value));
        document.getElementById('extra-time')?.addEventListener('change', (e) => this.updateExtraTime(e.target.checked));
        document.getElementById('knockout-back')?.addEventListener('click', () => this.goBackFromKnockout());
        document.getElementById('knockout-next')?.addEventListener('click', () => this.validateAndNextKnockout());

        // Schedule tab
        document.getElementById('num-fields')?.addEventListener('input', (e) => this.updateFields(e.target.value));
        document.getElementById('start-time')?.addEventListener('change', (e) => this.updateStartTime(e.target.value));
        document.getElementById('timer-start')?.addEventListener('click', () => this.startTimer());
        document.getElementById('timer-pause')?.addEventListener('click', () => this.pauseTimer());
        document.getElementById('timer-reset')?.addEventListener('click', () => this.resetTimer());
        document.getElementById('schedule-back')?.addEventListener('click', () => this.goBackFromSchedule());
        document.getElementById('generate-tournament')?.addEventListener('click', () => this.generateTournament());

        // Knockout stage checkboxes
        document.querySelectorAll('.stage-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateKnockoutStages());
        });

        // Results tab
        document.querySelectorAll('.result-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchResultsTab(e.target.dataset.result));
        });
    }

    // Progress tracking
    updateProgress() {
        let progress = 0;
        const steps = 6;

        if (this.tournament.settings.numTeams > 0) progress += 1;
        if (this.tournament.settings.format) progress += 1;
        if (this.tournament.settings.numGroups > 0 || this.tournament.settings.format === 'knockout') progress += 1;
        if (this.tournament.settings.knockoutStages.length > 0 || this.tournament.settings.format === 'group') progress += 1;
        if (this.tournament.settings.numFields > 0) progress += 1;
        if (this.tournament.matches.length > 0) progress += 1;

        const percentage = (progress / steps) * 100;
        document.getElementById('progress').style.width = percentage + '%';
    }

    // Tab management
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        document.getElementById(tabName)?.classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    }

    // Setup tab functions
    updateTeamCount(count) {
        this.tournament.settings.numTeams = parseInt(count) || 0;
        this.suggestGroups();
        this.updateProgress();
    }

    updateFormat(format) {
        this.tournament.settings.format = format;
        this.toggleFormatVisibility();
        this.updateProgress();
    }

    toggleFormatVisibility() {
        const format = this.tournament.settings.format;
        const groupsTab = document.getElementById('groups-tab');
        const knockoutTab = document.getElementById('knockout-tab');

        if (format === 'group') {
            groupsTab.style.display = 'flex';
            knockoutTab.style.display = 'none';
        } else if (format === 'knockout') {
            groupsTab.style.display = 'none';
            knockoutTab.style.display = 'flex';
        } else if (format === 'both') {
            groupsTab.style.display = 'flex';
            knockoutTab.style.display = 'flex';
        }
    }

    suggestGroups() {
        const numTeams = this.tournament.settings.numTeams;
        if (numTeams < 2) return;

        // Suggest groups = ceiling of square root, rounded to divisor
        let suggested = Math.ceil(Math.sqrt(numTeams));

        // Find closest divisor
        for (let i = suggested; i >= 2; i--) {
            if (numTeams % i === 0 || numTeams % i <= i) {
                suggested = i;
                break;
            }
        }

        const suggestionEl = document.getElementById('groups-suggestion');
        if (suggestionEl) {
            suggestionEl.textContent = `Suggested: ${suggested} groups for ${numTeams} teams`;
        }
    }

    validateAndNextSetup() {
        const numTeams = parseInt(document.getElementById('num-teams')?.value);
        const playersPerTeam = parseInt(document.getElementById('players-per-team')?.value);
        const format = document.getElementById('tournament-format')?.value;

        if (!numTeams || numTeams < 2 || numTeams > 64) {
            alert('Please enter a valid number of teams (2-64)');
            return;
        }

        if (!playersPerTeam || playersPerTeam < 1) {
            alert('Please enter players per team');
            return;
        }

        if (!format || format === '') {
            alert('Please select a tournament format');
            return;
        }

        this.tournament.settings.numTeams = numTeams;
        this.tournament.settings.playersPerTeam = playersPerTeam;
        this.tournament.settings.format = format;

        // Create teams
        this.tournament.teams = Array.from({ length: numTeams }, (_, i) => ({
            id: i + 1,
            name: `Team ${i + 1}`,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            group: null
        }));

        // Navigate to next tab
        if (format === 'group' || format === 'both') {
            this.switchTab('groups');
        } else if (format === 'knockout') {
            this.switchTab('knockout');
        }

        this.updateProgress();
    }

    // Group stage functions
    updateGroupCount(count) {
        this.tournament.settings.numGroups = parseInt(count) || 0;
        this.updateGroupsAdvancingOptions();
        this.calculateGroupStageStats();
    }

    updateRounds(rounds) {
        this.tournament.settings.roundsPerGroup = parseInt(rounds) || 1;
        this.calculateGroupStageStats();
    }

    updateAdvancing(advancing) {
        this.tournament.settings.teamsAdvancing = parseInt(advancing) || 0;
        this.suggestKnockoutBracket();
    }

    updateGroupDuration(duration) {
        this.tournament.settings.groupGameDuration = parseInt(duration) || 0;
        this.calculateGroupStageStats();
    }

    updateScoring() {
        this.tournament.settings.scoringSystem = {
            win: parseInt(document.getElementById('win-points')?.value) || 3,
            draw: parseInt(document.getElementById('draw-points')?.value) || 1,
            loss: parseInt(document.getElementById('loss-points')?.value) || 0
        };
    }

    updateGroupsAdvancingOptions() {
        const numGroups = this.tournament.settings.numGroups;
        const numTeams = this.tournament.settings.numTeams;

        if (numGroups === 0 || numTeams === 0) return;

        const teamsPerGroup = Math.floor(numTeams / numGroups);
        const advancingSelect = document.getElementById('teams-advancing');

        if (advancingSelect) {
            advancingSelect.innerHTML = '';
            for (let i = 1; i <= Math.min(teamsPerGroup, 4); i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Top ${i}`;
                advancingSelect.appendChild(option);
            }
        }
    }

    calculateGroupStageStats() {
        const numGroups = this.tournament.settings.numGroups;
        const numTeams = this.tournament.settings.numTeams;
        const rounds = this.tournament.settings.roundsPerGroup;
        const duration = this.tournament.settings.groupGameDuration;

        if (!numGroups || !numTeams) return;

        const teamsPerGroup = Math.ceil(numTeams / numGroups);
        const gamesPerTeam = (teamsPerGroup - 1) * rounds;
        const totalGamesPerGroup = (teamsPerGroup * (teamsPerGroup - 1) / 2) * rounds;
        const totalGames = totalGamesPerGroup * numGroups;

        const calcEl = document.getElementById('group-calculations');
        if (calcEl) {
            calcEl.innerHTML = `
                <strong>Group Stage Summary:</strong><br>
                Teams per group: ${teamsPerGroup}<br>
                Games per team: ${gamesPerTeam}<br>
                Total group games: ${totalGames}<br>
                ${duration ? `Estimated duration: ${Math.ceil(totalGames * duration / (this.tournament.settings.numFields || 1))} minutes` : ''}
            `;
        }
    }

    suggestKnockoutBracket() {
        const numGroups = this.tournament.settings.numGroups;
        const teamsAdvancing = this.tournament.settings.teamsAdvancing;

        if (!numGroups || !teamsAdvancing) return;

        const totalAdvancing = numGroups * teamsAdvancing;
        const nearestPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalAdvancing)));

        const suggestionEl = document.getElementById('knockout-suggestion');
        if (suggestionEl) {
            suggestionEl.textContent = `${totalAdvancing} teams advancing → Suggested ${nearestPowerOf2}-team bracket`;
            if (totalAdvancing !== nearestPowerOf2) {
                suggestionEl.textContent += ` (${nearestPowerOf2 - totalAdvancing} byes required)`;
            }
        }
    }

    validateAndNextGroups() {
        const numGroups = parseInt(document.getElementById('num-groups')?.value);
        const duration = parseInt(document.getElementById('group-game-duration')?.value);
        const teamsAdvancing = parseInt(document.getElementById('teams-advancing')?.value);

        if (!numGroups || numGroups < 1) {
            alert('Please enter number of groups');
            return;
        }

        if (!duration || duration < 1) {
            alert('Please enter game duration');
            return;
        }

        this.tournament.settings.numGroups = numGroups;
        this.tournament.settings.groupGameDuration = duration;
        this.tournament.settings.teamsAdvancing = teamsAdvancing || 0;

        // Assign teams to groups
        this.assignTeamsToGroups();

        // Navigate based on format
        if (this.tournament.settings.format === 'both') {
            this.switchTab('knockout');
        } else {
            this.switchTab('schedule');
        }

        this.updateProgress();
    }

    assignTeamsToGroups() {
        const numGroups = this.tournament.settings.numGroups;
        const teams = this.tournament.teams;

        // Distribute teams evenly across groups
        teams.forEach((team, index) => {
            team.group = (index % numGroups) + 1;
        });

        // Create group structures
        this.tournament.groups = Array.from({ length: numGroups }, (_, i) => ({
            id: i + 1,
            name: `Group ${String.fromCharCode(65 + i)}`,
            teams: teams.filter(t => t.group === i + 1)
        }));
    }

    // Knockout stage functions
    updateMatchFormat(format) {
        this.tournament.settings.matchFormat = format;
    }

    updateKnockoutDuration(duration) {
        this.tournament.settings.knockoutGameDuration = parseInt(duration) || 0;
        this.calculateKnockoutStats();
    }

    updateExtraTime(enabled) {
        this.tournament.settings.extraTime = enabled;
    }

    updateKnockoutStages() {
        const stages = [];
        document.querySelectorAll('.stage-checkbox:checked').forEach(checkbox => {
            stages.push(checkbox.value);
        });
        this.tournament.settings.knockoutStages = stages;
        this.calculateKnockoutStats();
        this.updateProgress();
    }

    calculateKnockoutStats() {
        const stages = this.tournament.settings.knockoutStages;
        const matchFormat = this.tournament.settings.matchFormat;
        const duration = this.tournament.settings.knockoutGameDuration;

        if (stages.length === 0) return;

        let totalMatches = 0;
        const stageGames = {
            'last32': 16,
            'last16': 8,
            'quarters': 4,
            'semis': 2,
            'final': 1,
            'third-place': 1
        };

        stages.forEach(stage => {
            const games = stageGames[stage] || 0;
            totalMatches += games * (matchFormat === 'two-leg' && stage !== 'final' ? 2 : 1);
        });

        const bracketEl = document.getElementById('bracket-preview');
        if (bracketEl) {
            bracketEl.innerHTML = `
                <strong>Knockout Stage Summary:</strong><br>
                Total knockout matches: ${totalMatches}<br>
                Format: ${matchFormat === 'two-leg' ? 'Two-legged (except final)' : 'Single elimination'}<br>
                ${duration ? `Estimated duration: ${Math.ceil(totalMatches * duration / (this.tournament.settings.numFields || 1))} minutes` : ''}
            `;
        }
    }

    validateAndNextKnockout() {
        const duration = parseInt(document.getElementById('knockout-game-duration')?.value);
        const stages = this.tournament.settings.knockoutStages;

        if (!duration || duration < 1) {
            alert('Please enter knockout game duration');
            return;
        }

        if (stages.length === 0) {
            alert('Please select at least one knockout stage');
            return;
        }

        this.tournament.settings.knockoutGameDuration = duration;
        this.switchTab('schedule');
        this.updateProgress();
    }

    goBackFromKnockout() {
        if (this.tournament.settings.format === 'both') {
            this.switchTab('groups');
        } else {
            this.switchTab('setup');
        }
    }

    goBackFromSchedule() {
        if (this.tournament.settings.format === 'knockout') {
            this.switchTab('knockout');
        } else if (this.tournament.settings.format === 'group') {
            this.switchTab('groups');
        } else {
            this.switchTab('knockout');
        }
    }

    // Schedule tab functions
    updateFields(count) {
        this.tournament.settings.numFields = parseInt(count) || 0;
        this.calculateTournamentSchedule();
    }

    updateStartTime(time) {
        this.tournament.settings.startTime = time;
    }

    calculateTournamentSchedule() {
        const numFields = this.tournament.settings.numFields;
        if (!numFields) return;

        let totalGames = 0;
        let totalDuration = 0;

        // Group stage games
        if (this.tournament.settings.format !== 'knockout') {
            const numGroups = this.tournament.settings.numGroups;
            const numTeams = this.tournament.settings.numTeams;
            const rounds = this.tournament.settings.roundsPerGroup;
            const teamsPerGroup = Math.ceil(numTeams / numGroups);
            const gamesPerGroup = (teamsPerGroup * (teamsPerGroup - 1) / 2) * rounds;
            totalGames += gamesPerGroup * numGroups;
            totalDuration += Math.ceil(totalGames / numFields) * this.tournament.settings.groupGameDuration;
        }

        // Knockout games
        if (this.tournament.settings.format !== 'group') {
            const stages = this.tournament.settings.knockoutStages;
            const matchFormat = this.tournament.settings.matchFormat;
            const stageGames = {
                'last32': 16,
                'last16': 8,
                'quarters': 4,
                'semis': 2,
                'final': 1,
                'third-place': 1
            };

            let knockoutGames = 0;
            stages.forEach(stage => {
                const games = stageGames[stage] || 0;
                knockoutGames += games * (matchFormat === 'two-leg' && stage !== 'final' ? 2 : 1);
            });

            totalGames += knockoutGames;
            totalDuration += Math.ceil(knockoutGames / numFields) * this.tournament.settings.knockoutGameDuration;
        }

        const scheduleEl = document.getElementById('schedule-summary');
        if (scheduleEl) {
            scheduleEl.innerHTML = `
                <strong>Tournament Overview:</strong><br>
                Total matches: ${totalGames}<br>
                Matches per field: ${Math.ceil(totalGames / numFields)}<br>
                Estimated completion: ${Math.ceil(totalDuration)} minutes (${(totalDuration / 60).toFixed(1)} hours)
                ${numFields < this.tournament.settings.numGroups ? '<br><span style="color: #e63946;">⚠️ Warning: Fewer fields than groups will cause delays</span>' : ''}
            `;
        }
    }

    // Timer functions
    startTimer() {
        if (this.timerRunning) return;

        this.timerRunning = true;
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        this.timerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.pauseTimer();
        this.timerSeconds = 0;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const hours = Math.floor(this.timerSeconds / 3600);
        const minutes = Math.floor((this.timerSeconds % 3600) / 60);
        const seconds = this.timerSeconds % 60;

        const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const timerEl = document.getElementById('timer-display');
        if (timerEl) {
            timerEl.textContent = display;
        }
    }

    // Tournament generation
    generateTournament() {
        const numFields = parseInt(document.getElementById('num-fields')?.value);

        if (!numFields || numFields < 1) {
            alert('Please enter number of fields');
            return;
        }

        this.tournament.settings.numFields = numFields;

        // Generate group stage matches
        if (this.tournament.settings.format !== 'knockout') {
            this.generateGroupStageMatches();
        }

        // Generate knockout bracket
        if (this.tournament.settings.format !== 'group') {
            this.generateKnockoutBracket();
        }

        this.tournament.currentStage = 'live';
        this.switchTab('live');
        this.renderLiveView();
        this.updateProgress();

        alert('Tournament generated successfully!');
    }

    generateGroupStageMatches() {
        const rounds = this.tournament.settings.roundsPerGroup;
        let matchId = 1;

        this.tournament.groups.forEach(group => {
            const teams = group.teams;
            const n = teams.length;

            // Generate round-robin fixtures using circle method
            for (let round = 0; round < rounds; round++) {
                for (let i = 0; i < n - 1; i++) {
                    for (let j = 0; j < n / 2; j++) {
                        const home = (i + j) % (n - 1);
                        const away = (n - 1 - j + i) % (n - 1);

                        const homeTeam = j === 0 ? teams[n - 1] : teams[home];
                        const awayTeam = teams[away];

                        this.tournament.matches.push({
                            id: matchId++,
                            group: group.id,
                            round: round + 1,
                            stage: 'group',
                            homeTeam: homeTeam,
                            awayTeam: awayTeam,
                            homeScore: null,
                            awayScore: null,
                            status: 'scheduled'
                        });
                    }
                }
            }
        });
    }

    generateKnockoutBracket() {
        let teams = [];

        // Get teams from group stage or use all teams
        if (this.tournament.settings.format === 'both') {
            // Get top teams from each group
            this.tournament.groups.forEach(group => {
                const sorted = group.teams
                    .sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                        return b.goalsFor - a.goalsFor;
                    })
                    .slice(0, this.tournament.settings.teamsAdvancing);
                teams.push(...sorted);
            });
        } else {
            teams = [...this.tournament.teams];
        }

        // Seed teams and create bracket
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(teams.length)));
        const byes = bracketSize - teams.length;

        // Simple seeding: pair highest with lowest
        for (let i = 0; i < teams.length / 2; i++) {
            if (i < teams.length - i - 1) {
                // Create match between seeded teams
                // This is placeholder - full bracket generation would be more complex
            }
        }

        this.tournament.knockoutBracket = {
            size: bracketSize,
            byes: byes,
            teams: teams
        };
    }

    // Live view rendering
    renderLiveView() {
        this.renderGroupStandings();
        this.renderCurrentMatches();
        this.renderUpcomingMatches();
    }

    renderGroupStandings() {
        const container = document.getElementById('group-standings-container');
        if (!container) return;

        let html = '';

        this.tournament.groups.forEach(group => {
            const sorted = group.teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            html += `
                <h3>${group.name}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Team</th>
                            <th>P</th>
                            <th>W</th>
                            <th>D</th>
                            <th>L</th>
                            <th>GF</th>
                            <th>GA</th>
                            <th>GD</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(team => `
                            <tr>
                                <td>${team.name}</td>
                                <td>${team.played}</td>
                                <td>${team.wins}</td>
                                <td>${team.draws}</td>
                                <td>${team.losses}</td>
                                <td>${team.goalsFor}</td>
                                <td>${team.goalsAgainst}</td>
                                <td>${team.goalDifference}</td>
                                <td><strong>${team.points}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        });

        container.innerHTML = html;
    }

    renderCurrentMatches() {
        const container = document.getElementById('current-matches-container');
        if (!container) return;

        const currentMatches = this.tournament.matches.filter(m => m.status === 'live').slice(0, 5);

        if (currentMatches.length === 0) {
            container.innerHTML = '<p>No matches currently in progress</p>';
            return;
        }

        const html = currentMatches.map(match => `
            <div class="match-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span>${match.homeTeam.name}</span>
                    <input type="number" min="0" value="${match.homeScore || 0}" 
                           onchange="tournament.updateScore(${match.id}, 'home', this.value)"
                           style="width: 50px; text-align: center;">
                    <span>vs</span>
                    <input type="number" min="0" value="${match.awayScore || 0}"
                           onchange="tournament.updateScore(${match.id}, 'away', this.value)"
                           style="width: 50px; text-align: center;">
                    <span>${match.awayTeam.name}</span>
                </div>
                <button class="btn btn-small btn-success" onclick="tournament.finishMatch(${match.id})">Finish Match</button>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderUpcomingMatches() {
        const container = document.getElementById('upcoming-matches-container');
        if (!container) return;

        const upcomingMatches = this.tournament.matches.filter(m => m.status === 'scheduled').slice(0, 10);

        if (upcomingMatches.length === 0) {
            container.innerHTML = '<p>No upcoming matches</p>';
            return;
        }

        const html = upcomingMatches.map(match => `
            <div style="padding: 8px; border-bottom: 1px solid #e5e8ec;">
                ${match.homeTeam.name} vs ${match.awayTeam.name}
                <button class="btn btn-small" onclick="tournament.startMatch(${match.id})" style="float: right;">Start</button>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    startMatch(matchId) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (match) {
            match.status = 'live';
            match.homeScore = 0;
            match.awayScore = 0;
            this.renderLiveView();
        }
    }

    updateScore(matchId, side, score) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (match) {
            if (side === 'home') {
                match.homeScore = parseInt(score) || 0;
            } else {
                match.awayScore = parseInt(score) || 0;
            }
        }
    }

    finishMatch(matchId) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (!match) return;

        match.status = 'completed';

        // Update team statistics
        const homeTeam = match.homeTeam;
        const awayTeam = match.awayTeam;
        const homeScore = match.homeScore || 0;
        const awayScore = match.awayScore || 0;

        homeTeam.played++;
        awayTeam.played++;
        homeTeam.goalsFor += homeScore;
        homeTeam.goalsAgainst += awayScore;
        awayTeam.goalsFor += awayScore;
        awayTeam.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
            homeTeam.wins++;
            homeTeam.points += this.tournament.settings.scoringSystem.win;
            awayTeam.losses++;
            awayTeam.points += this.tournament.settings.scoringSystem.loss;
        } else if (awayScore > homeScore) {
            awayTeam.wins++;
            awayTeam.points += this.tournament.settings.scoringSystem.win;
            homeTeam.losses++;
            homeTeam.points += this.tournament.settings.scoringSystem.loss;
        } else {
            homeTeam.draws++;
            awayTeam.draws++;
            homeTeam.points += this.tournament.settings.scoringSystem.draw;
            awayTeam.points += this.tournament.settings.scoringSystem.draw;
        }

        homeTeam.goalDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
        awayTeam.goalDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;

        this.renderLiveView();
    }

    // Results tab
    switchResultsTab(resultType) {
        document.querySelectorAll('.result-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.result-tab').forEach(tab => tab.classList.remove('active'));

        document.getElementById(`${resultType}-content`)?.classList.add('active');
        document.querySelector(`[data-result="${resultType}"]`)?.classList.add('active');

        if (resultType === 'standings') {
            this.renderFinalStandings();
        } else if (resultType === 'bracket') {
            this.renderBracket();
        } else if (resultType === 'stats') {
            this.renderStatistics();
        }
    }

    renderFinalStandings() {
        this.renderGroupStandings();
    }

    renderBracket() {
        const container = document.getElementById('bracket-content');
        if (!container) return;

        if (this.tournament.settings.format === 'group') {
            container.innerHTML = '<p>No knockout stage in this tournament</p>';
            return;
        }

        container.innerHTML = '<p>Bracket visualization - Interactive bracket tree would be rendered here</p>';
    }

    renderStatistics() {
        const container = document.getElementById('stats-content');
        if (!container) return;

        const completedMatches = this.tournament.matches.filter(m => m.status === 'completed');
        const totalGoals = completedMatches.reduce((sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0), 0);

        container.innerHTML = `
            <h3>Tournament Statistics</h3>
            <p>Total Matches Played: ${completedMatches.length}</p>
            <p>Total Goals Scored: ${totalGoals}</p>
            <p>Average Goals per Match: ${completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(2) : 0}</p>
        `;
    }
}

// Initialize tournament manager when page loads
let tournament;
document.addEventListener('DOMContentLoaded', () => {
    tournament = new TournamentManager();
});
