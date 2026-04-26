# App Development Roadmap for SwiftSolitaire

Based on the analysis comparing the official "Kloudio Solitaire" PDF rules with the actual gameplay video, the following roadmap outlines the development plan for the iOS application. 

### Key Rule Clarifications from Video
Before starting development, note these essential rule corrections derived from the video:
1. **Stockpile Drawing:** Cards are drawn from the stockpile into multiple temporary side-by-side stacks as described in the PDF. First round deals into 4 stacks, second round into 3 stacks, third round into 2 stacks, and the final round into 1 stack.
2. **Tableau Spaces & Moves:** Entire valid groups of cards (alternating color, descending sequence) can move together between Tableau piles. Any valid card or group can be placed into an empty Tableau space.
3. **Tableau Layout:** Tableau piles begin as a stacked pile of 3 cards (played from the top down), not visually "staggered" as the PDF describes.

---

### Phase 1: Project Setup and UI Layout
1. **✅Initialize Swift Project**:
   - Create a new iOS Swift project using SwiftUI (or UIKit if preferred, though SwiftUI is recommended for modern drag-and-drop card games).
   - Set up the device orientation to **Landscape** (best fits the cross layout shown in the video).
2. **✅Define Card and Deck Models**:
   - Create the `Card` model (Suit, Rank, Color, isFaceUp).
   - Create the `Deck` model to manage a standard 52-card deck and a double deck (104 cards).
3. **✅Design the Game Board Layout**:
   - **Center**: 1 slot for an active Ace-to-King Foundation.
   - **Corners**: 4 slots for active King-to-Ace Foundations.
   - **Cross Arms (Tableau)**: 4 Tableau piles.
   - **Outer Arms (Reserves)**: 4 Reserve piles (10 cards each).
   - **Stock & Discard**: Stockpile and Discard pile positioned off to the side.

### Phase 2: Core Game Logic and State Management
1. **✅Game Setup / Dealing**:
   - Deal 10 face-down cards to each of the 4 Reserve piles.
   - Deal 3 face-up cards to each of the 4 Tableau piles.
   - Remaining cards go to the Stockpile.
2. **✅Move Validation Engine**:
   - Implement logic for Tableau moves: Alternating color, descending order. Allow moving single cards or valid sequences.
   - Implement logic for Foundation moves: Same suit, ascending order (Ace to King).
   - Implement logic for King Pile moves: Same suit, descending order (King to Ace).
3. **✅Empty Tableau Space Logic**:
   - Implement the rule allowing the player to move any valid card/sequence into an empty Tableau spot.
   - Implement the auto-flip or manual-flip of the Reserve pile's top card when the adjacent Tableau pile is empty.
4. **✅Stockpile Drawing**:
   - Implement drawing from the Stockpile into temporary side-by-side stacks based on the current pass.
   - Implement the phase logic (Pass 1: 4 stacks, Pass 2: 3 stacks, Pass 3: 2 stacks, Pass 4: 1 stack).
   - Implement the consolidation of the temporary stacks back into the face-down Stockpile at the end of each pass.

### Phase 3: Interactivity and Animations
1. **✅Drag and Drop Mechanics**:
   - Implement drag gestures for cards.
   - Highlight valid drop zones when hovering over them.
   - Snap cards back to their origin if dropped in an invalid location.
2. **Tap-to-Move (Optional but Recommended)**:
   - Double-tapping a card automatically sends it to a valid Foundation or King pile if a valid move exists.
3. **Animations**:
   - Smooth dealing animations at the start of the game.
   - Card flipping animations.
   - Completed Foundation/King pile removal animations (clearing the spot for a new sequence).

### Phase 4: Polish, Winning/Losing Conditions, and Extras
1. **Win/Loss Detection**:
   - **Win**: All 104 cards successfully played into the 8 completed sequences.
   - **Loss**: No more valid moves available, and the stockpile has been exhausted through all its allowed passes.
2. **Undo/Redo System**:
   - Implement a state stack to allow the player to undo their moves.
3. **Hint System**:
   - Add a button that highlights the next possible valid move.
4. **Game Over UI**:
   - Display a victory screen with stats (time, moves) or a "No More Moves" dialogue.
