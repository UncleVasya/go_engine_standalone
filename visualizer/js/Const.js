/**
 * A lookup table that converts byte values from 0-255 to their hexadecimal two letter
 * representation.
 */
INT_TO_HEX = new Array(256);
(function() {
	for ( var i = 0; i < 16; i++)
		INT_TO_HEX[i] = '0' + i.toString(16);
	for (; i < 256; i++)
		INT_TO_HEX[i] = i.toString(16);
}());

/**
 * width of left side panel
 * 
 * @const
 */
LEFT_PANEL_W = 48;

/**
 * width of right side panel
 * 
 * @const
 */
RIGHT_PANEL_W = 48;

/**
 * height of bottom panel
 * 
 * @const
 */
BOTTOM_PANEL_H = 64;

/**
 * a list of appropriate symbol constants for players
 *
 * @const
 */
PLAYER_SYMBOLS = 'wb';

/**
 * map different colors depending on player count
 *
 * @const
 */
COLOR_MAPS = [  10, // highlighted player
              [ 1 ],
              [ 1, 6 ],
              [ 1, 3, 6 ],
              [ 1, 3, 6, 8 ],
              [ 0, 2, 4, 6, 8 ],
              [ 0, 2, 3, 4, 6, 8 ],
              [ 0, 1, 3, 4, 5, 6, 8 ],
              [ 0, 1, 3, 4, 5, 6, 7, 8 ],
              [ 0, 1, 2, 3, 4, 5, 6, 7, 8 ],
              [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ] ];


/**
 * color schemes for visualizer
 *
 * @const
 */
COLOR_THEMES = [
    // BLACK-WHITE THEME
    {
        /**
         * colors of players
         */
        PLAYER_COLORS: [ [ 350, 85, 45 ], [ 0, 0, 90 ],
                         [ 45, 80, 50 ], [ 60, 90, 65 ],
                         [ 110, 60, 75 ], [ 155, 60, 45 ],
                         [ 0, 0, 12 ], [ 265, 80, 45 ],
                         [ 300, 60, 60 ], [ 345, 25, 75 ],

                         [ 0, 0, 90 ] ],

        /**
         * color of food items
         */
        DEFAULT_CELL_COLOR: hsl_to_rgb([ 180, 100, 50 ]),

        /**
         * color of land squares
         */
        SAND_COLOR: rgb_to_hex([ 223, 186, 114 ]),

        /**
         * color of text in player stats
         */
        STAT_COLOR: rgb_to_hex(hsl_to_rgb([ 210, 80, 55 ])),

        /**
         * color of text in stat titles
         */
        TEXT_COLOR: rgb_to_hex(hsl_to_rgb([ 210, 80, 55 ])),

        /**
         * color of text on graph title
         */
        TEXT_GRAPH_COLOR: rgb_to_hex(hsl_to_rgb([ 210, 80, 55 ])),

        /**
         * color of background for top stats bars
         */
        STATS_BACK_COLOR: rgb_to_hex(hsl_to_rgb([ 30, 30, 100 ])),

        /**
         * color of graph backhround
         */
        GRAPH_BACK_COLOR: rgb_to_hex([ 223, 186, 114 ]),

        /**
         * color of map canvas background
         */
        MAP_BACK_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 0 ])),

        /**
         * color of map grid lines
         */
        MAP_GRID_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 0])),

        /**
         * color of KO positions
         */
        KO_COLOR: rgb_to_hex(hsl_to_rgb([ 196, 100, 38 ]))
    },

    // ORANGE-BLUE THEME
    {
        PLAYER_COLORS: [ [ 350, 85, 45 ], [ 20, 80, 55 ],
                         [ 45, 80, 50 ], [ 60, 90, 65 ],
                         [ 110, 60, 75 ], [ 155, 60, 45 ],
                         [ 210, 80, 55 ], [ 265, 80, 45 ],
                         [ 300, 60, 60 ], [ 345, 25, 75 ],

                         [ 0, 0, 90 ] ],

        DEFAULT_CELL_COLOR: hsl_to_rgb([ 180, 100, 50 ]),

        SAND_COLOR: rgb_to_hex(hsl_to_rgb([ 30, 35, 35 ])),

        STAT_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 10 ])),

        TEXT_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 10 ])),

        TEXT_GRAPH_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 90 ])),

        STATS_BACK_COLOR: rgb_to_hex(hsl_to_rgb([ 30, 30, 100 ])),

        GRAPH_BACK_COLOR: rgb_to_hex(hsl_to_rgb([ 30, 35, 35 ])),

        MAP_BACK_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 100 ])),

        MAP_GRID_COLOR: rgb_to_hex(hsl_to_rgb([ 0, 0, 100 ])),

        KO_COLOR: rgb_to_hex(hsl_to_rgb([ 196, 100, 38 ]))
    }
];


/**
 * maximum pixel size of map squares
 * 
 * @const
 */
ZOOM_SCALE = 60;

/**
 * The standard font in the visualizer. Be careful here, because my implementation of font string
 * parsing in the Java wrapper is not very resilient to changes. Check back if the font displays ok
 * there.
 * 
 * @const
 */
FONT = 'bold 19px Arial,Sans';

/**
 * height of hint message
 *
 * @const
 */
HINT_HEIGHT = 22;

/**
 * Path to User profile. '~' is the placeholder for User id.
 *
 * @const
 */
DEFAULT_USER_URL = window.location.origin + '/player/~';

/**
 * Path to Match page. '~' is the placeholder for Match id.
 *
 * @const
 */
DEFAULT_GAME_URL = window.location.origin + '/replay.~';
