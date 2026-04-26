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
    
    // Stock and Discard
    @Published var stockpile: [Card] = []
    @Published var discardPile: [Card] = []
    
    @Published var passesRemaining: Int = 4 // Example: standard solitaire limits to 3 or 4 passes.
    
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
        discardPile.removeAll()
        
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
    
    // MARK: - Core Actions (To be implemented)
    
    func drawCard() {
        if let card = stockpile.popLast() {
            var drawnCard = card
            drawnCard.isFaceUp = true
            discardPile.append(drawnCard)
        } else if passesRemaining > 0 {
            // Redeal: flip discard pile to form new stockpile
            stockpile = discardPile.reversed()
            discardPile.removeAll()
            for i in 0..<stockpile.count {
                stockpile[i].isFaceUp = false
            }
            passesRemaining -= 1
        }
    }
    
    // TODO: Implement move validation and execution methods
}
