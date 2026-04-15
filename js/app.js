import { AvalonGame, PHASES } from './game.js';
import { NetworkManager, ACTION_TYPES } from './network.js';
import { getInitialRoles, getKnowledge, ROLE_TYPES, TEAMS, GAME_CONFIGS } from './roles.js';

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
            document.getElementById('modal-overlay').classList.remove('hidden');
            document.getElementById('instructions-modal').classList.remove('hidden');
        };

        document.getElementById('btn-close-instructions').onclick = () => this.hideModal();

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
        this.showScreen('room');
        this.render(this.game.state);
    }

    joinRoom() {
        const roomId = document.getElementById('join-room-id').value;
        if (!roomId) return this.notify('Please enter a Room ID');
        
        this.localPlayerName = prompt('Enter your name:') || 'Guest';
        this.network.joinRoom(roomId, this.localPlayerName);
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
            
            if (count < 2) {
                this.notify('Need at least 2 players to start');
                return;
            }
            
            const settings = {
                percival: document.getElementById('role-percival').checked,
                morgana: document.getElementById('role-morgana').checked,
                mordred: document.getElementById('role-mordred').checked,
                oberon: document.getElementById('role-oberon').checked
            };
            
            let roles = getInitialRoles(count, settings);
            
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
        
        // Auto-switch screens based on phase
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
        
        if (this.network.isHost) {
            document.getElementById('host-controls').classList.remove('hidden');
            document.getElementById('client-waiting').classList.add('hidden');
        } else {
            document.getElementById('host-controls').classList.add('hidden');
            document.getElementById('client-waiting').classList.remove('hidden');
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

        // Header info
        document.getElementById('rejection-count').innerText = state.rejections;
        const track = document.getElementById('quest-track');
        track.innerHTML = config.quests.map((q, i) => {
            let cls = 'quest-node';
            if (i === state.questHistory.length) cls += ' active';
            if (state.questHistory[i] === 'success') cls += ' success';
            if (state.questHistory[i] === 'fail') cls += ' fail';
            const double = config.doubleFailRequired && i === 3 ? '*' : '';
            return `<div class="${cls}"><span class="quest-size">${q}${double}</span></div>`;
        }).join('');

        // Phase info
        const title = document.getElementById('phase-title');
        const instruction = document.getElementById('phase-instruction');
        const actionBar = document.getElementById('action-bar');
        actionBar.innerHTML = '';

        title.innerText = state.phase;
        
        if (state.phase === PHASES.PROPOSING) {
            instruction.innerText = `${state.players[state.leaderIndex].name} is choosing a team of ${questSize}...`;
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
            instruction.innerText = `Voting on team: ${state.selectedTeam.map(id => state.players.find(p => p.id === id).name).join(', ')}`;
            if (!state.votes[this.network.playerId]) {
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('vote-modal').classList.remove('hidden');
            }
        } else if (state.phase === PHASES.QUEST) {
            instruction.innerText = `The quest is underway! Waiting for results...`;
            const isOnTeam = state.selectedTeam.includes(this.network.playerId);
            const alreadyVoted = state.questVotes.length > state.selectedTeam.indexOf(this.network.playerId) && state.selectedTeam.indexOf(this.network.playerId) !== -1;
            // Note: questVotes logic needs to match player index properly, but since it's secret, we just check if this player should vote.
            // Simplified secret voting: if you are on team and haven't voted, show modal.
            // We'll track who voted locally in state in a real app, but for now we'll check if the player's vote is missing.
            // (Self-correction: in this simplified engine, we'll use a local 'hasVoted' flag for the quest)
            if (isOnTeam && !this.localQuestVoted) {
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('quest-modal').classList.remove('hidden');
                this.localQuestVoted = true;
            }
        } else if (state.phase === PHASES.ASSASSINATION) {
            instruction.innerText = `Assassin is choosing who to kill...`;
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
