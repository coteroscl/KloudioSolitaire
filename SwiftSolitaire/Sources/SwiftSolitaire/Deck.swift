import Foundation

struct Deck {
    private(set) var cards: [Card] = []
    
    init(numberOfDecks: Int = 2) {
        cards = Deck.generateDecks(count: numberOfDecks)
    }
    
    /// Generates a specified number of standard 52-card decks.
    private static func generateDecks(count: Int) -> [Card] {
        var newCards: [Card] = []
        for _ in 0..<count {
            for suit in Suit.allCases {
                for rank in Rank.allCases {
                    newCards.append(Card(suit: suit, rank: rank))
                }
            }
        }
        return newCards
    }
    
    /// Shuffles the deck.
    mutating func shuffle() {
        cards.shuffle()
    }
    
    /// Deals a specific number of cards from the top of the deck.
    mutating func deal(count: Int) -> [Card] {
        guard count <= cards.count else { return [] }
        let dealtCards = Array(cards.prefix(count))
        cards.removeFirst(count)
        return dealtCards
    }
    
    /// Deals a single card.
    mutating func dealOne() -> Card? {
        guard !cards.isEmpty else { return nil }
        return cards.removeFirst()
    }
}
