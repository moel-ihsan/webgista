<?php

use App\Http\Controllers\AgencyListController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CctvPointController;
use App\Http\Controllers\CctvPointModelController;
use App\Http\Controllers\MapSettingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('home');
})->name('home');

// Route::middleware(['auth:sanctum', 'verified'])->get('/', function () {
//     return view('home');
// })->name('dashboard');

Route::get('/profileUser', [AuthController::class, 'init'])->name('profil.user');
Route::get('/authUser', [AuthController::class, 'authUser'])->name('auth.user');
Route::get('/profile/{user:id}', [AuthController::class, 'edit'])->name('auth.edit');
Route::patch('/updateProfile/{user:id}', [AuthController::class, 'update'])->name('auth.update');
Route::post('/uploadEditProfile/{user:id}', [AuthController::class, 'uploadEdit'])->name('auth.uploadEdit');
Route::post('/changePassword/{user:id}', [AuthController::class, 'changePassword'])->name('auth.changePassword');


Route::get('/login', [AuthController::class, 'login'])->name('login');
Route::get('/logout', [AuthController::class, 'logout'])->name('auth.logout');
Route::post('/login/enter', [AuthController::class, 'auth'])->name('auth.enter');

Route::get('/register', function () {
    return view('register');
});

Route::get('/password', function () {
    return view('password');
});

Route::get('/map', function () {
    return view('map');
});

Route::get('/table', [CctvPointController::class, 'index'])->name('table');
Route::post('/update/keterangan/{cctvPoint:id}', [CctvPointController::class, 'update_keterangan'])->name('cctv_keterangan');
Route::get('/api/table', [CctvPointController::class, 'table_api'])->name('table_api');
Route::post('/store', [CctvPointModelController::class, 'store'])->name('store');
Route::patch('/update/{cctvPoint:id}', [CctvPointModelController::class, 'update'])->name('update');
// Route::patch('/updateVeh/{cctvPoint:id}', [CctvPointModelController::class, 'updateVeh'])->name('updateVeh');
Route::post('/uploadEdit/{cctvPoint:id}', [CctvPointModelController::class, 'uploadEdit'])->name('uploadEdit');
Route::post('/upload', [CctvPointModelController::class, 'upload'])->name('upload');
Route::get('/destroy/{cctvPoint:id}', [CctvPointModelController::class, 'destroy'])->name('destroy');

Route::get('/table/add', function () {
    return view('add');
});

Route::get('/table/edit/{cctvPoint:id}', [CctvPointModelController::class, 'edit'])->name('edit');
Route::get('/detail/{cctvPoint:id}', [CctvPointModelController::class, 'show'])->name('show');
Route::get('/detail/video/{cctvPoint:id}', [CctvPointModelController::class, 'showvideo'])->name('showvideo');

Route::get('/setting/{mapSetting:id}', [MapSettingController::class, 'edit'])->name('setting');
Route::get('/api/agency', [AgencyListController::class, 'table_agency'])->name('table_agency');
Route::post('/store/agency', [AgencyListController::class, 'store'])->name('storeAgency');
Route::get('/destroyAgent/{agencyList:agency}', [AgencyListController::class, 'destroy'])->name('destroyAgent');

Route::get('/api/setting', [MapSettingController::class, 'table_setting'])->name('table_setting');
Route::post('/store/mapSetting', [MapSettingController::class, 'store'])->name('storeSetting');
Route::patch('/updateSetting/{mapSetting:id}', [MapSettingController::class, 'update'])->name('updateSetting');
