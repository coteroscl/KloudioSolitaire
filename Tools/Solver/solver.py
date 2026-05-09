import math

SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

def get_rank_val(card):
    return RANKS.index(card['rank']) + 1

def get_color(card):
    return 'red' if card['suit'] in ['hearts', 'diamonds'] else 'black'

def mulberry32(seed):
    """
    Python implementation of Mulberry32 PRNG.
    Produces the exact same float sequence as the JS implementation.
    """
    def rng():
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = seed
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)
        t = (t ^ (t >> 14)) & 0xFFFFFFFF
        return t / 4294967296.0
    return rng

def create_deck(num_decks=2):
    cards = []
    for _ in range(num_decks):
        for suit in SUITS:
            for rank in RANKS:
                cards.append({'suit': suit, 'rank': rank})
    return cards

def shuffle_deck(arr, rng):
    for i in range(len(arr) - 1, 0, -1):
        j = math.floor(rng() * (i + 1))
        arr[i], arr[j] = arr[j], arr[i]
    return arr

def winnable_shuffle(deck, rng):
    # Match the JS winnableShuffle logic exactly to ensure seed parity
    aces = [c for c in deck if c['rank'] == 'A']
    twos = [c for c in deck if c['rank'] == '2']
    rest = [c for c in deck if c['rank'] not in ['A', '2']]
    
    shuffle_deck(rest, rng)
    
    winnable_deck = []
    for _ in range(4): winnable_deck.append(aces.pop())
    for _ in range(8): winnable_deck.append(rest.pop())
    for _ in range(40): winnable_deck.append(rest.pop())
    
    for _ in range(4):
        if aces: winnable_deck.append(aces.pop())
        if twos: winnable_deck.append(twos.pop())
        
    winnable_deck.extend(aces)
    winnable_deck.extend(twos)
    winnable_deck.extend(rest)
    return winnable_deck

class GameState:
    def __init__(self, reserves, tableaus, stockpile):
        self.reserves = reserves
        self.tableaus = tableaus
        self.stockpile = stockpile
        self.temp_stacks = []
        self.central_foundation = []
        self.king_foundations = [[], [], [], []]
        self.phase = 1

    def serialize(self):
        # Creates a unique string for the current board to detect loops
        def hash_pile(pile):
            return "".join([c['rank'] + c['suit'][0] for c in pile])
        
        state_str = "C:" + hash_pile(self.central_foundation) + "|"
        state_str += "K:" + ",".join([hash_pile(k) for k in self.king_foundations]) + "|"
        state_str += "T:" + ",".join([hash_pile(t) for t in self.tableaus]) + "|"
        state_str += "R:" + ",".join([str(len(r)) for r in self.reserves]) + "|"
        state_str += "S:" + str(len(self.stockpile)) + "|"
        state_str += "P:" + str(self.phase)
        return state_str

    def is_win(self):
        return len(self.central_foundation) + sum(len(k) for k in self.king_foundations) == 104

def can_move_to_center(card, central_foundation):
    if not central_foundation:
        return card['rank'] == 'A'
    top = central_foundation[-1]
    return card['suit'] == top['suit'] and get_rank_val(card) == get_rank_val(top) + 1

def can_move_to_king(card, king_foundation):
    if not king_foundation:
        return card['rank'] == 'K'
    top = king_foundation[-1]
    return card['suit'] == top['suit'] and get_rank_val(card) == get_rank_val(top) - 1

def can_move_to_tableau(cards, tableau):
    if not cards: return False
    if not tableau: return True
    top = tableau[-1]
    bottom = cards[0]
    return get_color(bottom) != get_color(top) and get_rank_val(bottom) == get_rank_val(top) - 1

def is_valid_sequence(cards):
    if len(cards) <= 1: return True
    for i in range(len(cards) - 1):
        if get_color(cards[i]) == get_color(cards[i+1]): return False
        if get_rank_val(cards[i+1]) != get_rank_val(cards[i]) - 1: return False
    return True

def get_possible_moves(state):
    moves = []
    
    # Check Tableaus as Source
    for i in range(4):
        if not state.tableaus[i]:
            if state.reserves[i]:
                moves.append({'type': 'flip_reserve', 'idx': i})
            continue
            
        top_card = state.tableaus[i][-1]
        
        if can_move_to_center(top_card, state.central_foundation):
            moves.append({'type': 'tableau_to_center', 'from_idx': i})
            
        for k in range(4):
            if can_move_to_king(top_card, state.king_foundations[k]):
                moves.append({'type': 'tableau_to_king', 'from_idx': i, 'to_idx': k})
                
        # Tableau sequence moving
        for j in range(len(state.tableaus[i])):
            seq = state.tableaus[i][j:]
            if is_valid_sequence(seq):
                for target_t in range(4):
                    if i != target_t and can_move_to_tableau(seq, state.tableaus[target_t]):
                        moves.append({'type': 'tableau_to_tableau', 'from_idx': i, 'to_idx': target_t, 'count': len(seq)})

    # Check Temp Stacks as Source
    for i, t_stack in enumerate(state.temp_stacks):
        if not t_stack: continue
        top_card = t_stack[-1]
        
        if can_move_to_center(top_card, state.central_foundation):
            moves.append({'type': 'temp_to_center', 'from_idx': i})
            
        for k in range(4):
            if can_move_to_king(top_card, state.king_foundations[k]):
                moves.append({'type': 'temp_to_king', 'from_idx': i, 'to_idx': k})
                
        for t in range(4):
            if can_move_to_tableau([top_card], state.tableaus[t]):
                moves.append({'type': 'temp_to_tableau', 'from_idx': i, 'to_idx': t})

    # Draw from Stockpile / Consolidate
    if state.stockpile or state.phase <= 4:
        moves.append({'type': 'draw_stock'})
        
    return moves

import copy

def apply_move(state, move):
    new_state = copy.deepcopy(state)
    t = move['type']
    
    if t == 'tableau_to_center':
        new_state.central_foundation.append(new_state.tableaus[move['from_idx']].pop())
    elif t == 'tableau_to_king':
        new_state.king_foundations[move['to_idx']].append(new_state.tableaus[move['from_idx']].pop())
    elif t == 'tableau_to_tableau':
        count = move['count']
        cards = new_state.tableaus[move['from_idx']][-count:]
        del new_state.tableaus[move['from_idx']][-count:]
        new_state.tableaus[move['to_idx']].extend(cards)
    elif t == 'temp_to_center':
        new_state.central_foundation.append(new_state.temp_stacks[move['from_idx']].pop())
    elif t == 'temp_to_king':
        new_state.king_foundations[move['to_idx']].append(new_state.temp_stacks[move['from_idx']].pop())
    elif t == 'temp_to_tableau':
        new_state.tableaus[move['to_idx']].append(new_state.temp_stacks[move['from_idx']].pop())
    elif t == 'flip_reserve':
        card = new_state.reserves[move['idx']].pop()
        card['faceUp'] = True
        new_state.tableaus[move['idx']].append(card)
    elif t == 'draw_stock':
        if not new_state.stockpile and new_state.phase <= 4:
            # Consolidate Phase
            new_stock = []
            for stack in reversed(new_state.temp_stacks):
                for card in stack:
                    card['faceUp'] = False
                    new_stock.append(card)
            new_stock.reverse()
            new_state.stockpile = new_stock
            new_state.temp_stacks = []
            new_state.phase += 1
        else:
            if new_state.phase <= 4:
                num_to_draw = 5 - new_state.phase
                if not new_state.temp_stacks:
                    new_state.temp_stacks = [[] for _ in range(num_to_draw)]
                for i in range(num_to_draw):
                    if new_state.stockpile:
                        card = new_state.stockpile.pop()
                        card['faceUp'] = True
                        new_state.temp_stacks[i].append(card)
                        
    return new_state

def play_game(seed):
    """
    Simulates a game of Kloudio Solitaire.
    Returns True if winnable, False otherwise.
    """
    rng = mulberry32(seed)
    deck = winnable_shuffle(create_deck(2), rng)
    
    # Initialize Game State
    reserves = [deck[i*10:(i+1)*10] for i in range(4)]
    idx = 40
    tableaus = [deck[idx+i*3:idx+(i+1)*3] for i in range(4)]
    idx += 12
    stockpile = deck[idx:]
    
    initial_state = GameState(reserves, tableaus, stockpile)
    
    # DFS Search
    stack = [initial_state]
    visited = set()
    
    while stack:
        current_state = stack.pop()
        
        if current_state.is_win():
            return True
            
        state_hash = current_state.serialize()
        if state_hash in visited:
            continue
        visited.add(state_hash)
        
        moves = get_possible_moves(current_state)
        for move in moves:
            new_state = apply_move(current_state, move)
            stack.append(new_state)
            
    return False

if __name__ == "__main__":
    print("Kloudio Solitaire Seed Finder")
    print("Hunting for winnable seeds...")
    
    # Test generation
    winnable_seeds = []
    for seed in range(1, 100):
        if play_game(seed):
            winnable_seeds.append(seed)
            print(f"Found winnable seed: #{seed}")
            
    print("Done. Found", len(winnable_seeds), "winnable seeds.")
