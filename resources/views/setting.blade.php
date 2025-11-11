@extends('layouts.base',[
    'title'=>'Settings'
])


@section('content')
@php
    $TOKEN = csrf_token();
    
    // dd(gettype($TOKEN))
@endphp
    <settings :setti="{{json_encode($mapSetting)}}" csrf="{{$TOKEN}}"></settings>    
@endsection

