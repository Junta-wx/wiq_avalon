export const ROLE_TYPES = {
    MERLIN: 'Merlin',
    SERVANT: 'Loyal Servant of Arthur',
    ASSASSIN: 'Assassin',
    MINION: 'Minion of Mordred'
};

export const TEAMS = {
    GOOD: 'Good',
    EVIL: 'Evil'
};

export const ROLES = {
    [ROLE_TYPES.MERLIN]: { team: TEAMS.GOOD, name: 'Merlin', description: 'You know exactly who the agents of Evil are. You must lead the Good players to victory without revealing your identity to the Assassin.' },
    [ROLE_TYPES.SERVANT]: { team: TEAMS.GOOD, name: 'Loyal Servant of Arthur', description: 'You are a loyal companion of Arthur. You do not know anyone else\'s identity. Your goal is to succeed quests.' },
    [ROLE_TYPES.ASSASSIN]: { team: TEAMS.EVIL, name: 'Assassin', description: 'You are an agent of Evil. If Good succeeds 3 quests, you have one final chance to identify Merlin and steal the victory.' },
    [ROLE_TYPES.MINION]: { team: TEAMS.EVIL, name: 'Minion of Mordred', description: 'You are an agent of Evil. You know your fellow Minions. Your goal is to fail quests and confuse Merlin.' }
};

export const GAME_CONFIGS = {
    2: { good: 1, evil: 1, quests: [1, 2, 1, 2, 1] },
    3: { good: 2, evil: 1, quests: [2, 2, 2, 2, 2] },
    4: { good: 2, evil: 2, quests: [2, 3, 2, 3, 3] },
    5: { good: 3, evil: 2, quests: [2, 3, 2, 3, 3] },
    6: { good: 4, evil: 2, quests: [2, 3, 4, 3, 4] },
    7: { good: 4, evil: 3, quests: [2, 3, 3, 4, 4], doubleFailRequired: true },
    8: { good: 5, evil: 3, quests: [3, 4, 4, 5, 5], doubleFailRequired: true },
    9: { good: 6, evil: 3, quests: [3, 4, 4, 5, 5], doubleFailRequired: true },
    10: { good: 6, evil: 4, quests: [3, 4, 4, 5, 5], doubleFailRequired: true }
};

export function getInitialRoles(numPlayers) {
    const config = GAME_CONFIGS[numPlayers];
    if (!config) return null;

    let roles = [ROLE_TYPES.MERLIN, ROLE_TYPES.ASSASSIN];
    
    // Fill remaining Good
    while (roles.filter(r => ROLES[r].team === TEAMS.GOOD).length < config.good) {
        roles.push(ROLE_TYPES.SERVANT);
    }

    // Fill remaining Evil
    while (roles.filter(r => ROLES[r].team === TEAMS.EVIL).length < config.evil) {
        roles.push(ROLE_TYPES.MINION);
    }

    return roles.sort(() => Math.random() - 0.5);
}

export function getKnowledge(role, allPlayers) {
    const knowledge = {
        seen: [], // list of player IDs
        text: ''
    };

    const evilPlayers = allPlayers.filter(p => ROLES[p.role].team === TEAMS.EVIL);

    switch (role) {
        case ROLE_TYPES.MERLIN:
            // Sees all evil
            knowledge.seen = evilPlayers.map(p => p.id);
            knowledge.text = 'The following players are EVIL:';
            break;
        case ROLE_TYPES.ASSASSIN:
        case ROLE_TYPES.MINION:
            // Sees all evil
            knowledge.seen = evilPlayers.map(p => p.id);
            knowledge.text = 'The following players are your EVIL allies:';
            break;
        default:
            knowledge.text = 'You have no special knowledge.';
    }

    return knowledge;
}
