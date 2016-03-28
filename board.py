import copy

EMPTY, PLAYER1, PLAYER2, KO, LIBERTY = range(0, 5)

ADJACENT = [
    (-1, 0),
    (0, 1),
    (1, 0),
    (0, -1)
]

class Board:

    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.cell = [[EMPTY for col in range (0, width)] for row in range(0, height)]
        self.prev_cells = [None for i in range (0, 11)]

    def int_to_cell(self, i):
        if i == 0:
            return EMPTY
        elif i == 1:
            return PLAYER1
        elif i == 2:
            return PLAYER2
        elif i == 3:
            return KO
        else:
            return LIBERTY

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

    def not_suicide(self, player, row, col):
        dfs = DepthFirstSearch(self)
        dfs.flood_fill_default(player, row, col)
        if EMPTY in dfs.reached:
            return True
        else:
            return self.is_capture(player, row, col)

    def is_capture(self, player, row, col):
        dfs = DepthFirstSearch(self)
        is_cap = False
        prev_color = self.cell[row][col]
        self.cell[row][col] = player
        for (valid, (ar, ac)) in self.get_adjacent(row, col):
            if valid and self.cell[row][col] != self.cell[ar][ac] and self.cell[ar][ac] != EMPTY:
                dfs.refresh()
                dfs.flood_fill(ar, ac)
                if EMPTY not in dfs.reached:
                    is_cap = True
        self.cell[row][col] = prev_color
        return is_cap

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

    def count_scores(self):
        already_counted = []
        scores = [0,0]
        dfs = DepthFirstSearch(self)
        for ir, row in enumerate(self.cell):
            for ic, cell in enumerate(row):
                if cell == 0 and (ir, ic) not in already_counted:
                    dfs.flood_fill(ir, ic)
                    already_counted += dfs.matched
                    if len(dfs.reached) == 1:
                        if dfs.reached[0] == 1:
                            scores[0] += len(dfs.matched)
                        elif dfs.reached[0] == 2:
                            scores[1] += len(dfs.matched)
                    dfs.refresh()
                elif cell == 1:
                    scores[0] += 1
                elif cell == 2:
                    scores[1] += 1
        print("scores = " + str(scores))
        return scores
                

    def not_ko(self, player, row, col):
        if self.is_capture(player, row, col):
            tcell = copy.deepcopy(self.cell)
            tboard = Board(self.width, self.height)
            tboard.cell = tcell
            tboard.place_move(player, row, col)
            ko = False
            for pboard in self.prev_cells:
                if tboard.cells_match (pboard):
                    ko = True
            return not ko
        else: return True

    def legal_moves(self, player):
        legal = []
        for (ri, row) in enumerate(self.cell):
            for (ci, cell) in enumerate(row):
                if cell == EMPTY and self.not_suicide(player, ri, ci) and self.not_ko(player, ri, ci):
                    legal.append((ri, ci))
        return legal

    def collapse_array(self):
        return [cell for row in self.cell for cell in row]
        

    def push_state(self):
        limit = len(self.prev_cells) - 1
        for count in range(0, limit):
            index = limit - count
            self.prev_cells[index] = self.prev_cells[index - 1]
        self.prev_cells[0] = copy.deepcopy(self.cell)
            
    def board_symbol(self, cell):
        if cell == EMPTY:
            return "."
        elif cell == PLAYER1:
            return "o"
        elif cell == PLAYER2:
            return "x"
        else:
            return '-'

    def text_board(self):
        output = ""
        for row in self.cell:
            output = " ".join([self.board_symbol(i) for i in row])
            print(output)

    def cell_for_csv(self, cell):
        if cell == EMPTY:
            return "0"
        elif cell == PLAYER1:
            return "1"
        elif cell == PLAYER2:
            return "2"
        else:
            print("WARNING: cell_for_csv received " + str(cell))
            return "0"

    def to_csv(self):
        arr = []
        for row in self.cell:
            for cell in row:
                arr.append(self.cell_for_csv(cell))
        return ",".join(arr)


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
        
