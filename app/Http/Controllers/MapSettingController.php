<?php

namespace App\Http\Controllers;

use App\Models\MapSetting;
use Illuminate\Http\Request;

class MapSettingController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        return view('setting');
    }

    public function table_setting()
    {
        $all = MapSetting::latest()->get();
        return response()->json($all);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $valid = $request->validate([
            'lattitude' => ['required'],
            'longitude' => ['required'],
            'zoom' => ['required'],
        ]);

        MapSetting::create($valid);
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Models\MapSetting  $mapSetting
     * @return \Illuminate\Http\Response
     */
    public function show(MapSetting $mapSetting)
    {
        // return view('detail', compact('mapSetting'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  MapSetting  $mapSetting
     * @return \Illuminate\Http\Response
     */
    public function edit(MapSetting $mapSetting)
    {
        return view('setting', compact('mapSetting'));
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\MapSetting  $mapSetting
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, MapSetting $mapSetting)
    {
        $valid = request()->validate([
            'lattitude' => ['required'],
            'longitude' => ['required'],
            'zoom' => ['required'],

        ]);

        $mapSetting->update($valid);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\MapSetting  $mapSetting
     * @return \Illuminate\Http\Response
     */
    public function destroy(MapSetting $mapSetting)
    {
        //
    }
}
