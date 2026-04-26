import Foundation

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
    
    // TODO: Implement move validation and execution methods
}
