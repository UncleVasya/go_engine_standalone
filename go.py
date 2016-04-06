#!/usr/bin/env python3

from random import randrange, choice, shuffle, randint, seed, random
from math import cos, pi, sin, sqrt, atan
from collections import deque, defaultdict

from fractions import Fraction
import operator
from game import Game
from copy import deepcopy
import board

try:
    from sys import maxint
except ImportError:
    from sys import maxsize as maxint


class Go(Game):
    def __init__(self, options=None):
        self.last_move = None
        self.cutoff = None
        self.timebank = 0
        if 'timebank' in options:
            self.timebank = int(options['timebank'])
        self.time_per_move = int(options['time_per_move'])
        self.player_names = options['player_names']
        self.use_player_names = ["Player1", "Player2"]
        self.engine_seed = options.get('engine_seed',
            randint(-maxint-1, maxint))
        self.player_seed = options.get('player_seed',
            randint(-maxint-1, maxint))
        self.field_width = options.get('field_width',19)
        self.field_height = options.get('field_height',19)

        seed(self.engine_seed)
#        self.field = [ EMPTY for j in range(0, self.field_width * self.field_height) ]

        self.turn = 0
        self.turn_limit = options.get('turns', 500)
        self.num_players = 2 # map_data["players"]
        self.player_to_begin = randint(0, self.num_players)
        # used to cutoff games early
        self.cutoff_turns = 0
        # used to calculate the turn when the winner took the lead
        self.winning_bot = None
        self.winning_turn = 0
        # used to calculate when the player rank last changed
        self.ranking_bots = None
        self.ranking_turn = 0

        self.consecutive_passes = 0
        #self.field = board.Board(self.field_width, self.field_height)
        self.board = board.Board(self.field_width, self.field_height)

        # initialize scores
        self.score = [0]*self.num_players
        self.bonus = [0]*self.num_players
        self.score_history = [[s] for s in self.score]

        # used to track dead players, ants may still exist, but orders are not processed # Ants?
        self.killed = [False for _ in range(self.num_players)]

        # used to give a different ordering of players to each player;
        # initialized to ensure that each player thinks they are player 0
        self.switch = [[None]*self.num_players + list(range(-5,0))
                       for i in range(self.num_players)]
        for i in range(self.num_players):
            self.switch[i][i] = 0

        # the engine may kill players before the game starts and this is needed
        # to prevent errors
        self.orders = [[] for i in range(self.num_players)]

        ### collect turns for the replay
        self.replay_data = []

    def output_cell (self, cell):
        return str(cell)

    def string_field (self, field):
        return ','.join([self.output_cell (cell) for cell in field.collapse_array()])

    def render_changes(self, player, time_to_move):
        """ Create a string which communicates the updates to the state
        """
        updates = self.get_state_changes(time_to_move)
        visible_updates = []
        # next list all transient objects
        for update in updates:
            visible_updates.append(update)
        visible_updates.append([]) # newline
        return '\n'.join(' '.join(map(str,s)) for s in visible_updates)

    def get_state_changes(self, time_to_move):
        """ Return a list of all transient objects on the map.

        """
        changes = []
        changes.extend([['update game round', int(self.turn / 2)]])
        changes.extend([['update game move', self.turn]])
        changes.extend([['update game field', self.board.to_csv()]])
        if self.last_move:
            row, col = self.last_move
            changes.extend([['update game last_move', row, col]])
        elif self.turn > 1:
            changes.extend([['update game last_move pass']])
        return changes

    def parse_orders(self, player, lines):
        """ Parse orders from the given player
        """
        orders = []
        valid = []
        ignored = []
        invalid = []

        for line in lines:
            line = line.strip().lower()
            # ignore blank lines and comments
            if not line: # or line[0] == '#':
                continue

            if line[0] == '#':
                ignored.append((line))
                continue

            data = line.split()

            # validate data format
            if data[0] != 'place_move' and data[0] != 'pass':
                invalid.append((line, 'unknown action'))
                continue
            elif data[0] == 'pass':
                print("PASS!")
                self.last_move = None
                self.consecutive_passes += 1
                continue
            else:
                row, col = data[1:]

            # validate the data types
            try:
                row, col = int(row), int(col)
                orders.append((player, row, col))
                valid.append(line)

            except ValueError:
                invalid.append((line, "row and col should be integers"))
                continue

        return orders, valid, ignored, invalid



    def bots_to_play(self, turn):
        """ Indices of the bots who should receive the game state and return orders now """
        if turn == 0: return [0, 1]
        else: return [(turn + 1) % 2]


    def place_move(self, move):
        self.board.text_board()
        print("\n")
        (player_id, col, row) = move
        owner = board.PLAYER2
        if player_id == 0:
            owner = board.PLAYER1

        if (row, col) in self.board.legal_moves(owner):
            self.last_move = (row, col)
            self.consecutive_passes = 0
            self.board.place_move(owner, row, col)
            self.board.push_state()
        else:
            print("PASS due to illegal move! " + str(move))
            self.last_move = None
            self.consecutive_passes += 1
        self.board.text_board()
#        print(self.board.to_csv())

    def do_orders(self):
        """ Execute player orders and handle conflicts
        """
        player = self.bots_to_play(self.turn)[0]
        if self.is_alive(player):
            if len(self.orders[player]) > 0:
                self.place_move (self.orders[player][0])
        else:
            pass

    # Common functions for all games

    def game_won(self):
        return scores[0] != scores[1] and self.game_over()

    def game_over(self):
        """ Determine if the game is over

            Used by the engine to determine when to finish the game.
            A game is over when there are no players remaining, or a single
              winner remaining.
        """
        if len(self.remaining_players()) < 1:
            self.cutoff = 'extermination'
            return True
        elif len(self.remaining_players()) == 1:
            self.cutoff = 'lone survivor'
            return True
        elif self.consecutive_passes > 1:
            self.cutoff = "agreement"
            return True
        elif self.turn > self.turn_limit:
            self.cutoff = "turn limit exceeded"
            return True
        else: return False

    def kill_player(self, player):
        """ Used by engine to signal that a player is out of the game """
        self.killed[player] = True

    def start_game(self):
        """ Called by engine at the start of the game """
        self.game_started = True
        
        ### append turn 0 to replay
        self.replay_data.append( self.get_state_changes(self.time_per_move) )
        result = []

    def score_game(self):
        return self.board.count_scores() #[0, 0]

    def finish_game(self):
        """ Called by engine at the end of the game """

        self.score = self.score_game()
        self.calc_significant_turns()
        for i, s in enumerate(self.score):
            self.score_history[i].append(s)
        self.replay_data.append( self.get_state_changes(self.time_per_move) )

        # check if a rule change lengthens games needlessly
        if self.cutoff is None:
            self.cutoff = 'turn limit reached'

    def start_turn(self):
        """ Called by engine at the start of the turn """
        self.turn += 1
#        self.text_board()
#        self.text_macroboard()
        self.orders = [[] for _ in range(self.num_players)]

    def finish_turn(self):
        """ Called by engine at the end of the turn """
        self.do_orders()
        self.score = self.board.count_scores()
        # record score in score history
        for i, s in enumerate(self.score):
            if self.is_alive(i):
                self.score_history[i].append(s)
            elif s != self.score_history[i][-1]:
                # score has changed, increase history length to proper amount
                last_score = self.score_history[i][-1]
                score_len = len(self.score_history[i])
                self.score_history[i].extend([last_score]*(self.turn-score_len))
                self.score_history[i].append(s)
        self.calc_significant_turns()

        ### append turn to replay
        self.replay_data.append( self.get_state_changes(self.time_per_move) )

    def calc_significant_turns(self):
        ranking_bots = [sorted(self.score, reverse=True).index(x) for x in self.score]
        if self.ranking_bots != ranking_bots:
            self.ranking_turn = self.turn
        self.ranking_bots = ranking_bots

        winning_bot = [p for p in range(len(self.score)) if self.score[p] == max(self.score)]
        if self.winning_bot != winning_bot:
            self.winning_turn = self.turn
        self.winning_bot = winning_bot

    def get_state(self):
        """ Get all state changes

            Used by engine for streaming playback
        """
        updates = self.get_state_changes()
        updates.append([]) # newline
        return '\n'.join(' '.join(map(str,s)) for s in updates)

    def get_player_start(self, player=None):
        """ Get game parameters visible to players

            Used by engine to send bots startup info on turn 0
        """
        result = []
        result.append(['settings timebank', self.timebank])
        result.append(['settings time_per_move', self.time_per_move])
        result.append(['settings player_names', ','.join(self.use_player_names)])
        if player:
            result.append(['settings your_bot', self.use_player_names[player]])
        result.append(['settings your_botid', player + 1])
        result.append(['settings field_width', self.field_width])
        result.append(['settings field_height', self.field_height])

        result.append(['settings player_seed', self.player_seed])
        result.append(['settings max_rounds', int(self.turn_limit / 2)])

        result.append([]) # newline
        pen = '\n'.join(' '.join(map(str,s)) for s in result)
        return pen #+ message #+ 'ready\n'

    def get_player_state(self, player, time_to_move):
        """ Get state changes visible to player

            Used by engine to send state to bots
        """
        points_update0 = "update " + self.use_player_names[0] + " points " + str(self.score[0]) + "\n"
        points_update1 = "update " + self.use_player_names[1] + " points " + str(self.score[1]) + "\n"
        return self.render_changes(player, time_to_move) + points_update1 + points_update0 + 'action move ' +  str(int(time_to_move * 1000)) + '\n'

    def is_alive(self, player):
        """ Determine if player is still alive

            Used by engine to determine players still in the game
        """
        if self.killed[player]:
            return False
        else:
            return True

    def get_error(self, player):
        """ Returns the reason a player was killed

            Used by engine to report the error that kicked a player
              from the game
        """
        return ''

    def do_moves(self, player, moves):
        """ Called by engine to give latest player orders """
        orders, valid, ignored, invalid = self.parse_orders(player, moves)
        self.orders[player] = orders
        return valid, ['%s # %s' % ignore for ignore in ignored], ['%s # %s' % error for error in invalid]

    def get_scores(self, player=None):
        """ Gets the scores of all players

            Used by engine for ranking
        """
        return self.score_game()

    def order_for_player(self, player, data):
        """ Orders a list of items for a players perspective of player #

            Used by engine for ending bot states
        """
        s = self.switch[player]
        return [None if i not in s else data[s.index(i)]
                for i in range(max(len(data),self.num_players))]

    def remaining_players(self):
        """ Return the players still alive """
        return [p for p in range(self.num_players) if self.is_alive(p)]

    def get_stats(self):
        """  Used by engine to report stats
        """
        stats = {}
        return stats

    def get_replay(self):
        """ Return a summary of the entire game

            Used by the engine to create a replay file which may be used
            to replay the game.
        """
        replay = {}
        # required params
        replay['revision'] = 1
        replay['players'] = self.num_players

        # optional params
        replay['loadtime'] = self.timebank
        replay['turntime'] = self.time_per_move
        replay['turns'] = self.turn
        replay['engine_seed'] = self.engine_seed
        replay['player_seed'] = self.player_seed

        # scores
        replay['scores'] = self.score_history
        replay['bonus'] = self.bonus
        replay['winning_turn'] = self.winning_turn
        replay['ranking_turn'] = self.ranking_turn
        replay['cutoff'] =  self.cutoff

        
        ### 
        replay['data'] = self.replay_data
        return replay


    def bot_input_finished(self, line):
        return line.lower().startswith('place_move') or line.lower().startswith('pass')

