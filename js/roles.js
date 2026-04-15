export const ROLE_TYPES = {
    MERLIN: 'Merlin',
    PERCIVAL: 'Percival',
    SERVANT: 'Loyal Servant of Arthur', // Updated
    ASSASSIN: 'Assassin',
    MORGANA: 'Morgana',
    MORDRED: 'Mordred',
    OBERON: 'Oberon',
    MINION: 'Minion of Mordred' // Updated
};

export const TEAMS = {
    GOOD: 'Good',
    EVIL: 'Evil'
};

export const ROLES = {
    [ROLE_TYPES.MERLIN]: { team: TEAMS.GOOD, name: 'Merlin', description: 'You know exactly who the agents of Evil are (except Mordred). You must lead the Good players to victory without revealing your identity to the Assassin.' },
    [ROLE_TYPES.PERCIVAL]: { team: TEAMS.GOOD, name: 'Percival', description: 'You know who Merlin and Morgana are, but not which is which. Your job is to protect and follow the true Merlin.' },
    [ROLE_TYPES.SERVANT]: { team: TEAMS.GOOD, name: 'Loyal Servant of Arthur', description: 'You are a loyal companion of Arthur. You do not know anyone else\'s identity. Your goal is to succeed quests.' },
    [ROLE_TYPES.ASSASSIN]: { team: TEAMS.EVIL, name: 'Assassin', description: 'You are an agent of Evil. If Good succeeds 3 quests, you have one final chance to identify Merlin and steal the victory.' },
    [ROLE_TYPES.MORGANA]: { team: TEAMS.EVIL, name: 'Morgana', description: 'You are an agent of Evil. You appear as Merlin to Percival, confusing the forces of Good.' },
    [ROLE_TYPES.MORDRED]: { team: TEAMS.EVIL, name: 'Mordred', description: 'You are the ultimate Evil. You are hidden from Merlin\'s sight, making you the most dangerous Minion.' },
    [ROLE_TYPES.OBERON]: { team: TEAMS.EVIL, name: 'Oberon', description: 'You are a chaotic agent of Evil. You are unknown to your allies, and you do not know them. Useful for sowing confusion.' },
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

export function getInitialRoles(numPlayers, settings = {}) {
    const config = GAME_CONFIGS[numPlayers];
    if (!config) return null;

    let roles = [ROLE_TYPES.MERLIN, ROLE_TYPES.ASSASSIN];
    
    // Add Special Good roles
    if (settings.percival) roles.push(ROLE_TYPES.PERCIVAL);
    
    // Fill remaining Good
    while (roles.filter(r => ROLES[r].team === TEAMS.GOOD).length < config.good) {
        roles.push(ROLE_TYPES.SERVANT);
    }

    // Add Special Evil roles
    if (settings.morgana) roles.push(ROLE_TYPES.MORGANA);
    if (settings.mordred) roles.push(ROLE_TYPES.MORDRED);
    if (settings.oberon) roles.push(ROLE_TYPES.OBERON);

    // Fill remaining Evil
    while (roles.filter(r => ROLES[r].team === TEAMS.EVIL).length < config.evil) {
        roles.push(ROLE_TYPES.MINION);
    }

    // Trim or add if settings caused imbalance
    // (This is a simplified balancer)
    return roles.sort(() => Math.random() - 0.5);
}

export function getKnowledge(role, allPlayers) {
    const knowledge = {
        seen: [], // list of player IDs
        text: ''
    };

    const evilPlayers = allPlayers.filter(p => ROLES[p.role].team === TEAMS.EVIL);
    const merlinMorgana = allPlayers.filter(p => p.role === ROLE_TYPES.MERLIN || p.role === ROLE_TYPES.MORGANA);

    switch (role) {
        case ROLE_TYPES.MERLIN:
            // Sees all evil except Mordred
            knowledge.seen = evilPlayers.filter(p => p.role !== ROLE_TYPES.MORDRED).map(p => p.id);
            knowledge.text = 'The following players are EVIL (but you don\'t see Mordred):';
            break;
        case ROLE_TYPES.PERCIVAL:
            // Sees Merlin and Morgana as the same
            knowledge.seen = merlinMorgana.map(p => p.id);
            knowledge.text = 'One of these is Merlin, the other is Morgana:';
            break;
        case ROLE_TYPES.ASSASSIN:
        case ROLE_TYPES.MORGANA:
        case ROLE_TYPES.MORDRED:
        case ROLE_TYPES.MINION:
            // Sees all evil except Oberon
            knowledge.seen = evilPlayers.filter(p => p.role !== ROLE_TYPES.OBERON).map(p => p.id);
            knowledge.text = 'The following players are your EVIL allies (but you don\'t see Oberon):';
            break;
        case ROLE_TYPES.OBERON:
            knowledge.text = 'You are Oberon. You don\'t know anyone, and they don\'t know you.';
            break;
        default:
            knowledge.text = 'You have no special knowledge.';
    }

    return knowledge;
}
