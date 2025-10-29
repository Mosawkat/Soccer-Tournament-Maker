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
                <h4>📊 Group Stage Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
                    <div><strong>Teams per group:</strong> ${teamsPerGroup}</div>
                    <div><strong>Games per team:</strong> ${gamesPerTeam}</div>
                    <div><strong>Total matches:</strong> ${totalGames}</div>
                    <div><strong>Total duration:</strong> ${hours}h ${mins}m</div>
                </div>
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
            if (totalAdvancing === nearestPowerOf2) {
                suggestionEl.innerHTML = `<strong style="color: #26b46a;">✓ Perfect!</strong> ${totalAdvancing} teams advancing creates a perfect ${nearestPowerOf2}-team bracket`;
            } else {
                suggestionEl.innerHTML = `⚠️ ${totalAdvancing} teams advancing → ${nearestPowerOf2}-team bracket needed (${nearestPowerOf2 - totalAdvancing} byes required)`;
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

        // Distribute teams evenly across groups (snake draft style for fairness)
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
        this.calculateKnockoutStats();
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
        
        this.tournament.stats.totalKnockoutMatches = totalMatches;
        this.tournament.stats.knockoutDuration = totalMatches * duration;

        const bracketEl = document.getElementById('bracket-preview');
        if (bracketEl) {
            const hours = Math.floor(this.tournament.stats.knockoutDuration / 60);
            const mins = this.tournament.stats.knockoutDuration % 60;
            
            bracketEl.innerHTML = `
                <h4>🏆 Knockout Stage Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
                    <div><strong>Total matches:</strong> ${totalMatches}</div>
                    <div><strong>Format:</strong> ${matchFormat === 'two-leg' ? 'Two-legged' : 'Single'}</div>
                    <div><strong>Total duration:</strong> ${hours}h ${mins}m</div>
                </div>
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

        const totalGroupDuration = this.tournament.stats.groupStageDuration;
        const totalKnockoutDuration = this.tournament.stats.knockoutDuration;
        const totalDuration = totalGroupDuration + totalKnockoutDuration;
        
        const totalMatches = this.tournament.stats.totalGroupMatches + this.tournament.stats.totalKnockoutMatches;

        const scheduleEl = document.getElementById('schedule-summary');
        if (scheduleEl) {
            const totalHours = Math.floor(totalDuration / 60);
            const totalMins = totalDuration % 60;
            const groupHours = Math.floor(totalGroupDuration / 60);
            const groupMins = totalGroupDuration % 60;
            const knockoutHours = Math.floor(totalKnockoutDuration / 60);
            const knockoutMins = totalKnockoutDuration % 60;
            
            const matchDays = Math.ceil(totalMatches / numFields);
            
            scheduleEl.innerHTML = `
                <h4>📅 Tournament Overview</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="background: #e8f0fe; padding: 1rem; border-radius: 8px;">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #1d6ae5;">Total Tournament</strong>
                        <div>${totalMatches} matches</div>
                        <div>${totalHours}h ${totalMins}m</div>
                        <div>${matchDays} match days</div>
                    </div>
                    ${this.tournament.settings.format !== 'knockout' ? `
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px;">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #26b46a;">Group Stage</strong>
                        <div>${this.tournament.stats.totalGroupMatches} matches</div>
                        <div>${groupHours}h ${groupMins}m</div>
                    </div>
                    ` : ''}
                    ${this.tournament.settings.format !== 'group' ? `
                    <div style="background: #fef3f2; padding: 1rem; border-radius: 8px;">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #dc2626;">Knockout Stage</strong>
                        <div>${this.tournament.stats.totalKnockoutMatches} matches</div>
                        <div>${knockoutHours}h ${knockoutMins}m</div>
                    </div>
                    ` : ''}
                </div>
                ${numFields < this.tournament.settings.numGroups ? '<p style="color: #dc2626; margin-top: 1rem;">⚠️ Warning: Fewer fields than groups may cause scheduling delays</p>' : ''}
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

        this.tournament.groups.forEach(group => {
            const teams = group.teams;
            const n = teams.length;

            if (n < 2) return;

            // Generate round-robin fixtures using circle method
            for (let round = 0; round < rounds; round++) {
                for (let i = 0; i < n - 1; i++) {
                    const roundMatches = [];
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

                        this.tournament.matches.push({
                            id: matchId++,
                            group: group.id,
                            groupName: group.name,
                            round: round + 1,
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
        });
    }

    generateKnockoutBracket() {
        let teams = [];

        // Get teams from group stage or use all teams
        if (this.tournament.settings.format === 'both') {
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

        // Create knockout matches based on selected stages
        let matchId = this.tournament.matches.length + 1;
        const stages = this.tournament.settings.knockoutStages;
        const matchFormat = this.tournament.settings.matchFormat;
        
        stages.forEach(stage => {
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
            const legs = matchFormat === 'two-leg' && stage !== 'final' ? 2 : 1;
            
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
            stages: stages
        };
    }

    organizeMatchDays() {
        const numFields = this.tournament.settings.numFields;
        const matches = this.tournament.matches;
        
        this.tournament.matchDays = [];
        let dayNumber = 1;
        let matchIndex = 0;
        
        while (matchIndex < matches.length) {
            const dayMatches = matches.slice(matchIndex, matchIndex + numFields);
            
            dayMatches.forEach((match, i) => {
                match.matchDay = dayNumber;
                match.field = (i % numFields) + 1;
            });
            
            this.tournament.matchDays.push({
                day: dayNumber,
                matches: dayMatches,
                stage: dayMatches[0].stage
            });
            
            matchIndex += numFields;
            dayNumber++;
        }
    }

    // Rendering functions
    renderSchedule() {
        const container = document.getElementById('schedule-display');
        if (!container) return;

        if (this.tournament.matchDays.length === 0) {
            container.innerHTML = '<p>No matches scheduled yet. Click "Generate Tournament" to create the schedule.</p>';
            return;
        }

        let html = '<div class="match-days-container">';
        
        this.tournament.matchDays.forEach(matchDay => {
            const stageLabel = matchDay.stage === 'group' ? 'Group Stage' : 'Knockout Stage';
            const stageBadge = matchDay.stage === 'group' ? 
                '<span style="background: #26b46a; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">GROUP</span>' :
                '<span style="background: #dc2626; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">KNOCKOUT</span>';
            
            html += `
                <div class="match-day-card">
                    <div class="match-day-header">
                        <h3>Match Day ${matchDay.day}</h3>
                        ${stageBadge}
                    </div>
                    <div class="match-day-matches">
            `;
            
            matchDay.matches.forEach(match => {
                const groupLabel = match.stage === 'group' ? `${match.groupName} - Round ${match.round}` : match.stageName;
                const legLabel = match.leg ? ` (Leg ${match.leg})` : '';
                
                html += `
                    <div class="schedule-match-card">
                        <div class="match-field">Field ${match.field}</div>
                        <div class="match-details">
                            <div class="match-label">${groupLabel}${legLabel}</div>
                            <div class="match-teams">
                                <span class="team-name">${match.homeTeam.name}</span>
                                <span class="vs">vs</span>
                                <span class="team-name">${match.awayTeam.name}</span>
                            </div>
                            <div class="match-duration">${match.duration} minutes</div>
                        </div>
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

    renderLiveView() {
        this.renderGroupStandings();
        this.renderCurrentMatches();
        this.renderUpcomingMatches();
    }

    renderGroupStandings() {
        const container = document.getElementById('group-standings-container');
        if (!container) return;

        if (this.tournament.groups.length === 0) {
            container.innerHTML = '<p>No group standings available</p>';
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
                    <h4>${group.name}</h4>
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
                            ${sorted.map((team, i) => `
                                <tr class="${i < this.tournament.settings.teamsAdvancing ? 'qualified' : ''}">
                                    <td>${i + 1}</td>
                                    <td style="text-align: left;">${team.name}</td>
                                    <td>${team.played}</td>
                                    <td>${team.wins}</td>
                                    <td>${team.draws}</td>
                                    <td>${team.losses}</td>
                                    <td>${team.goalsFor}</td>
                                    <td>${team.goalsAgainst}</td>
                                    <td>${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}</td>
                                    <td><strong>${team.points}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderCurrentMatches() {
        const container = document.getElementById('current-matches');
        if (!container) return;

        const currentMatches = this.tournament.matches.filter(m => m.status === 'in-progress');
        
        if (currentMatches.length === 0) {
            container.innerHTML = '<p>No matches currently in progress</p>';
            return;
        }

        const html = currentMatches.map(match => `
            <div class="match-card">
                <div class="match-info">
                    ${match.stage === 'group' ? `${match.groupName} - Round ${match.round}` : match.stageName}
                    ${match.field ? `<span style="color: #666;"> • Field ${match.field}</span>` : ''}
                </div>
                <div class="match-score">
                    <div>${match.homeTeam.name}</div>
                    <div class="score">${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}</div>
                    <div>${match.awayTeam.name}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderUpcomingMatches() {
        const container = document.getElementById('upcoming-matches');
        if (!container) return;

        const upcomingMatches = this.tournament.matches
            .filter(m => m.status === 'scheduled')
            .slice(0, 5);
        
        if (upcomingMatches.length === 0) {
            container.innerHTML = '<p>No upcoming matches</p>';
            return;
        }

        const html = upcomingMatches.map(match => `
            <div class="match-card">
                <div class="match-info">
                    ${match.stage === 'group' ? `${match.groupName} - Round ${match.round}` : match.stageName}
                    ${match.matchDay ? `<span style="color: #666;"> • Day ${match.matchDay}</span>` : ''}
                    ${match.field ? `<span style="color: #666;"> • Field ${match.field}</span>` : ''}
                </div>
                <div class="match-teams">
                    ${match.homeTeam.name} <strong>vs</strong> ${match.awayTeam.name}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Results tab
    switchResultsTab(tabName) {
        document.querySelectorAll('.result-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.result-tab').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(tabName + '-content')?.classList.add('active');
        document.querySelector(`[data-result="${tabName}"]`)?.classList.add('active');

        if (tabName === 'standings') this.renderFinalStandings();
        if (tabName === 'bracket') this.renderBracket();
        if (tabName === 'statistics') this.renderStatistics();
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

        container.innerHTML = '<div style="padding: 2rem; text-align: center; background: #f3f7fa; border-radius: 8px;">🏆 Interactive bracket visualization<br><small>Knockout matches will appear here</small></div>';
    }

    renderStatistics() {
        const container = document.getElementById('stats-content');
        if (!container) return;

        const completedMatches = this.tournament.matches.filter(m => m.status === 'completed');
        const totalGoals = completedMatches.reduce((sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0), 0);
        const avgGoals = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(2) : 0;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${this.tournament.matches.length}</div>
                    <div class="stat-label">Total Matches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedMatches.length}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalGoals}</div>
                    <div class="stat-label">Total Goals</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${avgGoals}</div>
                    <div class="stat-label">Avg Goals/Match</div>
                </div>
            </div>
        `;
    }

    // CSV Export functions
    exportScheduleCSV() {
        if (this.tournament.matchDays.length === 0) {
            alert('No schedule to export. Generate tournament first.');
            return;
        }

        let csv = 'Match Day,Field,Stage,Group/Round,Home Team,Away Team,Duration (min)\n';
        
        this.tournament.matchDays.forEach(matchDay => {
            matchDay.matches.forEach(match => {
                const groupInfo = match.stage === 'group' ? 
                    `${match.groupName} R${match.round}` : 
                    match.stageName + (match.leg ? ` Leg ${match.leg}` : '');
                
                csv += `${match.matchDay},${match.field},${match.stage},${groupInfo},${match.homeTeam.name},${match.awayTeam.name},${match.duration}\n`;
            });
        });

        this.downloadCSV(csv, 'tournament_schedule.csv');
    }

    exportStandingsCSV() {
        if (this.tournament.groups.length === 0) {
            alert('No standings to export.');
            return;
        }

        let csv = 'Group,Position,Team,Played,Won,Drawn,Lost,Goals For,Goals Against,Goal Difference,Points\n';
        
        this.tournament.groups.forEach(group => {
            const sorted = group.teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            sorted.forEach((team, i) => {
                csv += `${group.name},${i + 1},${team.name},${team.played},${team.wins},${team.draws},${team.losses},${team.goalsFor},${team.goalsAgainst},${team.goalDifference},${team.points}\n`;
            });
        });

        this.downloadCSV(csv, 'tournament_standings.csv');
    }

    exportResultsCSV() {
        const completedMatches = this.tournament.matches.filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            alert('No completed matches to export.');
            return;
        }

        let csv = 'Match ID,Stage,Group/Round,Home Team,Away Team,Home Score,Away Score,Match Day,Field\n';
        
        completedMatches.forEach(match => {
            const groupInfo = match.stage === 'group' ? 
                `${match.groupName} R${match.round}` : 
                match.stageName;
            
            csv += `${match.id},${match.stage},${groupInfo},${match.homeTeam.name},${match.awayTeam.name},${match.homeScore},${match.awayScore},${match.matchDay || 'N/A'},${match.field || 'N/A'}\n`;
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

// Initialize tournament manager when page loads
let tournament;
document.addEventListener('DOMContentLoaded', () => {
    tournament = new TournamentManager();
});
