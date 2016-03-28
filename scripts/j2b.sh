#!/bin/sh

./playgame.py --verbose --fill --log_input --log_output --log_error \
--log_dir game_logs  --log_stderr --turns 200 --turntime 20 \
./starter.native ./mc001.native
#./starter/ocaml/main.native ./starter/ocaml/main.native
#--map_file maps/tron_00.map \

