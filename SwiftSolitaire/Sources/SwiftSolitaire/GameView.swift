import SwiftUI

struct GameView: View {
    @StateObject private var engine = GameEngine()
    
    var body: some View {
        ZStack {
            Color.green.edgesIgnoringSafeArea(.all) // Classic felt table
            
            VStack(spacing: 20) {
                // Top Row: North Reserve & Tableau
                HStack(spacing: 20) {
                    PileView(cards: engine.reserves[0], label: "North Res")
                    TableauPileView(cards: engine.tableaus[0])
                }
                
                // Middle Row: West, Center, East
                HStack(spacing: 20) {
                    // West Reserve & Tableau
                    VStack(spacing: 10) {
                        PileView(cards: engine.reserves[3], label: "West Res")
                        TableauPileView(cards: engine.tableaus[3])
                    }
                    
                    // Center Foundations (King corners & Ace Center)
                    ZStack {
                        // Background square for foundations
                        Rectangle()
                            .stroke(Color.white.opacity(0.3), lineWidth: 2)
                            .frame(width: 250, height: 250)
                        
                        // Center Ace Foundation
                        PileView(cards: engine.centralFoundation, label: "Ace")
                        
                        // Corner King Foundations
                        VStack(spacing: 150) {
                            HStack(spacing: 150) {
                                PileView(cards: engine.kingFoundations[0], label: "King")
                                PileView(cards: engine.kingFoundations[1], label: "King")
                            }
                            HStack(spacing: 150) {
                                PileView(cards: engine.kingFoundations[2], label: "King")
                                PileView(cards: engine.kingFoundations[3], label: "King")
                            }
                        }
                    }
                    
                    // East Tableau & Reserve
                    VStack(spacing: 10) {
                        TableauPileView(cards: engine.tableaus[1])
                        PileView(cards: engine.reserves[1], label: "East Res")
                    }
                }
                
                // Bottom Row: South Tableau & Reserve
                HStack(spacing: 20) {
                    TableauPileView(cards: engine.tableaus[2])
                    PileView(cards: engine.reserves[2], label: "South Res")
                }
                
                Spacer()
                
                // Stockpile and Discard Row
                HStack(spacing: 40) {
                    Button(action: {
                        engine.drawCard()
                        // Since GameEngine isn't an ObservableObject yet, this won't auto-refresh the view in this scaffold.
                        // We will add @Published and ObservableObject protocols later.
                    }) {
                        PileView(cards: engine.stockpile, label: "Stock")
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    PileView(cards: engine.discardPile, label: "Discard")
                    
                    Text("Passes Left: \(engine.passesRemaining)")
                        .foregroundColor(.white)
                        .font(.headline)
                }
            }
            .padding()
        }
    }
}

/// A simple view to display a pile of cards.
struct PileView: View {
    var cards: [Card]
    var label: String
    
    var body: some View {
        ZStack {
            // Placeholder when empty
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.white.opacity(0.5), lineWidth: 2)
                .frame(width: 70, height: 100)
                .overlay(Text(label).font(.caption).foregroundColor(.white))
            
            if let topCard = cards.last {
                CardView(card: topCard)
            }
        }
    }
}

/// A view specifically for the Tableau piles to show the cascaded cards.
struct TableauPileView: View {
    var cards: [Card]
    
    var body: some View {
        ZStack {
            // Placeholder
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.white.opacity(0.5), lineWidth: 2)
                .frame(width: 70, height: 100)
            
            // Display cascading cards
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                CardView(card: card)
                    .offset(y: CGFloat(index * 25))
            }
        }
        .frame(width: 70, height: 100 + CGFloat(max(0, cards.count - 1) * 25))
    }
}
