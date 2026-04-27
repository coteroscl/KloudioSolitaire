import Foundation

enum PileLocation: Equatable {
    case none
    case tableau(Int)
    case reserve(Int)
    case centerFoundation
    case kingFoundation(Int)
    case temporaryStack(Int)
}

/// Represents a hint: a suggested move from one location to another.
struct Hint: Equatable {
    let card: Card
    let from: PileLocation
    let to: PileLocation
}

/// A snapshot of the entire game state, used for undo/redo.
struct GameSnapshot {
    let centralFoundation: [Card]
    let kingFoundations: [[Card]]
    let reserves: [[Card]]
    let tableaus: [[Card]]
    let stockpile: [Card]
    let temporaryStacks: [[Card]]
    let currentPhase: Int
}

class GameEngine: ObservableObject {
    // MARK: - Game State
    
    // Central Foundation (Ace to King)
    @Published var centralFoundation: [Card] = []
    
    // Corner King Foundations (King to Ace)
    @Published var kingFoundations: [[Card]] = Array(repeating: [], count: 4)
    
    // Reserves (4 piles of initially 10 face-down cards)
    @Published var reserves: [[Card]] = Array(repeating: [], count: 4)
    
    // Tableaus (4 piles of initially 3 face-up cards)
    @Published var tableaus: [[Card]] = Array(repeating: [], count: 4)
    
    // Stock and Temporary Stacks
    @Published var stockpile: [Card] = []
    @Published var temporaryStacks: [[Card]] = []
    
    // Pass tracking (Phase 1 = 4 stacks, Phase 2 = 3 stacks, etc.)
    @Published var currentPhase: Int = 1
    
    // MARK: - Drag and Drop State
    @Published var draggedCards: [Card] = []
    @Published var dragSource: PileLocation = .none
    @Published var dragOffset: CGSize = .zero
    
    // MARK: - Undo/Redo State
    private var undoStack: [GameSnapshot] = []
    private var redoStack: [GameSnapshot] = []
    @Published var canUndo: Bool = false
    @Published var canRedo: Bool = false
    
    // MARK: - Hint State
    @Published var currentHint: Hint? = nil
    
    // MARK: - Game Over State
    @Published var isGameOver: Bool = false
    
    // MARK: - Initialization
    
    init() {
        startNewGame()
    }
    
    func startNewGame() {
        // Reset state
        centralFoundation.removeAll()
        kingFoundations = Array(repeating: [], count: 4)
        reserves = Array(repeating: [], count: 4)
        tableaus = Array(repeating: [], count: 4)
        temporaryStacks.removeAll()
        currentPhase = 1
        undoStack.removeAll()
        redoStack.removeAll()
        canUndo = false
        canRedo = false
        currentHint = nil
        isGameOver = false
        
        var deck = Deck(numberOfDecks: 2)
        deck.shuffle()
        
        // Deal Reserves (10 face-down cards to each of the 4 piles)
        for i in 0..<4 {
            let dealt = deck.deal(count: 10)
            reserves[i] = dealt
            // Ensure they are face down (they are by default, but let's be explicit)
            for j in 0..<reserves[i].count {
                reserves[i][j].isFaceUp = false
            }
        }
        
        // Deal Tableaus (3 face-up cards to each of the 4 piles)
        for i in 0..<4 {
            var dealt = deck.deal(count: 3)
            for j in 0..<dealt.count {
                dealt[j].isFaceUp = true
            }
            tableaus[i] = dealt
        }
        
        // Remaining to Stockpile
        stockpile = deck.cards
        
        // Set face down just in case
        for i in 0..<stockpile.count {
            stockpile[i].isFaceUp = false
        }
    }
    
    // MARK: - Snapshot Helpers
    
    /// Captures the current game state as a snapshot.
    private func takeSnapshot() -> GameSnapshot {
        return GameSnapshot(
            centralFoundation: centralFoundation,
            kingFoundations: kingFoundations,
            reserves: reserves,
            tableaus: tableaus,
            stockpile: stockpile,
            temporaryStacks: temporaryStacks,
            currentPhase: currentPhase
        )
    }
    
    /// Restores the game state from a snapshot.
    private func restore(from snapshot: GameSnapshot) {
        centralFoundation = snapshot.centralFoundation
        kingFoundations = snapshot.kingFoundations
        reserves = snapshot.reserves
        tableaus = snapshot.tableaus
        stockpile = snapshot.stockpile
        temporaryStacks = snapshot.temporaryStacks
        currentPhase = snapshot.currentPhase
        currentHint = nil
        isGameOver = false
    }
    
    /// Saves the current state to the undo stack before a mutation.
    private func saveForUndo() {
        undoStack.append(takeSnapshot())
        redoStack.removeAll()
        canUndo = true
        canRedo = false
    }
    
    // MARK: - Undo / Redo
    
    func undo() {
        guard let snapshot = undoStack.popLast() else { return }
        redoStack.append(takeSnapshot())
        restore(from: snapshot)
        canUndo = !undoStack.isEmpty
        canRedo = true
        currentHint = nil
    }
    
    func redo() {
        guard let snapshot = redoStack.popLast() else { return }
        undoStack.append(takeSnapshot())
        restore(from: snapshot)
        canUndo = true
        canRedo = !redoStack.isEmpty
        currentHint = nil
    }
    
    // MARK: - Core Actions
    
    func drawCard() {
        saveForUndo()
        currentHint = nil
        let maxStacks = 5 - currentPhase // Phase 1 -> 4 stacks, Phase 4 -> 1 stack
        
        // Setup initial empty stacks if we're starting a new pass
        if temporaryStacks.isEmpty && currentPhase <= 4 {
            temporaryStacks = Array(repeating: [], count: maxStacks)
        }
        
        // Find next stack to deal to (left to right, wrapping around)
        if let card = stockpile.popLast() {
            var drawnCard = card
            drawnCard.isFaceUp = true
            
            // Figure out which stack to deal onto based on total cards drawn so far this pass
            let totalCardsInStacks = temporaryStacks.reduce(0) { $0 + $1.count }
            let targetStackIndex = totalCardsInStacks % maxStacks
            
            temporaryStacks[targetStackIndex].append(drawnCard)
            
        } else if currentPhase <= 4 {
            // Stockpile is empty, consolidate temporary stacks from right to left
            var newStockpile: [Card] = []
            
            for stack in temporaryStacks.reversed() {
                var flippedStack = stack
                for i in 0..<flippedStack.count {
                    flippedStack[i].isFaceUp = false
                }
                newStockpile.append(contentsOf: flippedStack)
            }
            
            stockpile = newStockpile.reversed() // maintain correct ordering
            temporaryStacks.removeAll()
            currentPhase += 1
        }
    }
    
    // MARK: - Validation Logic
    
    /// Checks if a card can be placed onto the Center Ace Foundation.
    func canMoveToCenterFoundation(card: Card) -> Bool {
        if centralFoundation.isEmpty {
            return card.rank == .ace
        }
        guard let topCard = centralFoundation.last else { return false }
        return card.suit == topCard.suit && card.rank.rawValue == topCard.rank.rawValue + 1
    }
    
    /// Checks if a card can be placed onto a specific Corner King Foundation.
    func canMoveToKingFoundation(card: Card, pileIndex: Int) -> Bool {
        let pile = kingFoundations[pileIndex]
        if pile.isEmpty {
            return card.rank == .king
        }
        guard let topCard = pile.last else { return false }
        return card.suit == topCard.suit && card.rank.rawValue == topCard.rank.rawValue - 1
    }
    
    /// Checks if a card (or sequence of cards) can be placed onto a specific Tableau pile.
    func canMoveToTableau(cardsToMove: [Card], pileIndex: Int) -> Bool {
        guard let bottomCard = cardsToMove.first else { return false }
        let pile = tableaus[pileIndex]
        
        if pile.isEmpty {
            // Empty tableau can accept any valid card or sequence
            return true
        }
        
        guard let topCard = pile.last else { return false }
        // Must be alternate color and descending rank
        return bottomCard.color != topCard.color && bottomCard.rank.rawValue == topCard.rank.rawValue - 1
    }
    
    /// Validates if a sequence of cards selected from a Tableau is valid to move together.
    func isValidTableauSequence(_ cards: [Card]) -> Bool {
        guard cards.count > 1 else { return true } // A single card is always valid
        
        for i in 0..<(cards.count - 1) {
            let current = cards[i]
            let next = cards[i + 1]
            if current.color == next.color || next.rank.rawValue != current.rank.rawValue - 1 {
                return false
            }
        }
        return true
    }
    
    // MARK: - Core Actions
    
    // MARK: - Drag and Drop Execution
    
    /// Called when the user starts dragging a card or sequence of cards.
    func startDrag(cards: [Card], source: PileLocation) {
        self.draggedCards = cards
        self.dragSource = source
    }
    
    /// Called when the user releases a dragged stack of cards.
    func handleDrop(on target: PileLocation) {
        guard !draggedCards.isEmpty else { return }
        
        // Prevent dropping onto the exact same pile it came from
        if target == dragSource {
            draggedCards.removeAll()
            dragSource = .none
            dragOffset = .zero
            return
        }
        
        currentHint = nil
        var moveSuccessful = false
        
        switch target {
        case .centerFoundation:
            if draggedCards.count == 1, canMoveToCenterFoundation(card: draggedCards[0]) {
                saveForUndo()
                centralFoundation.append(draggedCards[0])
                moveSuccessful = true
            }
        case .kingFoundation(let index):
            if draggedCards.count == 1, canMoveToKingFoundation(card: draggedCards[0], pileIndex: index) {
                saveForUndo()
                kingFoundations[index].append(draggedCards[0])
                moveSuccessful = true
            }
        case .tableau(let index):
            if canMoveToTableau(cardsToMove: draggedCards, pileIndex: index) {
                saveForUndo()
                tableaus[index].append(contentsOf: draggedCards)
                moveSuccessful = true
            }
        default:
            break
        }
        
        if moveSuccessful {
            removeCardsFromSource()
            checkAndRefillEmptyTableaus()
            checkCompletedFoundations()
            currentHint = nil
        }
        
        // Reset drag state
        self.draggedCards = []
        self.dragSource = .none
        self.dragOffset = .zero
    }
    
    /// Removes the successfully moved cards from their original location.
    private func removeCardsFromSource() {
        let countToRemove = draggedCards.count
        switch dragSource {
        case .tableau(let index):
            tableaus[index].removeLast(countToRemove)
        case .temporaryStack(let index):
            temporaryStacks[index].removeLast(countToRemove)
        case .reserve(let index):
            reserves[index].removeLast(countToRemove)
        default:
            break
        }
    }
    
    /// Automatically refills an empty tableau from its corresponding reserve pile.
    func checkAndRefillEmptyTableaus() {
        for i in 0..<4 {
            if tableaus[i].isEmpty, let reserveCard = reserves[i].popLast() {
                var flippedCard = reserveCard
                flippedCard.isFaceUp = true
                tableaus[i].append(flippedCard)
            }
        }
    }
    
    // MARK: - Auto-Move (Tap-to-Move)
    
    /// Auto-moves a card to a foundation or king pile if possible.
    @discardableResult
    func autoMove(card: Card, from source: PileLocation) -> Bool {
        currentHint = nil
        
        // Ensure we are only auto-moving the top card of the source pile
        guard let sourcePile = getArrayForLocation(source),
              let topCard = sourcePile.last,
              topCard.id == card.id else {
            return false
        }
        
        // Try center foundation first (Ace piles)
        if canMoveToCenterFoundation(card: topCard) {
            saveForUndo()
            centralFoundation.append(topCard)
            removeCardFromPile(source: source)
            checkAndRefillEmptyTableaus()
            checkCompletedFoundations()
            return true
        }
        
        // Try King foundations
        for i in 0..<4 {
            if canMoveToKingFoundation(card: topCard, pileIndex: i) {
                saveForUndo()
                kingFoundations[i].append(topCard)
                removeCardFromPile(source: source)
                checkAndRefillEmptyTableaus()
                checkCompletedFoundations()
                return true
            }
        }
        
        return false
    }
    
    private func getArrayForLocation(_ location: PileLocation) -> [Card]? {
        switch location {
        case .tableau(let index): return tableaus[index]
        case .reserve(let index): return reserves[index]
        case .temporaryStack(let index): return temporaryStacks[index]
        case .centerFoundation: return centralFoundation
        case .kingFoundation(let index): return kingFoundations[index]
        default: return nil
    }
    }
    
    /// Removes a single card from the top of the specified pile.
    private func removeCardFromPile(source: PileLocation) {
        switch source {
        case .tableau(let index):
            tableaus[index].removeLast()
        case .temporaryStack(let index):
            temporaryStacks[index].removeLast()
        case .reserve(let index):
            reserves[index].removeLast()
        default:
            break
        }
    }
    
    // MARK: - Foundation Completion
    
    /// Checks if any foundation or king pile is complete (13 cards) and removes it.
    func checkCompletedFoundations() {
        // Check center foundation (Ace to King = 13 cards)
        if centralFoundation.count == 13 {
            centralFoundation.removeAll()
        }
        
        // Check king foundations (King to Ace = 13 cards)
        for i in 0..<4 {
            if kingFoundations[i].count == 13 {
                kingFoundations[i].removeAll()
            }
        }
    }
    
    // MARK: - Win Detection
    
    /// Returns true if all 104 cards have been played into completed foundations.
    var isGameWon: Bool {
        let totalCardsRemaining =
            centralFoundation.count +
            kingFoundations.reduce(0) { $0 + $1.count } +
            reserves.reduce(0) { $0 + $1.count } +
            tableaus.reduce(0) { $0 + $1.count } +
            stockpile.count +
            temporaryStacks.reduce(0) { $0 + $1.count }
        return totalCardsRemaining == 0
    }
    
    // MARK: - Hint System
    
    /// Finds and sets the first valid move as the current hint.
    func findHint() {
        // 1. Check tableau top cards -> foundations / king piles
        for i in 0..<4 {
            guard let topCard = tableaus[i].last else { continue }
            if canMoveToCenterFoundation(card: topCard) {
                currentHint = Hint(card: topCard, from: .tableau(i), to: .centerFoundation)
                return
            }
            for j in 0..<4 {
                if canMoveToKingFoundation(card: topCard, pileIndex: j) {
                    currentHint = Hint(card: topCard, from: .tableau(i), to: .kingFoundation(j))
                    return
                }
            }
        }
        
        // 2. Check temporary stack top cards -> foundations / king piles / tableaus
        for i in 0..<temporaryStacks.count {
            guard let topCard = temporaryStacks[i].last else { continue }
            if canMoveToCenterFoundation(card: topCard) {
                currentHint = Hint(card: topCard, from: .temporaryStack(i), to: .centerFoundation)
                return
            }
            for j in 0..<4 {
                if canMoveToKingFoundation(card: topCard, pileIndex: j) {
                    currentHint = Hint(card: topCard, from: .temporaryStack(i), to: .kingFoundation(j))
                    return
                }
            }
            for j in 0..<4 {
                if canMoveToTableau(cardsToMove: [topCard], pileIndex: j) {
                    currentHint = Hint(card: topCard, from: .temporaryStack(i), to: .tableau(j))
                    return
                }
            }
        }
        
        // 3. Check tableau-to-tableau moves
        for i in 0..<4 {
            guard let topCard = tableaus[i].last else { continue }
            for j in 0..<4 where j != i {
                if canMoveToTableau(cardsToMove: [topCard], pileIndex: j) {
                    currentHint = Hint(card: topCard, from: .tableau(i), to: .tableau(j))
                    return
                }
            }
        }
        
        // 4. Check if stockpile can still be drawn
        if !stockpile.isEmpty {
            currentHint = nil // No card hint, but drawing is still possible
            return
        }
        
        // No hint found
        currentHint = nil
    }
    
    // MARK: - Game Over Detection
    
    /// Checks if the game is stuck (no valid moves and no draws left).
    func checkGameOver() {
        // If stockpile has cards, the game is not over yet
        if !stockpile.isEmpty { isGameOver = false; return }
        
        // If there are still phases left, game is not over
        if currentPhase <= 4 { isGameOver = false; return }
        
        // Check all possible moves
        // 1. Check tableau cards -> foundations or other tableaus
        for i in 0..<4 {
            guard let topCard = tableaus[i].last else { continue }
            if canMoveToCenterFoundation(card: topCard) { isGameOver = false; return }
            for j in 0..<4 {
                if canMoveToKingFoundation(card: topCard, pileIndex: j) { isGameOver = false; return }
            }
            for j in 0..<4 where j != i {
                if canMoveToTableau(cardsToMove: [topCard], pileIndex: j) { isGameOver = false; return }
            }
        }
        
        // 2. Check temporary stack cards
        for i in 0..<temporaryStacks.count {
            guard let topCard = temporaryStacks[i].last else { continue }
            if canMoveToCenterFoundation(card: topCard) { isGameOver = false; return }
            for j in 0..<4 {
                if canMoveToKingFoundation(card: topCard, pileIndex: j) { isGameOver = false; return }
            }
            for j in 0..<4 {
                if canMoveToTableau(cardsToMove: [topCard], pileIndex: j) { isGameOver = false; return }
            }
        }
        
        // No moves found
        isGameOver = true
    }
}
