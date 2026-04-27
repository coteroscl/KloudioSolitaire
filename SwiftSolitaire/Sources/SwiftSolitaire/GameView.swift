import SwiftUI

struct GameView: View {
    @StateObject private var engine = GameEngine()
    
    var body: some View {
        ZStack {
            // Rich felt table background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.05, green: 0.35, blue: 0.15),
                    Color(red: 0.08, green: 0.45, blue: 0.2),
                    Color(red: 0.05, green: 0.35, blue: 0.15)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                // Top Row: North Reserve & Tableau
                HStack(spacing: 20) {
                    ReservePileView(cards: engine.reserves[0], label: "North Res", location: .reserve(0), engine: engine)
                    DraggableTableauPileView(cards: engine.tableaus[0], pileIndex: 0, engine: engine)
                }
                
                // Middle Row: West, Center, East
                HStack(spacing: 20) {
                    // West Reserve & Tableau
                    VStack(spacing: 10) {
                        ReservePileView(cards: engine.reserves[3], label: "West Res", location: .reserve(3), engine: engine)
                        DraggableTableauPileView(cards: engine.tableaus[3], pileIndex: 3, engine: engine)
                    }
                    
                    // Center Foundations (King corners & Ace Center)
                    ZStack {
                        // Background square for foundations
                        Rectangle()
                            .stroke(Color.white.opacity(0.3), lineWidth: 2)
                            .frame(width: 250, height: 250)
                        
                        // Center Ace Foundation (drop target)
                        DropTargetPileView(cards: engine.centralFoundation, label: "Ace", location: .centerFoundation, engine: engine)
                        
                        // Corner King Foundations (drop targets)
                        VStack(spacing: 150) {
                            HStack(spacing: 150) {
                                DropTargetPileView(cards: engine.kingFoundations[0], label: "King", location: .kingFoundation(0), engine: engine)
                                DropTargetPileView(cards: engine.kingFoundations[1], label: "King", location: .kingFoundation(1), engine: engine)
                            }
                            HStack(spacing: 150) {
                                DropTargetPileView(cards: engine.kingFoundations[2], label: "King", location: .kingFoundation(2), engine: engine)
                                DropTargetPileView(cards: engine.kingFoundations[3], label: "King", location: .kingFoundation(3), engine: engine)
                            }
                        }
                    }
                    
                    // East Tableau & Reserve
                    VStack(spacing: 10) {
                        DraggableTableauPileView(cards: engine.tableaus[1], pileIndex: 1, engine: engine)
                        ReservePileView(cards: engine.reserves[1], label: "East Res", location: .reserve(1), engine: engine)
                    }
                }
                
                // Bottom Row: South Tableau & Reserve
                HStack(spacing: 20) {
                    DraggableTableauPileView(cards: engine.tableaus[2], pileIndex: 2, engine: engine)
                    ReservePileView(cards: engine.reserves[2], label: "South Res", location: .reserve(2), engine: engine)
                }
                
                Spacer()
                
                // MARK: - Toolbar (Undo, Redo, Hint, New Game)
                HStack(spacing: 20) {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            engine.undo()
                        }
                    }) {
                        VStack {
                            Image(systemName: "arrow.uturn.backward.circle.fill")
                                .font(.title2)
                            Text("Undo")
                                .font(.caption2)
                        }
                        .foregroundColor(engine.canUndo ? .white : .gray)
                    }
                    .disabled(!engine.canUndo)
                    
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            engine.redo()
                        }
                    }) {
                        VStack {
                            Image(systemName: "arrow.uturn.forward.circle.fill")
                                .font(.title2)
                            Text("Redo")
                                .font(.caption2)
                        }
                        .foregroundColor(engine.canRedo ? .white : .gray)
                    }
                    .disabled(!engine.canRedo)
                    
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            engine.findHint()
                        }
                    }) {
                        VStack {
                            Image(systemName: "lightbulb.fill")
                                .font(.title2)
                            Text("Hint")
                                .font(.caption2)
                        }
                        .foregroundColor(.yellow)
                    }
                    
                    Spacer()
                    
                    // Stockpile and Drawing Row
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            engine.drawCard()
                        }
                    }) {
                        PileView(cards: engine.stockpile, label: "Stock")
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // Temporary Stacks (Phase specific, draggable top cards)
                    HStack(spacing: 20) {
                        ForEach(0..<engine.temporaryStacks.count, id: \.self) { index in
                            DraggablePileView(cards: engine.temporaryStacks[index], label: "Stack \(index + 1)", location: .temporaryStack(index), engine: engine)
                        }
                    }
                    
                    Text(engine.currentPhase <= 4 ? "Phase: \(engine.currentPhase)/4" : "Done")
                        .foregroundColor(.white)
                        .font(.headline)
                    
                    Spacer()
                    
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.5)) {
                            engine.startNewGame()
                        }
                    }) {
                        VStack {
                            Image(systemName: "arrow.counterclockwise.circle.fill")
                                .font(.title2)
                            Text("New")
                                .font(.caption2)
                        }
                        .foregroundColor(.white)
                    }
                }
            }
            .padding()
            
            // MARK: - Floating Drag Overlay
            // Renders the cards being dragged, floating above everything else
            if !engine.draggedCards.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(engine.draggedCards.enumerated()), id: \.element.id) { index, card in
                        CardView(card: card)
                            .offset(y: CGFloat(index * 25))
                    }
                }
                .offset(engine.dragOffset)
                .opacity(0.85)
                .shadow(color: .black.opacity(0.4), radius: 8, x: 2, y: 4)
                .animation(.none, value: engine.dragOffset)
            }
            
            // MARK: - Victory Overlay
            if engine.isGameWon {
                Color.black.opacity(0.6)
                    .edgesIgnoringSafeArea(.all)
                    .transition(.opacity)
                
                VStack(spacing: 20) {
                    Text("🎉 You Won! 🎉")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.yellow)
                        .shadow(color: .orange, radius: 10)
                    
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.5)) {
                            engine.startNewGame()
                        }
                    }) {
                        Text("New Game")
                            .font(.title2.bold())
                            .foregroundColor(.white)
                            .padding(.horizontal, 30)
                            .padding(.vertical, 12)
                            .background(Color.blue)
                            .cornerRadius(12)
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
            
            // MARK: - Game Over Overlay
            if engine.isGameOver && !engine.isGameWon {
                Color.black.opacity(0.6)
                    .edgesIgnoringSafeArea(.all)
                    .transition(.opacity)
                
                VStack(spacing: 20) {
                    Text("😔 No More Moves")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text("The game is stuck. Try undoing some moves or start a new game.")
                        .font(.body)
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    
                    HStack(spacing: 20) {
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                engine.isGameOver = false
                                engine.undo()
                            }
                        }) {
                            Text("Undo")
                                .font(.title3.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 25)
                                .padding(.vertical, 10)
                                .background(Color.orange)
                                .cornerRadius(10)
                        }
                        .disabled(!engine.canUndo)
                        
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.5)) {
                                engine.startNewGame()
                            }
                        }) {
                            Text("New Game")
                                .font(.title3.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 25)
                                .padding(.vertical, 10)
                                .background(Color.blue)
                                .cornerRadius(10)
                        }
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
    }
}

// MARK: - PileView (Static, no interaction)

/// A simple view to display a pile of cards (no drag interaction).
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

// MARK: - DraggablePileView (Top card draggable, e.g. temporary stacks)

/// A pile where only the top card can be dragged (used for temporary stacks).
struct DraggablePileView: View {
    var cards: [Card]
    var label: String
    var location: PileLocation
    @ObservedObject var engine: GameEngine
    
    private var isHintSource: Bool {
        engine.currentHint?.from == location
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .stroke(isHintSource ? Color.cyan : Color.white.opacity(0.5), lineWidth: isHintSource ? 3 : 2)
                .frame(width: 70, height: 100)
                .overlay(Text(label).font(.caption).foregroundColor(.white))
            
            if let topCard = cards.last {
                CardView(card: topCard)
                    .onTapGesture(count: 2) {
                        // Double-tap: auto-move to foundation/king pile
                        withAnimation(.easeInOut(duration: 0.3)) {
                            engine.autoMove(card: topCard, from: location)
                        }
                    }
                    .gesture(
                        DragGesture()
                            .onChanged { gesture in
                                engine.startDrag(cards: [topCard], source: location)
                                engine.dragOffset = gesture.translation
                            }
                            .onEnded { _ in
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    engine.handleDrop(on: .none)
                                }
                            }
                    )
            }
        }
    }
}

// MARK: - ReservePileView (Top card draggable when tableau is empty)

/// Displays a reserve pile. The top card can be tapped to flip into its tableau.
struct ReservePileView: View {
    var cards: [Card]
    var label: String
    var location: PileLocation
    @ObservedObject var engine: GameEngine
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.white.opacity(0.5), lineWidth: 2)
                .frame(width: 70, height: 100)
                .overlay(Text(label).font(.caption).foregroundColor(.white))
            
            if let topCard = cards.last {
                CardView(card: topCard)
                    .onTapGesture {
                        // Tapping a reserve card flips it into its tableau
                        // (handled automatically by checkAndRefillEmptyTableaus)
                        if case .reserve(let index) = location {
                            if engine.tableaus[index].isEmpty {
                                engine.checkAndRefillEmptyTableaus()
                            }
                        }
                    }
            }
        }
    }
}

// MARK: - DropTargetPileView (Foundations and King Piles)

/// A pile that acts as a drop target. Tapping a dragged card onto this triggers a drop.
struct DropTargetPileView: View {
    var cards: [Card]
    var label: String
    var location: PileLocation
    @ObservedObject var engine: GameEngine
    
    private var isHintTarget: Bool {
        engine.currentHint?.to == location
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .stroke(isValidDropTarget ? Color.yellow : (isHintTarget ? Color.cyan : Color.white.opacity(0.5)), lineWidth: isValidDropTarget || isHintTarget ? 3 : 2)
                .frame(width: 70, height: 100)
                .overlay(Text(label).font(.caption).foregroundColor(.white))
                .background(isValidDropTarget ? Color.yellow.opacity(0.15) : (isHintTarget ? Color.cyan.opacity(0.15) : Color.clear))
                .cornerRadius(8)
            
            if let topCard = cards.last {
                CardView(card: topCard)
            }
        }
        .onTapGesture {
            // Allow tapping a foundation to drop the currently dragged card
            if !engine.draggedCards.isEmpty {
                engine.handleDrop(on: location)
            }
        }
    }
    
    /// Highlights the pile if the currently dragged card(s) could be validly dropped here.
    private var isValidDropTarget: Bool {
        guard !engine.draggedCards.isEmpty else { return false }
        switch location {
        case .centerFoundation:
            return engine.draggedCards.count == 1 && engine.canMoveToCenterFoundation(card: engine.draggedCards[0])
        case .kingFoundation(let index):
            return engine.draggedCards.count == 1 && engine.canMoveToKingFoundation(card: engine.draggedCards[0], pileIndex: index)
        case .tableau(let index):
            return engine.canMoveToTableau(cardsToMove: engine.draggedCards, pileIndex: index)
        default:
            return false
        }
    }
}

// MARK: - DraggableTableauPileView (Full drag from any card in the cascade)

/// A Tableau pile where the player can drag a card and all cards below it.
struct DraggableTableauPileView: View {
    var cards: [Card]
    var pileIndex: Int
    @ObservedObject var engine: GameEngine
    
    private var isHintSource: Bool {
        engine.currentHint?.from == .tableau(pileIndex)
    }
    
    private var isHintTarget: Bool {
        engine.currentHint?.to == .tableau(pileIndex)
    }
    
    var body: some View {
        ZStack {
            // Drop target placeholder
            RoundedRectangle(cornerRadius: 8)
                .stroke(isValidDropTarget ? Color.yellow : (isHintTarget || isHintSource ? Color.cyan : Color.white.opacity(0.5)), lineWidth: isValidDropTarget || isHintTarget || isHintSource ? 3 : 2)
                .frame(width: 70, height: 100)
                .background(isValidDropTarget ? Color.yellow.opacity(0.15) : (isHintTarget ? Color.cyan.opacity(0.15) : Color.clear))
                .cornerRadius(8)
                .onTapGesture {
                    // Allow dropping onto an empty tableau
                    if !engine.draggedCards.isEmpty {
                        engine.handleDrop(on: .tableau(pileIndex))
                    }
                }
            
            // Display cascading cards, each individually draggable
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                CardView(card: card)
                    .offset(y: CGFloat(index * 25))
                    .opacity(isDragging(cardIndex: index) ? 0.3 : 1.0)
                    .onTapGesture(count: 2) {
                        // Double-tap: auto-move to foundation/king pile
                        // Only works on the top card of the tableau
                        if index == cards.count - 1 {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                engine.autoMove(card: card, from: .tableau(pileIndex))
                            }
                        }
                    }
                    .gesture(
                        DragGesture()
                            .onChanged { gesture in
                                let cardsToGrab = Array(cards[index...])
                                if engine.isValidTableauSequence(cardsToGrab) {
                                    engine.startDrag(cards: cardsToGrab, source: .tableau(pileIndex))
                                    engine.dragOffset = gesture.translation
                                }
                            }
                            .onEnded { _ in
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    engine.handleDrop(on: .none)
                                }
                            }
                    )
                    .animation(.easeInOut(duration: 0.2), value: cards.count)
            }
        }
        .frame(width: 70, height: 100 + CGFloat(max(0, cards.count - 1) * 25))
    }
    
    /// Checks if the given card index is part of the currently dragged stack from this pile.
    private func isDragging(cardIndex: Int) -> Bool {
        guard engine.dragSource == .tableau(pileIndex), !engine.draggedCards.isEmpty else { return false }
        let dragStartIndex = cards.count - engine.draggedCards.count
        return cardIndex >= dragStartIndex
    }
    
    /// Highlights the pile if the currently dragged card(s) could be validly dropped here.
    private var isValidDropTarget: Bool {
        guard !engine.draggedCards.isEmpty else { return false }
        // Don't highlight the pile we're dragging FROM
        if engine.dragSource == .tableau(pileIndex) { return false }
        return engine.canMoveToTableau(cardsToMove: engine.draggedCards, pileIndex: pileIndex)
    }
}
