import { AvalonGame, PHASES } from './game.js';
import { NetworkManager, ACTION_TYPES } from './network.js';
import { getInitialRoles, getKnowledge, ROLE_TYPES, TEAMS, GAME_CONFIGS, ROLES } from './roles.js';

class AvalonApp {
    constructor() {
        this.game = new AvalonGame();
        this.network = new NetworkManager(
            (state) => this.render(state),
            (msg) => this.notify(msg)
        );
        this.localPlayerName = '';
        this.selectedPlayers = []; // For team picking
        
        this.initDOM();
    }

    async initDOM() {
        // Screens
        this.screens = {
            lobby: document.getElementById('lobby-screen'),
            room: document.getElementById('room-screen'),
            leader: document.getElementById('leader-screen'),
            role: document.getElementById('role-screen'),
            game: document.getElementById('game-screen'),
            end: document.getElementById('end-screen')
        };

        // Lobby
        this.btnCreate = document.getElementById('btn-create-room');
        this.btnJoin = document.getElementById('btn-join-room');
        
        this.btnCreate.disabled = true;
        this.btnJoin.disabled = true;
        this.btnCreate.innerText = 'Initializing...';

        this.btnCreate.onclick = () => this.createRoom();
        this.btnJoin.onclick = () => this.joinRoom();

        document.getElementById('link-how-to-play').onclick = () => {
            document.getElementById('instructions-modal').classList.remove('hidden');
        };

        // Network Init
        try {
            // Add a 5 second timeout to network init for better UX
            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Network Timeout')), 5000)
            );
            await Promise.race([this.network.init(), timeout]);
            console.log('Network initialized successfully');
        } catch (err) {
            console.error('Network initialization failed or timed out:', err);
            this.notify('Network slow or unavailable. You can still try to create a room.');
        } finally {
            this.btnCreate.disabled = false;
            this.btnJoin.disabled = false;
            this.btnCreate.innerText = 'Create New Room';
        }

        document.getElementById('btn-close-instructions').onclick = () => {
            document.getElementById('instructions-modal').classList.add('hidden');
        };

        document.getElementById('btn-view-rules').onclick = () => {
            document.getElementById('instructions-modal').classList.remove('hidden');
        };

        document.getElementById('btn-close-rules').onclick = () => {
            document.getElementById('instructions-modal').classList.add('hidden');
        };

        // Room
        const startBtn = document.getElementById('btn-start-game');
        startBtn.addEventListener('click', () => {
            console.log('Start button physically clicked');
            this.startGame();
        });

        // Role
        document.getElementById('role-card').onclick = (e) => {
            e.currentTarget.classList.add('revealed');
        };
        document.getElementById('btn-ready').onclick = () => {
            this.network.send({ type: ACTION_TYPES.READY, id: this.network.playerId });
            document.getElementById('btn-ready').disabled = true;
            document.getElementById('btn-ready').innerText = 'Waiting...';
        };

        // Footer & Identity
        document.getElementById('role-reminder').onclick = () => {
            document.getElementById('identity-modal').classList.remove('hidden');
        };

        document.getElementById('btn-close-identity').onclick = () => {
            document.getElementById('identity-modal').classList.add('hidden');
        };

        // Standard Modal Background Clicks
        const modals = ['modal-overlay', 'instructions-modal', 'identity-modal'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = (e) => {
                    if (e.target === el) el.classList.add('hidden');
                };
            }
        });

        // Leader
        document.getElementById('btn-proceed-to-roles').onclick = () => {
            this.network.send({ type: ACTION_TYPES.PROCEED_TO_ROLES });
        };

        // Modals
        document.getElementById('btn-vote-approve').onclick = () => this.submitVote(true);
        document.getElementById('btn-vote-reject').onclick = () => this.submitVote(false);
        document.getElementById('btn-quest-success').onclick = () => this.submitQuestVote(true);
        document.getElementById('btn-quest-fail').onclick = () => this.submitQuestVote(false);

        document.getElementById('btn-copy-id').onclick = () => {
            const id = document.getElementById('display-room-id').innerText;
            navigator.clipboard.writeText(id).then(() => this.notify('Room ID copied!'));
        };

        // Initialize Peer
        try {
            await this.network.init();
            this.btnCreate.disabled = false;
            this.btnJoin.disabled = false;
            this.btnCreate.innerText = 'Create New Room';
            console.log('App initialized with ID:', this.network.playerId);
        } catch (err) {
            this.notify('Failed to connect to signaling server.');
            console.error(err);
        }
    }

    notify(msg) {
        const n = document.getElementById('notification');
        n.innerText = msg;
        n.classList.remove('hidden');
        setTimeout(() => n.classList.add('hidden'), 3000);
    }

    updateIdentity(state) {
        if (this.localPlayerName) {
            document.getElementById('local-identity').classList.remove('hidden');
            document.getElementById('display-local-name').innerText = this.localPlayerName;
        }

        const footer = document.getElementById('game-footer');
        const me = state ? state.players.find(p => p.id === this.network.playerId) : null;

        if (state && me && state.phase !== PHASES.LOBBY && state.phase !== PHASES.END) {
            footer.classList.remove('hidden');
            const roleInfo = ROLES[me.role];
            const knowledge = getKnowledge(me.role, state.players);
            
            const reminderName = document.getElementById('reminder-role-name');
            const reminderBadge = document.getElementById('role-reminder');
            
            reminderName.innerText = roleInfo.name;
            const team = roleInfo.team.toLowerCase();
            reminderBadge.className = `role-badge ${team}`;
            
            // Populate Identity Modal Content
            document.getElementById('identity-role-name').innerText = roleInfo.name;
            document.getElementById('identity-role-desc').innerText = roleInfo.description;
            
            const header = document.getElementById('identity-header-team');
            header.innerText = roleInfo.team.toUpperCase();
            header.className = `phase-badge ${team}`;

            const knowledgeBox = document.getElementById('identity-knowledge');
            const seenNames = knowledge.seen.map(id => state.players.find(p => p.id === id)?.name || 'Unknown');
            
            knowledgeBox.innerHTML = `
                <div style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.5rem">SECRET KNOWLEDGE:</div>
                <div style="font-weight: bold; color: white;">${knowledge.text}</div>
                <div style="margin-top: 0.5rem; color: var(--accent-gold);">${seenNames.length > 0 ? seenNames.join(', ') : 'None'}</div>
            `;
        } else {
            footer.classList.add('hidden');
        }
    }

    async createRoom() {
        this.localPlayerName = prompt('Enter your name:') || 'Player 1';
        this.network.createRoom(this.network.playerId);
        
        // Host override handleHostData
        this.network.handleHostData = (data) => this.processAction(data);
        
        // Add self as player
        this.game.state.players.push({
            id: this.network.playerId,
            name: this.localPlayerName,
            role: null,
            ready: false
        });
        
        document.getElementById('display-room-id').innerText = this.network.playerId;
        this.updateIdentity(); // Show name
        this.showScreen('room');
        this.render(this.game.state);
    }

    joinRoom() {
        const roomId = document.getElementById('join-room-id').value;
        if (!roomId) return this.notify('Please enter a Room ID');
        
        this.localPlayerName = prompt('Enter your name:') || 'Guest';
        this.network.joinRoom(roomId, this.localPlayerName);
        this.updateIdentity(); // Show name
        this.showScreen('room');
    }

    processAction(data) {
        const state = this.game.state;
        switch (data.type) {
            case ACTION_TYPES.JOIN:
                if (state.players.length < 10) {
                    state.players.push({ id: data.id, name: data.name, role: null, ready: false });
                }
                break;
            case ACTION_TYPES.READY:
                this.game.setPlayerReady(data.id);
                break;
            case ACTION_TYPES.PICK_TEAM:
                this.game.selectTeam(data.team);
                break;
            case ACTION_TYPES.VOTE:
                this.game.submitVote(data.id, data.approve);
                break;
            case ACTION_TYPES.QUEST_VOTE:
                this.game.submitQuestVote(data.success);
                break;
            case ACTION_TYPES.ASSASSINATE:
                this.game.assassinate(data.targetId);
                break;
            case ACTION_TYPES.PROCEED_TO_ROLES:
                this.game.proceedToRoles();
                break;
        }

        this.network.broadcast(state);
    }

    startGame() {
        try {
            const count = this.game.state.players.length;
            console.log('Attempting to start game with', count, 'players');
            
            if (count < 5) {
                this.notify('Need at least 5 players to start');
                return;
            }
            
            let roles = getInitialRoles(count);
            
            if (!roles) {
                this.notify('Critical Error: Could not generate roles');
                return;
            }

            // Ensure we only have as many roles as players
            if (roles.length > count) {
                roles = roles.slice(0, count);
            }

            this.game.startGame(roles);
            this.network.broadcast(this.game.state);
            this.notify('Game Started!');
        } catch (err) {
            console.error('Start Game Error:', err);
            this.notify('Error: ' + err.message);
        }
    }

    submitVote(approve) {
        this.network.send({ type: ACTION_TYPES.VOTE, id: this.network.playerId, approve });
        this.hideModal();
    }

    submitQuestVote(success) {
        this.network.send({ type: ACTION_TYPES.QUEST_VOTE, success });
        this.hideModal();
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[name].classList.add('active');
    }

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('vote-modal').classList.add('hidden');
        document.getElementById('quest-modal').classList.add('hidden');
        document.getElementById('instructions-modal').classList.add('hidden');
    }

    render(state) {
        console.log('Rendering phase:', state.phase, 'Players:', state.players.length, 'isHost:', this.network.isHost);
        this.updateIdentity(state); // Enhanced identity check
        if (state.phase === PHASES.LOBBY) {
            // If we have players, we are in the Waiting Room. 
            // If no players, we are still on the Main Menu.
            if (state.players.length > 0) this.showScreen('room');
            else this.showScreen('lobby');
        }
        else if (state.phase === PHASES.LEADER_REVEAL) this.renderLeaderReveal(state);
        else if (state.phase === PHASES.ROLES) this.renderRoleReveal(state);
        else if (state.phase === PHASES.END) this.renderEnd(state);
        else this.renderGame(state);

        // Update player list in Room
        const list = document.getElementById('player-list');
        list.innerHTML = state.players.map((p, i) => `
            <li>
                ${p.name} ${i === 0 ? '<span class="host-badge">HOST</span>' : ''}
                ${p.ready ? '✅' : ''}
            </li>
        `).join('');
        document.getElementById('player-count').innerText = state.players.length;
        
        if (this.network.isHost && state.phase === PHASES.LOBBY) {
            document.getElementById('host-controls').classList.remove('hidden');
            document.getElementById('client-waiting').classList.add('hidden');
        } else if (state.phase === PHASES.LOBBY) {
            document.getElementById('host-controls').classList.add('hidden');
            document.getElementById('client-waiting').classList.remove('hidden');
        } else {
            document.getElementById('host-controls').classList.add('hidden');
            document.getElementById('client-waiting').classList.add('hidden');
        }
    }

    renderLeaderReveal(state) {
        this.showScreen('leader');
        const leader = state.players[state.leaderIndex];
        document.getElementById('first-leader-name').innerText = leader.name;
        
        if (this.network.isHost) {
            document.getElementById('leader-controls').classList.remove('hidden');
        } else {
            document.getElementById('leader-controls').classList.add('hidden');
        }
    }

    renderRoleReveal(state) {
        this.showScreen('role');
        const me = state.players.find(p => p.id === this.network.playerId);
        if (!me) return;

        const roleCard = document.getElementById('role-card');
        const cardBack = roleCard.querySelector('.card-back');
        const loyaltyTag = document.getElementById('role-loyalty');
        
        // Clear previous classes
        cardBack.className = 'card-back';
        loyaltyTag.className = 'loyalty-tag';
        
        const roleInfo = ROLES[me.role];
        if (!roleInfo) {
            console.error('No role info found for:', me.role);
            return;
        }
        const team = roleInfo.team;

        // Add role-specific class and loyalty
        if (me.role === ROLE_TYPES.MERLIN) cardBack.classList.add('merlin');
        else if (me.role === ROLE_TYPES.ASSASSIN) cardBack.classList.add('assassin');
        else if (team === TEAMS.GOOD) cardBack.classList.add('good');
        else cardBack.classList.add('evil');

        loyaltyTag.innerText = team.toUpperCase();
        loyaltyTag.classList.add(team.toLowerCase());

        document.getElementById('role-name').innerText = roleInfo.name;
        document.getElementById('role-desc').innerText = roleInfo.description;
        
        const knowledge = getKnowledge(me.role, state.players);
        const kBox = document.getElementById('role-knowledge');
        kBox.innerHTML = `<strong>${knowledge.text}</strong><br>`;
        knowledge.seen.forEach(id => {
            const p = state.players.find(p => p.id === id);
            kBox.innerHTML += `<span class="knowledge-item">${p.name}</span>, `;
        });

        if (me.ready) {
            document.getElementById('btn-ready').disabled = true;
            document.getElementById('btn-ready').innerText = 'Waiting...';
        } else {
            document.getElementById('btn-ready').disabled = false;
            document.getElementById('btn-ready').innerText = 'I Understand My Role';
        }
    }

    renderGame(state) {
        this.showScreen('game');
        const me = state.players.find(p => p.id === this.network.playerId);
        const isLeader = state.players[state.leaderIndex].id === this.network.playerId;
        const config = GAME_CONFIGS[state.players.length];
        const questSize = config.quests[state.questHistory.length];

        // 1. Quest Track (Fate Panel)
        const track = document.getElementById('quest-track');
        track.innerHTML = config.quests.map((q, i) => {
            const isCurrent = i === state.questHistory.length;
            let cls = 'quest-node';
            if (isCurrent) cls += ' active';
            if (state.questHistory[i] === 'success') cls += ' success';
            if (state.questHistory[i] === 'fail') cls += ' fail';
            const double = config.doubleFailRequired && i === 3;
            const doubleSign = double ? '*' : '';
            
            const tooltipText = `Mission ${i+1}: ${q} Players needed. ${double ? 'REQUIRES 2 FAILS TO SABOTAGE.' : '1 Fail required to sabotage.'}`;

            return `
                <div class="quest-container ${isCurrent ? 'active' : ''}" data-tooltip="${tooltipText}">
                    <span class="quest-label">Q${i+1}${isCurrent ? ' <small>(Current)</small>' : ''}</span>
                    <div class="${cls}"><span class="quest-size">${q}${doubleSign}</span></div>
                </div>
            `;
        }).join('');

        // 2. Vote Track (Discord Panel)
        const voteTrack = document.getElementById('vote-track');
        const narratives = [
            "King Arthur's court is in harmony.",
            "The first seeds of doubt are sown...",
            "Whispers of treason echo in the halls.",
            "Discord spreads! The Knights are divided.",
            "THE BRINK OF DESPAIR! The next failure is fatal.",
            "CHAOS REIGNS. Evil has triumphed through discord."
        ];
        
        voteTrack.innerHTML = [1, 2, 3, 4, 5].map(i => {
            let cls = 'vote-node';
            if (i <= state.rejections) cls += ' active';
            if (i === 5) cls += ' evil-win';
            return `<div class="${cls}">${i}</div>`;
        }).join('');
        
        const narrativeEl = document.getElementById('vote-narrative');
        narrativeEl.innerText = narratives[state.rejections];
        narrativeEl.className = `vote-narrative rejection-${state.rejections}`;

        // 3. Phase info
        const context = document.getElementById('phase-context');
        const title = document.getElementById('phase-title');
        const instruction = document.getElementById('phase-instruction');
        const actionBar = document.getElementById('action-bar');
        actionBar.innerHTML = '';

        if (state.phase === PHASES.PROPOSING) {
            context.innerText = 'PHASE 1: TEAM BUILDING';
            title.innerText = 'PROPOSAL';
            instruction.innerText = `${state.players[state.leaderIndex].name} is choosing a team of ${questSize} players for the next quest.`;
            if (isLeader) {
                const btn = document.createElement('button');
                btn.className = 'btn primary';
                btn.innerText = `Propose Team (${this.selectedPlayers.length}/${questSize})`;
                btn.disabled = this.selectedPlayers.length !== questSize;
                btn.onclick = () => {
                    this.network.send({ type: ACTION_TYPES.PICK_TEAM, team: this.selectedPlayers });
                    this.selectedPlayers = [];
                };
                actionBar.appendChild(btn);
            }
        } else if (state.phase === PHASES.VOTING) {
            context.innerText = 'PHASE 1: TEAM BUILDING';
            title.innerText = 'VOTING';
            const teamNames = state.selectedTeam.map(id => state.players.find(p => p.id === id).name);
            instruction.innerText = `Everyone: Do you approve of this team: ${teamNames.join(', ')}?`;
            
            // Force update Modal Team List
            const teamListEl = document.getElementById('modal-team-list');
            teamListEl.innerHTML = teamNames.map(name => `<div style="font-weight: bold; padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.05)">👤 ${name}</div>`).join('');

            if (state.votes[this.network.playerId] === undefined) {
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('vote-modal').classList.remove('hidden');
            }
        } else if (state.phase === PHASES.QUEST) {
            context.innerText = 'PHASE 2: THE QUEST';
            title.innerText = 'SECRET VOTE';
            const teamNames = state.selectedTeam.map(id => state.players.find(p => p.id === id).name);
            instruction.innerText = `The chosen team is on the quest! Waiting for their secret success/fail results...`;
            
            // Force update Quest Modal Team
            const questTeamEl = document.getElementById('quest-modal-team');
            questTeamEl.innerHTML = `<span style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.5rem">ON THE QUEST:</span>` + 
                teamNames.map(name => `<div style="font-weight: bold; padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.05)">👤 ${name}</div>`).join('');

            const isOnTeam = state.selectedTeam.includes(this.network.playerId);
            if (isOnTeam && !this.localQuestVoted) {
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('quest-modal').classList.remove('hidden');
                this.localQuestVoted = true;
            }
        } else if (state.phase === PHASES.ASSASSINATION) {
            context.innerText = 'FINAL PHASE';
            title.innerText = 'ASSASSINATION';
            instruction.innerText = `The forces of Good have succeeded 3 quests! Now the Assassin must try to identify Merlin...`;
            if (me.role === ROLE_TYPES.ASSASSIN) {
                const targets = state.players.filter(p => ROLES[p.role].team === TEAMS.GOOD);
                targets.forEach(t => {
                    const btn = document.createElement('button');
                    btn.className = 'btn reject';
                    btn.innerText = `Kill ${t.name}`;
                    btn.onclick = () => this.network.send({ type: ACTION_TYPES.ASSASSINATE, targetId: t.id });
                    actionBar.appendChild(btn);
                });
            }
        }

        // Reset local quest voted flag if phase changed
        if (state.phase !== PHASES.QUEST) this.localQuestVoted = false;

        // Player Board
        const board = document.getElementById('player-board');
        board.innerHTML = '';
        state.players.forEach((p, i) => {
            const isSelected = this.selectedPlayers.includes(p.id);
            const isOnTeam = state.selectedTeam.includes(p.id);
            const pCard = document.createElement('div');
            pCard.className = `player-card ${i === state.leaderIndex ? 'leader' : ''} ${isSelected ? 'selected' : ''} ${isOnTeam ? 'on-team' : ''}`;
            
            // Show markers for voting results if in history or end
            let markers = '';
            if (state.phase === PHASES.PROPOSING && state.votes[p.id] !== undefined) {
               // Show last vote results? (Maybe not needed for simple version)
            }

            pCard.innerHTML = `
                <div class="player-avatar">👤</div>
                <div class="player-name">${p.name}</div>
                ${i === state.leaderIndex ? '<div class="leader-badge">LEADER</div>' : ''}
                ${markers}
            `;

            if (state.phase === PHASES.PROPOSING && isLeader) {
                pCard.onclick = () => {
                    if (this.selectedPlayers.includes(p.id)) {
                        this.selectedPlayers = this.selectedPlayers.filter(id => id !== p.id);
                    } else if (this.selectedPlayers.length < questSize) {
                        this.selectedPlayers.push(p.id);
                    }
                    this.render(state);
                };
            }
            board.appendChild(pCard);
        });
    }

    renderEnd(state) {
        this.showScreen('end');
        document.getElementById('winner-title').innerText = state.winner.team === TEAMS.GOOD ? 'GOOD VICTORIOUS' : 'EVIL VICTORIOUS';
        document.getElementById('winner-msg').innerText = state.winner.reason;
        
        const list = document.getElementById('role-reveal-list');
        list.innerHTML = state.players.map(p => `
            <div class="glass-panel" style="margin-top: 5px; padding: 10px; display: flex; justify-content: space-between">
                <span><strong>${p.name}</strong></span>
                <span class="${ROLES[p.role].team === TEAMS.GOOD ? 'knowledge-item' : 'evil-color'}" style="color: ${ROLES[p.role].team === TEAMS.GOOD ? '#2ecc71' : '#e74c3c'}">
                    ${p.role}
                </span>
            </div>
        `).join('');
    }
}

// Start the app
window.onload = () => {
    window.app = new AvalonApp();
};
