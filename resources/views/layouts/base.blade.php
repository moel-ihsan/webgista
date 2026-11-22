<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="theme-normal">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Real-Time Traffic Condition Mapping at Intersections in Banda Aceh Based on WebGIS and Machine Learning.">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="map-config" content="{{ json_encode(config('services.map'), JSON_UNESCAPED_SLASHES) }}">
    <meta name="webgista-simulation" content="{{ json_encode(config('simulation'), JSON_UNESCAPED_SLASHES) }}">

    <title>{{ $title ?? 'WebGIS Traffic Banda Aceh' }}</title>

    <link rel="icon" type="image/svg+xml" href="/assets/brand/svg/webgis-icon.svg">
    <link rel="alternate icon" type="image/png" href="/assets/brand/png/webgis-icon.png">
    <link rel="apple-touch-icon" href="/assets/brand/png/webgis-icon.png">

    <script>
        (function () {
            try {
                var saved = window.localStorage.getItem('theme');
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var useDark = saved === 'theme-dark' || (!saved && prefersDark);
                document.documentElement.className = useDark ? 'theme-dark dark' : 'theme-normal';
            } catch (_e) {
                document.documentElement.className = 'theme-normal';
            }
        })();
    </script>

    <link rel="stylesheet" href="{{ mix('css/app.css') }}">
</head>
<body>
    <div id="app">
        @section('content')
        @show
    </div>

    <script>
        var BASE_URL = "{{ URL::to('/') }}";
    </script>
    <script src="{{ mix('js/app.js') }}"></script>
    @section('script')
    @show
</body>
</html>
