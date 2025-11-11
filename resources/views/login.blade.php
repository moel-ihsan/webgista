@extends('layouts.base',[
    'title'=>'Login'
])


@section('content')
@php
    $TOKEN = csrf_token();
    
    // dd(gettype($TOKEN))
@endphp
    <login csrf="{{$TOKEN}}"></login>    
@endsection



