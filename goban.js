class vGoban {
    constructor(options = {}) {
        this.players = {
            black: options.black || "Black",
            white: options.white || "White",
        }
        this.boardSize = options.size || 19;

        this.board = Array.from({ length: this.boardSize }, () => Array(this.boardSize).fill(0));
        this.current = options.current || this.players.black;
        this.moves = options.moves || [];
        this.width = options.element.width || 600;
        this.height = options.element.height || 600;
        this.boardstate = this.board;
        
        // Card system (set before createBoard)
        this.cardMode = options.cardMode || false;
        
        this.createBoard(options.element);
        
        // Calculate cell size based on canvas dimensions and board size
        this.cellSize = Math.min(this.width, this.height) / (this.boardSize + 1);
        this.margin = this.cellSize;

        this.rules = new Set();
        this.callbacks = {
            beforeMove: [],
            afterMove: [],
            invalidMove: [],
            capture: []
        };
        
        // Mouse interaction properties
        this.currentPlayer = 1; // 1 = black, 2 = white
        this.hoverPosition = null;
        this.enableInteraction = options.interactive !== false; // Default to true
        
        // Multiplayer properties
        this.multiplayer = options.multiplayer || false;
        this.playerType = options.playerType || 'host'; // host, guest, spectator
        this.socket = options.socket || null;
        this.userData = options.userData || null;
        this.myPlayerNumber = this.playerType === 'host' ? 1 : this.playerType === 'guest' ? 2 : 0; // 0 = spectator
        this.connectedUsers = new Map();
        
                 // Ko rule tracking - store last 2 board states
         this.boardStateHistory = [];
         this.lastMoveWasKoCapture = false;
        
        // Initialize card system if enabled
        if (this.cardMode) {
            this.initializeCardSystem();
        }
        
        // Add mouse event listeners if interaction is enabled
        if (this.enableInteraction) {
            this.addMouseListeners();
        }
    }

    createBoard(element) {
        // Main goban canvas
        this.canvas = document.createElement("canvas");
        this.canvas.width = element.width || 600;
        this.canvas.height = element.height || 600;
        this.canvas.style.width = element.width + "px" || "600px";
        this.canvas.style.height = element.height + "px" || "600px";
        this.canvas.style.display = "block";
        this.canvas.style.border = "1px solid #000";
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        // Hand canvas (if card mode is enabled)
        if (this.cardMode) {
            this.handCanvas = document.createElement("canvas");
            this.handCanvas.width = element.width || 600;
            this.handCanvas.height = 250; // Fixed height for hand area
            this.handCanvas.style.width = element.width + "px" || "600px";
            this.handCanvas.style.height = "250px";
            this.handCanvas.style.display = "block";
            this.handCanvas.style.border = "1px solid #000";
            this.handCanvas.style.marginTop = "10px";
            document.body.appendChild(this.handCanvas);
            this.handCtx = this.handCanvas.getContext("2d");
            
            // Add click listener for hand canvas
            this.handCanvas.addEventListener('click', (event) => {
                this.handleHandClick(event);
            });
        }
    }

    renderBoard() {
        // Clear canvas and set background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#DEB887"; // Traditional goban wood color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawIntersections();
        this.drawStarPoints();
        this.drawStones();
        this.drawCoordinateLabels();
        this.drawHoverStone();
        
        // Render hand if in card mode
        if (this.cardMode) {
            this.renderHand();
        }
    }

    drawStones() {
        for (let x = 0; x < this.boardSize; x++) {
            for (let y = 0; y < this.boardSize; y++) {
                const cell = this.board[x][y];
                
                if (cell === 1 || cell === 2) {
                    // Set stone color
                    if (cell === 1) {
                        this.ctx.fillStyle = "black";
                        this.ctx.strokeStyle = "black";
                    } else if (cell === 2) {
                        this.ctx.fillStyle = "white";
                        this.ctx.strokeStyle = "black";
                    }

                    // Calculate stone radius for better fit
                    const stoneRadius = this.cellSize * 0.45; // Larger stones that fit nicely
                    
                    // Draw the stone
                    this.ctx.beginPath();
                    this.ctx.arc(
                        this.margin + x * this.cellSize, 
                        this.margin + y * this.cellSize, 
                        stoneRadius,
                        0, 
                        2 * Math.PI
                    );
                    this.ctx.fill();
                    
                    // Add subtle border for all stones for better definition
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeStyle = cell === 1 ? "#333" : "#666";
                    this.ctx.stroke();
                }
            }
        }
    }

    drawIntersections() {
        // Set line properties
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 1;

        // Draw horizontal lines
        for (let i = 0; i < this.boardSize; i++) {
                this.ctx.beginPath();
            this.ctx.moveTo(this.margin, this.margin + i * this.cellSize);
            this.ctx.lineTo(this.margin + (this.boardSize - 1) * this.cellSize, this.margin + i * this.cellSize);
            this.ctx.stroke();
        }

        // Draw vertical lines
        for (let i = 0; i < this.boardSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.margin + i * this.cellSize, this.margin);
            this.ctx.lineTo(this.margin + i * this.cellSize, this.margin + (this.boardSize - 1) * this.cellSize);
            this.ctx.stroke();
        }
    }

    drawStarPoints() {
        // Star points are traditional markers on a goban
        const starPoints = [];
        
        if (this.boardSize === 19) {
            // Standard 19x19 board star points
            starPoints.push([3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]);
        } else if (this.boardSize === 13) {
            // 13x13 board star points
            starPoints.push([3, 3], [3, 9], [6, 6], [9, 3], [9, 9]);
        } else if (this.boardSize === 9) {
            // 9x9 board star points
            starPoints.push([2, 2], [2, 6], [4, 4], [6, 2], [6, 6]);
        }

                this.ctx.fillStyle = "black";
        starPoints.forEach(([x, y]) => {
                this.ctx.beginPath();
            this.ctx.arc(
                this.margin + x * this.cellSize, 
                this.margin + y * this.cellSize, 
                3, 0, 2 * Math.PI
            );
            this.ctx.fill();
        });
    }

    drawCoordinateLabels() {
                this.ctx.fillStyle = "black";
        this.ctx.font = `${Math.max(12, this.cellSize * 0.3)}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        // Draw column labels (A, B, C, etc.) at top and bottom
        for (let i = 0; i < this.boardSize; i++) {
            const x = this.margin + i * this.cellSize;
            const letter = String.fromCharCode(65 + i); // A, B, C, etc.
            
            // Top labels
            this.ctx.fillText(letter, x, this.margin * 0.5);
            
            // Bottom labels
            this.ctx.fillText(letter, x, this.margin + (this.boardSize - 1) * this.cellSize + this.margin * 0.5);
        }
        
        // Draw row labels (1, 2, 3, etc.) at left and right
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        for (let i = 0; i < this.boardSize; i++) {
            const y = this.margin + i * this.cellSize;
            const number = (this.boardSize - i).toString(); // Numbers from top to bottom (19, 18, 17...)
            
            // Left labels
            this.ctx.fillText(number, this.margin * 0.5, y);
            
            // Right labels
            this.ctx.fillText(number, this.margin + (this.boardSize - 1) * this.cellSize + this.margin * 0.5, y);
        }
    }

    playMove(move) {
        // Trigger beforeMove callbacks
        this.triggerCallback('beforeMove', { move, board: this.board });
        
        if (!this.isValidMove(move)) {
            this.triggerCallback('invalidMove', { move, reason: 'Rule violation' });
            return { success: false, error: "Invalid move" };
        }
        
        // Make the move
        this.board[move.x][move.y] = move.color;
        this.moves.push(move);
        
                 // Check for captures
         const captures = this.checkCaptures(move);
         const hadCaptures = captures.length > 0;
         if (hadCaptures) {
             this.triggerCallback('capture', { move, captures });
         }
         
         // Store board state AFTER making the move and captures (for Ko rule)
         const currentState = this.getBoardStateString();
         this.boardStateHistory.push(currentState);
         if (this.boardStateHistory.length > 2) {
             this.boardStateHistory.shift(); // Keep only last 2 states
         }
         
         // Track if this move was a Ko-creating capture
         // A Ko-creating capture is one that captures exactly one stone and creates a symmetric position
         this.lastMoveWasKoCapture = hadCaptures && captures.length === 1;

        
        // Switch current player after successful move
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        
        // Trigger afterMove callbacks
        this.triggerCallback('afterMove', { move, board: this.board, captures });
        
        this.renderBoard();
        return { success: true, captures };
    }

    isValidMove(move) {
        if (!this.onBoard(move)) { 
            return false; 
        }
        if (this.board[move.x][move.y] !== 0) { 
            return false; 
        }
        
        for (const rule of this.rules) {
            if (!rule.call(this, move)) { 
                return false; 
            }
        }
        return true;
    }

    addRule(rule) {
        if (typeof rule !== 'function') {
            throw new Error('Rule must be a function');
        }
        if (this.rules.has(rule)) {
            throw new Error('Rule already exists');
        }
        this.rules.add(rule);
        return this; // Allow method chaining
    }

    removeRule(rule) {
        this.rules.delete(rule);
        return this;
    }

    addCallback(event, callback) {
        if (!this.callbacks[event]) {
            throw new Error(`Unknown event: ${event}`);
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        this.callbacks[event].push(callback);
        return this;
    }

    removeCallback(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
        return this;
    }

    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback.call(this, data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }

    onBoard(move) {
        return move.x >= 0 && move.x < this.boardSize && 
               move.y >= 0 && move.y < this.boardSize;
    }

    addMouseListeners() {
        // Mouse move for hover effect
        this.canvas.addEventListener('mousemove', (event) => {
            const boardPos = this.getMousePosition(event);
            if (boardPos && this.onBoard(boardPos)) {
                this.hoverPosition = boardPos;
            } else {
                this.hoverPosition = null;
            }
            this.renderBoard();
        });

        // Mouse leave to clear hover
        this.canvas.addEventListener('mouseleave', () => {
            this.hoverPosition = null;
            this.renderBoard();
        });

        // Mouse click to place stone
        this.canvas.addEventListener('click', (event) => {
            const boardPos = this.getMousePosition(event);
            if (boardPos && this.onBoard(boardPos)) {
                this.handleClick(boardPos);
            }
        });

        // Add cursor pointer style
        this.canvas.style.cursor = 'pointer';
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Convert to board coordinates
        const boardX = Math.round((mouseX - this.margin) / this.cellSize);
        const boardY = Math.round((mouseY - this.margin) / this.cellSize);

        return { x: boardX, y: boardY };
    }

    handleClick(position) {
        // Check if it's this player's turn in multiplayer
        if (this.multiplayer && !this.isMyTurn()) {
            console.log("Not your turn!");
            this.triggerCallback('invalidMove', { 
                move: { x: position.x, y: position.y, color: this.currentPlayer }, 
                reason: 'Not your turn' 
            });
            return { success: false, error: 'Not your turn' };
        }
        
        if (this.cardMode) {
            // In card mode, must have a card selected to play
            if (!this.selectedCard) {
                console.log('Please select a card first before placing stones');
                this.triggerCallback('invalidMove', { 
                    move: { x: position.x, y: position.y, color: this.currentPlayer }, 
                    reason: 'No card selected' 
                });
                return { success: false, error: 'No card selected' };
            }
            
            // Handle card-based move
            return this.handleCardMove(position);
        }
        
        // Normal move (non-card mode)
        const result = this.playMove({
            x: position.x,
            y: position.y,
            color: this.currentPlayer
        });
        
        return result;
    }

    // Handle moves when a card is being played
    handleCardMove(position) {
        if (!this.selectedCard) {
            return { success: false, error: 'No card selected' };
        }
        
        // Create the move object
        const move = {
            x: position.x,
            y: position.y,
            color: this.currentPlayer
        };
        
        // Add this move to the card moves temporarily for validation
        this.cardMoves.push(move);
        
        console.log(`Card move ${this.cardMoves.length}/${this.selectedCard.canPlayMoves}: ${this.getCoordinateString(position.x, position.y)}`);
        
        // Check if this move sequence can still lead to a valid pattern
        if (!this.canStillCompletePattern(this.cardMoves, this.selectedCard)) {
            console.log(`Move ${this.getCoordinateString(position.x, position.y)} would make pattern impossible to complete!`);
            this.triggerCallback('invalidMove', { move, reason: 'Pattern cannot be completed' });
            
            // Remove the invalid move from sequence
            this.cardMoves.pop();
            return { success: false, reason: 'Pattern cannot be completed' };
        }
        
        // Try to place the stone
        const result = this.playMove(move);
        
        if (!result.success) {
            // Remove the failed move from cardMoves
            this.cardMoves.pop();
            return result;
        }
        
        // Check if we've completed the card
        if (this.cardMoves.length === this.selectedCard.canPlayMoves) {
            return this.completeCardPlay();
        }
        
        // Don't switch players until card is complete
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1; // Switch back
        
        return { success: true, cardProgress: this.cardMoves.length, cardTotal: this.selectedCard.canPlayMoves };
    }

    // Check if the current move sequence can still lead to a valid pattern completion
    // This allows moves to be played in ANY order, as long as they can form a valid pattern
    canStillCompletePattern(currentMoves, card) {
        if (currentMoves.length === 0) return true;
        
        // Get all possible transformations of the pattern (rotations + reflections)
        const allPatternVariations = this.getAllPatternTransformations(card.move_data);
        
        // Try each pattern variation
        for (const patternPositions of allPatternVariations) {
            // Try each possible center position on the board
            for (let centerX = 0; centerX < this.boardSize; centerX++) {
                for (let centerY = 0; centerY < this.boardSize; centerY++) {
                    // Generate all expected moves for this pattern placement
                    const expectedMoves = patternPositions.map(pos => ({
                        x: centerX + pos.offsetX,
                        y: centerY + pos.offsetY
                    }));
                    
                    // Check if all expected moves are on board
                    if (!expectedMoves.every(move => this.onBoard(move))) {
                        continue;
                    }
                    
                    // Check if ALL current moves are part of this expected pattern
                    // (moves can be in any order)
                    const allCurrentMovesMatch = currentMoves.every(currentMove => 
                        expectedMoves.some(expectedMove => 
                            expectedMove.x === currentMove.x && expectedMove.y === currentMove.y
                        )
                    );
                    
                    if (allCurrentMovesMatch) {
                        // Check if the remaining moves can be completed
                        const remainingMoves = expectedMoves.filter(expectedMove =>
                            !currentMoves.some(currentMove => 
                                currentMove.x === expectedMove.x && currentMove.y === expectedMove.y
                            )
                        );
                        
                        // Simulate the remaining moves on a copy of the current board
                        if (this.canCompleteRemainingMoves(remainingMoves)) {
                            console.log(`Pattern can be completed at center (${centerX}, ${centerY}) with remaining moves:`, remainingMoves.map(m => `(${m.x}, ${m.y})`));
                            return true; // Found at least one valid completion
                        }
                    }
                }
            }
        }
        
        console.log(`No valid pattern completion found for current moves:`, currentMoves.map(m => `(${m.x}, ${m.y})`));
        return false; // No valid pattern completion found
    }

    // Get all possible transformations of a pattern (8 total: 4 rotations × 2 reflections)
    getAllPatternTransformations(moveData) {
        const transformations = [];
        
        // Original pattern
        transformations.push(this.extractPatternPositions(moveData));
        
        // Rotate 90 degrees (3 more rotations)
        let rotated = moveData;
        for (let i = 0; i < 3; i++) {
            rotated = this.rotatePattern90(rotated);
            transformations.push(this.extractPatternPositions(rotated));
        }
        
        // Horizontal reflection of original
        const horizontalReflected = this.reflectPatternHorizontally(moveData);
        transformations.push(this.extractPatternPositions(horizontalReflected));
        
        // Rotate the reflected pattern (3 more rotations)
        rotated = horizontalReflected;
        for (let i = 0; i < 3; i++) {
            rotated = this.rotatePattern90(rotated);
            transformations.push(this.extractPatternPositions(rotated));
        }
        
        return transformations;
    }

    // Extract pattern positions from move data
    extractPatternPositions(moveData) {
        const positions = [];
        const center = Math.floor(moveData.length / 2);
        
        for (let row = 0; row < moveData.length; row++) {
            for (let col = 0; col < moveData[row].length; col++) {
                if (moveData[row][col] === '1') {
                    positions.push({
                        offsetX: col - center,
                        offsetY: row - center
                    });
                }
            }
        }
        
        return positions;
    }

    // Rotate pattern 90 degrees clockwise
    rotatePattern90(pattern) {
        const size = pattern.length;
        const rotated = Array(size).fill().map(() => Array(size).fill('0'));
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                rotated[col][size - 1 - row] = pattern[row][col];
            }
        }
        
        return rotated;
    }

    // Reflect pattern horizontally
    reflectPatternHorizontally(pattern) {
        const size = pattern.length;
        const reflected = Array(size).fill().map(() => Array(size).fill('0'));
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                reflected[row][size - 1 - col] = pattern[row][col];
            }
        }
        
        return reflected;
    }

    // Check if the remaining moves can be completed on the current board state
    canCompleteRemainingMoves(remainingMoves) {
        if (remainingMoves.length === 0) return true;
        
        const tempBoard = this.copyBoard();
        
        try {
            for (const move of remainingMoves) {
                // Check if position is available or will be freed by captures
                if (tempBoard[move.x][move.y] !== 0) {
                    // Position is occupied - check if any captures would free it
                    // For simplicity, if position is occupied and no captures free it, fail
                    return false;
                }
                
                // Place the stone
                tempBoard[move.x][move.y] = this.currentPlayer;
                
                // Apply captures
                const captures = this.getCapturesForMove({
                    x: move.x,
                    y: move.y,
                    color: this.currentPlayer
                }, tempBoard);
                
                captures.forEach(capture => {
                    tempBoard[capture.x][capture.y] = 0;
                });
            }
            
            return true; // All remaining moves can be placed
        } catch (_error) {
            return false;
        }
    }

    // Complete the card play and validate the pattern
    completeCardPlay() {
        // Validate the moves match the card pattern (flexible center matching)
        const isValidPattern = this.selectedCard.findMatchingPattern(this.cardMoves);
        
        if (!isValidPattern) {
            console.log(`Invalid pattern! Card ${this.selectedCard.name} was not played correctly.`);
            // Could implement penalty or undo here
        } else {
            console.log(`Successfully played card: ${this.selectedCard.name}`);
            
            // For multiplayer, we'll send the updated game state after all changes are made
            
            // The card belongs to the player who played the first stone in the sequence
            const cardOwner = this.cardMoves[0].color;
            const playerHand = this.hands[cardOwner];
            
            console.log(`Removing card from Player ${cardOwner} hand (current hand size: ${playerHand.length})`);
            
            // Remove card from the correct player's hand and send to graveyard
            const cardIndex = playerHand.findIndex(card => card.id === this.selectedCard.id);
            if (cardIndex !== -1) {
                const playedCard = playerHand.splice(cardIndex, 1)[0];
                this.graveyard.push(playedCard);
                console.log(`Card ${playedCard.name} sent to graveyard`);
                console.log(`Player ${cardOwner} hand size after removal: ${playerHand.length}`);
            } else {
                console.log(`ERROR: Card ${this.selectedCard.name} not found in Player ${cardOwner} hand!`);
            }
            
            // Draw a new card only if hand is under limit (3 cards)
            if (playerHand.length < 3) {
                const newCard = this.drawCard();
                if (newCard) {
                    playerHand.push(newCard);
                    console.log(`Drew new card: ${newCard.name} for Player ${cardOwner}`);
                } else {
                    console.log('Deck is empty - no new card drawn');
                }
            } else {
                console.log(`Hand at maximum size (3 cards) - no new card drawn for Player ${cardOwner}`);
            }
        }
        
        // Reset card play state
        this.selectedCard = null;
        this.cardMoves = [];
        this.cardPlayInProgress = false;
        
        // Send updated game state to other players (after all changes are complete)
        if (this.multiplayer && this.socket && isValidPattern) {
            this.sendGameState();
        }
        
        // Player's turn is complete, don't switch again (already switched after each stone)
        
        return { 
            success: true, 
            cardComplete: true, 
            validPattern: isValidPattern,
            nextPlayer: this.currentPlayer === 1 ? 'Black' : 'White'
        };
    }

    drawHoverStone() {
        if (!this.hoverPosition || !this.enableInteraction) return;
        
        // Don't show hover if position is occupied
        if (this.board[this.hoverPosition.x][this.hoverPosition.y] !== 0) return;

        // Draw a semi-transparent stone at hover position
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        
        const stoneRadius = this.cellSize * 0.45;
        
        if (this.currentPlayer === 1) {
            this.ctx.fillStyle = "black";
        } else {
            this.ctx.fillStyle = "white";
        }
        
        this.ctx.beginPath();
        this.ctx.arc(
            this.margin + this.hoverPosition.x * this.cellSize,
            this.margin + this.hoverPosition.y * this.cellSize,
            stoneRadius,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
        
        // Add border for white stones
        if (this.currentPlayer === 2) {
            this.ctx.globalAlpha = 0.7;
            this.ctx.strokeStyle = "#666";
            this.ctx.lineWidth = 1;
                this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // Method to change current player manually
    setCurrentPlayer(player) {
        if (player === 1 || player === 2) {
            this.currentPlayer = player;
            this.renderBoard(); // Update hover stone color
        }
    }

    // Method to toggle interaction on/off
    setInteractive(interactive) {
        this.enableInteraction = interactive;
        if (!interactive) {
            this.hoverPosition = null;
            this.renderBoard();
        }
    }

    // Render the player's hand
    renderHand() {
        if (!this.handCanvas) return;
        
        // Clear hand canvas
        this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
        
        // Dark gray background
        this.handCtx.fillStyle = "#444444";
        this.handCtx.fillRect(0, 0, this.handCanvas.width, this.handCanvas.height);
        
        // Title - show appropriate player info based on multiplayer mode
        this.handCtx.fillStyle = "white";
        this.handCtx.font = "18px Arial";
        this.handCtx.textAlign = "center";
        
        let titleText;
        if (this.multiplayer) {
            if (this.playerType === 'spectator') {
                titleText = `Player ${this.currentPlayer} (${this.currentPlayer === 1 ? 'Black' : 'White'}) Hand`;
            } else {
                titleText = `Your Hand (${this.myPlayerNumber === 1 ? 'Black' : 'White'})`;
            }
        } else {
            titleText = `Player ${this.currentPlayer} (${this.currentPlayer === 1 ? 'Black' : 'White'}) Hand`;
        }
        
        this.handCtx.fillText(titleText, this.handCanvas.width / 2, 25);
        
        // Card dimensions - made bigger
        const cardWidth = 160;
        const cardHeight = 140;
        const cardSpacing = 15;
        
        // Center cards in hand
        const totalWidth = 3 * cardWidth + 2 * cardSpacing;
        const startX = (this.handCanvas.width - totalWidth) / 2;
        const startY = 40;
        
        // Determine which hand to show
        let playerHand;
        if (this.multiplayer) {
            if (this.playerType === 'spectator') {
                // Spectators see the current player's hand
                playerHand = this.hands[this.currentPlayer];
            } else {
                // Players ALWAYS see only their own hand, regardless of whose turn it is
                playerHand = this.hands[this.myPlayerNumber];
            }
        } else {
            // Single player mode - show current player's hand
            playerHand = this.hands[this.currentPlayer];
        }
        
        // Store card positions for click detection
        this.cardPositions = [];
        
        // Draw each card
        playerHand.forEach((card, index) => {
            const x = startX + index * (cardWidth + cardSpacing);
            const y = startY;
            
            // Store position for click detection
            this.cardPositions.push({
                x, y, width: cardWidth, height: cardHeight,
                cardId: card.id, card: card
            });
            
            // Card background (same as goban wood color)
            const isSelected = this.selectedCard && this.selectedCard.id === card.id;
            this.handCtx.fillStyle = isSelected ? "#ffff99" : "#DEB887";
            this.handCtx.fillRect(x, y, cardWidth, cardHeight);
            
            // Card border
            this.handCtx.strokeStyle = isSelected ? "#ff6600" : "black";
            this.handCtx.lineWidth = isSelected ? 3 : 1;
            this.handCtx.strokeRect(x, y, cardWidth, cardHeight);
            
            // Card name at the top
            this.handCtx.fillStyle = "black";
            this.handCtx.font = "14px Arial";
            this.handCtx.textAlign = "center";
            this.handCtx.fillText(card.name, x + cardWidth/2, y + 18);
            
            // Draw 5x5 goban pattern - centered and bigger
            const gridSize = 5;
            const cellSize = 20;
            const gridTotalSize = (gridSize - 1) * cellSize;
            const gobanStartX = x + (cardWidth - gridTotalSize) / 2;
            const gobanStartY = y + 30;
            const stoneRadius = 8;
            
            // Draw grid lines - black for better contrast
            this.handCtx.strokeStyle = "black";
            this.handCtx.lineWidth = 1;
            
            // Horizontal lines
            for (let i = 0; i < gridSize; i++) {
                this.handCtx.beginPath();
                this.handCtx.moveTo(gobanStartX, gobanStartY + i * cellSize);
                this.handCtx.lineTo(gobanStartX + (gridSize - 1) * cellSize, gobanStartY + i * cellSize);
                this.handCtx.stroke();
            }
            
            // Vertical lines
            for (let i = 0; i < gridSize; i++) {
                this.handCtx.beginPath();
                this.handCtx.moveTo(gobanStartX + i * cellSize, gobanStartY);
                this.handCtx.lineTo(gobanStartX + i * cellSize, gobanStartY + (gridSize - 1) * cellSize);
                this.handCtx.stroke();
            }
            
            // Draw stones according to card pattern
            for (let row = 0; row < card.move_data.length; row++) {
                for (let col = 0; col < card.move_data[row].length; col++) {
                    if (card.move_data[row][col] === '1') {
                        const stoneX = gobanStartX + col * cellSize;
                        const stoneY = gobanStartY + row * cellSize;
                        
                        this.handCtx.beginPath();
                        this.handCtx.arc(stoneX, stoneY, stoneRadius, 0, 2 * Math.PI);
                        
                        // Stone color based on the hand owner, not current player
                        let handOwner;
                        if (this.multiplayer) {
                            if (this.playerType === 'spectator') {
                                handOwner = this.currentPlayer; // Spectators see current player's hand
                            } else {
                                handOwner = this.myPlayerNumber; // Players see their own hand
                            }
                        } else {
                            handOwner = this.currentPlayer; // Single player mode
                        }
                        
                        this.handCtx.fillStyle = handOwner === 1 ? "black" : "white";
                        this.handCtx.fill();
                        
                        // Add border for white stones
                        if (handOwner === 2) {
                            this.handCtx.strokeStyle = "black";
                            this.handCtx.lineWidth = 1;
                            this.handCtx.stroke();
                        }
                    }
                }
            }
            

        });
        
        // Single discard button (only when card is selected)
        this.discardButton = null; // Reset discard button position
        if (this.selectedCard) {
            const discardButtonWidth = 60;
            const discardButtonHeight = 25;
            const discardButtonX = this.handCanvas.width / 2 + 200; // To the right of status message
            const discardButtonY = startY + cardHeight + 15;
            
            // Store discard button position for click detection
            this.discardButton = {
                x: discardButtonX,
                y: discardButtonY,
                width: discardButtonWidth,
                height: discardButtonHeight
            };
            
            // Draw discard button
            this.handCtx.fillStyle = "#cc4444";
            this.handCtx.fillRect(discardButtonX, discardButtonY, discardButtonWidth, discardButtonHeight);
            this.handCtx.strokeStyle = "black";
            this.handCtx.lineWidth = 1;
            this.handCtx.strokeRect(discardButtonX, discardButtonY, discardButtonWidth, discardButtonHeight);
            
            // Discard button text
            this.handCtx.fillStyle = "white";
            this.handCtx.font = "12px Arial";
            this.handCtx.textAlign = "center";
            this.handCtx.fillText("Discard", discardButtonX + discardButtonWidth/2, discardButtonY + 16);
        }
        
        // Status message
        this.handCtx.fillStyle = "white";
        this.handCtx.font = "14px Arial";
        this.handCtx.textAlign = "center";
        const instructionY = startY + cardHeight + 25;
        
        if (this.multiplayer && !this.isMyTurn() && this.playerType !== 'spectator') {
            this.handCtx.fillStyle = "#ff6666";
            this.handCtx.fillText("Waiting for your turn...", this.handCanvas.width / 2, instructionY);
        } else if (this.selectedCard) {
            this.handCtx.fillText(`Selected: ${this.selectedCard.name} - Progress: ${this.cardMoves.length}/${this.selectedCard.canPlayMoves}`, this.handCanvas.width / 2, instructionY);
        } else if (!this.canPlayAnyCard()) {
            this.handCtx.fillStyle = "#ff6666";
            this.handCtx.fillText("No legal plays available - click a card to discard", this.handCanvas.width / 2, instructionY);
        } else {
            this.handCtx.fillStyle = "#ffff99";
            this.handCtx.fillText("Select a card to play - stones cannot be placed without a card!", this.handCanvas.width / 2, instructionY);
        }
        
        // Additional info
        this.handCtx.fillStyle = "white";
        this.handCtx.font = "12px Arial";
        this.handCtx.fillText(`Deck: ${this.deck.length} | Graveyard: ${this.graveyard.length}`, this.handCanvas.width / 2, instructionY + 20);
    }

    // Handle clicks on the hand canvas
    handleHandClick(event) {
        const rect = this.handCanvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Check if click is on the single discard button
        if (this.discardButton && this.selectedCard &&
            mouseX >= this.discardButton.x && mouseX <= this.discardButton.x + this.discardButton.width &&
            mouseY >= this.discardButton.y && mouseY <= this.discardButton.y + this.discardButton.height) {
            
            // Discard the selected card
            const result = this.discardAndDraw(this.selectedCard.id);
            if (result.success) {
                console.log(`Discarded selected card: ${result.discarded.name}`);
                this.selectedCard = null; // Clear selection
                this.cardMoves = [];
                this.cardPlayInProgress = false;
                this.renderHand(); // Update display
            }
            return;
        }
        
        // Check if click is on a card
        for (const cardPos of this.cardPositions) {
            if (mouseX >= cardPos.x && mouseX <= cardPos.x + cardPos.width &&
                mouseY >= cardPos.y && mouseY <= cardPos.y + cardPos.height) {
                
                this.handleCardClick(cardPos.card);
                break;
            }
        }
    }

    // Handle clicking on a specific card
    handleCardClick(card) {
        // Check if it's this player's turn in multiplayer
        if (this.multiplayer && !this.isMyTurn()) {
            console.log("Not your turn - cannot select cards!");
            return;
        }
        
        // If no card selected, select this card
        if (!this.selectedCard) {
            // Check if this card can be played with advanced validation
            if (this.canPlayCardAnywhere(card)) {
                this.selectCard(card.id);
                console.log(`Selected card: ${card.name}`);
            } else {
                // No legal plays - offer to discard
                const confirm = globalThis.confirm(`No legal plays for "${card.name}". Discard this card and draw a new one?`);
                if (confirm) {
                    this.discardAndDraw(card.id);
                }
            }
        } else {
            // Card already selected
            if (this.selectedCard.id === card.id) {
                // Clicking same card - deselect
                this.selectedCard = null;
                this.cardMoves = [];
                this.cardPlayInProgress = false;
                console.log('Card deselected');
            } else {
                // Clicking different card - switch selection
                if (this.canPlayCardAnywhere(card)) {
                    this.selectCard(card.id);
                    console.log(`Switched to card: ${card.name}`);
                } else {
                    console.log(`Cannot select ${card.name} - no legal plays available`);
                }
            }
        }
        
        this.renderHand(); // Update hand display
    }

    // Advanced check: can this card be played anywhere on the board?
    canPlayCardAnywhere(card) {
        // Get all possible transformations of the pattern
        const allPatternVariations = this.getAllPatternTransformations(card.move_data);
        
        // Try each pattern variation
        for (const patternPositions of allPatternVariations) {
            // Try each position on the board as a potential starting position
            for (let boardX = 0; boardX < this.boardSize; boardX++) {
                for (let boardY = 0; boardY < this.boardSize; boardY++) {
                    // Skip if position is already occupied (unless captures might free it)
                    if (this.board[boardX][boardY] !== 0) {
                        continue;
                    }
                    
                    // Try this board position as each pattern position
                    for (const patternPos of patternPositions) {
                        // Calculate where the center would be
                        const centerX = boardX - patternPos.offsetX;
                        const centerY = boardY - patternPos.offsetY;
                        
                        // Generate all required moves for this pattern placement
                        const requiredMoves = patternPositions.map(pos => ({
                            x: centerX + pos.offsetX,
                            y: centerY + pos.offsetY
                        }));
                        
                        // Check if all moves are on board
                        if (!requiredMoves.every(move => this.onBoard(move))) {
                            continue;
                        }
                        
                        // Simulate the sequence considering captures
                        if (this.canCompletePattern(requiredMoves)) {
                            return true; // Found at least one valid placement
                        }
                    }
                }
            }
        }
        
        return false; // No valid placements found
    }

    // Check if a pattern can be completed considering captures at each step
    canCompletePattern(moves) {
        const originalBoard = this.copyBoard();
        let canComplete = true;
        
        try {
            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                
                // Check if position is available (empty or will be freed by captures)
                if (this.board[move.x][move.y] !== 0) {
                    // Check if placing previous stones created captures that free this position
                    let positionWillBeFree = false;
                    
                    // Temporarily place all previous moves and check captures
                    const tempBoard = this.copyBoard();
                    for (let j = 0; j < i; j++) {
                        tempBoard[moves[j].x][moves[j].y] = this.currentPlayer;
                        // Apply captures from this move
                        const captures = this.getCapturesForMove({
                            x: moves[j].x,
                            y: moves[j].y,
                            color: this.currentPlayer
                        }, tempBoard);
                        captures.forEach(capture => {
                            tempBoard[capture.x][capture.y] = 0;
                        });
                    }
                    
                    // Check if current position is now free
                    if (tempBoard[move.x][move.y] === 0) {
                        positionWillBeFree = true;
                    }
                    
                    if (!positionWillBeFree) {
                        canComplete = false;
                        break;
                    }
                }
                
                // Place the stone
                this.board[move.x][move.y] = this.currentPlayer;
                
                // Apply captures
                this.checkCaptures({
                    x: move.x,
                    y: move.y,
                    color: this.currentPlayer
                }, true);
            }
        } catch (_error) {
            canComplete = false;
        }
        
        // Restore original board
        this.board = originalBoard;
        
        return canComplete;
    }

    // Helper method to get captures without applying them to a specific board state
    getCapturesForMove(move, boardState) {
        const captures = [];
        const opponentColor = move.color === 1 ? 2 : 1;
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        directions.forEach(([dx, dy]) => {
            const adjX = move.x + dx;
            const adjY = move.y + dy;
            
            if (this.onBoard({x: adjX, y: adjY}) && boardState[adjX][adjY] === opponentColor) {
                const group = this.getGroupInBoardState(adjX, adjY, boardState);
                if (this.getLibertiesInBoardState(group, boardState).length === 0) {
                    captures.push(...group);
                }
            }
        });
        
        return captures;
    }

    // Helper methods for working with arbitrary board states
    getGroupInBoardState(startX, startY, boardState) {
        const color = boardState[startX][startY];
        const group = [];
        const visited = new Set();
        const stack = [{x: startX, y: startY}];
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key) || !this.onBoard({x, y}) || boardState[x][y] !== color) {
                continue;
            }
            
            visited.add(key);
            group.push({x, y});
            
            // Add adjacent positions
            [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy]) => {
                stack.push({x: x + dx, y: y + dy});
            });
        }
        
        return group;
    }

    getLibertiesInBoardState(group, boardState) {
        const liberties = new Set();
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        group.forEach(({x, y}) => {
            directions.forEach(([dx, dy]) => {
                const adjX = x + dx;
                const adjY = y + dy;
                
                if (this.onBoard({x: adjX, y: adjY}) && boardState[adjX][adjY] === 0) {
                    liberties.add(`${adjX},${adjY}`);
                }
            });
        });
        
        return Array.from(liberties).map(key => {
            const [x, y] = key.split(',').map(Number);
            return {x, y};
        });
    }

    // Helper method to convert coordinates to standard notation
    getCoordinateString(x, y) {
        const letter = String.fromCharCode(65 + x); // A, B, C, etc.
        const number = this.boardSize - y; // Numbers from top to bottom
        return letter + number;
    }

    // Helper method to parse coordinate string back to x,y
    parseCoordinate(coordString) {
        if (coordString.length < 2) return null;
        
        const letter = coordString.charAt(0).toUpperCase();
        const number = parseInt(coordString.slice(1));
        
        const x = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
        const y = this.boardSize - number; // Convert back to array index
        
        if (x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize) {
            return {x, y};
        }
        return null;
    }

    // Method to play a move for the current player (respects rules and switches players)
    playMoveForCurrentPlayer(x, y) {
        return this.handleClick({x, y});
    }

    // Method to play a move at coordinate string (e.g., "D4")
    playMoveAtCoordinate(coordString) {
        const position = this.parseCoordinate(coordString);
        if (position) {
            return this.playMoveForCurrentPlayer(position.x, position.y);
        }
        return false;
    }

    // Initialize the card system
    initializeCardSystem() {
        this.deck = this.createDeck();
        this.shuffleDeck();
        this.graveyard = []; // Used cards go here
        
        // Player hands
        this.hands = {
            1: [], // Black player hand
            2: []  // White player hand
        };
        
        // Deal initial hands (3 cards each)
        for (let i = 0; i < 3; i++) {
            this.hands[1].push(this.drawCard());
            this.hands[2].push(this.drawCard());
        }
        
        // Card play state
        this.selectedCard = null;
        this.cardMoves = [];
        this.cardPlayInProgress = false;
        
        console.log('Card system initialized');
        console.log('Player 1 hand:', this.hands[1].map(card => card.name));
        console.log('Player 2 hand:', this.hands[2].map(card => card.name));
    }

    // Create a deck with multiple copies of each card
    createDeck() {
        const deck = [];
        const copiesPerCard = 3; // Adjust as needed
        
        cards.forEach(cardTemplate => {
            for (let i = 0; i < copiesPerCard; i++) {
                deck.push(new Card(cardTemplate.move_data, cardTemplate.name));
            }
        });
        
        return deck;
    }

    // Shuffle the deck
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // Draw a card from the deck
    drawCard() {
        if (this.deck.length === 0) {
            console.log('Deck is empty!');
            return null;
        }
        return this.deck.pop();
    }

    // Select a card to play
    selectCard(cardId) {
        // In multiplayer, use the player's own hand, not the current player's hand
        const handToUse = this.multiplayer ? this.myPlayerNumber : this.currentPlayer;
        const playerHand = this.hands[handToUse];
        const cardIndex = playerHand.findIndex(card => card.id === cardId);
        
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in hand' };
        }
        
        this.selectedCard = playerHand[cardIndex];
        this.cardMoves = [];
        this.cardPlayInProgress = true;
        
        console.log(`Selected card: ${this.selectedCard.name} (${this.selectedCard.canPlayMoves} moves)`);
        
        return { success: true, card: this.selectedCard };
    }

    // Check if current player can play any card
    canPlayAnyCard() {
        // In multiplayer, check the player's own hand, not the current player's hand
        const handToUse = this.multiplayer ? this.myPlayerNumber : this.currentPlayer;
        const playerHand = this.hands[handToUse];
        
        if (!playerHand || playerHand.length === 0) return false;
        
        return playerHand.some(card => this.canPlayCardAnywhere(card));
    }

    // Discard a card and draw a new one (pass)
    discardAndDraw(cardId) {
        // In multiplayer, use the player's own hand, not the current player's hand
        const handToUse = this.multiplayer ? this.myPlayerNumber : this.currentPlayer;
        const playerHand = this.hands[handToUse];
        const cardIndex = playerHand.findIndex(card => card.id === cardId);
        
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in hand' };
        }
        
        // Remove card from hand and send to graveyard
        const discardedCard = playerHand.splice(cardIndex, 1)[0];
        this.graveyard.push(discardedCard);
        
        // Draw a new card only if hand is under limit
        let newCard = null;
        if (playerHand.length < 3) {
            newCard = this.drawCard();
            if (newCard) {
                playerHand.push(newCard);
            }
        }
        
        // Switch players (this counts as a pass)
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        
        // Send updated game state to other players in multiplayer
        if (this.multiplayer && this.socket) {
            this.sendGameState();
        }
        
        console.log(`Player discarded ${discardedCard.name} to graveyard and drew ${newCard ? newCard.name : 'no card'}`);
        
        return { success: true, discarded: discardedCard, drawn: newCard };
    }

    // === MULTIPLAYER METHODS ===
    
    // Check if it's this player's turn
    isMyTurn() {
        if (!this.multiplayer) return true; // Single player mode
        if (this.playerType === 'spectator') return false; // Spectators can't play
        return this.currentPlayer === this.myPlayerNumber;
    }
    
    // Handle user joining the room
    handleUserJoined(userData) {
        this.connectedUsers.set(userData.id, userData);
        console.log(`${userData.name} (${userData.type}) joined the room`);
        
        // If this is the host and someone joins, send current game state
        if (this.playerType === 'host' && userData.type !== 'host') {
            this.sendGameState();
        }
    }
    
    // Send current game state to other players
    sendGameState() {
        if (!this.socket) return;
        
                 const gameState = {
             board: this.board,
             currentPlayer: this.currentPlayer,
             moves: this.moves,
             boardStateHistory: this.boardStateHistory,
             lastMoveWasKoCapture: this.lastMoveWasKoCapture,
             graveyard: this.graveyard,
             // Only send visible hands (not opponent's hand)
             hands: this.getVisibleHands()
         };
        
        this.socket.emit("game-state", gameState);
    }
    
    // Get hands that this player can see
    getVisibleHands() {
        if (this.playerType === 'spectator') {
            return this.hands; // Spectators see all hands
        } else {
            // Players only send their own hand data
            const visibleHands = {};
            visibleHands[this.myPlayerNumber] = this.hands[this.myPlayerNumber];
            return visibleHands;
        }
    }
    
    // Remote play is now handled via game state synchronization
    
    // Sync game state from host
    syncGameState(state) {
        console.log('Syncing game state:', state);
        
                 this.board = state.board;
         this.currentPlayer = state.currentPlayer;
         this.moves = state.moves;
         this.boardStateHistory = state.boardStateHistory;
         this.lastMoveWasKoCapture = state.lastMoveWasKoCapture || false;
         this.graveyard = state.graveyard;
        
        // Reconstruct hands with proper Card objects (only update hands that are visible to this player)
        if (state.hands) {
            // For spectators, sync all hands
            if (this.playerType === 'spectator') {
                Object.keys(state.hands).forEach(playerNum => {
                    this.hands[playerNum] = this.reconstructCardObjects(state.hands[playerNum]);
                });
            } else {
                // For players, only sync their own hand
                if (state.hands[this.myPlayerNumber]) {
                    this.hands[this.myPlayerNumber] = this.reconstructCardObjects(state.hands[this.myPlayerNumber]);
                }
                // Don't sync opponent's hand to maintain privacy
            }
        }
        
        this.renderBoard();
        this.renderHand();
    }
    
    // Reconstruct Card objects from plain data
    reconstructCardObjects(handData) {
        if (!Array.isArray(handData)) {
            console.warn('Invalid hand data:', handData);
            return [];
        }
        
        return handData.map(cardData => {
            // Create new Card object with proper methods
            return new Card(cardData.move_data, cardData.name, cardData.id);
        });
    }
    
    // Play events are now sent via game state synchronization

    // Create a string representation of the current board state
    getBoardStateString() {
        return this.board.map(row => row.join('')).join('');
    }

    // Create a deep copy of the board
    copyBoard() {
        return this.board.map(row => [...row]);
    }

    checkCaptures(lastMove, applyCaptures = true) {
        const captures = [];
        const opponentColor = lastMove.color === 1 ? 2 : 1;
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        // Check adjacent opponent groups for capture
        directions.forEach(([dx, dy]) => {
            const adjX = lastMove.x + dx;
            const adjY = lastMove.y + dy;
            
            if (this.onBoard({x: adjX, y: adjY}) && this.board[adjX][adjY] === opponentColor) {
                const group = this.getGroup(adjX, adjY);
                if (this.getLiberties(group).length === 0) {
                    // Record the captures
                    group.forEach(({x, y}) => {
                        captures.push({x, y});
                    });
                    
                    // Only actually remove stones if applyCaptures is true
                    if (applyCaptures) {
                        group.forEach(({x, y}) => {
                            this.board[x][y] = 0;
                        });
                    }
                }
            }
        });
        
        return captures;
    }

    getGroup(startX, startY) {
        const color = this.board[startX][startY];
        const group = [];
        const visited = new Set();
        const stack = [{x: startX, y: startY}];
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key) || !this.onBoard({x, y}) || this.board[x][y] !== color) {
                continue;
            }
            
            visited.add(key);
            group.push({x, y});
            
            // Add adjacent positions
            [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy]) => {
                stack.push({x: x + dx, y: y + dy});
            });
        }
        
        return group;
    }

    getLiberties(group) {
        const liberties = new Set();
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        group.forEach(({x, y}) => {
            directions.forEach(([dx, dy]) => {
                const adjX = x + dx;
                const adjY = y + dy;
                
                if (this.onBoard({x: adjX, y: adjY}) && this.board[adjX][adjY] === 0) {
                    liberties.add(`${adjX},${adjY}`);
                }
            });
        });
        
        return Array.from(liberties).map(key => {
            const [x, y] = key.split(',').map(Number);
            return {x, y};
        });
    }
}

// Built-in rule examples
vGoban.rules = {
    // Suicide rule - prevent moves that would capture your own group
    noSuicide: function(move) {
        // Temporarily place the stone FIRST
        this.board[move.x][move.y] = move.color;
        
        // Check if this move would capture opponent stones (don't actually capture)
        const wouldCapture = this.checkCaptures(move, false).length > 0;
        if (wouldCapture) {
            // Remove the temporary stone
            this.board[move.x][move.y] = 0;
            return true; // Captures take precedence over suicide
        }
        
        // Check if our own group has liberties
        const group = this.getGroup(move.x, move.y);
        const liberties = this.getLiberties(group);
        
        // Remove the temporary stone
        this.board[move.x][move.y] = 0;
        
        // Allow if group has liberties (no suicide)
        return liberties.length > 0;
    },
    
         // Ko rule - prevent immediate board state repetition
     koRule: function(move) {
         // Ko rule only applies if the LAST move was a Ko-creating capture
         // (captured exactly one stone, creating a symmetric Ko position)
         if (!this.lastMoveWasKoCapture) {
             return true; // If last move wasn't a Ko-creating capture, Ko rule doesn't apply
         }
         
         if (this.boardStateHistory.length === 0) return true;
         
         // Temporarily make the move
         const originalBoard = this.copyBoard();
         this.board[move.x][move.y] = move.color;
         
         // Apply captures to see the resulting board state
         const captures = this.checkCaptures(move, false);
         
         // Ko rule only applies if THIS move would also be a capture
         if (captures.length === 0) {
             this.board = originalBoard;
             return true; // No capture = no Ko violation possible
         }
         
         captures.forEach(({x, y}) => this.board[x][y] = 0);
         
         const newState = this.getBoardStateString();
         this.board = originalBoard;
         
         // Ko rule: does this capturing move recreate any previous board state?
         const wouldRepeat = this.boardStateHistory.includes(newState);
         
         return !wouldRepeat; // Return true if valid (doesn't repeat)
     },
    
    // Alternating turns
    alternateTurns: function(move) {
        // Ensure the move color matches the current player
        return move.color === this.currentPlayer;
    }
};

class Card {
    constructor(move_data, name, id = null) {
        this.move_data = move_data;
        this.name = name;
        // Get number of 1s in move_data (number of stones to play)
        this.canPlayMoves = this.move_data.reduce((acc, row) => acc + row.split("").filter(char => char === "1").length, 0);
        this.id = id || Math.random().toString(36).substr(2, 9); // Use provided ID or generate new one
    }

    // Check if a set of moves matches this card's pattern
    validateMoves(moves, _centerX, _centerY) {
        if (moves.length !== this.canPlayMoves) return false;
        
        // Try to find the best center position that matches the played moves
        return this.findMatchingPattern(moves);
    }

    // Find if the played moves match this card's pattern (checking all rotations and reflections)
    // The first move can be any '1' position, remaining moves must complete the pattern
    findMatchingPattern(playedMoves) {
        if (playedMoves.length !== this.canPlayMoves) return false;
        
        // Get all possible transformations of the pattern (rotations + reflections)
        const allPatternVariations = this.getAllPatternTransformations(this.move_data);
        
        // Try each pattern variation
        for (const patternPositions of allPatternVariations) {
            // Try each played move as the potential starting position
            for (const firstMove of playedMoves) {
                // For each pattern position, try it as the reference for the first move
                for (const patternPos of patternPositions) {
                    // Calculate what the center would be if firstMove corresponds to this pattern position
                    const centerX = firstMove.x - patternPos.offsetX;
                    const centerY = firstMove.y - patternPos.offsetY;
                    
                    // Generate expected moves for this center
                    const expectedMoves = patternPositions.map(pos => ({
                        x: centerX + pos.offsetX,
                        y: centerY + pos.offsetY
                    }));
                    
                    // Check if all played moves match expected moves
                    const matches = playedMoves.every(playedMove =>
                        expectedMoves.some(expectedMove =>
                            expectedMove.x === playedMove.x && expectedMove.y === playedMove.y
                        )
                    ) && expectedMoves.every(expectedMove =>
                        playedMoves.some(playedMove =>
                            playedMove.x === expectedMove.x && playedMove.y === expectedMove.y
                        )
                    );
                    
                    if (matches) {
                        return true; // Found a valid pattern match
                    }
                }
            }
        }
        
        return false;
    }

    // Get all possible transformations of a pattern (8 total: 4 rotations × 2 reflections)
    getAllPatternTransformations(moveData) {
        const transformations = [];
        
        // Original pattern
        transformations.push(this.extractPatternPositions(moveData));
        
        // Rotate 90 degrees (3 more rotations)
        let rotated = moveData;
        for (let i = 0; i < 3; i++) {
            rotated = this.rotatePattern90(rotated);
            transformations.push(this.extractPatternPositions(rotated));
        }
        
        // Horizontal reflection of original
        const horizontalReflected = this.reflectPatternHorizontally(moveData);
        transformations.push(this.extractPatternPositions(horizontalReflected));
        
        // Rotate the reflected pattern (3 more rotations)
        rotated = horizontalReflected;
        for (let i = 0; i < 3; i++) {
            rotated = this.rotatePattern90(rotated);
            transformations.push(this.extractPatternPositions(rotated));
        }
        
        return transformations;
    }

    // Extract pattern positions from move data
    extractPatternPositions(moveData) {
        const positions = [];
        const center = Math.floor(moveData.length / 2);
        
        for (let row = 0; row < moveData.length; row++) {
            for (let col = 0; col < moveData[row].length; col++) {
                if (moveData[row][col] === '1') {
                    positions.push({
                        offsetX: col - center,
                        offsetY: row - center
                    });
                }
            }
        }
        
        return positions;
    }

    // Rotate pattern 90 degrees clockwise
    rotatePattern90(pattern) {
        const size = pattern.length;
        const rotated = Array(size).fill().map(() => Array(size).fill('0'));
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                rotated[col][size - 1 - row] = pattern[row][col];
            }
        }
        
        return rotated;
    }

    // Reflect pattern horizontally
    reflectPatternHorizontally(pattern) {
        const size = pattern.length;
        const reflected = Array(size).fill().map(() => Array(size).fill('0'));
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                reflected[row][size - 1 - col] = pattern[row][col];
            }
        }
        
        return reflected;
    }

    // Get the expected moves for this card at a given center position
    getExpectedMoves(centerX, centerY) {
        const moves = [];
        const center = Math.floor(this.move_data.length / 2); // Assuming 5x5 grid, center is at (2,2)
        
        for (let y = 0; y < this.move_data.length; y++) {
            for (let x = 0; x < this.move_data[y].length; x++) {
                if (this.move_data[y][x] === '1') {
                    const offsetX = x - center;
                    const offsetY = y - center;
                    moves.push({
                        x: centerX + offsetX,
                        y: centerY + offsetY
                    });
                }
            }
        }
        
        return moves;
    }

    // Get valid positions where this card can be played (considering captures)
    getValidPlacements(goban) {
        const validPlacements = [];
        
        // Get all '1' positions in the pattern
        const patternPositions = [];
        const center = Math.floor(this.move_data.length / 2);
        
        for (let row = 0; row < this.move_data.length; row++) {
            for (let col = 0; col < this.move_data[row].length; col++) {
                if (this.move_data[row][col] === '1') {
                    patternPositions.push({
                        offsetX: col - center,
                        offsetY: row - center
                    });
                }
            }
        }
        
        // Try placing the pattern with each '1' position as a potential starting point
        for (let startX = 0; startX < goban.boardSize; startX++) {
            for (let startY = 0; startY < goban.boardSize; startY++) {
                // Try each pattern position as the reference for this board position
                for (const patternPos of patternPositions) {
                    const centerX = startX - patternPos.offsetX;
                    const centerY = startY - patternPos.offsetY;
                    
                    // Generate all moves for this pattern placement
                    const expectedMoves = patternPositions.map(pos => ({
                        x: centerX + pos.offsetX,
                        y: centerY + pos.offsetY
                    }));
                    
                    // Check if this placement is valid considering captures
                    if (this.canPlayAtPosition(goban, expectedMoves)) {
                        validPlacements.push({centerX, centerY, moves: expectedMoves});
                    }
                }
            }
        }
        
        return validPlacements;
    }

    // Check if a card can be played at a specific position (considering captures)
    canPlayAtPosition(goban, moves) {
        // All moves must be on board
        if (!moves.every(move => goban.onBoard(move))) {
            return false;
        }
        
        // Simulate the sequence of moves to see if the pattern can be completed
        const originalBoard = goban.copyBoard();
        let canComplete = true;
        
        try {
            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                
                // Check if position is empty
                if (goban.board[move.x][move.y] !== 0) {
                    canComplete = false;
                    break;
                }
                
                // Place the stone temporarily
                goban.board[move.x][move.y] = goban.currentPlayer;
                
                // Apply captures (this might free up positions for later moves)
                goban.checkCaptures({
                    x: move.x,
                    y: move.y,
                    color: goban.currentPlayer
                }, true);
            }
        } catch (_error) {
            canComplete = false;
        }
        
        // Restore original board
        goban.board = originalBoard;
        
        return canComplete;
    }
}
