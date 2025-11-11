<?php

namespace App\Http\Controllers;

use App\Models\Totalveh;
use Illuminate\Http\Request;

class TotalvehController extends Controller
{
    public function update(Request $request, Totalveh $totalveh)
    {
        $valid = request()->validate([
            'totalcar' => ['required'],
            'totalmotor' => ['required'],
        ]);

        $totalveh->update($valid);
    }
}
