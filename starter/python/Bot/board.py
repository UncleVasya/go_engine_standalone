import copy

EMPTY, FRIEND, ENEMY, LIBERTY, KO = [0, 1, 2, 3, -1]

ADJACENT = [
    (-1, 0),
    (0, 1),
    (1, 0),
    (0, -1)
]

KO_BOARDS = 11 # How many previous board positions to store for ko prevention

class Board:

    def __init__(self, friend_id, width, height):
        self.friend_id = friend_id
        self.width = width
        self.height = height
        self.cell = [[EMPTY for col in range (0, width)] for row in range(0, height)]
        self.prev_cells = [None for i in range (0, KO_BOARDS)]

    def int_to_cell(self, i):
        if i == 0:
            return EMPTY
        elif i == -1:
            return KO
        elif i == self.friend_id:
            return FRIEND
        else:
            return ENEMY

    def parse(self, data):
        cells = data.split(',')
        col = 0
        row = 0
        for cell in cells:
            if (col >= self.width):
                col = 0
                row +=1
            self.cell[row][col] = self.int_to_cell(int(cell))
            col += 1

    def valid_step(self, offset, target):
        ro, co = offset
        row, col = target
        tr = row + ro
        tc = col + co
        valid = True
        if (tr < 0) or (tr >= self.height) or (tc < 0) or (tc >= self.width):
            valid = False
        return (valid, (tr, tc))

    def get_adjacent(self, row, col):
        return [self.valid_step((r, c), (row, col)) for (r, c) in ADJACENT]

    def not_suicide(self, row, col):
        dfs = DepthFirstSearch(self)
        dfs.flood_fill_default(FRIEND, row, col)
        if EMPTY in dfs.reached:
            return True
        else:
            return self.is_capture(row, col)

    def is_capture(self, row, col):
        dfs = DepthFirstSearch(self)
        is_cap = False
        prev_color = self.cell[row][col]
        self.cell[row][col] = FRIEND
        for (valid, (ar, ac)) in self.get_adjacent(row, col):
            if valid and self.cell[row][col] != self.cell[ar][ac] and self.cell[ar][ac] != EMPTY:
                dfs.refresh()
                dfs.flood_fill(ar, ac)
                if EMPTY not in dfs.reached:
                    is_cap = True
        self.cell[row][col] = prev_color
        return is_cap

    # Check whether all cells in c2 match self.cell array
    def cells_match(self, c2):
        c1 = self.cell
        if (c1 == None) or (c2 == None): 
            return False
        else:
            result = True
            try:
                for (count_row, row) in enumerate(c1):
                    if result == False:
                        break
                    for (count_col, cell) in enumerate(row):
                        if cell != c2[count_row][count_col]:
                            result = False
                            break
            except: result = False
            return result

    def remove_pieces(self, to_remove):
        for (row, col) in to_remove:
            self.cell[row][col] = EMPTY
            
    def place_move(self, owner, row, col):
        self.cell[row][col] = owner
        dfs = DepthFirstSearch(self)
        is_cap = False
        to_remove = []
        for (valid, (ar, ac)) in self.get_adjacent(row, col):
            if valid and not self.cell[row][col] == self.cell[ar][ac] and not self.cell[ar][ac] == EMPTY:
                dfs.refresh()
                dfs.flood_fill(ar, ac)
                if EMPTY not in dfs.reached:
                    to_remove = to_remove + dfs.matched
        self.remove_pieces(to_remove)

    def not_ko(self, row, col):
        return self.cell[row][col] != KO
        # This works for determining ko when it isn't given by the engine.
        # With the new engine updates, it isn't necessary.
#        if self.is_capture(row, col):
#            tcell = copy.deepcopy(self.cell)
#            tboard = Board(self.friend_id, self.width, self.height)
#            tboard.cell = tcell
#            tboard.place_move(FRIEND, row, col)
#            ko = False
#            for pboard in self.prev_cells:
#                if tboard.cells_match (pboard):
#                    ko = True
#            return not ko
#        else: return True

    def legal_moves(self):
        legal = []
        for (ri, row) in enumerate(self.cell):
            for (ci, cell) in enumerate(row):
                # Ko check already done by cell == EMPTY requirement when
                # using new updated engine.
                if cell == EMPTY and self.not_suicide(ri, ci): #and self.not_ko(ri, ci):
                    legal.append((ri, ci))
        return legal
        
    def not_fill_own_eye(self, mv):
        """ This assumes that (mv) is an empty tile """
        result = False
        sr, sc = mv
        for (valid, (row, col)) in self.get_adjacent(sr, sc):
            if valid and self.cell[row][col] != FRIEND:
                result = True
        return result
                

    def push_state(self):
        limit = len(self.prev_cells) - 1
        for count in range(0, limit):
            index = limit - count
            self.prev_cells[index] = self.prev_cells[index - 1]
        self.prev_cells[0] = copy.deepcopy(self.cell)
            

# End of Board class


class DepthFirstSearch:

    def __init__(self, board):
        self.board = board
        self.visited = [[False for cell in row] for row in board.cell]
        self.reached = []
        self.matched = []

    def search_step(self, fillval, loc):
        row, col = loc
        if not self.visited[row][col]:
            self.visited[row][col] = True
            if self.board.cell[row][col] == fillval:
                self.matched.append((row, col))
                adjacents = self.board.get_adjacent(row, col)
                for (valid, target) in adjacents:
                    if valid:
                        self.search_step (fillval, target)
            else:
                reached = self.board.cell[row][col]
                if reached not in self.reached:
                    self.reached.append(reached)

    def flood_fill(self, row, col):
        fillval = self.board.cell[row][col]
        self.search_step(fillval, (row, col))
        
    def flood_fill_default(self, hcolor, row, col):
        prev_val = self.board.cell[row][col]
        self.board.cell[row][col] = hcolor
        self.search_step(hcolor, (row, col))
        self.board.cell[row][col] = prev_val
        
    def refresh(self):
        self.visited = [[False for cell in row] for row in self.board.cell]
        self.reached = []
        self.matched = []
        
