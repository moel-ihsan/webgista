<?php

namespace App\Http\Controllers;

use App\Models\AgencyList;
use Illuminate\Http\Request;

class AgencyListController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
    }

    public function table_agency()
    {
        $all = AgencyList::get();
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
            'agency' => ['required'],
        ]);

        AgencyList::create($valid);
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Models\AgencyList  $agencyList
     * @return \Illuminate\Http\Response
     */
    public function show(AgencyList $agencyList)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  \App\Models\AgencyList  $agencyList
     * @return \Illuminate\Http\Response
     */
    public function edit(AgencyList $agencyList)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\AgencyList  $agencyList
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, AgencyList $agencyList)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\AgencyList  $agencyList
     * @return \Illuminate\Http\Response
     */
    public function destroy(AgencyList $agencyList)
    {
        $agencyList->delete();
    }
}
