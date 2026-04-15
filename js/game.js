import { GAME_CONFIGS, ROLES, ROLE_TYPES, TEAMS } from './roles.js';

export const PHASES = {
    LOBBY: 'LOBBY',
    LEADER_REVEAL: 'LEADER_REVEAL', // New
    ROLES: 'ROLES',
    PROPOSING: 'PROPOSING',
    VOTING: 'VOTING',
    QUEST: 'QUEST',
    ASSASSINATION: 'ASSASSINATION',
    END: 'END'
};

export class AvalonGame {
    constructor() {
        this.state = this.getInitialState();
    }

    getInitialState() {
        return {
            phase: PHASES.LOBBY,
            players: [], // { id, name, role, ready }
            questHistory: [], // ['success', 'fail']
            rejections: 0,
            leaderIndex: 0,
            selectedTeam: [],
            votes: {}, // id: boolean
            questVotes: [], // [boolean]
            winner: null,
            assassinTarget: null
        };
    }

    // Host Only: Start game
    startGame(roles) {
        this.state.phase = PHASES.LEADER_REVEAL; // Transition to Leader Reveal first
        this.state.players.forEach((p, i) => {
            p.role = roles[i];
            p.ready = false;
        });
        this.state.leaderIndex = Math.floor(Math.random() * this.state.players.length);
    }

    proceedToRoles() {
        if (this.state.phase === PHASES.LEADER_REVEAL) {
            this.state.phase = PHASES.ROLES;
        }
    }

    setPlayerReady(playerId) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) player.ready = true;

        if (this.state.players.every(p => p.ready)) {
            this.state.phase = PHASES.PROPOSING;
        }
    }

    selectTeam(teamIds) {
        this.state.selectedTeam = teamIds;
        this.state.phase = PHASES.VOTING;
        this.state.votes = {};
    }

    submitVote(playerId, approve) {
        this.state.votes[playerId] = approve;
        
        if (Object.keys(this.state.votes).length === this.state.players.length) {
            const approvals = Object.values(this.state.votes).filter(v => v).length;
            if (approvals > this.state.players.length / 2) {
                // Approved
                this.state.phase = PHASES.QUEST;
                this.state.questVotes = [];
                this.state.rejections = 0;
            } else {
                // Rejected
                this.state.rejections++;
                if (this.state.rejections >= 5) {
                    this.endGame(TEAMS.EVIL, '5 Rejections in a row!');
                } else {
                    this.nextLeader();
                    this.state.phase = PHASES.PROPOSING;
                }
            }
        }
    }

    submitQuestVote(success) {
        this.state.questVotes.push(success);
        const questSize = GAME_CONFIGS[this.state.players.length].quests[this.state.questHistory.length];

        if (this.state.questVotes.length === questSize) {
            const fails = this.state.questVotes.filter(v => !v).length;
            const config = GAME_CONFIGS[this.state.players.length];
            const isRound4 = this.state.questHistory.length === 3;
            const doubleFail = config.doubleFailRequired && isRound4;

            const questFailed = doubleFail ? fails >= 2 : fails >= 1;

            if (questFailed) {
                this.state.questHistory.push('fail');
            } else {
                this.state.questHistory.push('success');
            }

            this.checkWinCondition();
        }
    }

    checkWinCondition() {
        const successes = this.state.questHistory.filter(h => h === 'success').length;
        const fails = this.state.questHistory.filter(h => h === 'fail').length;

        if (fails >= 3) {
            this.endGame(TEAMS.EVIL, '3 Quests failed!');
        } else if (successes >= 3) {
            this.state.phase = PHASES.ASSASSINATION;
        } else {
            this.nextLeader();
            this.state.phase = PHASES.PROPOSING;
        }
    }

    assassinate(targetId) {
        const target = this.state.players.find(p => p.id === targetId);
        if (target.role === ROLE_TYPES.MERLIN) {
            this.endGame(TEAMS.EVIL, 'Merlin has been assassinated!');
        } else {
            this.endGame(TEAMS.GOOD, 'The Assassin missed Merlin!');
        }
    }

    nextLeader() {
        this.state.leaderIndex = (this.state.leaderIndex + 1) % this.state.players.length;
        this.state.selectedTeam = [];
    }

    endGame(winner, reason) {
        this.state.phase = PHASES.END;
        this.state.winner = { team: winner, reason };
    }
}
