@extends('layouts.base',[
    'title'=>'Video Detail'
])

@section('content')
@php
    $TOKEN = csrf_token();
    
    // dd(gettype($TOKEN))
@endphp
    <videodetail :cctv="{{json_encode($cctvPoint)}}" csrf="{{$TOKEN}}"></videodetail>    
@endsection
