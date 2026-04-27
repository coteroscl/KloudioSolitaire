# Kloudio Solitaire

Kloudio is a unique solitaire game played with two standard 52-card decks (104 cards total). The game features a dynamic cross-shaped layout, building sequences both ascending and descending from the center and corners.

## 1. Objective of the Game
The primary objective of Kloudio is to build eight complete suit sequences. Each sequence corresponds to one of the four standard suits, duplicated across the two decks.
* **Central Foundation Piles:** Start with an Ace and build *upward* in the same suit to a King (e.g., Ace♣, 2♣, ..., King♣).
* **Corner King Piles:** Start with a King and build *downward* in the same suit to an Ace (e.g., King♠, Queen♠, ..., Ace♠).

The game is won when all 104 cards are successfully played into these eight completed piles, which are then set aside.

## 2. Game Setup
The playing area is organized into a cross shape:

* **Central Foundation Area:** Initially empty. Built UP from Ace to King.
* **King Pile Positions:** Four corners. Built DOWN from King to Ace (45° radial orientation).
* **Reserve Piles:** 10 face-down cards.
    *   **North/South:** Horizontal orientation.
    *   **East/West:** Vertical orientation.
* **Tableau Piles:** Placed adjacent to Reserves, fanning OUTWARD from the center.
    *   **North:** Tableau ABOVE Reserve, horizontal, fanning UP (visible card top).
    *   **South:** Tableau BELOW Reserve, horizontal, fanning DOWN (visible card bottom).
    *   **East:** Tableau RIGHT of Reserve, vertical, fanning RIGHT (visible card right).
    *   **West:** Tableau LEFT of Reserve, vertical, fanning LEFT (visible card left).
* **Stockpile:** 52 cards remaining. Phase-based drawing:
    *   **Phase 1:** Draw 1 card at a time.
    *   **Phase 2:** Draw 2 cards at a time.
    *   **Phase 3:** Draw 3 cards at a time.
    *   **Phase 4:** Draw 4 cards at a time (Batch drawing).
    *   Cards are distributed across temporary stacks (4 in Phase 1, 1 in Phase 4). New draws cover previous ones, making only the top card playable. Once the play is finished, drawing starts again from the left-most pile.

## 3. Rules of Play

### 3.1 Tableau Rules
* **Moving Cards:** You can move a face-up card from one Tableau pile to another if it is **one rank lower and of the opposite color** (e.g., placing a Red 7 on a Black 8).
* **Moving Groups:** You can move an entire valid sequence of cards (alternating color, descending order) together between Tableau piles.
* **Empty Tableau Spaces:** If a Tableau space becomes empty, you can move any available valid card (or valid sequence of cards) into that empty space.
* **Refilling from Reserves:** When a Tableau pile is empty, you can flip the top card of its corresponding face-down Reserve pile to fill the space and make that card available for play.

### 3.2 Building Foundations and King Piles
* **Central Foundation:** When an Ace is available, it can be moved to the center to start a new pile. Build upwards in the same suit. Once the sequence is finished (King is placed), the pile is removed from the board, freeing the central spot for a new Ace.
* **King Piles:** When a King is available, it can be moved to one of the four empty corner spots. Build downwards in the same suit. Once finished (Ace is placed), the pile is removed, freeing the spot.
* **Strategic Choice:** When both an Ace sequence and a King sequence of the same suit are active, you can choose whether to play an available card onto the ascending or descending pile.

### 3.3 Drawing from the Stockpile
* **Drawing:** The Stockpile is drawn through in four distinct phases, forming temporary face-up stacks side-by-side. 
  * Phase 1: Draw cards one at a time to form 4 temporary stacks.
  * Phase 2: Form 3 temporary stacks.
  * Phase 3: Form 2 temporary stacks.
  * Phase 4 (Final): Form 1 temporary stack.
* **Playing:** The top cards of any temporary stacks are available to be played onto the Foundations, King Piles, or Tableau piles.
* **Consolidation:** Once the Stockpile is exhausted in a phase, the temporary stacks are consolidated (stacked on top of each other from right to left) and turned face-down to form the new Stockpile for the next phase. After the 4th phase, no more passes are allowed.

## 4. Winning and Losing
* **Winning:** The game is won when all 104 cards have been successfully built into eight complete suit sequences and set aside.
* **Losing:** The game is lost if no more legal moves can be made, and the Stockpile has been exhausted of all its drawing passes.

---
*Based on the original Kloudio Solitaire document by Claudio R. Otero-Garin, updated to reflect the official gameplay rules.*
