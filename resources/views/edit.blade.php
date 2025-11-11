@extends('layouts.base',[
    'title'=>'CCTV | Edit'
])


@section('content')
@php
    $TOKEN = csrf_token();
    
    // dd(gettype($TOKEN))
@endphp
    <edit :cctv="{{json_encode($cctvPoint)}}" csrf="{{$TOKEN}}"></edit>    
@endsection



