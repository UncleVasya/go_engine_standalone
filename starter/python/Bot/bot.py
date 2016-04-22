import random

class Bot:


    def __init__(self):
        self.game = None

    def setup(self, game):
        self.game = game

    def do_turn(self):
        legal = self.game.field.legal_moves()
        desirable = list(filter(self.game.field.not_fill_own_eye, legal))
        if len(desirable) == 0:
            self.game.issue_order_pass()
        else:
            chosen = random.choice(desirable)
            self.game.issue_order(chosen)

