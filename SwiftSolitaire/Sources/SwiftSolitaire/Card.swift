import Foundation

/// Represents a standard playing card suit.
enum Suit: String, CaseIterable {
    case hearts = "Hearts"
    case diamonds = "Diamonds"
    case clubs = "Clubs"
    case spades = "Spades"
    
    var color: CardColor {
        switch self {
        case .hearts, .diamonds:
            return .red
        case .clubs, .spades:
            return .black
        }
    }
}

/// Represents the color of a playing card.
enum CardColor {
    case red, black
}

/// Represents the rank of a playing card.
enum Rank: Int, CaseIterable {
    case ace = 1
    case two, three, four, five, six, seven, eight, nine, ten
    case jack, queen, king
    
    var symbol: String {
        switch self {
        case .ace: return "A"
        case .jack: return "J"
        case .queen: return "Q"
        case .king: return "K"
        default: return String(self.rawValue)
        }
    }
}

/// Represents a single playing card.
struct Card: Identifiable, Equatable {
    let id: UUID
    let suit: Suit
    let rank: Rank
    var isFaceUp: Bool
    
    init(suit: Suit, rank: Rank, isFaceUp: Bool = false) {
        self.id = UUID()
        self.suit = suit
        self.rank = rank
        self.isFaceUp = isFaceUp
    }
    
    var color: CardColor {
        return suit.color
    }
    
    var description: String {
        return "\(rank.symbol) of \(suit.rawValue)"
    }
}
