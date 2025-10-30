// Tournament Manager - Enhanced Version with Match Days & CSV Export
class TournamentManager {
    constructor() {
        this.tournament = {
            teams: [],
            groups: [],
            matches: [],
            matchDays: [],
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
            stats: {
                groupStageDuration: 0,
                knockoutDuration: 0,
                totalGroupMatches: 0,
                totalKnockoutMatches: 0
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
        ['win-points', 'draw-points', 'loss-points'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.updateScoring());
        });
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

        // Export buttons
        document.getElementById('export-schedule')?.addEventListener('click', () => this.exportScheduleCSV());
        document.getElementById('export-standings')?.addEventListener('click', () => this.exportStandingsCSV());
        document.getElementById('export-results')?.addEventListener('click', () => this.exportResultsCSV());

        // Knockout stage checkboxes
        document.querySelectorAll('.stage-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateKnockoutStages());
        });

        // Results tab
        document.querySelectorAll('.result-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchResultsTab(e.target.dataset.result));
        });

        // Score editing modal
        document.getElementById('score-modal-close')?.addEventListener('click', () => this.closeScoreModal());
        document.getElementById('score-modal-cancel')?.addEventListener('click', () => this.closeScoreModal());
        document.getElementById('score-modal-save')?.addEventListener('click', () => this.saveMatchScore());
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
        const progressBar = document.getElementById('progress');
        if (progressBar) progressBar.style.width = percentage + '%';
    }

    // Tab management
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabName)?.classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Render content when switching to specific tabs
        if (tabName === 'results') {
            this.renderFinalStandings();
            this.renderKnockoutBracket();
            this.renderStatistics();
        }
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

        // Smart suggestion considering knockout bracket compatibility
        const suggestions = [];

        // For knockout tournaments, suggest groups that create power-of-2 advancing teams
        if (this.tournament.settings.format === 'both') {
            const powerOf2Targets = [4, 8, 16, 32];
            powerOf2Targets.forEach(target => {
                for (let groups = 2; groups <= 8; groups++) {
                    for (let advancing = 1; advancing <= 4; advancing++) {
                        if (groups * advancing === target && numTeams >= groups * 2) {
                            suggestions.push({
                                groups: groups,
                                advancing: advancing,
                                total: target,
                                teamsPerGroup: Math.ceil(numTeams / groups)
                            });
                        }
                    }
                }
            });

            if (suggestions.length > 0) {
                // Get best suggestion (closest to even distribution)
                const best = suggestions.sort((a, b) => {
                    const aDiff = Math.abs(a.teamsPerGroup * a.groups - numTeams);
                    const bDiff = Math.abs(b.teamsPerGroup * b.groups - numTeams);
                    return aDiff - bDiff;
                })[0];

                const suggestionEl = document.getElementById('groups-suggestion');
                if (suggestionEl) {
                    suggestionEl.textContent = `💡 Recommended: ${best.groups} groups with top ${best.advancing} advancing = ${best.total}-team knockout bracket (perfect for eliminations)`;
                }
                return;
            }
        }

        // Standard suggestion for group-only format
        let suggested = Math.ceil(Math.sqrt(numTeams));
        for (let i = suggested; i >= 2; i--) {
            if (numTeams % i === 0 || numTeams % i <= i) {
                suggested = i;
                break;
            }
        }

        const suggestionEl = document.getElementById('groups-suggestion');
        if (suggestionEl) {
            suggestionEl.textContent = `💡 Suggested: ${suggested} groups for ${numTeams} teams (~${Math.ceil(numTeams / suggested)} teams per group)`;
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

        this.tournament.stats.totalGroupMatches = totalGames;
        this.tournament.stats.groupStageDuration = totalGames * duration;

        const calcEl = document.getElementById('group-calculations');
        if (calcEl) {
            const hours = Math.floor(this.tournament.stats.groupStageDuration / 60);
            const mins = this.tournament.stats.groupStageDuration % 60;
            calcEl.innerHTML = `
                <strong>📊 Group Stage Calculations:</strong><br>
                • ${teamsPerGroup} teams per group<br>
                • ${gamesPerTeam} games per team<br>
                • ${totalGamesPerGroup} games per group<br>
                • <strong>${totalGames} total group matches</strong><br>
                • <strong>Estimated duration: ${hours}h ${mins}m</strong> (${duration} min per game)
            `;
        }
    }

    suggestKnockoutBracket() {
        const numGroups = this.tournament.settings.numGroups;
        const teamsAdvancing = this.tournament.settings.teamsAdvancing;

        if (!numGroups || !teamsAdvancing) return;

        const totalAdvancing = numGroups * teamsAdvancing;
        const knockoutEl = document.getElementById('knockout-suggestion');

        if (knockoutEl) {
            const isPowerOf2 = (totalAdvancing & (totalAdvancing - 1)) === 0;
            if (isPowerOf2) {
                knockoutEl.textContent = `✓ Perfect! ${totalAdvancing} teams advancing creates a balanced knockout bracket`;
                knockoutEl.style.color = '#26b46a';
            } else {
                knockoutEl.textContent = `⚠️ ${totalAdvancing} teams advancing may require byes or play-in matches for a bracket`;
                knockoutEl.style.color = '#ff9800';
            }
        }
    }

    validateAndNextGroups() {
        const numGroups = parseInt(document.getElementById('num-groups')?.value);
        const rounds = parseInt(document.getElementById('rounds-per-group')?.value);
        const teamsAdvancing = parseInt(document.getElementById('teams-advancing')?.value);
        const duration = parseInt(document.getElementById('group-game-duration')?.value);

        if (!numGroups || numGroups < 2 || numGroups > this.tournament.settings.numTeams / 2) {
            alert('Please enter a valid number of groups');
            return;
        }

        if (!duration || duration < 1) {
            alert('Please enter game duration');
            return;
        }

        this.tournament.settings.numGroups = numGroups;
        this.tournament.settings.roundsPerGroup = rounds;
        this.tournament.settings.teamsAdvancing = teamsAdvancing;
        this.tournament.settings.groupGameDuration = duration;

        // Assign teams to groups
        this.assignTeamsToGroups();

        // Navigate to next tab
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

        // Create groups
        this.tournament.groups = Array.from({ length: numGroups }, (_, i) => ({
            id: i + 1,
            name: String.fromCharCode(65 + i), // A, B, C, etc.
            teams: []
        }));

        // Distribute teams evenly across groups (snake draft style for fairness)
        teams.forEach((team, index) => {
            const groupIndex = Math.floor(index / Math.ceil(teams.length / numGroups));
            const group = this.tournament.groups[Math.min(groupIndex, numGroups - 1)];
            team.group = group.id;
            team.groupName = group.name;
            group.teams.push(team);
        });
    }

    // Knockout tab functions
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
        document.querySelectorAll('.stage-checkbox:checked').forEach(cb => {
            stages.push(cb.value);
        });
        this.tournament.settings.knockoutStages = stages;
        this.calculateKnockoutStats();
    }

    calculateKnockoutStats() {
        const stages = this.tournament.settings.knockoutStages;
        const duration = this.tournament.settings.knockoutGameDuration;
        const matchFormat = this.tournament.settings.matchFormat;

        let totalMatches = 0;
        const stageData = {
            'last32': 16,
            'last16': 8,
            'quarters': 4,
            'semis': 2,
            'final': 1,
            'third-place': 1
        };

        stages.forEach(stage => {
            const matches = stageData[stage] || 0;
            const legs = matchFormat === 'two-leg' && stage !== 'final' && stage !== 'third-place' ? 2 : 1;
            totalMatches += matches * legs;
        });

        this.tournament.stats.totalKnockoutMatches = totalMatches;
        this.tournament.stats.knockoutDuration = totalMatches * duration;

        const previewEl = document.getElementById('knockout-preview');
        if (previewEl && stages.length > 0) {
            const hours = Math.floor(this.tournament.stats.knockoutDuration / 60);
            const mins = this.tournament.stats.knockoutDuration % 60;

            previewEl.innerHTML = `
                <strong>🏆 Knockout Stage Preview:</strong><br>
                • ${stages.length} stage(s) selected<br>
                • ${matchFormat === 'two-leg' ? 'Two-leg' : 'Single-leg'} format${matchFormat === 'two-leg' ? ' (final always single)' : ''}<br>
                • <strong>${totalMatches} total knockout matches</strong><br>
                • <strong>Estimated duration: ${hours}h ${mins}m</strong> (${duration} min per game)
            `;
        }
    }

    goBackFromKnockout() {
        if (this.tournament.settings.format === 'both') {
            this.switchTab('groups');
        } else {
            this.switchTab('setup');
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

    // Schedule tab functions
    updateFields(count) {
        this.tournament.settings.numFields = parseInt(count) || 0;
        this.updateScheduleSummary();
    }

    updateStartTime(time) {
        this.tournament.settings.startTime = time;
        this.updateScheduleSummary();
    }

    updateScheduleSummary() {
        const numFields = this.tournament.settings.numFields;
        const startTime = this.tournament.settings.startTime;
        const totalMatches = this.tournament.stats.totalGroupMatches + this.tournament.stats.totalKnockoutMatches;
        const totalDuration = this.tournament.stats.groupStageDuration + this.tournament.stats.knockoutDuration;

        const summaryEl = document.getElementById('schedule-summary');
        if (summaryEl && numFields > 0) {
            const parallelRounds = Math.ceil(totalMatches / numFields);
            const actualDuration = parallelRounds * (totalDuration / (totalMatches || 1));
            const hours = Math.floor(actualDuration / 60);
            const mins = Math.round(actualDuration % 60);

            summaryEl.innerHTML = `
                <strong>📅 Tournament Overview:</strong><br>
                • ${totalMatches} total matches across ${numFields} field(s)<br>
                • ${parallelRounds} rounds of matches<br>
                • <strong>Estimated completion: ${hours}h ${mins}m</strong><br>
                ${startTime ? `• Start time: ${startTime}` : ''}
                ${numFields < this.tournament.settings.numGroups ? '<br>⚠️ Warning: Fewer fields than groups may cause scheduling delays' : ''}
            `;
        }
    }

    goBackFromSchedule() {
        if (this.tournament.settings.format === 'knockout') {
            this.switchTab('knockout');
        } else if (this.tournament.settings.format === 'both') {
            this.switchTab('knockout');
        } else {
            this.switchTab('groups');
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

        const timerDisplays = document.querySelectorAll('.timer-display');
        timerDisplays.forEach(el => el.textContent = display);
    }

    // Tournament generation
    generateTournament() {
        const numFields = parseInt(document.getElementById('num-fields')?.value);

        if (!numFields || numFields < 1) {
            alert('Please enter number of fields');
            return;
        }

        this.tournament.settings.numFields = numFields;

        // Clear existing matches
        this.tournament.matches = [];

        // Generate group stage matches
        if (this.tournament.settings.format !== 'knockout') {
            this.generateGroupStageMatches();
        }

        // Generate knockout bracket
        if (this.tournament.settings.format !== 'group') {
            this.generateKnockoutBracket();
        }

        // Organize matches into match days
        this.organizeMatchDays();

        this.tournament.currentStage = 'live';
        this.switchTab('schedule');
        this.renderSchedule();
        this.updateProgress();

        alert('✓ Tournament generated successfully! Check the Schedule tab to see match days.');
    }

    generateGroupStageMatches() {
        const rounds = this.tournament.settings.roundsPerGroup;
        let matchId = 1;

        // Generate all matches for each group first
        const groupMatches = [];

        this.tournament.groups.forEach(group => {
            const teams = group.teams;
            const n = teams.length;

            if (n < 2) return;

            const matches = [];

            // Generate round-robin fixtures using circle method
            for (let round = 0; round < rounds; round++) {
                for (let i = 0; i < n - 1; i++) {
                    for (let j = 0; j < Math.floor(n / 2); j++) {
                        let home = (i + j) % (n - 1);
                        let away = (n - 1 - j + i) % (n - 1);

                        if (j === 0) {
                            home = n - 1;
                        }

                        if (away === n - 1) {
                            away = home;
                            home = n - 1;
                        }

                        const homeTeam = teams[home];
                        const awayTeam = teams[away];

                        matches.push({
                            id: matchId++,
                            group: group.id,
                            groupName: group.name,
                            round: round + 1,
                            matchdayWithinGroup: i + 1,
                            stage: 'group',
                            homeTeam: homeTeam,
                            awayTeam: awayTeam,
                            homeScore: null,
                            awayScore: null,
                            status: 'scheduled',
                            duration: this.tournament.settings.groupGameDuration,
                            field: null,
                            matchDay: null,
                            startTime: null
                        });
                    }
                }
            }

            groupMatches.push({
                groupId: group.id,
                groupName: group.name,
                matches: matches
            });
        });

        // Now interleave matches so all groups play simultaneously/alternating
        const maxMatchesPerGroup = Math.max(...groupMatches.map(g => g.matches.length));
        
        for (let matchIndex = 0; matchIndex < maxMatchesPerGroup; matchIndex++) {
            groupMatches.forEach(group => {
                if (matchIndex < group.matches.length) {
                    this.tournament.matches.push(group.matches[matchIndex]);
                }
            });
        }
    }

    generateKnockoutBracket() {
        let teams = [];

        // Get teams from group stage or use all teams
        if (this.tournament.settings.format === 'both') {
            // Will be populated after group stage completion
            teams = Array.from({ length: this.tournament.settings.numGroups * this.tournament.settings.teamsAdvancing }, (_, i) => ({
                id: 0,
                name: 'TBD'
            }));
        } else {
            teams = [...this.tournament.teams];
        }

        // Create knockout matches based on selected stages
        let matchId = this.tournament.matches.length + 1;
        const stages = this.tournament.settings.knockoutStages;
        const matchFormat = this.tournament.settings.matchFormat;

        // Sort stages in proper order
        const stageOrder = ['last32', 'last16', 'quarters', 'semis', 'third-place', 'final'];
        const sortedStages = stages.sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

        sortedStages.forEach(stage => {
            const stageData = {
                'last32': { name: 'Round of 32', teams: 32 },
                'last16': { name: 'Round of 16', teams: 16 },
                'quarters': { name: 'Quarterfinals', teams: 8 },
                'semis': { name: 'Semifinals', teams: 4 },
                'final': { name: 'Final', teams: 2 },
                'third-place': { name: '3rd Place', teams: 2 }
            };

            const info = stageData[stage];
            if (!info) return;

            const numMatches = stage === 'third-place' || stage === 'final' ? 1 : info.teams / 2;
            const legs = matchFormat === 'two-leg' && stage !== 'final' && stage !== 'third-place' ? 2 : 1;

            for (let leg = 1; leg <= legs; leg++) {
                for (let i = 0; i < numMatches; i++) {
                    this.tournament.matches.push({
                        id: matchId++,
                        stage: 'knockout',
                        knockoutStage: stage,
                        stageName: info.name,
                        leg: legs > 1 ? leg : null,
                        matchNumber: i + 1,
                        homeTeam: { id: 0, name: 'TBD' },
                        awayTeam: { id: 0, name: 'TBD' },
                        homeScore: null,
                        awayScore: null,
                        status: 'scheduled',
                        duration: this.tournament.settings.knockoutGameDuration,
                        field: null,
                        matchDay: null,
                        startTime: null
                    });
                }
            }
        });

        this.tournament.knockoutBracket = {
            teams: teams,
            stages: sortedStages
        };
    }

    organizeMatchDays() {
        const numFields = this.tournament.settings.numFields;
        const matches = this.tournament.matches;
        this.tournament.matchDays = [];

        // Separate group and knockout matches
        const groupMatches = matches.filter(m => m.stage === 'group');
        const knockoutMatches = matches.filter(m => m.stage === 'knockout');

        let dayNumber = 1;

        // Organize group stage matches
        if (groupMatches.length > 0) {
            const numGroups = this.tournament.settings.numGroups;
            
            // Group matches are already interleaved, so we just need to organize them by match days
            let matchIndex = 0;

            while (matchIndex < groupMatches.length) {
                const dayMatches = groupMatches.slice(matchIndex, matchIndex + numFields);

                dayMatches.forEach((match, i) => {
                    match.matchDay = dayNumber;
                    match.field = (i % numFields) + 1;
                });

                this.tournament.matchDays.push({
                    day: dayNumber,
                    matches: dayMatches,
                    stage: 'group'
                });

                matchIndex += numFields;
                dayNumber++;
            }
        }

        // Organize knockout matches
        if (knockoutMatches.length > 0) {
            let matchIndex = 0;

            while (matchIndex < knockoutMatches.length) {
                const dayMatches = knockoutMatches.slice(matchIndex, matchIndex + numFields);

                dayMatches.forEach((match, i) => {
                    match.matchDay = dayNumber;
                    match.field = (i % numFields) + 1;
                });

                this.tournament.matchDays.push({
                    day: dayNumber,
                    matches: dayMatches,
                    stage: 'knockout'
                });

                matchIndex += numFields;
                dayNumber++;
            }
        }
    }

    // Score editing functions
    openScoreModal(matchId) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (!match) return;

        this.currentEditingMatch = match;

        // Populate modal
        document.getElementById('score-modal-match-title').textContent = 
            match.stage === 'group' 
                ? `Group ${match.groupName} - ${match.homeTeam.name} vs ${match.awayTeam.name}`
                : `${match.stageName} - ${match.homeTeam.name} vs ${match.awayTeam.name}`;

        document.getElementById('score-home-team').textContent = match.homeTeam.name;
        document.getElementById('score-away-team').textContent = match.awayTeam.name;
        document.getElementById('score-home-input').value = match.homeScore !== null ? match.homeScore : '';
        document.getElementById('score-away-input').value = match.awayScore !== null ? match.awayScore : '';

        // Show modal
        document.getElementById('score-modal').style.display = 'flex';
    }

    closeScoreModal() {
        document.getElementById('score-modal').style.display = 'none';
        this.currentEditingMatch = null;
    }

    saveMatchScore() {
        if (!this.currentEditingMatch) return;

        const homeScore = parseInt(document.getElementById('score-home-input').value);
        const awayScore = parseInt(document.getElementById('score-away-input').value);

        if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
            alert('Please enter valid scores (0 or greater)');
            return;
        }

        const match = this.currentEditingMatch;

        // Revert previous score effects if match was already scored
        if (match.homeScore !== null && match.awayScore !== null && match.stage === 'group') {
            this.revertMatchStats(match);
        }

        // Update match score
        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.status = 'completed';

        // Update team statistics for group stage matches
        if (match.stage === 'group') {
            this.updateTeamStats(match);
        }

        // Update knockout bracket progression
        if (match.stage === 'knockout') {
            this.updateKnockoutProgression(match);
        }

        // Re-render relevant sections
        this.renderSchedule();
        this.renderLiveView();
        this.renderFinalStandings();
        this.renderKnockoutBracket();
        this.renderStatistics();

        this.closeScoreModal();
    }

    revertMatchStats(match) {
        const homeTeam = match.homeTeam;
        const awayTeam = match.awayTeam;
        const oldHomeScore = match.homeScore;
        const oldAwayScore = match.awayScore;

        homeTeam.played--;
        awayTeam.played--;

        homeTeam.goalsFor -= oldHomeScore;
        homeTeam.goalsAgainst -= oldAwayScore;
        awayTeam.goalsFor -= oldAwayScore;
        awayTeam.goalsAgainst -= oldHomeScore;

        if (oldHomeScore > oldAwayScore) {
            homeTeam.wins--;
            homeTeam.points -= this.tournament.settings.scoringSystem.win;
            awayTeam.losses--;
            awayTeam.points -= this.tournament.settings.scoringSystem.loss;
        } else if (oldHomeScore < oldAwayScore) {
            awayTeam.wins--;
            awayTeam.points -= this.tournament.settings.scoringSystem.win;
            homeTeam.losses--;
            homeTeam.points -= this.tournament.settings.scoringSystem.loss;
        } else {
            homeTeam.draws--;
            awayTeam.draws--;
            homeTeam.points -= this.tournament.settings.scoringSystem.draw;
            awayTeam.points -= this.tournament.settings.scoringSystem.draw;
        }

        homeTeam.goalDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
        awayTeam.goalDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
    }

    updateTeamStats(match) {
        const homeTeam = match.homeTeam;
        const awayTeam = match.awayTeam;
        const homeScore = match.homeScore;
        const awayScore = match.awayScore;

        // Update games played
        homeTeam.played++;
        awayTeam.played++;

        // Update goals
        homeTeam.goalsFor += homeScore;
        homeTeam.goalsAgainst += awayScore;
        awayTeam.goalsFor += awayScore;
        awayTeam.goalsAgainst += homeScore;

        // Update results and points
        if (homeScore > awayScore) {
            homeTeam.wins++;
            homeTeam.points += this.tournament.settings.scoringSystem.win;
            awayTeam.losses++;
            awayTeam.points += this.tournament.settings.scoringSystem.loss;
        } else if (homeScore < awayScore) {
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

        // Update goal difference
        homeTeam.goalDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
        awayTeam.goalDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
    }

    updateKnockoutProgression(match) {
        // Determine winner
        let winner = null;
        if (match.homeScore > match.awayScore) {
            winner = match.homeTeam;
        } else if (match.awayScore > match.homeScore) {
            winner = match.awayTeam;
        }

        // For now, just mark the match as completed
        // Full bracket progression would require more complex logic
        match.winner = winner;
    }

    // Rendering functions
    renderSchedule() {
        const container = document.getElementById('schedule-display');
        if (!container) return;

        if (this.tournament.matchDays.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <p style="font-size: 1.2rem; color: #666;">No matches scheduled yet. Click "Generate Tournament" to create the schedule.</p>
                </div>
            `;
            return;
        }

        // Separate group and knockout matches
        const groupMatches = this.tournament.matches.filter(m => m.stage === 'group');
        const knockoutMatches = this.tournament.matches.filter(m => m.stage === 'knockout');

        let html = '';

        // Group Stage Section
        if (groupMatches.length > 0) {
            html += '<div class="schedule-section"><h2 class="schedule-section-title">⚽ Group Stage</h2>';
            html += '<div class="match-days-container">';

            const groupDays = this.tournament.matchDays.filter(md => md.stage === 'group');
            groupDays.forEach(matchDay => {
                html += this.renderMatchDayCard(matchDay);
            });

            html += '</div></div>';
        }

        // Knockout Stage Section
        if (knockoutMatches.length > 0) {
            html += '<div class="schedule-section"><h2 class="schedule-section-title">🏆 Knockout Stage</h2>';
            html += '<div class="match-days-container">';

            const knockoutDays = this.tournament.matchDays.filter(md => md.stage === 'knockout');
            knockoutDays.forEach(matchDay => {
                html += this.renderMatchDayCard(matchDay);
            });

            html += '</div></div>';
        }

        container.innerHTML = html;
    }

    renderMatchDayCard(matchDay) {
        const numFields = this.tournament.settings.numFields;
        const subtitle = numFields === 1 
            ? 'Games played at the same time' 
            : `${matchDay.matches.length} ${matchDay.matches.length === 1 ? 'game' : 'games'} played simultaneously`;

        let html = `
            <div class="match-day-card">
                <div class="match-day-header">
                    <h3>Match Day ${matchDay.day}</h3>
                    <span>${subtitle}</span>
                </div>
                <div class="match-day-matches">
        `;

        matchDay.matches.forEach(match => {
            const scoreDisplay = match.homeScore !== null && match.awayScore !== null
                ? `<div class="match-score-display"><span class="score">${match.homeScore}</span> - <span class="score">${match.awayScore}</span></div>`
                : '<div class="match-score-display" style="color: #999;">Not played</div>';

            html += `
                <div class="schedule-match-card">
                    <div class="match-field">Field ${match.field}</div>
                    <div class="match-label">
                        ${match.stage === 'group' 
                            ? `Group ${match.groupName}${match.round ? ` - Round ${match.round}` : ''}`
                            : `${match.stageName}${match.leg ? ` (Leg ${match.leg})` : ''}`}
                    </div>
                    <div class="match-teams">
                        <span class="team-name">${match.homeTeam.name}</span>
                        <span class="vs">vs</span>
                        <span class="team-name">${match.awayTeam.name}</span>
                    </div>
                    ${scoreDisplay}
                    <div class="match-duration">${match.duration} minutes</div>
                    <button class="btn btn-small btn-primary" onclick="manager.openScoreModal(${match.id})" style="margin-top: 0.5rem; width: 100%;">
                        ${match.homeScore !== null ? '✏️ Edit Score' : '⚽ Enter Score'}
                    </button>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    renderLiveView() {
        this.renderLiveStandings();
        this.renderCurrentMatches();
        this.renderUpcomingMatches();
    }

    renderLiveStandings() {
        const container = document.getElementById('live-standings');
        if (!container) return;

        if (this.tournament.groups.length === 0) {
            container.innerHTML = '<p style="color: #666;">No group standings available</p>';
            return;
        }

        let html = '';

        this.tournament.groups.forEach(group => {
            const sorted = group.teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            html += `
                <div class="group-standings">
                    <h4>Group ${group.name}</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Pos</th>
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
            `;

            sorted.forEach((team, i) => {
                const qualified = i < this.tournament.settings.teamsAdvancing ? 'class="qualified"' : '';
                html += `
                    <tr ${qualified}>
                        <td>${i + 1}</td>
                        <td>${team.name}</td>
                        <td>${team.played}</td>
                        <td>${team.wins}</td>
                        <td>${team.draws}</td>
                        <td>${team.losses}</td>
                        <td>${team.goalsFor}</td>
                        <td>${team.goalsAgainst}</td>
                        <td>${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderCurrentMatches() {
        const container = document.getElementById('live-current');
        if (!container) return;

        const currentMatches = this.tournament.matches.filter(m => m.status === 'in-progress');

        if (currentMatches.length === 0) {
            container.innerHTML = '<p style="color: #666;">No matches currently in progress</p>';
            return;
        }

        const html = currentMatches.map(match => `
            <div class="match-card">
                <div class="match-info">
                    ${match.stage === 'group' ? `Group ${match.groupName}` : match.stageName} • Field ${match.field}
                </div>
                <div class="match-score">
                    <div>
                        <div class="team-name">${match.homeTeam.name}</div>
                        <div class="score">${match.homeScore !== null ? match.homeScore : 0}</div>
                    </div>
                    <div style="text-align: center; color: #999;">LIVE</div>
                    <div style="text-align: right;">
                        <div class="team-name">${match.awayTeam.name}</div>
                        <div class="score">${match.awayScore !== null ? match.awayScore : 0}</div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderUpcomingMatches() {
        const container = document.getElementById('live-upcoming');
        if (!container) return;

        const upcomingMatches = this.tournament.matches
            .filter(m => m.status === 'scheduled')
            .slice(0, 5);

        if (upcomingMatches.length === 0) {
            container.innerHTML = '<p style="color: #666;">No upcoming matches</p>';
            return;
        }

        const html = upcomingMatches.map(match => `
            <div class="match-card">
                <div class="match-info">
                    ${match.stage === 'group' ? `Group ${match.groupName}` : match.stageName} • Field ${match.field}
                </div>
                <div class="match-teams">
                    ${match.homeTeam.name} <span class="vs">vs</span> ${match.awayTeam.name}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Results tab functions
    switchResultsTab(tab) {
        document.querySelectorAll('.result-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.result-tab').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`${tab}-content`)?.classList.add('active');
        document.querySelector(`[data-result="${tab}"]`)?.classList.add('active');

        // Render the selected tab
        if (tab === 'standings') {
            this.renderFinalStandings();
        } else if (tab === 'bracket') {
            this.renderKnockoutBracket();
        } else if (tab === 'stats') {
            this.renderStatistics();
        }
    }

    renderFinalStandings() {
        const container = document.getElementById('final-standings');
        if (!container) return;

        if (this.tournament.groups.length === 0) {
            container.innerHTML = '<p style="color: #666;">No group standings available</p>';
            return;
        }

        let html = '<div class="export-buttons-container">';
        html += '<button class="btn btn-primary" onclick="manager.exportStandingsCSV()">📥 Export Standings</button>';
        html += '<button class="btn btn-primary" onclick="manager.exportResultsCSV()">📥 Export Results</button>';
        html += '</div>';

        this.tournament.groups.forEach(group => {
            const sorted = group.teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            html += `
                <div class="group-standings">
                    <h4>Group ${group.name}</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Pos</th>
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
            `;

            sorted.forEach((team, i) => {
                const qualified = i < this.tournament.settings.teamsAdvancing ? 'class="qualified"' : '';
                html += `
                    <tr ${qualified}>
                        <td>${i + 1}</td>
                        <td>${team.name}</td>
                        <td>${team.played}</td>
                        <td>${team.wins}</td>
                        <td>${team.draws}</td>
                        <td>${team.losses}</td>
                        <td>${team.goalsFor}</td>
                        <td>${team.goalsAgainst}</td>
                        <td>${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderKnockoutBracket() {
        const container = document.getElementById('bracket-content');
        if (!container) return;

        if (this.tournament.settings.format === 'group') {
            container.innerHTML = '<p style="color: #666; padding: 2rem; text-align: center;">No knockout stage in this tournament</p>';
            return;
        }

        const knockoutMatches = this.tournament.matches.filter(m => m.stage === 'knockout');
        if (knockoutMatches.length === 0) {
            container.innerHTML = '<p style="color: #666; padding: 2rem; text-align: center;">No knockout matches scheduled yet</p>';
            return;
        }

        // Group matches by stage
        const stages = this.tournament.settings.knockoutStages;
        const stageOrder = ['last32', 'last16', 'quarters', 'semis', 'third-place', 'final'];
        const sortedStages = stages.sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

        let html = '<div class="bracket-container">';

        sortedStages.forEach(stage => {
            const stageMatches = knockoutMatches.filter(m => m.knockoutStage === stage);
            if (stageMatches.length === 0) return;

            const stageNames = {
                'last32': 'Round of 32',
                'last16': 'Round of 16',
                'quarters': 'Quarterfinals',
                'semis': 'Semifinals',
                'third-place': '3rd Place Match',
                'final': 'Final'
            };

            html += `
                <div class="bracket-stage">
                    <h3 class="bracket-stage-title">${stageNames[stage]}</h3>
                    <div class="bracket-matches">
            `;

            stageMatches.forEach(match => {
                const homeWinner = match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore ? 'winner' : '';
                const awayWinner = match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore ? 'winner' : '';

                html += `
                    <div class="bracket-match">
                        <div class="bracket-match-header">
                            Match ${match.matchNumber}${match.leg ? ` - Leg ${match.leg}` : ''}
                        </div>
                        <div class="bracket-team ${homeWinner}">
                            <span class="bracket-team-name">${match.homeTeam.name}</span>
                            <span class="bracket-team-score">${match.homeScore !== null ? match.homeScore : '-'}</span>
                        </div>
                        <div class="bracket-team ${awayWinner}">
                            <span class="bracket-team-name">${match.awayTeam.name}</span>
                            <span class="bracket-team-score">${match.awayScore !== null ? match.awayScore : '-'}</span>
                        </div>
                        <button class="btn btn-small btn-primary" onclick="manager.openScoreModal(${match.id})" style="margin-top: 0.5rem; width: 100%;">
                            ${match.homeScore !== null ? '✏️ Edit' : '⚽ Enter Score'}
                        </button>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    renderStatistics() {
        const container = document.getElementById('statistics-content');
        if (!container) return;

        const totalMatches = this.tournament.matches.length;
        const completedMatches = this.tournament.matches.filter(m => m.status === 'completed').length;
        const totalGoals = this.tournament.matches
            .filter(m => m.homeScore !== null && m.awayScore !== null)
            .reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);

        const groupMatches = this.tournament.matches.filter(m => m.stage === 'group');
        const knockoutMatches = this.tournament.matches.filter(m => m.stage === 'knockout');
        const completedGroupMatches = groupMatches.filter(m => m.status === 'completed').length;
        const completedKnockoutMatches = knockoutMatches.filter(m => m.status === 'completed').length;

        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalMatches}</div>
                    <div class="stat-label">Total Matches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedMatches}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalGoals}</div>
                    <div class="stat-label">Total Goals</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedMatches > 0 ? (totalGoals / completedMatches).toFixed(1) : 0}</div>
                    <div class="stat-label">Goals per Match</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedGroupMatches}</div>
                    <div class="stat-label">Group Stage Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedKnockoutMatches}</div>
                    <div class="stat-label">Knockout Completed</div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // CSV Export functions
    exportScheduleCSV() {
        if (this.tournament.matches.length === 0) {
            alert('No matches to export');
            return;
        }

        let csv = 'Match Day,Field,Stage,Group/Round,Home Team,Away Team,Home Score,Away Score,Duration,Status\n';

        this.tournament.matches.forEach(match => {
            const stage = match.stage === 'group' ? `Group ${match.groupName}` : match.stageName;
            const homeScore = match.homeScore !== null ? match.homeScore : '';
            const awayScore = match.awayScore !== null ? match.awayScore : '';
            
            csv += `${match.matchDay},${match.field},"${stage}","${match.round || ''}","${match.homeTeam.name}","${match.awayTeam.name}",${homeScore},${awayScore},${match.duration},${match.status}\n`;
        });

        this.downloadCSV(csv, 'tournament_schedule.csv');
    }

    exportStandingsCSV() {
        if (this.tournament.groups.length === 0) {
            alert('No standings to export');
            return;
        }

        let csv = 'Group,Position,Team,Played,Wins,Draws,Losses,Goals For,Goals Against,Goal Difference,Points\n';

        this.tournament.groups.forEach(group => {
            const sorted = group.teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            sorted.forEach((team, i) => {
                csv += `${group.name},${i + 1},"${team.name}",${team.played},${team.wins},${team.draws},${team.losses},${team.goalsFor},${team.goalsAgainst},${team.goalDifference},${team.points}\n`;
            });
        });

        this.downloadCSV(csv, 'tournament_standings.csv');
    }

    exportResultsCSV() {
        const completedMatches = this.tournament.matches.filter(m => m.status === 'completed');

        if (completedMatches.length === 0) {
            alert('No completed matches to export');
            return;
        }

        let csv = 'Match Day,Field,Stage,Group/Round,Home Team,Home Score,Away Score,Away Team,Duration\n';

        completedMatches.forEach(match => {
            const stage = match.stage === 'group' ? `Group ${match.groupName}` : match.stageName;
            csv += `${match.matchDay},${match.field},"${stage}","${match.round || ''}","${match.homeTeam.name}",${match.homeScore},${match.awayScore},"${match.awayTeam.name}",${match.duration}\n`;
        });

        this.downloadCSV(csv, 'tournament_results.csv');
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize tournament manager
let manager;
document.addEventListener('DOMContentLoaded', () => {
    manager = new TournamentManager();
});
