import SwiftUI

struct CardView: View {
    var card: Card
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(card.isFaceUp ? Color.white : Color.blue)
                .shadow(radius: 2)
                
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.black, lineWidth: 1)
            
            if card.isFaceUp {
                VStack {
                    HStack {
                        Text(card.rank.symbol)
                            .font(.headline)
                            .foregroundColor(card.color == .red ? .red : .black)
                        Spacer()
                    }
                    Spacer()
                    
                    Text(suitSymbol(for: card.suit))
                        .font(.largeTitle)
                        .foregroundColor(card.color == .red ? .red : .black)
                    
                    Spacer()
                    HStack {
                        Spacer()
                        Text(card.rank.symbol)
                            .font(.headline)
                            .foregroundColor(card.color == .red ? .red : .black)
                            .rotationEffect(.degrees(180))
                    }
                }
                .padding(4)
            } else {
                // Card back design
                Image(systemName: "seal.fill")
                    .resizable()
                    .scaledToFit()
                    .padding(10)
                    .foregroundColor(Color.white.opacity(0.5))
            }
        }
        .frame(width: 70, height: 100)
    }
    
    func suitSymbol(for suit: Suit) -> String {
        switch suit {
        case .hearts: return "♥"
        case .diamonds: return "♦"
        case .clubs: return "♣"
        case .spades: return "♠"
        }
    }
}
