/**
 * Loads a replay or map in text form. The streaming format is not supported directly, but can by
 * loaded by the Java wrapper. In the visualizer, cells are unique objects, that are mostly a list of
 * animation key-frames that are interpolated for any given time to produce a "tick-less" animation.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @class The replay class loads a replay or map in string form and prepares it for playback. All
 *        per turn data is lazily evaluated to avoid long load times. The Java wrapper has some
 *        extensions to load streaming replays. Make sure changes here don't break it.
 *
 * @constructor
 * @param {String} params.replay
 *        The replay or map text.
 * @param {Boolean} params.debug
 *        If true, then partially corrupt replays are loaded instead of throwing an error.
 * @param {String} params.highlightUser
 *        The user with this ID (usually a database index) in the replay will get the first
 *        color in the player colors array.
 * @see Options#user
 * @see #addMissingMetaData
 * @see Cell
 */
function Replay(params) {
	var i, highlightPlayer, n, p;
	/**
	 * @private
	 */
	this.debug = params.debug || false;
    this.colorTheme = COLOR_THEMES[params.colorTheme];
	if (!params.replay && !params.meta) {
		// This code path is taken by the Java wrapper for streaming replay and initializes only the
		// basics. Most of the rest is faster done in native Java, than through Rhino.
		this.meta = {};
		this.meta['challenge'] = 'go';
		this.meta['replayformat'] = format;
		this.meta['replaydata'] = {
			'map' : {},
			'cells' : []
		};
		this.duration = -1;
		this.hasDuration = true;
		this.aniCells = [];
	} else {
        this.parseReplay(params.replay);
        this.buildCellsList();

        var cells = this.meta['replaydata']['cells'];

        // prepare score and count lists
        this['scores'] = new Array(this.duration + 1);
        this['counts'] = new Array(this.duration + 1);
        this['stores'] = new Array(this.duration + 1);
        for (n = 0; n < this.duration + 1; ++n) {
            this['scores'][n] = new Array(this.players);
            for (i = 0; i < this.players; i++)
                this['scores'][n][i] = 0;

            this['counts'][n] = new Array(this.players);
            for (i = 0; i < this.players; i++)
                this['counts'][n][i] = 0;

            this['stores'][n] = new Array(this.players);
            for (i = 0; i < this.players; i++)
                this['stores'][n][i] = 0;
        }

        for (i = 0; i < this.players; i++) {
            // convert scores from per-player to per-turn
            var player_scores = this.meta['replaydata']['scores'][i];
            for (var k = 0; k < this.duration + 1; k++) {
                this['scores'][k][i] = player_scores[k];
            }
        }

        // TODO: discuss with Smiley how to deal with
        // Player 1 having 361 score after placing 1st cell.
        this.scores[1][0] = 1;

        // calculate cell counts per turn per player
        for (i = 0; i < cells.length; i++) {
            for (n = cells[i][2]; n < cells[i][4]; n++) {
                this['counts'][n][cells[i][3]]++;
            }
        }
         // prepare caches
        this.aniCells =  new Array(cells.length);
        this.turns = new Array(this.duration + 1);
        this.aliveCells = new Array(this.duration + 1);
    }
    this.hasDuration = this.duration > 0 || this.meta['replaydata']['turns'] > 0;

    // add missing meta data
    highlightPlayer = undefined;
    if (this.meta['user_ids']) {
        highlightPlayer = this.meta['user_ids'].indexOf(params.highlightUser, 0);
        if (highlightPlayer === -1) highlightPlayer = undefined;
    }
    this.addMissingMetaData(highlightPlayer);
}

Replay.prototype.parseReplay = function(replay) {
    var format = 'json';
	replay = JSON.parse(replay);

	// check if we have meta data or just replay data
	if (replay['challenge'] === undefined) {
		this.meta = {};
		this.meta['challenge'] = 'lightsout';
		this.meta['replayformat'] = format;
		this.meta['replaydata'] = replay;
	} else {
		this.meta = replay;
		replay = this.meta['replaydata'];
	}
	// validate meta data
	if (this.meta['challenge'] !== 'go') {
		throw new Error('This visualizer is for the Go challenge,' + ' but a "'
				+ this.meta['challenge'] + '" replay was loaded.');
	} else if (this.meta['replayformat'] !== format) {
		throw new Error('Replays in the format "' + this.meta['replayformat']
				+ '" are not supported.');
	}
	if (!replay) {
		throw new Error('replay meta data is no object notation');
	}

	// start validation process
	this.duration = 0;
	var that = this;

	// set up helper functions
	var stack = [];
	var keyEq = function(obj, key, val) {
		if (obj[key] !== val && !that.debug) {
			throw new Error(stack.join('.') + '.' + key + ' should be ' + val
					+ ', but was found to be ' + obj[key] + '!');
		}
	};
	var keyRange = function(obj, key, min, max) {
		if (!(obj[key] >= min && (obj[key] <= max || max === undefined)) && !that.debug) {
			throw new Error(stack.join('.') + '.' + key + ' should be within [' + min
					+ ' .. ' + max + '], but was found to be ' + obj[key] + '!');
		}
	};
	var keyIsArr = function(obj, key, minlen, maxlen) {
		if (!(obj[key] instanceof Array)) {
			throw new Error(stack.join('.') + '.' + key
					+ ' should be an array, but was found to be of type ' + typeof obj[key]
					+ '!');
		}
		stack.push(key);
		keyRange(obj[key], 'length', minlen, maxlen);
		stack.pop();
	};
	var keyIsStr = function(obj, key, minlen, maxlen) {
		if (typeof obj[key] !== 'string') {
			throw new Error(stack.join('.') + '.' + key
					+ ' should be a string, but was found to be of type ' + typeof obj[key]
					+ '!');
		}
		stack.push(key);
		keyRange(obj[key], 'length', minlen, maxlen);
		stack.pop();
	};
	var keyOption = function(obj, key, func, params) {
		if (obj[key] !== undefined) {
			func.apply(undefined, [ obj, key ].concat(params));
		}
	};
	var keyDefault = function(obj, key, def, func, params) {
		if (obj[key] === undefined) {
			obj[key] = def;
		}
		func.apply(undefined, [ obj, key ].concat(params));
	};
	var enterObj = function(obj, key) {
		if (!(obj[key] instanceof Object)) {
			throw new Error(stack.join('.') + '.' + key
					+ ' should be an object, but was found to be of type '
					+ typeof obj[key] + '!');
		}
		stack.push(key);
		return obj[key];
	};
	var durationSetter = null;
	var setReplayDuration = function(duration, fixed) {
		if (durationSetter) {
			if (!fixed && that.duration < duration || fixed && that.duration !== duration
					&& !that.debug) {
				throw new Error('Replay duration was previously set to ' + that.duration
						+ ' by "' + durationSetter + '" and is now redefined to be '
						+ duration + ' by "' + obj + '"');
			}
		} else {
			that.duration = Math.max(that.duration, duration);
			if (fixed) durationSetter = obj;
		}
	};

	// options
	enterObj(this.meta, 'replaydata');
	keyRange(replay, 'revision', 1, 1);
	this.revision = replay['revision'];
	keyRange(replay, 'players', 1, 2);
	this.players = replay['players'];

	// map
    this.rows = this.cols = 19; // Go game defaults
    if (replay['map']) {
        var map = enterObj(replay, 'map');
        keyIsArr(map, 'data', 1, undefined);
        stack.push('data');
        keyIsStr(map['data'], 0, 1, undefined);
        stack.pop();
        keyDefault(map, 'rows', map['data'].length, keyEq, [map['data'].length]);
        this.rows = map['rows'];
        keyDefault(map, 'cols', map['data'][0].length, keyEq, [map['data'][0].length]);
        this.cols = map['cols'];
        var mapdata = enterObj(map, 'data');
        var regex = /[^-01]/;
        for (var r = 0; r < mapdata.length; r++) {
            keyIsStr(mapdata, r, map['cols'], map['cols']);
            var maprow = String(mapdata[r]);
            var i;
            if ((i = maprow.search(regex)) !== -1 && !this.debug) {
                throw new Error('Invalid character "' + maprow.charAt(i)
                    + '" in map. Zero based row/col: ' + r + '/' + i);
            }
        }
        stack.pop(); // pop 'data'
        stack.pop(); // pop 'map'
    }

    // scores
    keyIsArr(replay, 'scores', this.players, this.players);

	// board positions and moves for every turn
    this.boards = [];
    this.moves = [];

    var place_move = new RegExp('update (.*) last_move place_move');
    var pass = new RegExp('update (.*) last_move pass');

	keyIsArr(replay, 'data', 0, undefined);
	stack.push('data');
	var turns = replay['data'];
	for (var n=0; n < turns.length; n++) {
        this.moves.push(null);

        // check that turn data is an array
        keyIsArr(turns, n, 3, 4);
		stack.push(n);

        var turn_data = turns[n];
        for (var i=0; i < turn_data.length; i++) {
            // check that turndata element is an array
            keyIsArr(turn_data, i, 1, 3);
            stack.push(i);

            // check that turndata element caption is a string
            var obj = turn_data[i];
            keyIsStr(obj, 0, 1, undefined);

            // board position
            if (obj[0] === 'update game field') {
                keyIsStr(obj, 1, 1, undefined);
                var board_cells = obj[1].split(',');

                var board = [];
                for (var row_num=0; row_num < this.rows; row_num++) {
                    var row = [];
                    for (var col_num=0; col_num < this.cols; col_num++) {
                        var pos = row_num * this.cols + col_num;
                        var cell_owner = Number(board_cells[pos]);
                        row.push(cell_owner);
                    }
                    board.push(row);
                }
                this.boards.push(board);
            }

            //last move
            if (place_move.test(obj[0])) {  // player placed a stone
                this.moves[n] = [obj[1], [obj[2]]];
            }
            else if (pass.test(obj[0])) {  // player passed
                this.moves[n] = 'pass';
            }
            stack.pop();
        }
		stack.pop();
	}
	stack.pop();

    // default Profile and Game urls for Smiley1983's TCP server
    if (this.meta['game_url'] === undefined) {
        this.meta['game_url'] = DEFAULT_GAME_URL;
    }
    if (this.meta['user_url'] === undefined) {
        this.meta['user_url'] = DEFAULT_USER_URL;
    }
    if (this.meta['user_ids'] === undefined) {
        this.meta['user_ids'] = this.meta['playernames'];
    }

    this.duration = Math.max.apply(null, this.meta['playerturns']);
};

/**
 * This method will parse board position of every turn
 * and build a single list of all cells involved in entire game.
 * For every cell it will add its spawn and death turns.
 *
 * This will also build list of KO positions.
 */
Replay.prototype.buildCellsList = function() {
    var EMPTY = 0;
    var row, col;
    var turn, cell, owner;
    var cells = this.meta['replaydata']['cells'] = [];
    var koCells = this.koCells = new Array(this.duration);
    var board;

    var state = new Array(this.rows);
    for (row = 0; row < this.rows; ++row)
        state[row] = new Array(this.cols);

    for (turn = 1 ; turn < this.duration; ++turn) {
        board = this.boards[turn];

        for (row = 0; row < this.rows; ++row) {
            for (col = 0; col < this.cols; ++col) {
                cell = state[row][col]; // cell state on previous turn
                if (cell && board[row][col] < 1) {
                    // cell died
                    cell[4] = turn;
                    state[row][col] = EMPTY;
                } else if (!cell && board[row][col] > 0) {
                    // new cell born
                    owner = board[row][col];
                    cell = [row, col, turn, owner-1, this.duration + 1];
                    cells.push(cell);
                    state[row][col] = cell;
                }
                // check for KO
                if (board[row][col] === -1) {
                    koCells[turn] = {row: row, col: col};
                }
            }
        }
    }
};

Replay.prototype.getCurrentPlayer = function(turn) {
    return turn % 2;
};

/**
 * Adds optional meta data to the replay as required. This includes default player names and colors.
 * 
 * @private
 * @param {Number} highlightPlayer
 *        The index of a player who's default color should be exchanged with the first
 *        player's color. This is useful to identify a selected player by its color (the first one
 *        in the PĹAYER_COLORS array).
 */
Replay.prototype.addMissingMetaData = function(highlightPlayer) {
	var i;
	if (!(this.meta['playernames'] instanceof Array)) {
		if (this.meta['players'] instanceof Array) {
			// move players to playernames in old replays
			this.meta['playernames'] = this.meta['players'];
			delete this.meta['players'];
		} else {
			this.meta['playernames'] = new Array(this.players);
		}
	}
	if (!(this.meta['playercolors'] instanceof Array)) {
		this.meta['playercolors'] = new Array(this.players);
	}
	if (!(this.meta['playerturns'] instanceof Array)) {
		this.meta['playerturns'] = new Array(this.players);
	}
	// setup player colors
	var rank;
    var rank_sorted;
	if (this.meta['challenge_rank']) {
        rank = this.meta['challenge_rank'].slice();
	}
    var COLOR_MAP;
	if (highlightPlayer !== undefined) {
		COLOR_MAP = COLOR_MAPS[this.players-1];
        rank.splice(highlightPlayer, 1);
	} else {
		COLOR_MAP = COLOR_MAPS[this.players];
	}
    if (rank) {
        rank_sorted = rank.slice().sort(function (a, b) { return a - b; });
    }

    var PLAYER_COLORS = this.colorTheme.PLAYER_COLORS;

    var adjust = 0;
	for (i = 0; i < this.players; i++) {
		if (!this.meta['playernames'][i]) {
			this.meta['playernames'][i] = 'player ' + (i + 1);
		}
		if (this.meta['replaydata']['scores'] && !this.meta['playerturns'][i]) {
			this.meta['playerturns'][i] = this.meta['replaydata']['scores'][i].length - 1;
		}
		if (!(this.meta['playercolors'][i] instanceof Array)) {
            var color;
            if (highlightPlayer !== undefined && i === highlightPlayer) {
                color = PLAYER_COLORS[COLOR_MAPS[0]];
                adjust = 1;
            } else {
                if (rank) {
                    var rank_i = rank_sorted.indexOf(rank[i - adjust]);
                    color = PLAYER_COLORS[COLOR_MAP[rank_i]];
                    rank_sorted[rank_i] = null;
                    
                } else {
                    color = PLAYER_COLORS[COLOR_MAP[i]];
                }
            }
            this.meta['playercolors'][i] = color = hsl_to_rgb(color);
		}
	}
	this.htmlPlayerColors = new Array(this.players);
	for (i = 0; i < this.players; i++) {
		this.htmlPlayerColors[i] = '#';
		this.htmlPlayerColors[i] += INT_TO_HEX[this.meta['playercolors'][i][0]];
		this.htmlPlayerColors[i] += INT_TO_HEX[this.meta['playercolors'][i][1]];
		this.htmlPlayerColors[i] += INT_TO_HEX[this.meta['playercolors'][i][2]];
	}
};

/**
 * Sets a new color scheme for replay.
 *
 * This clears cached cells and animation frames
 * cause they were colored with an old scheme.
 *
 * Also this re-setups player colors.
 *
 * @param {Number} colorTheme
 *        color theme id
 *
 * @param {Number} highlightPlayer
 *        The index of a player who's default color should be exchanged with the first
 *        player's color. This is useful to identify a selected player by its color (the first one
 *        in the PĹAYER_COLORS array).
 *
 */
Replay.prototype.setColorTheme = function(colorTheme, highlightPlayer) {
    this.colorTheme = COLOR_THEMES[colorTheme];

    // clear cached colored cells
    this.turns = [];
    this.aniCells = [];

    // re-setup player colors
    this.meta['playercolors'] = null;
    this.addMissingMetaData(highlightPlayer);
};

/**
 * Computes a list of visible cells for a given turn. This list is then used to render the
 * visualization.
 * <ul>
 * <li>The turns are computed on reqest.</li>
 * <li>The result is cached.</li>
 * <li>Turns are calculated iteratively so there is no quick random access to turn 1000.</li>
 * </ul>
 * 
 * @param {Number} n
 *        The requested turn.
 * @returns {Cell[]} The array of visible cells.
 */
Replay.prototype.getTurn = function(n) {
	var i, turn, cells, cell, aniCell, dead;
	if (this.turns[n] === undefined) {
		if (n !== 0) this.getTurn(n - 1);
		turn = this.turns[n] = [];
		// generate cells & keyframes
		cells = this.meta['replaydata']['cells'];
		for (i = 0; i < cells.length; i++) {
			cell = cells[i];
            var spawnTurn = cell[2];
			if (spawnTurn === n + 1 || n === 0 && spawnTurn === 0) {
				// spawn this cell
				aniCell = this.spawnCell(i, cell[0], cell[1], cell[2], cell[3]);
			} else if (this.aniCells[i]) {
				// load existing state
				aniCell = this.aniCells[i];
			} else {
				// continue with next cell
				continue;
			}

            // TODO: GoL is an easy game and maybe I can avoid need to pre-calculate previous turns.
            //       1) Rearrange check below to first check if we need to show this cell
            //       2) Add   if (!aniCell) this.SpawnCell(). So we don't rely on cell presence from prev. turns
            //       3) Original call to this.spawnCell() replace with    aniCell = this.aniCells[i] || this.spawnCell()

			dead = cell[4];
			if (dead === n + 1) {
				// end of life
				this.killCell(aniCell, dead);
			}
			if (dead > n || dead < 0) {
				// assign cell to display list
				turn.push(aniCell);
			}
		}
	}
	return this.turns[n];
};

/**
 * Spawns a new cell.
 * 
 * @param {Number} id
 *        Global cell id, an auto-incrementing number for each new cell. See {@link Config#label}
 * @param {Number} row
 *        Map row to spawn the cell on.
 * @param {Number} col
 *        Map column to spawn the cell on.
 * @param {Number} spawn
 *        Turn to spawn the cell at.
 * @param {Number} owner
 *        the owning player index
 * @returns {Cell} The new animation cell object.
 */
Replay.prototype.spawnCell = function(id, row, col, spawn, owner) {
    var aniCell = this.aniCells[id] = new Cell(id, spawn - 0.9);
	var color;
    var f = aniCell.frameAt(spawn - 0.9);

    if (owner === undefined)
        color = this.colorTheme.DEFAULT_CELL_COLOR;
    else
        color = this.meta['playercolors'][owner];

	aniCell.owner = owner;
	f['x'] = col;
	f['y'] = row;
	f['owner'] = owner;
	f['r'] = color[0];
	f['g'] = color[1];
	f['b'] = color[2];
	if (spawn !== 0) {
		f = aniCell.frameAt(spawn - 0.775);
        f['size'] = 1.0;
		f = aniCell.frameAt(spawn - 0.710);
		f['size'] = 1.5;
		f = aniCell.frameAt(spawn - 0.645);
		f['size'] = 0.7;
		f = aniCell.frameAt(spawn - 0.520);
	}
	f['size'] = 1.0;
	return aniCell;
};

/**
 * Animates a cell's death.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @private
 * @param {Cell} aniCell
 *        The cell to be worked on.
 * @param {Number} death
 *        The zero-based turn, that the cell died in.
 */
Replay.prototype.killCell = function(aniCell, death) {
    var owner = aniCell.frameAt(death)['owner'];
	var color = this.meta['playercolors'][owner];
	aniCell.fade('r', 255, death - 0.500, death - 0.375);
	aniCell.fade('g', 255, death - 0.500, death - 0.375);
	aniCell.fade('b', 255, death - 0.500, death - 0.375);
	aniCell.fade('r', color[0], death - 0.375, death - 0.250);
	aniCell.fade('g', color[1], death - 0.375, death - 0.250);
	aniCell.fade('b', color[2], death - 0.375, death - 0.250);
	aniCell.fade('r', 0.0, death - 0.250, death);
	aniCell.fade('g', 0.0, death - 0.250, death);
	aniCell.fade('b', 0.0, death - 0.250, death);
	aniCell.fade('size', 0.7, death - 0.500, death - 0.375);
	aniCell.fade('size', 0.0, death - 0.250, death);
	aniCell.death = death;
};
    
/**
 * This method will try and recreate the bot input generated by the engine as seen by a particular
 * player in this replay.<br>
 * 
 * @param {Number} player
 *        The index of the participating player.
 * @param {Number} min
 *        The first turn.
 * @param {Number} max
 *        The last turn.
 *
 * @returns {String} The bot input text.
 */
Replay.prototype.generateBotInput = function(player, min, max) {
	var botInput = 'turn 0\n';
	return botInput;
};