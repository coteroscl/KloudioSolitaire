import Foundation

enum PileLocation: Equatable {
    case none
    case tableau(Int)
    case reserve(Int)
    case centerFoundation
    case kingFoundation(Int)
    case temporaryStack(Int)
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
    
    // MARK: - Core Actions
    
    func drawCard() {
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
        
        var moveSuccessful = false
        
        switch target {
        case .centerFoundation:
            if draggedCards.count == 1, canMoveToCenterFoundation(card: draggedCards[0]) {
                centralFoundation.append(draggedCards[0])
                moveSuccessful = true
            }
        case .kingFoundation(let index):
            if draggedCards.count == 1, canMoveToKingFoundation(card: draggedCards[0], pileIndex: index) {
                kingFoundations[index].append(draggedCards[0])
                moveSuccessful = true
            }
        case .tableau(let index):
            if canMoveToTableau(cardsToMove: draggedCards, pileIndex: index) {
                tableaus[index].append(contentsOf: draggedCards)
                moveSuccessful = true
            }
        default:
            break
        }
        
        if moveSuccessful {
            removeCardsFromSource()
            // Check if we need to auto-flip a reserve card
            checkAndRefillEmptyTableaus()
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
    
    /// Attempts to automatically move a card to a valid foundation or king pile.
    /// Returns true if the card was successfully moved.
    @discardableResult
    func autoMove(card: Card, from source: PileLocation) -> Bool {
        // Try center foundation first (Ace piles)
        if canMoveToCenterFoundation(card: card) {
            centralFoundation.append(card)
            removeCardFromPile(source: source)
            checkAndRefillEmptyTableaus()
            checkCompletedFoundations()
            return true
        }
        
        // Try each king foundation
        for i in 0..<4 {
            if canMoveToKingFoundation(card: card, pileIndex: i) {
                kingFoundations[i].append(card)
                removeCardFromPile(source: source)
                checkAndRefillEmptyTableaus()
                checkCompletedFoundations()
                return true
            }
        }
        
        return false
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
}
