<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CctvPointController;
use App\Http\Controllers\CctvPointModelController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|ur 
| Here is where you can register API routes for yoapplication. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
//     return $request->user();
// });
Route::post('/traffic/{cctvPoint:id}', [CctvPointController::class, 'update_keterangan']);
Route::get('/detail/{cctvPoint:id}', [CctvPointModelController::class, 'showCCTV'])->name('showCCTV');