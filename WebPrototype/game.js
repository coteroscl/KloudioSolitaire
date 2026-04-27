/* ============================================
   Kloudio Solitaire – Web Prototype Game Logic
   ============================================ */

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
    startTime: Date.now(),

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
        this.startTime = Date.now();

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
            temporaryStacks: this.temporaryStacks,
            currentPhase: this.currentPhase,
            moveCount: this.moveCount
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
        this.saveForUndo();
        const maxStacks = 5 - this.currentPhase;

        if (!this.temporaryStacks.length && this.currentPhase <= 4) {
            this.temporaryStacks = Array.from({ length: maxStacks }, () => []);
        }

        if (this.stockpile.length) {
            const card = this.stockpile.pop();
            card.faceUp = true;
            const total = this.temporaryStacks.reduce((s, st) => s + st.length, 0);
            this.temporaryStacks[total % maxStacks].push(card);
            this.moveCount++;
        } else if (this.currentPhase <= 4) {
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
        }
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
        // Remove from source
        this.getArray(fromPile, fromType).splice(-cards.length, cards.length);
        // Add to target
        this.getArray(toPile, toType).push(...cards);
        this.moveCount++;
        this.checkAndRefillTableaus();
        this.checkCompletedFoundations();
        clearHint();
    },

    autoMove(card, fromPile, fromType) {
        if (this.canMoveToCenterFoundation(card)) {
            this.saveForUndo();
            this.getArray(fromPile, fromType).pop();
            this.centralFoundation.push(card);
            this.moveCount++;
            this.checkAndRefillTableaus();
            this.checkCompletedFoundations();
            clearHint();
            return true;
        }
        for (let i = 0; i < 4; i++) {
            if (this.canMoveToKingFoundation(card, i)) {
                this.saveForUndo();
                this.getArray(fromPile, fromType).pop();
                this.kingFoundations[i].push(card);
                this.moveCount++;
                this.checkAndRefillTableaus();
                this.checkCompletedFoundations();
                clearHint();
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
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            const top = t[t.length - 1];
            if (this.canMoveToCenterFoundation(top))
                return { from: `tableau-${i}`, to: 'ace-foundation' };
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j))
                    return { from: `tableau-${i}`, to: `king-${j}` };
            }
        }
        for (let i = 0; i < this.temporaryStacks.length; i++) {
            const st = this.temporaryStacks[i];
            if (!st.length) continue;
            const top = st[st.length - 1];
            if (this.canMoveToCenterFoundation(top))
                return { from: `temp-${i}`, to: 'ace-foundation' };
            for (let j = 0; j < 4; j++) {
                if (this.canMoveToKingFoundation(top, j))
                    return { from: `temp-${i}`, to: `king-${j}` };
                if (this.canMoveToTableau([top], j))
                    return { from: `temp-${i}`, to: `tableau-${j}` };
            }
        }
        for (let i = 0; i < 4; i++) {
            const t = this.tableaus[i];
            if (!t.length) continue;
            const top = t[t.length - 1];
            for (let j = 0; j < 4; j++) {
                if (j !== i && this.canMoveToTableau([top], j))
                    return { from: `tableau-${i}`, to: `tableau-${j}` };
            }
        }
        return null;
    }
};

// ============================================
// UI RENDERING
// ============================================

function createCardEl(card, index = 0) {
    const el = document.createElement('div');
    el.className = `card ${card.color}`;
    el.style.setProperty('--card-index', index);
    el.dataset.cardId = card.id;

    if (card.faceUp) {
        const sym = SUIT_SYMBOLS[card.suit];
        el.innerHTML = `
            <div class="card-face">
                <div class="card-corner">${card.rank}${sym}</div>
                <div class="card-center">${sym}</div>
                <div class="card-corner card-corner-bottom">${card.rank}${sym}</div>
            </div>`;
    } else {
        el.innerHTML = `<div class="card-back"></div>`;
        el.style.cursor = 'default';
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
    // Update pile height for cascade
    if (cascade && cards.length > 1) {
        el.style.minHeight = `${105 + (cards.length - 1) * 24}px`;
    } else {
        el.style.minHeight = '';
    }
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

            // Double-click to auto-move
            cardEl.ondblclick = (e) => {
                e.preventDefault();
                if (cardIndex === pile.length - 1) {
                    if (game.autoMove(card, i, 'tableau')) renderAll();
                }
            };

            // Drag start
            cardEl.onmousedown = (e) => {
                if (e.button !== 0) return;
                const cardsToGrab = pile.slice(cardIndex);
                if (!game.isValidSequence(cardsToGrab)) return;

                e.preventDefault();
                startDrag(e, cardsToGrab, i, 'tableau', pileEl, cardIndex);
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

        cardEl.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startDrag(e, [card], i, 'temp', pileEl, stack.length - 1);
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
    cards.forEach((c, i) => {
        const el = createCardEl(c, 0);
        el.style.position = 'relative';
        el.style.marginTop = i > 0 ? '-81px' : '0';
        ghost.appendChild(el);
    });
    ghost.style.left = `${e.clientX - 37}px`;
    ghost.style.top = `${e.clientY - 20}px`;

    // Highlight valid drop targets
    highlightDropTargets(cards);

    document.onmousemove = onDragMove;
    document.onmouseup = onDragEnd;
}

function onDragMove(e) {
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = `${e.clientX - 37}px`;
    ghost.style.top = `${e.clientY - 20}px`;
}

function onDragEnd(e) {
    document.onmousemove = null;
    document.onmouseup = null;

    const ghost = document.getElementById('drag-ghost');
    ghost.classList.add('hidden');

    // Find drop target
    ghost.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    ghost.style.display = '';

    let dropped = false;
    if (target) {
        const pileEl = target.closest('.pile');
        if (pileEl && pileEl.dataset.pile) {
            const parsed = parsePileId(pileEl.dataset.pile);
            if (parsed) {
                dropped = tryDrop(parsed, pileEl);
            }
        }
    }

    clearHighlights();
    if (!dropped) {
        // Snap back (just re-render)
    }
    dragData = null;
    renderAll();
}

function tryDrop(target, targetEl) {
    if (!dragData) return false;
    const { cards, fromPile, fromType } = dragData;

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

function clearHint() {
    document.querySelectorAll('.hint-source, .hint-target').forEach(el => {
        el.classList.remove('hint-source', 'hint-target');
    });
}

function showHint() {
    clearHint();
    const hint = game.findHint();
    if (!hint) return;
    const fromEl = document.getElementById(hint.from);
    const toEl = document.getElementById(hint.to);
    if (fromEl) fromEl.classList.add('hint-source');
    if (toEl) toEl.classList.add('hint-target');
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
