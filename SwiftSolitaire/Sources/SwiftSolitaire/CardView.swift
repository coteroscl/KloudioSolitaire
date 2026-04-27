import SwiftUI

struct CardView: View {
    var card: Card
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(card.isFaceUp ? Color.white : Color(red: 0.15, green: 0.25, blue: 0.55))
                .shadow(color: .black.opacity(0.3), radius: 3, x: 1, y: 2)
                
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.black.opacity(0.6), lineWidth: 1)
            
            if card.isFaceUp {
                VStack {
                    HStack {
                        Text(card.rank.symbol)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(card.color == .red ? .red : .black)
                        Spacer()
                    }
                    Spacer()
                    
                    Text(suitSymbol(for: card.suit))
                        .font(.system(size: 30))
                        .foregroundColor(card.color == .red ? .red : .black)
                    
                    Spacer()
                    HStack {
                        Spacer()
                        Text(card.rank.symbol)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(card.color == .red ? .red : .black)
                            .rotationEffect(.degrees(180))
                    }
                }
                .padding(4)
            } else {
                // Card back design with decorative pattern
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 0.1, green: 0.2, blue: 0.5),
                                    Color(red: 0.2, green: 0.35, blue: 0.7)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .padding(3)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.white.opacity(0.3), lineWidth: 1)
                        .padding(6)
                    
                    Image(systemName: "suit.spade.fill")
                        .resizable()
                        .scaledToFit()
                        .padding(20)
                        .foregroundColor(Color.white.opacity(0.2))
                }
            }
        }
        .frame(width: 60, height: 84)
        // 3D flip animation: rotate along Y-axis based on face-up state
        .rotation3DEffect(
            .degrees(card.isFaceUp ? 0 : 180),
            axis: (x: 0, y: 1, z: 0)
        )
        .animation(.easeInOut(duration: 0.4), value: card.isFaceUp)
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
