// ---- Constants ----
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_SYMBOLS = { hearts:'♥', diamonds:'♦', clubs:'♣', spades:'♠' };
const RED_SUITS = new Set(['hearts','diamonds']);

// ---- Card ----
function makeCard(suit, rank, faceUp = false) {
    return {
        id: `${rank}_${suit}_${Math.random().toString(36).slice(2,7)}`,
        suit, rank, faceUp,
        color: RED_SUITS.has(suit) ? 'red' : 'black',
        rankValue: RANKS.indexOf(rank) + 1
    };
}

// ---- Deck ----
function createDeck(numDecks = 2) {
    const cards = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                cards.push(makeCard(suit, rank));
            }
        }
    }
    return cards;
}

// ---- Seeded PRNG (Mulberry32) ----
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function shuffle(arr, rng) {
    rng = rng || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function winnableShuffle(deck, rng) {
    // 1. Extract all Aces and some 2s to ensure a strong start
    const aces = deck.filter(c => c.rank === 'A');
    const twos = deck.filter(c => c.rank === '2');
    const rest = deck.filter(c => c.rank !== 'A' && c.rank !== '2');
    
    shuffle(rest, rng);
    
    // 2. We have 4 Tableaus, 8 Foundations (4 Ace, 4 King)
    // Let's put 4 Aces in the first 4 Tableau spots or early Stockpile
    const winnableDeck = [];
    
    // Deal 4 Aces to the Tableaus initially
    for (let i = 0; i < 4; i++) {
        winnableDeck.push(aces.pop());
    }
    
    // Fill the rest of the Tableaus (8 more cards for the 3-per-tableau deal)
    for (let i = 0; i < 8; i++) {
        winnableDeck.push(rest.pop());
    }
    
    // Now fill Reserves (40 cards)
    for (let i = 0; i < 40; i++) {
        winnableDeck.push(rest.pop());
    }
    
    // Put some Twos and the remaining Aces in the early Stockpile (next 12 cards)
    for (let i = 0; i < 4; i++) {
        if (aces.length) winnableDeck.push(aces.pop());
        if (twos.length) winnableDeck.push(twos.pop());
    }
    
    // Append the rest
    winnableDeck.push(...aces, ...twos, ...rest);
    
    return winnableDeck;
}

// ---- Game Engine ----
const game = {
    centralFoundation: [],
    kingFoundations: [[], [], [], []],
    reserves: [[], [], [], []],
    tableaus: [[], [], [], []],
    stockpile: [],
    temporaryStacks: [],
    currentPhase: 1,
    undoStack: [],
    redoStack: [],
    lastMove: null,
    moveCount: 0,
    lastDrawStackIndex: -1,
    startTime: Date.now(),
    currentHint: null,
    peeksLeft: 3,
    isPeekActive: false,
    hasStarted: false,
    lastMoveTime: 0,
    hintCooldown: 2000, // 2 seconds Strategic Pause
    currentSeed: null, // Track the current game seed

    startNewGame(seed = null) {
        this.centralFoundation = [];
        this.kingFoundations = [[], [], [], []];
        this.reserves = [[], [], [], []];
        this.tableaus = [[], [], [], []];
        this.temporaryStacks = [];
        this.currentPhase = 1;
        this.undoStack = [];
        this.redoStack = [];
        this.moveCount = 0;
        this.lastDrawStackIndex = -1;
        this.startTime = Date.now();
        this.currentHint = null;
        this.peeksLeft = 3;
        this.isPeekActive = false;
        
        if (!seed) {
            this.currentSeed = Math.floor(Math.random() * 1000000);
        } else {
            this.currentSeed = seed;
        }
        
        const rng = mulberry32(this.currentSeed);

        // Use the new Winnable Shuffle logic for testing
        const deck = winnableShuffle(createDeck(2), rng);
        let idx = 0;

        // Deal reserves (10 face-down each)
        for (let i = 0; i < 4; i++) {
            this.reserves[i] = deck.slice(idx, idx + 10);
            idx += 10;
        }

        // Deal tableaus (3 face-up each)
        for (let i = 0; i < 4; i++) {
            this.tableaus[i] = deck.slice(idx, idx + 3).map(c => ({ ...c, faceUp: true }));
            idx += 3;
        }

        // Remaining to stockpile
        this.stockpile = deck.slice(idx);
        this.hasStarted = true;

        hideOverlays();
    },

    // ---- Snapshot ----
    takeSnapshot() {
        return JSON.parse(JSON.stringify({
            centralFoundation: this.centralFoundation,
            kingFoundations: this.kingFoundations,
            reserves: this.reserves,
            tableaus: this.tableaus,
            stockpile: this.stockpile,
            temporaryStacks: JSON.parse(JSON.stringify(this.temporaryStacks)),
            currentPhase: this.currentPhase,
            moveCount: this.moveCount,
            lastDrawStackIndex: this.lastDrawStackIndex
        }));
    },

    restore(snap) {
        this.centralFoundation = snap.centralFoundation;
        this.kingFoundations = snap.kingFoundations;
        this.reserves = snap.reserves;
        this.tableaus = snap.tableaus;
        this.stockpile = snap.stockpile;
        this.temporaryStacks = snap.temporaryStacks;
        this.currentPhase = snap.currentPhase;
        this.moveCount = snap.moveCount;
        this.lastDrawStackIndex = snap.lastDrawStackIndex;
        this.currentHints = [];
    },

    saveForUndo() {
        this.undoStack.push(this.takeSnapshot());
        this.redoStack = [];
    },

    undo() {
        if (!this.undoStack.length) return;
        this.redoStack.push(this.takeSnapshot());
        this.restore(this.undoStack.pop());
    },

    redo() {
        if (!this.redoStack.length) return;
        this.undoStack.push(this.takeSnapshot());
        this.restore(this.redoStack.pop());
    },

    // ---- Drawing ----
    drawCard() {
        if (!this.stockpile.length && this.currentPhase <= 4) {
            this.saveForUndo();
            // Consolidate: right to left, flip face-down
            const newStock = [];
            for (let i = this.temporaryStacks.length - 1; i >= 0; i--) {
                for (const c of this.temporaryStacks[i]) {
                    newStock.push({ ...c, faceUp: false });
                }
            }
            this.stockpile = newStock.reverse();
            this.temporaryStacks = [];
            this.currentPhase++;
            this.lastDrawStackIndex = -1;
            return;
        }

        if (this.currentPhase > 4) return;

        this.saveForUndo();
        const numToDraw = 5 - this.currentPhase;
        const maxStacks = 5 - this.currentPhase;

        if (!this.temporaryStacks.length) {
            this.temporaryStacks = Array.from({ length: maxStacks }, () => []);
            this.lastDrawStackIndex = -1;
        }

        // Draw 'numToDraw' cards and distribute across 'maxStacks'
        // Since numToDraw == maxStacks, we just give 1 to each stack
        for (let i = 0; i < numToDraw; i++) {
            if (this.stockpile.length) {
                const card = this.stockpile.pop();
                card.faceUp = true;
                this.temporaryStacks[i].push(card);
                this.moveCount++;
            }
        }
        this.currentHints = [];
    },

    // ---- Validation ----
    canMoveToCenterFoundation(card) {
        if (!this.centralFoundation.length) return card.rank === 'A';
        const top = this.centralFoundation[this.centralFoundation.length - 1];
        return card.suit === top.suit && card.rankValue === top.rankValue + 1;
    },

    canMoveToKingFoundation(card, idx) {
        const pile = this.kingFoundations[idx];
        if (!pile.length) return card.rank === 'K';
        const top = pile[pile.length - 1];
        return card.suit === top.suit && card.rankValue === top.rankValue - 1;
    },

    canMoveToTableau(cards, idx) {
        if (!cards.length) return false;
        const pile = this.tableaus[idx];
        if (!pile.length) return true;
        const top = pile[pile.length - 1];
        const bottom = cards[0];
        return bottom.color !== top.color && bottom.rankValue === top.rankValue - 1;
    },

    isValidSequence(cards) {
        if (cards.length <= 1) return true;
        for (let i = 0; i < cards.length - 1; i++) {
            if (cards[i].color === cards[i+1].color) return false;
            if (cards[i+1].rankValue !== cards[i].rankValue - 1) return false;
        }
        return true;
    },

    // ---- Move Execution ----
    moveCards(cards, fromPile, fromType, toPile, toType) {
        this.saveForUndo();
        const sourceArray = this.getArray(fromPile, fromType);
        const targetArray = this.getArray(toPile, toType);

        // Verify source: ensure these specific cards (by ID) are at the end of the source array
        const cardsToRemoveIds = new Set(cards.map(c => c.id));
        const actualSourceCards = sourceArray.slice(-cards.length);
        const match = actualSourceCards.every(c => cardsToRemoveIds.has(c.id));

        if (match) {
            sourceArray.splice(-cards.length, cards.length);
        } else {
            // Fallback: search and remove by ID if they aren't at the very end (safety check)
            for (const cardToRemove of cards) {
                const idx = sourceArray.findIndex(c => c.id === cardToRemove.id);
                if (idx !== -1) sourceArray.splice(idx, 1);
            }
        }

        // Add to target
        targetArray.push(...cards);
        
        this.lastMove = { from: fromPile, to: toPile, count: cards.length };
        this.lastMoveTime = Date.now();
        this.currentHints = []; // Clear hints after a move is made
        
        if (this.isGameWon) {
            document.getElementById('overlay-win').classList.remove('hidden');
        } else if (this.checkGameOver()) {
            document.getElementById('overlay-gameover').classList.remove('hidden');
        }
    },

    flipReserve(idx) {
        if (this.tableaus[idx].length === 0 && this.reserves[idx].length > 0) {
            this.saveForUndo();
            const card = this.reserves[idx].pop();
            card.faceUp = true;
            this.tableaus[idx].push(card);
            this.moveCount++;
            this.lastMoveTime = Date.now();
            renderAll();
        }
    },

    autoMove(card, fromPile, fromType) {
        this.currentHints = [];
        const sourceArray = this.getArray(fromPile, fromType);
        if (!sourceArray.length) return false;
        
        // Ensure we are only moving the top card of the pile
        const topCard = sourceArray[sourceArray.length - 1];
        if (topCard.id !== card.id) return false;

        if (this.canMoveToCenterFoundation(topCard)) {
            this.moveCards([topCard], fromPile, fromType, 0, 'ace');
            return true;
        }
        for (let i = 0; i < 4; i++) {
            if (this.canMoveToKingFoundation(topCard, i)) {
                this.moveCards([topCard], fromPile, fromType, i, 'king');
                return true;
            }
        }
        return false;
    },

    getArray(pile, type) {
        if (type === 'tableau') return this.tableaus[pile];
        if (type === 'reserve') return this.reserves[pile];
        if (type === 'temp') return this.temporaryStacks[pile];
        if (type === 'ace') return this.centralFoundation;
        if (type === 'king') return this.kingFoundations[pile];
        return [];
    },

    checkCompletedFoundations() {
        if (this.centralFoundation.length === 13) {
            // Sequence complete: in Kloudio, they stay until the end or are set aside.
            // For now, we'll keep them to allow foundation-to-tableau moves.
        }
    },

    // ---- Win / Game Over ----
    get isGameWon() {
        const total = this.centralFoundation.length +
            this.kingFoundations.reduce((s,p) => s + p.length, 0) +
            this.reserves.reduce((s,p) => s + p.length, 0) +
            this.tableaus.reduce((s,p) => s + p.length, 0) +
            this.stockpile.length +
            this.temporaryStacks.reduce((s,p) => s + p.length, 0);
        return total === 0;
    },

    // ---- Win / Game Over / Strategic Logic ----
    isPeekAllowed() {
        if (this.peeksLeft <= 0) return false;
        
        // Peek is only strategically useful if there is a choice to be made.
        // If there are 0 or 1 hints available, the player has no options, so peeking is disabled.
        const hints = this.calculateHints();
        return hints.length >= 2;
    },

    checkGameOver() {
        if (this.stockpile.length || this.currentPhase <= 4) return false;
        // Check all possible moves
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            const top = t[t.length - 1];
            if (this.canMoveToCenterFoundation(top)) return false;
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) return false;
                if (j !== i && this.canMoveToTableau([top], j)) return false;
            }
        }
        for (let i = 0; i < this.temporaryStacks.length; i++) {
            const st = this.temporaryStacks[i];
            if (!st.length) continue;
            const top = st[st.length - 1];
            if (this.canMoveToCenterFoundation(top)) return false;
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) return false;
                if (this.canMoveToTableau([top], j)) return false;
            }
        }
        // Also check if foundation cards can move to tableaus (Rule 4)
        const foundations = [this.centralFoundation, ...this.kingFoundations];
        for (const f of foundations) {
            if (!f.length) continue;
            const top = f[f.length - 1];
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToTableau([top], j)) return false;
            }
        }
        return true;
    },

    // ---- Hint ----
    findHint() {
        this.currentHints = this.calculateHints();
        return this.currentHints;
    },

    calculateHints() {
        let hints = [];
        
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            const top = t[t.length - 1];
            if (this.canMoveToCenterFoundation(top)) {
                hints.push({ from: `tableau-${i}`, to: 'ace-foundation', count: 1, priority: 1 });
            }
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) {
                    hints.push({ from: `tableau-${i}`, to: `king-${j}`, count: 1, priority: 2 });
                }
            }
        }
        for (let i = 0; i < this.temporaryStacks.length; i++) {
            const st = this.temporaryStacks[i];
            if (!st.length) continue;
            const top = st[st.length - 1];
            if (this.canMoveToCenterFoundation(top)) {
                hints.push({ from: `temp-${i}`, to: 'ace-foundation', count: 1, priority: 1 });
            }
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) {
                    hints.push({ from: `temp-${i}`, to: `king-${j}`, count: 1, priority: 2 });
                }
                if (this.canMoveToTableau([top], j)) {
                    hints.push({ from: `temp-${i}`, to: `tableau-${j}`, count: 1, priority: 3 });
                }
            }
        }

        // 2.5 Check foundation-to-tableau moves (Rule 4) - VERY LOW priority
        if (this.centralFoundation.length > 0) {
            const top = this.centralFoundation[this.centralFoundation.length - 1];
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToTableau([top], j)) {
                    hints.push({ from: 'ace-foundation', to: `tableau-${j}`, count: 1, priority: 8 });
                }
            }
        }
        for (let i = 0; i < 4; i++) {
            const kf = this.kingFoundations[i];
            if (!kf.length) continue;
            const top = kf[kf.length - 1];
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToTableau([top], j)) {
                    hints.push({ from: `king-${i}`, to: `tableau-${j}`, count: 1, priority: 8 });
                }
            }
        }
        
        // 3. Check tableau-to-tableau moves (including multi-card sequences)
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            
            // Start from the largest possible valid sequence
            for (let k = 0; k < t.length; k++) {
                const subSeq = t.slice(k);
                if (!this.isValidSequence(subSeq)) continue;
                
                // Try moving this valid sequence to any other tableau
                for (let j = 0; j < 4; j++) {
                    if (j !== i && this.canMoveToTableau(subSeq, j)) {
                        // Don't suggest moving an entire pile to an empty pile (pointless loop)
                        if (k === 0 && this.tableaus[j].length === 0) continue;
                        
                        let movePriority = 4;
                        const newParent = this.tableaus[j].length > 0 ? this.tableaus[j][this.tableaus[j].length - 1] : null;

                        // Loop Prevention: Don't suggest moving back exactly where we just came from
                        if (this.lastMove && 
                            this.lastMove.to === `tableau-${i}` && 
                            this.lastMove.from === `tableau-${j}` && 
                            this.lastMove.count === subSeq.length) {
                            continue;
                        }

                        if (k === 0) {
                            // Moving an ENTIRE pile exposes the possibility of a reserve flip.
                            movePriority = 3;
                        } else {
                            // Moving a partial pile
                            const oldParent = t[k - 1];
                            if (newParent && oldParent.rank === newParent.rank && oldParent.color === newParent.color) {
                                // Lateral Move Check - Issue 2 Refinement
                                if (k === 0) {
                                    movePriority = 5; // Low priority, but keeps space management
                                } else {
                                    continue; // Skip pointless partial lateral moves
                                }
                            }
                            
                            // Check for Foundation Unblocking ("Parking")
                            if (this.canMoveToCenterFoundation(oldParent) || 
                                [0, 1, 2, 3].some(idx => this.canMoveToKingFoundation(oldParent, idx))) {
                                movePriority = 1;
                            } else {
                                movePriority = 4;
                            }
                        }
                        
                        hints.push({ from: `tableau-${i}`, to: `tableau-${j}`, count: subSeq.length, priority: movePriority });
                    }
                }
            }
        }
        
        // 4. Check if stockpile can still be drawn
        if (this.stockpile.length > 0 && hints.length === 0) {
            hints.push({ from: 'stockpile', to: null, count: 1, priority: 5 });
        }

        // 5. Check for Consolidation (Issue 7)
        if (this.stockpile.length === 0 && this.temporaryStacks.some(s => s.length > 0)) {
            // Suggest consolidation if no foundation moves are available
            if (!hints.some(h => h.priority <= 2)) {
                hints.push({ from: 'stockpile', to: null, count: 1, priority: 0 });
            }
        }

        // 6. Check if reserves can be flipped
        for (let i = 0; i < 4; i++) {
            if (this.tableaus[i].length === 0 && this.reserves[i].length > 0) {
                hints.push({ from: `reserve-${i}`, to: `tableau-${i}`, count: 1, priority: 0 });
            }
        }

        hints.sort((a, b) => a.priority - b.priority);
        return hints;
    }
};

// ============================================
// UI RENDERING
// ============================================

function createCardEl(card, cardIndex = 0) {
    const el = document.createElement('div');
    el.className = `card ${card.color} ${card.faceUp ? 'face-up' : 'face-down'}`;
    el.id = card.id;
    el.style.setProperty('--card-index', cardIndex);

    if (card.faceUp) {
        const rankMap = { 'A': 'ace', 'J': 'jack', 'Q': 'queen', 'K': 'king' };
        const fileNameRank = rankMap[card.rank] || card.rank;
        const imgPath = `../assets/Cards/PNG-cards-1.3/${fileNameRank.toLowerCase()}_of_${card.suit.toLowerCase()}.png`;
        
        el.innerHTML = `
            <div class="card-face">
                <img src="${imgPath}" alt="${card.rank} of ${card.suit}" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
        `;
    } else {
        el.innerHTML = `<div class="card-back"></div>`;
    }
    return el;
}

function renderPile(el, cards, cascade = false) {
    el.innerHTML = '';
    
    // Dynamic Fanning - scaled for new 85x119px card size (was 35px for 65px wide cards)
    let overlap = 45;
    if (cascade && cards.length > 5) {
        overlap = Math.max(20, 235 / cards.length);
    }

    cards.forEach((card, i) => {
        const isTop = i === cards.length - 1;
        let cardEl;
        
        // Integrated Peek Logic (Supports Batch Reveal - Issue 4)
        if (card.isPeeked) {
            const peekedCard = { ...card, faceUp: true };
            cardEl = createCardEl(peekedCard, cascade ? i : 0);
            cardEl.classList.add('peek-reveal');
        } else {
            cardEl = createCardEl(card, cascade ? i : 0);
        }

        if (cascade && i > 0) {
            const pileId = el.id;
            if (pileId === 'tableau-0') cardEl.style.marginTop = `-${overlap}px`; // North (fans up)
            if (pileId === 'tableau-1') cardEl.style.marginTop = `${overlap}px`;  // South (fans down)
            if (pileId === 'tableau-2') cardEl.style.marginLeft = `${overlap}px`; // East (fans right)
            if (pileId === 'tableau-3') cardEl.style.marginLeft = `-${overlap}px`; // West (fans left)
        }

        if (!cascade && i < cards.length - 1) {
            cardEl.style.display = 'none';
        }
        el.appendChild(cardEl);
        
        // Add Sequence Hover Listeners
        if (card.faceUp) {
            cardEl.onmouseenter = () => highlightSequence(el.id, i, true);
            cardEl.onmouseleave = () => highlightSequence(el.id, i, false);
        }
    });
}

function highlightSequence(pileId, cardIndex, active) {
    const pileEl = document.getElementById(pileId);
    if (!pileEl) return;
    const cardEls = pileEl.querySelectorAll('.card');
    
    // Highlight target card and everything above it
    for (let i = cardIndex; i < cardEls.length; i++) {
        cardEls[i].classList.toggle('sequence-hover', active);
    }
}

function renderAll() {
    // Reserves
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`reserve-${i}`);
        el.onclick = () => { game.flipReserve(i); };
        el.style.cursor = game.tableaus[i].length === 0 && game.reserves[i].length > 0 ? 'pointer' : 'default';
        renderPile(el, game.reserves[i]);
    }

    // Tableaus
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`tableau-${i}`);
        renderPile(el, game.tableaus[i], true);
    }

    // Ace foundation
    const aceEl = document.getElementById('ace-foundation');
    renderPile(aceEl, game.centralFoundation);

    // King foundations
    for (let i = 0; i < 4; i++) {
        const kEl = document.getElementById(`king-${i}`);
        renderPile(kEl, game.kingFoundations[i]);
    }

    // Stockpile
    const stockEl = document.getElementById('stockpile');
    renderPile(stockEl, game.stockpile);

    // Temporary stacks
    const tempContainer = document.getElementById('temp-stacks-container');
    tempContainer.innerHTML = '';
    game.temporaryStacks.forEach((stack, i) => {
        const el = document.createElement('div');
        el.className = 'pile';
        el.id = `temp-${i}`;
        el.dataset.pile = `temp-${i}`;
        el.dataset.label = `Stack ${i + 1}`;
        renderPile(el, stack);
        tempContainer.appendChild(el);
    });

    document.getElementById('phase-display').textContent =
        game.currentPhase <= 4 ? `Phase: ${game.currentPhase}/4` : 'All Phases Done';

    // Peek count & state
    document.getElementById('peek-count').textContent = game.peeksLeft;
    document.getElementById('btn-peek').classList.toggle('active', game.isPeekActive);
    document.getElementById('btn-peek').disabled = !game.isPeekAllowed();
    
    // Add visual 'Choice' indicator to peek button if it just became active
    if (!document.getElementById('btn-peek').disabled) {
        document.getElementById('btn-peek').title = "Strategic Fork Detected: Peek is available.";
    } else {
        document.getElementById('btn-peek').title = "No strategic choice required right now.";
    }

    // Seed Display
    const seedDisplay = document.getElementById('seed-display');
    if (seedDisplay) {
        seedDisplay.textContent = `Game #${game.currentSeed}`;
    }

    // Toolbar buttons
    document.getElementById('btn-undo').disabled = !game.undoStack.length;
    document.getElementById('btn-redo').disabled = !game.redoStack.length;

    // Check win/game over
    if (game.hasStarted && game.isGameWon) {
        const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('win-stats').textContent =
            `Moves: ${game.moveCount} | Time: ${mins}m ${secs}s`;
        document.getElementById('overlay-win').classList.remove('hidden');
    } else if (game.hasStarted && game.checkGameOver()) {
        if (game.currentPhase >= 4 && game.stockpile.length === 0) {
            document.getElementById('overlay-vintage-gameover').classList.remove('hidden');
        } else {
            document.getElementById('overlay-gameover').classList.remove('hidden');
        }
    }

    // Apply Hints if active
    document.querySelectorAll('.hint-source, .hint-target').forEach(el => {
        el.classList.remove('hint-source', 'hint-target');
    });
    
    if (game.currentHints && game.currentHints.length > 0) {
        // Show ALL hints that share the highest priority level (Issue 6 Refinement)
        const topPriority = game.currentHints[0].priority;
        const bestHints = game.currentHints.filter(h => h.priority === topPriority);

        bestHints.forEach(hint => {
            if (hint.from) {
                const pileEl = document.getElementById(hint.from);
                if (pileEl) {
                    const cardEls = pileEl.querySelectorAll('.card');
                    const count = hint.count || 1;
                    
                    if (cardEls.length > 0) {
                        for (let i = Math.max(0, cardEls.length - count); i < cardEls.length; i++) {
                            cardEls[i].classList.add('hint-source');
                        }
                    } else {
                        pileEl.classList.add('hint-source');
                    }
                }
            }
            if (hint.to) {
                const pileEl = document.getElementById(hint.to);
                if (pileEl) {
                    const topCard = pileEl.querySelector('.card:last-child');
                    if (topCard) topCard.classList.add('hint-target');
                    else pileEl.classList.add('hint-target');
                }
            }
        });
    }

    // Rebind drag events
    bindDragEvents();
}

// ============================================
// DRAG AND DROP
// ============================================

let dragData = null; // { cards, fromPile, fromType, fromEl }

function parsePileId(id) {
    if (id.startsWith('tableau-')) return { type: 'tableau', index: parseInt(id.split('-')[1]) };
    if (id.startsWith('reserve-')) return { type: 'reserve', index: parseInt(id.split('-')[1]) };
    if (id.startsWith('temp-')) return { type: 'temp', index: parseInt(id.split('-')[1]) };
    if (id === 'ace-foundation') return { type: 'ace', index: 0 };
    if (id.startsWith('king-')) return { type: 'king', index: parseInt(id.split('-')[1]) };
    return null;
}

function bindDragEvents() {
    // Tableau cards: draggable from any card downward (if valid sequence)
    for (let i = 0; i < 4; i++) {
        const pile = game.tableaus[i];
        const pileEl = document.getElementById(`tableau-${i}`);
        const cardEls = pileEl.querySelectorAll('.card');

        cardEls.forEach((cardEl, cardIndex) => {
            const card = pile[cardIndex];
            if (!card || !card.faceUp) return;

            cardEl.ondblclick = (e) => {
                e.preventDefault();
                if (cardIndex === pile.length - 1) {
                    if (game.autoMove(card, i, 'tableau')) renderAll();
                }
            };

            cardEl.onpointerdown = (e) => {
                // e.button is 0 for touch or left-click
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                cardEl.setPointerCapture(e.pointerId);

                const cardsToGrab = pile.slice(cardIndex);
                // Sequence Drag Fix - Issue 1
                if (!game.isValidSequence(cardsToGrab)) {
                    // Fallback: If clicking a card that isn't head of a sequence, 
                    // check if user intended to just grab the top-most card
                    if (cardIndex === pile.length - 1) {
                        // Grab single card
                    } else {
                        return; 
                    }
                }

                let isDragging = false;
                const startX = e.clientX;
                const startY = e.clientY;

                const onMove = (moveEv) => {
                    if (!isDragging) {
                        const dx = moveEv.clientX - startX;
                        const dy = moveEv.clientY - startY;
                        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                            isDragging = true;
                            startDrag(e, cardsToGrab, i, 'tableau', pileEl, cardIndex);
                            onDragMove(moveEv);
                        }
                    } else {
                        onDragMove(moveEv);
                    }
                };

                const onUp = (upEv) => {
                    cardEl.releasePointerCapture(e.pointerId);
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    if (isDragging) {
                        onDragEnd(upEv);
                    }
                };

                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            };
        });
    }

    // Temporary stack top cards
    game.temporaryStacks.forEach((stack, i) => {
        if (!stack.length) return;
        const pileEl = document.getElementById(`temp-${i}`);
        if (!pileEl) return;
        const cardEl = pileEl.querySelector('.card:last-child');
        if (!cardEl) return;
        const card = stack[stack.length - 1];

        cardEl.ondblclick = (e) => {
            e.preventDefault();
            if (game.autoMove(card, i, 'temp')) renderAll();
        };

        cardEl.onpointerdown = (e) => {
            // e.button is 0 for touch or left-click
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            cardEl.setPointerCapture(e.pointerId);
            
            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const onMove = (moveEv) => {
                if (!isDragging) {
                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        isDragging = true;
                        startDrag(e, [card], i, 'temp', pileEl, stack.length - 1);
                        onDragMove(moveEv);
                    }
                } else {
                    onDragMove(moveEv);
                }
            };

            const onUp = (upEv) => {
                cardEl.releasePointerCapture(e.pointerId);
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (isDragging) {
                    onDragEnd(upEv);
                }
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };
    });

    // Foundation and King Piles: draggable if not empty (Rule 4)
    const foundationPiles = [
        { el: document.getElementById('ace-foundation'), type: 'ace', index: 0 },
        { el: document.getElementById('king-0'), type: 'king', index: 0 },
        { el: document.getElementById('king-1'), type: 'king', index: 1 },
        { el: document.getElementById('king-2'), type: 'king', index: 2 },
        { el: document.getElementById('king-3'), type: 'king', index: 3 }
    ];

    foundationPiles.forEach(pileObj => {
        const pileEl = pileObj.el;
        if (!pileEl) return;
        const pileArray = game.getArray(pileObj.index, pileObj.type);
        if (!pileArray.length) return;

        const cardEl = pileEl.querySelector('.card:last-child');
        if (!cardEl) return;
        const card = pileArray[pileArray.length - 1];

        cardEl.onpointerdown = (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            cardEl.setPointerCapture(e.pointerId);

            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const onMove = (moveEv) => {
                if (!isDragging) {
                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        isDragging = true;
                        startDrag(e, [card], pileObj.index, pileObj.type, pileEl, pileArray.length - 1);
                        onDragMove(moveEv);
                    }
                } else {
                    onDragMove(moveEv);
                }
            };

            const onUp = (upEv) => {
                cardEl.releasePointerCapture(e.pointerId);
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (isDragging) {
                    onDragEnd(upEv);
                }
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };
    });

    // Stockpile click to draw
    const stockEl = document.getElementById('stockpile');
    stockEl.onclick = () => { game.drawCard(); renderAll(); };
    stockEl.style.cursor = 'pointer';
}

function startDrag(e, cards, fromIndex, fromType, pileEl, startCardIndex) {
    dragData = { cards, fromPile: fromIndex, fromType, fromEl: pileEl, startCardIndex };

    // Mark dragging cards
    const cardEls = pileEl.querySelectorAll('.card');
    for (let i = startCardIndex; i < cardEls.length; i++) {
        cardEls[i].classList.add('dragging');
    }

    // Build ghost
    const ghost = document.getElementById('drag-ghost');
    ghost.innerHTML = '';
    ghost.classList.remove('hidden');
    
    let isRotated = false;
    let offsetProp = 'top';
    let offsetStep = 22;

    if (fromType === 'tableau') {
        if (fromIndex === 0) { offsetProp = 'top'; offsetStep = -22; isRotated = true; } // North
        if (fromIndex === 1) { offsetProp = 'top'; offsetStep = 22; isRotated = true; }  // South
        if (fromIndex === 2) { offsetProp = 'left'; offsetStep = -22; isRotated = false; } // West
        if (fromIndex === 3) { offsetProp = 'left'; offsetStep = 22; isRotated = false; }  // East
    }

    cards.forEach((c, i) => {
        const el = createCardEl(c, 0);
        el.style.position = 'absolute';
        
        if (isRotated) {
            el.style.transform = 'rotate(90deg)';
        }
        
        el.style[offsetProp] = `${i * offsetStep}px`;
        if (offsetProp === 'top') el.style.left = '0';
        if (offsetProp === 'left') el.style.top = '0';
        
        ghost.appendChild(el);
    });

    // Center ghost on cursor based on rotation
    if (isRotated) {
        ghost.style.left = `${e.clientX - 45}px`;
        ghost.style.top = `${e.clientY - 32}px`;
    } else {
        ghost.style.left = `${e.clientX - 32}px`;
        ghost.style.top = `${e.clientY - 45}px`;
    }

    // Highlight valid drop targets
    highlightDropTargets(cards);
}

function onDragMove(e) {
    const ghost = document.getElementById('drag-ghost');
    let isRotated = false;
    
    if (dragData && dragData.fromType === 'tableau') {
        if (dragData.fromPile === 0 || dragData.fromPile === 1) isRotated = true;
    }

    if (isRotated) {
        ghost.style.left = `${e.clientX - 45}px`;
        ghost.style.top = `${e.clientY - 32}px`;
    } else {
        ghost.style.left = `${e.clientX - 32}px`;
        ghost.style.top = `${e.clientY - 45}px`;
    }
}

function onDragEnd(e) {
    const ghost = document.getElementById('drag-ghost');
    ghost.classList.add('hidden');

    // Find drop target reliably by checking the DOM element under the cursor
    let pileEl = null;
    
    // Hide ghost temporarily to ensure we don't hit it (even though it has pointer-events: none, it's safer)
    ghost.style.display = 'none';
    
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    if (targetElement) {
        pileEl = targetElement.closest('.pile');
    }
    
    ghost.style.display = '';

    // Fallback: Check bounding rects of piles if elementFromPoint didn't hit a pile directly (e.g. empty space in flex container)
    if (!pileEl) {
        const piles = document.querySelectorAll('.pile');
        for (const p of piles) {
            const rect = p.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                pileEl = p;
                break;
            }
        }
    }

    let dropped = false;
    if (pileEl && pileEl.dataset.pile) {
        const parsed = parsePileId(pileEl.dataset.pile);
        if (parsed) {
            dropped = tryDrop(parsed, pileEl);
        }
    }

    clearHighlights();
    
    // Always clear drag data and re-render to ensure UI consistency
    dragData = null;
    renderAll();
}

function tryDrop(target, targetEl) {
    if (!dragData) return false;
    const { cards, fromPile, fromType } = dragData;

    // If dropping on source pile, return true (we just won't call moveCards)
    if (target.type === fromType && target.index === fromPile) {
        return true;
    }

    if (target.type === 'ace' && cards.length === 1 && game.canMoveToCenterFoundation(cards[0])) {
        game.moveCards(cards, fromPile, fromType, 0, 'ace');
        return true;
    }
    if (target.type === 'king' && cards.length === 1 && game.canMoveToKingFoundation(cards[0], target.index)) {
        game.moveCards(cards, fromPile, fromType, target.index, 'king');
        return true;
    }
    if (target.type === 'tableau' && game.canMoveToTableau(cards, target.index)) {
        game.moveCards(cards, fromPile, fromType, target.index, 'tableau');
        return true;
    }
    return false;
}

function highlightDropTargets(cards) {
    // Center foundation
    if (cards.length === 1 && game.canMoveToCenterFoundation(cards[0])) {
        document.getElementById('ace-foundation').classList.add('drop-valid');
    }
    // King foundations
    for (let i = 0; i < 4; i++) {
        if (cards.length === 1 && game.canMoveToKingFoundation(cards[0], i)) {
            document.getElementById(`king-${i}`).classList.add('drop-valid');
        }
    }
    // Tableaus
    for (let i = 0; i < 4; i++) {
        if (game.canMoveToTableau(cards, i)) {
            document.getElementById(`tableau-${i}`).classList.add('drop-valid');
        }
    }
}

function clearHighlights() {
    document.querySelectorAll('.drop-valid').forEach(el => el.classList.remove('drop-valid'));
}

// ============================================
// HINT
// ============================================

function showHint() {
    const timeSinceMove = Date.now() - game.lastMoveTime;
    if (timeSinceMove < game.hintCooldown) {
        // Provide feedback that the player should "think"
        const btn = document.getElementById('btn-hint');
        btn.classList.add('cooldown');
        setTimeout(() => btn.classList.remove('cooldown'), 300);
        return;
    }
    game.findHint();
    renderAll();
}

// ============================================
// OVERLAYS
// ============================================

function hideOverlays() {
    document.getElementById('overlay-win').classList.add('hidden');
    document.getElementById('overlay-gameover').classList.add('hidden');
}

// ============================================
// EVENT BINDINGS
// ============================================

document.getElementById('btn-undo').onclick = () => { game.undo(); renderAll(); };
document.getElementById('btn-redo').onclick = () => { game.redo(); renderAll(); };
document.getElementById('btn-hint').onclick = () => { showHint(); };

// Peek button
document.getElementById('btn-peek').onclick = () => {
    if (game.peeksLeft > 0) {
        game.isPeekActive = !game.isPeekActive;
        renderAll();
    }
};

// Add click listeners to piles for peeking (Direct Integration)
const piles = [...document.querySelectorAll('.pile'), document.getElementById('stockpile')];
piles.forEach(el => {
    if (!el) return;
    const originalClick = el.onclick;
    el.onclick = (e) => {
        if (game.isPeekActive) {
            handlePileClick(el.id);
        } else if (originalClick) {
            originalClick(e);
        }
    };
});

document.getElementById('btn-new').onclick = () => { game.startNewGame(); renderAll(); };

document.getElementById('btn-replay-seed').onclick = () => {
    const seedInput = document.getElementById('seed-input');
    seedInput.value = game.currentSeed;
    document.getElementById('overlay-seed').classList.remove('hidden');
    seedInput.focus();
};

document.getElementById('btn-seed-cancel').onclick = () => {
    document.getElementById('overlay-seed').classList.add('hidden');
};

document.getElementById('btn-seed-confirm').onclick = () => {
    const seedInput = document.getElementById('seed-input').value;
    if (seedInput && !isNaN(seedInput)) {
        document.getElementById('overlay-seed').classList.add('hidden');
        game.startNewGame(parseInt(seedInput));
        renderAll();
    }
};

function handlePileClick(pileId) {
    let pile = null;
    let isStock = false;
    if (pileId.startsWith('reserve-')) pile = game.reserves[parseInt(pileId.split('-')[1])];
    if (pileId === 'stockpile') {
        pile = game.stockpile;
        isStock = true;
    }

    if (pile && pile.length > 0) {
        if (isStock) {
            // Batch Peek logic (Issue 4 refinement)
            game.peeksLeft--;
            game.isPeekActive = false;
            const numToDraw = 5 - game.currentPhase;
            const batch = pile.slice(-numToDraw);
            batch.forEach(c => c.isPeeked = true);
            renderAll();
            setTimeout(() => {
                batch.forEach(c => c.isPeeked = false);
                renderAll();
            }, 3000);
            return true;
        } else {
            const topCard = pile[pile.length - 1];
            if (!topCard.faceUp) {
                game.peeksLeft--;
                game.isPeekActive = false;
                topCard.isPeeked = true;
                renderAll();
                setTimeout(() => {
                    topCard.isPeeked = false;
                    renderAll();
                }, 3000);
                return true;
            }
        }
    }
    game.isPeekActive = false;
    renderAll();
    return true;
}

// ============================================
// THEME SELECTION
// ============================================

const themeSelector = document.getElementById('theme-selector');
if (themeSelector) {
    // Set initial theme
    document.body.className = themeSelector.value;
    
    // Listen for changes
    themeSelector.addEventListener('change', (e) => {
        document.body.className = e.target.value;
    });
}

// Initial call with a slight delay for the 'Strategic Breath'
setTimeout(() => {
    game.startNewGame();
    renderAll();
}, 1000);
