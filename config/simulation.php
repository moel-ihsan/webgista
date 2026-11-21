<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Simulation Demo Settings
    |--------------------------------------------------------------------------
    |
    | Non-secret configuration for the simulated traffic detection demo.
    | All video and precomputed detection JSON paths can be overridden via
    | environment variables without hardcoding URLs in Vue components.
    |
    */

    'enabled' => filter_var(env('SIMULATION_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'default_mode' => env('SIMULATION_DEFAULT_MODE', 'live'),

    'banner_text' => env(
        'SIMULATION_BANNER_TEXT',
        'SIMULASI DEMO — Menggunakan video contoh lalu lintas, bukan data CCTV resmi Kota Banda Aceh.'
    ),

    'cameras' => [
        'simpang-pdam' => [
            'name' => 'Simpang PDAM',
            'video_url' => env('SIMULATION_PDAM_VIDEO_URL', '/demo/videos/simpang-pdam.mp4'),
            'precomputed_url' => env('SIMULATION_PDAM_PRECOMPUTED_URL', '/demo/detections/simpang-pdam.json'),
            'default_roi' => [
                'rec1x' => 195.0,
                'rec1y' => 148.0,
                'rec2x' => 475.0,
                'rec2y' => 148.0,
                'rec3x' => 625.0,
                'rec3y' => 255.0,
                'rec4x' => 595.0,
                'rec4y' => 352.0,
                'rec5x' => 55.0,
                'rec5y' => 352.0,
            ],
        ],
        'simpang-jambo-tape' => [
            'name' => 'Simpang Jambo Tape',
            'video_url' => env('SIMULATION_JAMBO_TAPE_VIDEO_URL', '/demo/videos/simpang-jambo-tape.mp4'),
            'precomputed_url' => env('SIMULATION_JAMBO_TAPE_PRECOMPUTED_URL', '/demo/detections/simpang-jambo-tape.json'),
            'default_roi' => [
                'rec1x' => 250.0,
                'rec1y' => 38.0,
                'rec2x' => 450.0,
                'rec2y' => 48.0,
                'rec3x' => 625.0,
                'rec3y' => 230.0,
                'rec4x' => 390.0,
                'rec4y' => 352.0,
                'rec5x' => 10.0,
                'rec5y' => 330.0,
            ],
        ],
    ],

];
