@extends('layouts.base',[
    'title'=>'CCTV | Profile'
])


@section('content')
@php
    $TOKEN = csrf_token();
    
    // dd(gettype($TOKEN))
@endphp
    <profile :users="{{json_encode($user)}}" csrf="{{$TOKEN}}"></profile>    
@endsection
