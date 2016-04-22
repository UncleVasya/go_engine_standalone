# python3

import sys

from Bot.go import Go

from Bot.bot import Bot


def __main__():
    bot = Bot()
    game = Go()
    game.run(bot)

__main__()
