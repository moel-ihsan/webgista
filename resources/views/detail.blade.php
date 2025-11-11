@extends('layouts.base',[
    'title'=>'CCTV Detail'
])


@section('content')
    <detail :cctv="{{json_encode($cctvPoint)}}"></detail>    
@endsection
