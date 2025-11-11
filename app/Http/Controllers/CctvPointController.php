<?php

namespace App\Http\Controllers;

use App\Models\CctvPoint;
use Illuminate\Http\Request;

class CctvPointController extends Controller
{
    public function index()
    {
        return view('table');
    }

    public function table_api()
    {
        $all = CctvPoint::latest()->get();
        return response()->json($all);
    }

    public function update_keterangan(CctvPoint $cctvPoint)
    {
        $valid = request()->validate([
            'keterangan' => ['required'],
        ]);
        $cctvPoint->update($valid);
        return response()->json(['message' => 'berhasil']);
    }
}
