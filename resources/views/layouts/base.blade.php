<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="theme-dark">


<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ $title ?? 'Unknown'}}</title>
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">
    {{-- <link href="https://vjs.zencdn.net/7.8.4/video-js.css" rel="stylesheet" />


    <!-- If you'd like to support IE8 (for Video.js versions prior to v7) -->
    <script src="https://vjs.zencdn.net/ie8/1.1.2/videojs-ie8.min.js"></script> --}}
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/video.js/7.12.0/video-js.min.css" />

    <link rel="stylesheet" href="{{ mix('css/app.css') }}">
    <link rel="preconnect" href="https://fonts.gstatic.com">    
    <link href="https://fonts.googleapis.com/css?family=Montserrat:400,100,500,600,700" rel="stylesheet">
    <link href="https://api.mapbox.com/mapbox-gl-js/v2.5.1/mapbox-gl.css" rel="stylesheet">    

    <style>

        * {
            font-family: 'Montserrat' , sans-serif;           
        }

        html{
            --size-md : 1em;
            --size-lg : 1.2em;
            --size-sm : 0.87em;
            --size-xs : 0.75em;
            --size-xxs : 0.4em;
            --size-xl : 1.8em;
            --green-hover: rgb(50, 225, 140);                        
        }
        .theme-dark{
            --color-primary:rgb(30, 30, 46);
            --color-secondary: rgb(39, 41, 61);
            --text-color:rgb(255, 255, 255);
            --green-theme: #32e18c;
            --green-theme-30: rgb(50, 225, 140,0.3);
            --tag-bg-success: transparent;
            --tag-text-success: #32e18c;            
            --tag-bg-primary: transparent;
            --tag-text-primary: #909399;            
            --table-hover: linear-gradient(90deg, rgba(2,0,36,0) 0%, rgba(30,30,46,0.5) 30%, rgba(30,30,46,0.5) 70%, rgba(0,212,255,0) 100%);
            
        
        }
        .theme-normal{
            --color-primary:rgb(242, 237, 255);          
            --color-secondary: rgb(255, 255, 255);
            --text-color:rgb(39, 41, 61);            
            --green-theme: #3a976d;            
            --green-theme-30: rgb(66, 183, 130,0.3);
            --tag-bg-success: #3a976d;
            --tag-text-success: rgb(255, 255, 255);  
            --tag-bg-primary: #909399;
            --tag-text-primary: rgb(255, 255, 255);  
            --table-hover: linear-gradient(90deg, rgba(2,0,36,0) 0%, rgba(242,237,255,0.5) 30%, rgba(242,237,255,0.5) 70%, rgba(0,212,255,0) 100%);
        }

        body{
            font-family: 'Montserrat';
            background-color: var(--color-primary);
            color: var(--text-color);                      
            transition: .5s;            
        }

        p{
            font-size: var(--size-md);
        }

        .topFix {
            background-color: var(--green-theme);
            height: 5px;
        }

        .sticky {
            position: fixed;
            top: 0;
            background-color: var(--color-primary);
            z-index: 101;
            width: 100%;
        }
        /* 
        .stickyhead {
        position: fixed;
        z-index: 100;
        width: 100%;
        background-color: var(--color-primary);
        }

        .stickyhead + .mainmain {
        padding-top: 80;
        } */

        .stickyside {
            position: fixed;
        }
        

        
 
        /* @media screen and (max-width: 992px) {
            html{
                --size-md : 0.8em;
                --size-lg : 1em;
                --size-sm : 0.6em;
                --size-xl : 1.6em;
            }
        }
        @media screen and (max-width: 600px) {
        } */
    </style>
</head>



<body>
    
    <div id="app">
    @section('content')
        
    @show
    
    
</div>

<script
src="https://cdnjs.cloudflare.com/ajax/libs/video.js/7.12.0/video.min.js"></script>

<script src="https://cdnjs.cloudflare.com/ajax/libs/videojs-youtube/2.6.1/Youtube.min.js"></script> 


</body>

<script>
    var BASE_URL = `{{ URL::to('/') }}`
</script>
<!-- Optional JavaScript -->
<!-- jQuery first, then Popper.js, then Bootstrap JS -->
<script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous">
</script>
<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" integrity="sha384-9/reFTGAW83EW2RDu2S0VKaIzap3H66lZH81PoYlFhbGU+6BZp6G7niu735Sk7lN" crossorigin="anonymous">
</script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js" integrity="sha384-B4gt1jrGC7Jh4AgTPSdUtOBvfO8shuf57BaghqFfPlYxofvL8/KUEfYiJOMMV+rV" crossorigin="anonymous">
</script>
<script src="https://unpkg.com/ionicons@5.4.0/dist/ionicons.js"></script>

<!-- Import TensorFlow.js library -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js" type="text/javascript"></script>
<!-- Load the coco-ssd model to use to recognize things in images -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js" type="text/javascript"></script>
<script src="https://api.mapbox.com/mapbox-gl-js/v2.5.1/mapbox-gl.js"></script>


<script src="{{ mix('js/app.js') }}"></script>
@section('script')
    
@show   

<script>
    const btn = document.querySelector(".el-switch")
    btn.addEventListener("click", res => changeTheme())
    // function to set a given theme/color-scheme
    function setTheme(themeName) {
        localStorage.setItem('theme', themeName);
        document.documentElement.className = themeName;
    }
    // function to toggle between primary and dark theme
    function changeTheme() {
        if (localStorage.getItem('theme') === 'theme-normal') {
            setTheme('theme-dark')
        } else {
            setTheme('theme-normal')
        }
    }
    // Immediately invoked function to set the theme on initial load
    (function () {
        if (localStorage.getItem('theme') === 'theme-dark') {
            setTheme('theme-dark');
        } else {
            setTheme('theme-normal');
        }
    })();

    async function stickyHeader(){
        try {
            window.onscroll = function() {myFunction()};

            var header = document.querySelector(".haha")
            var header1 = document.querySelector(".hihi")
            var header2 = document.querySelector(".huhu")
            var sticky = header.offsetTop;

            function myFunction() {
                if (window.pageYOffset > sticky) {
                    header.classList.add("sticky");
                    header1.classList.add("stickyside");
                    header2.classList.add("stickyhead");
                } else {
                    // header.classList.remove("sticky");
                    header1.classList.remove("stickyside");
                    header2.classList.remove("stickyhead");
                }
            }
        } catch (e) {
            
        }
    }

    stickyHeader();

    function getCursorPosition(canvas, event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        console.log("x: " + x + " y: " + y)
    }
    async function canvasTes(){
        try{
            const canvasClick = document.querySelector('#canvasw')
            canvasClick.addEventListener('mousedown', function(e) {
                getCursorPosition(canvasClick, e)
            })
        }
        catch(e){}
    }

    canvasTes();
   

 
</script>
</html>