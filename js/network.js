export const ACTION_TYPES = {
    JOIN: 'JOIN',
    START: 'START',
    READY: 'READY',
    PICK_TEAM: 'PICK_TEAM',
    VOTE: 'VOTE',
    QUEST_VOTE: 'QUEST_VOTE',
    ASSASSINATE: 'ASSASSINATE'
};

export class NetworkManager {
    constructor(onStateUpdate, onNotification) {
        this.peer = null;
        this.connections = []; // For Host
        this.conn = null; // For Client
        this.isHost = false;
        this.onStateUpdate = onStateUpdate;
        this.onNotification = onNotification;
        this.playerId = null;
    }

    init(id = null) {
        return new Promise((resolve) => {
            this.peer = new Peer(id);
            this.peer.on('open', (id) => {
                this.playerId = id;
                resolve(id);
            });
            this.peer.on('error', (err) => {
                this.onNotification('Error: ' + err.type);
            });
        });
    }

    // Host Methods
    createRoom(id) {
        this.isHost = true;
        this.peer.on('connection', (conn) => {
            this.connections.push(conn);
            conn.on('data', (data) => this.handleHostData(data, conn));
            conn.on('close', () => {
                this.connections = this.connections.filter(c => c !== conn);
                this.onNotification('A player disconnected.');
            });
        });
    }

    broadcast(state) {
        if (!this.isHost) return;
        this.connections.forEach(conn => {
            conn.send({ type: 'STATE_UPDATE', state });
        });
        this.onStateUpdate(state); // Update local host UI
    }

    handleHostData(data, conn) {
        // This will be overridden by App or handle specific requests
        console.log('Host received:', data);
    }

    // Client Methods
    joinRoom(roomId, name) {
        this.isHost = false;
        this.conn = this.peer.connect(roomId);
        this.conn.on('open', () => {
            this.conn.send({ type: ACTION_TYPES.JOIN, name, id: this.playerId });
        });
        this.conn.on('data', (data) => {
            if (data.type === 'STATE_UPDATE') {
                this.onStateUpdate(data.state);
            }
        });
        this.conn.on('close', () => {
            this.onNotification('Disconnected from host.');
        });
    }

    send(data) {
        if (this.isHost) {
            // Host sending to self (processed by handleHostData)
            this.handleHostData(data, null);
        } else if (this.conn) {
            this.conn.send(data);
        }
    }
}
