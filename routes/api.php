<?php

use App\Http\Controllers\CctvPointController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware(['auth:sanctum', 'admin'])
    ->post('/traffic/{cctvPoint:id}', [CctvPointController::class, 'update_keterangan'])
    ->name('api.traffic.update');

Route::get('/detail/{cctvPoint:id}', [CctvPointController::class, 'showCCTV'])->name('showCCTV');
