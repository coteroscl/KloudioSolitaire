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

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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
    moveCount: 0,
    lastDrawStackIndex: -1,
    startTime: Date.now(),
    currentHint: null,

    startNewGame() {
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

        const deck = shuffle(createDeck(2));
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
        
        this.moveCount++;
        this.checkAndRefillTableaus();
        this.checkCompletedFoundations();
        this.currentHints = [];

        if (this.isGameWon) {
            document.getElementById('overlay-win').classList.remove('hidden');
        } else if (this.checkGameOver()) {
            document.getElementById('overlay-gameover').classList.remove('hidden');
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

    checkAndRefillTableaus() {
        for (let i = 0; i < 4; i++) {
            if (!this.tableaus[i].length && this.reserves[i].length) {
                const card = this.reserves[i].pop();
                card.faceUp = true;
                this.tableaus[i].push(card);
            }
        }
    },

    checkCompletedFoundations() {
        if (this.centralFoundation.length === 13) this.centralFoundation = [];
        for (let i = 0; i < 4; i++) {
            if (this.kingFoundations[i].length === 13) this.kingFoundations[i] = [];
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
        return true;
    },

    // ---- Hint ----
    findHint() {
        this.currentHints = [];
        
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            const top = t[t.length - 1];
            if (this.canMoveToCenterFoundation(top)) {
                this.currentHints.push({ from: `tableau-${i}`, to: 'ace-foundation', count: 1, priority: 1 });
            }
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) {
                    this.currentHints.push({ from: `tableau-${i}`, to: `king-${j}`, count: 1, priority: 2 });
                }
            }
        }
        for (let i = 0; i < this.temporaryStacks.length; i++) {
            const st = this.temporaryStacks[i];
            if (!st.length) continue;
            const top = st[st.length - 1];
            if (this.canMoveToCenterFoundation(top)) {
                this.currentHints.push({ from: `temp-${i}`, to: 'ace-foundation', count: 1, priority: 1 });
            }
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j)) {
                    this.currentHints.push({ from: `temp-${i}`, to: `king-${j}`, count: 1, priority: 2 });
                }
                if (this.canMoveToTableau([top], j)) {
                    this.currentHints.push({ from: `temp-${i}`, to: `tableau-${j}`, count: 1, priority: 3 });
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
                        
                        if (k === 0) {
                            // Moving an ENTIRE pile exposes the reserve card. Very high priority!
                            movePriority = 3;
                        } else {
                            // Moving a partial pile
                            const oldParent = t[k - 1];
                            const newParent = this.tableaus[j].length > 0 ? this.tableaus[j][this.tableaus[j].length - 1] : null;
                            
                            if (newParent && oldParent.suit === newParent.suit && oldParent.rank === newParent.rank) {
                                // Pointless move: moving from a Diamond 5 to another Diamond 5. Lowest priority.
                                movePriority = 6;
                            } else {
                                // Useful move: frees up the old parent card for use elsewhere.
                                movePriority = 4;
                            }
                        }
                        
                        this.currentHints.push({ from: `tableau-${i}`, to: `tableau-${j}`, count: subSeq.length, priority: movePriority });
                    }
                }
            }
        }
        
        // 4. Check if stockpile can still be drawn
        if (this.stockpile.length > 0 && this.currentHints.length === 0) {
            this.currentHints.push({ from: 'stockpile', to: null, count: 1, priority: 5 });
        }

        this.currentHints.sort((a, b) => a.priority - b.priority);
        return this.currentHints;
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
    cards.forEach((card, i) => {
        const cardEl = createCardEl(card, cascade ? i : 0);
        if (!cascade && i < cards.length - 1) {
            cardEl.style.display = 'none';
        }
        el.appendChild(cardEl);
    });

    // Cards are positioned via Flexbox in CSS, so we just append them.
}

function renderAll() {
    // Reserves
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`reserve-${i}`);
        el.dataset.label = `Reserve (${game.reserves[i].length})`;
        renderPile(el, game.reserves[i]);
    }

    // Tableaus
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`tableau-${i}`);
        el.dataset.label = '';
        renderPile(el, game.tableaus[i], true);
    }

    // Ace foundation
    const aceEl = document.getElementById('ace-foundation');
    aceEl.dataset.label = 'ACE';
    renderPile(aceEl, game.centralFoundation);

    // King foundations
    for (let i = 0; i < 4; i++) {
        const kEl = document.getElementById(`king-${i}`);
        kEl.dataset.label = 'KING';
        renderPile(kEl, game.kingFoundations[i]);
    }

    // Stockpile
    const stockEl = document.getElementById('stockpile');
    stockEl.dataset.label = `Stock (${game.stockpile.length})`;
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

    // Phase display
    document.getElementById('phase-display').textContent =
        game.currentPhase <= 4 ? `Phase: ${game.currentPhase}/4` : 'All Phases Done';

    // Toolbar buttons
    document.getElementById('btn-undo').disabled = !game.undoStack.length;
    document.getElementById('btn-redo').disabled = !game.redoStack.length;

    // Check win/game over
    if (game.isGameWon) {
        const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('win-stats').textContent =
            `Moves: ${game.moveCount} | Time: ${mins}m ${secs}s`;
        document.getElementById('overlay-win').classList.remove('hidden');
    } else if (game.checkGameOver()) {
        document.getElementById('overlay-gameover').classList.remove('hidden');
    }

    // Apply Hints if active
    document.querySelectorAll('.hint-source, .hint-target').forEach(el => {
        el.classList.remove('hint-source', 'hint-target');
    });
    
    if (game.currentHints && game.currentHints.length > 0) {
        game.currentHints.forEach(hint => {
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
                if (!game.isValidSequence(cardsToGrab)) return;

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
document.getElementById('btn-new').onclick = () => { game.startNewGame(); renderAll(); };
document.getElementById('gameover-undo').onclick = () => {
    hideOverlays();
    game.undo();
    renderAll();
};

// ============================================
// INIT
// ============================================
game.startNewGame();
renderAll();
