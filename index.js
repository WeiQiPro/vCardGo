// Parse URL parameters for multiplayer
const urlParams = new URLSearchParams(globalThis.location.search);
const roomName = urlParams.get('room') || crypto.randomUUID().substring(0, 8);
const playerType = urlParams.get('type') || 'host'; // host, guest, spectator

// Create socket connection
const socket = new vIO({id: "dataframe", roomID: roomName});

// Create user data
const userData = {
    id: socket.id,
    type: playerType,
    name: `${playerType.charAt(0).toUpperCase() + playerType.slice(1)} Player`,
    room: roomName
};

// Create goban with multiplayer settings
const goban = new vGoban({
    size: 9, 
    element: {width: 600, height: 600},
    cardMode: true,
    multiplayer: true,
    playerType: playerType,
    socket: socket,
    userData: userData
})
// Add invite/room creation UI
function createInviteUI() {
    const inviteDiv = document.createElement('div');
    inviteDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #f0f0f0;
        padding: 15px;
        border: 1px solid #ccc;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        z-index: 1000;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Multiplayer Room';
    title.style.margin = '0 0 10px 0';
    
    const roomInfo = document.createElement('div');
    roomInfo.innerHTML = `
        <strong>Room:</strong> ${roomName}<br>
        <strong>Role:</strong> ${playerType}<br>
        <strong>Player:</strong> ${playerType === 'host' ? 'Black' : playerType === 'guest' ? 'White' : 'Spectator'}
    `;
    
    const inviteButton = document.createElement('button');
    inviteButton.textContent = 'Copy Guest Link';
    inviteButton.style.cssText = 'margin: 10px 5px 0 0; padding: 5px 10px;';
    inviteButton.onclick = () => {
        const guestUrl = `${globalThis.location.origin}${globalThis.location.pathname}?room=${roomName}&type=guest`;
        navigator.clipboard.writeText(guestUrl);
        inviteButton.textContent = 'Copied!';
        setTimeout(() => inviteButton.textContent = 'Copy Guest Link', 2000);
    };
    
    const spectatorButton = document.createElement('button');
    spectatorButton.textContent = 'Copy Spectator Link';
    spectatorButton.style.cssText = 'margin: 10px 0 0 0; padding: 5px 10px;';
    spectatorButton.onclick = () => {
        const spectatorUrl = `${globalThis.location.origin}${globalThis.location.pathname}?room=${roomName}&type=spectator`;
        navigator.clipboard.writeText(spectatorUrl);
        spectatorButton.textContent = 'Copied!';
        setTimeout(() => spectatorButton.textContent = 'Copy Spectator Link', 2000);
    };
    
    inviteDiv.appendChild(title);
    inviteDiv.appendChild(roomInfo);
    if (playerType === 'host') {
        inviteDiv.appendChild(inviteButton);
        inviteDiv.appendChild(document.createElement('br'));
        inviteDiv.appendChild(spectatorButton);
    }
    
    document.body.appendChild(inviteDiv);
}

// Listen for connection
socket.on('connect', () => {
    console.log(`Connected to room ${roomName} as ${playerType}!`);
    
    // Send user data when connecting
    socket.emit("user-joined", userData);
    
    // Create invite UI
    createInviteUI();
});

// Listen for peer connections
socket.on('peer-connected', (peer) => {
    console.log(`${peer.label} (${peer.id}) joined the room`);
    socket.getPeers().forEach(peer => {
        console.log(`${peer.label} (${peer.id})`);
    });
});

// Listen for peer disconnections
socket.on('peer-disconnected', (peer) => {
    console.log(`${peer.label} (${peer.id}) left the room`);
});

// Listen for game events (using game-state sync instead of individual moves)
socket.on("play", (data) => {
    console.log('Received play event (deprecated):', data);
    // This is now handled via game-state sync
});

socket.on("user-joined", (userData) => {
    console.log('User joined:', userData);
    goban.handleUserJoined(userData);
});

socket.on("game-state", (state) => {
    console.log('Received game state');
    goban.syncGameState(state);
});

socket.on("time", (time) => {
    console.log("Time:", time);
});

console.log('VDOSocket initialized:', socket.id);


function main() {
    // Add rules to the goban
    goban.addRule(vGoban.rules.noSuicide)
          .addRule(vGoban.rules.koRule)
          .addRule(vGoban.rules.alternateTurns);
    
    // Add callbacks for game events
    goban.addCallback('beforeMove', (data) => {
        const coord = goban.getCoordinateString(data.move.x, data.move.y);
        console.log(`About to play move at ${coord}:`, data.move);
    });
    
    goban.addCallback('afterMove', (data) => {
        const coord = goban.getCoordinateString(data.move.x, data.move.y);
        const color = data.move.color === 1 ? 'Black' : 'White';
        console.log(`${color} played at ${coord}`);
        
        if (data.captures.length > 0) {
            const captureCoords = data.captures.map(capture => 
                goban.getCoordinateString(capture.x, capture.y)
            ).join(', ');
            console.log(`Captured stones at: ${captureCoords}`);
        }
        // Show whose turn it is next (currentPlayer is already switched by this point)
        console.log('Next player:', goban.currentPlayer === 1 ? 'Black' : 'White');
    });
    
    goban.addCallback('invalidMove', (data) => {
        console.log('Invalid move attempted:', data.move, 'Reason:', data.reason);
    });
    
    goban.addCallback('capture', (data) => {
        console.log('Stones captured!', data.captures);
    });
    
    goban.renderBoard(); // Initial render to show empty board
    
    // The board is now interactive! Click to place stones.
    console.log('Board is ready! Click anywhere to place stones.');
    console.log('Current player:', goban.currentPlayer === 1 ? 'Black' : 'White');
    
    // Card system is now active!
    console.log('\n=== CARD SYSTEM WITH VISUAL HAND ===');
    console.log('Instructions:');
    console.log('1. Click on a card in your hand (below the board) to select it');
    console.log('2. Click on the board to place stones according to the card pattern');
    console.log('3. Complete all stones required by the card');
    console.log('4. Card is validated and you draw a new card');
    console.log('5. If no legal plays available, click a card to discard it');
    console.log('');
    console.log('Visual Features:');
    console.log('- Hand displayed below the goban');
    console.log('- Selected card highlighted in yellow');
    console.log('- Card patterns shown visually');
    console.log('- Progress indicator for multi-stone cards');
    console.log('- Automatic discard option when stuck');
    console.log('');
    console.log('Ready to play! Click a card to start.');
    
}

main();