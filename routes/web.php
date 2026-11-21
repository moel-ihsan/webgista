<?php

use App\Http\Controllers\AgencyListController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CctvPointController;
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

Route::get('/map', function () {
    return view('map');
})->name('map');

Route::get('/table', [CctvPointController::class, 'index'])->name('table');
Route::get('/detail/{cctvPoint:id}', [CctvPointController::class, 'show'])->name('show');
Route::get('/detail/video/{cctvPoint:id}', [CctvPointController::class, 'showvideo'])->name('showvideo');

Route::get('/api/table', [CctvPointController::class, 'table_api'])->name('table_api');
Route::get('/api/setting', [MapSettingController::class, 'table_setting'])->name('table_setting');
Route::get('/api/agency', [AgencyListController::class, 'table_agency'])->name('table_agency');

Route::get('/profileUser', [AuthController::class, 'init'])->name('profil.user');
Route::get('/authUser', [AuthController::class, 'authUser'])->name('auth.user');

Route::get('/login', [AuthController::class, 'login'])->name('login');
Route::post('/login/enter', [AuthController::class, 'auth'])->name('auth.enter');
Route::get('/register', function () {
    return view('register');
})->name('register.legacy');

Route::middleware(['auth'])->group(function () {
    Route::get('/logout', [AuthController::class, 'logout'])->name('auth.logout');
});

Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/table/add', [CctvPointController::class, 'create'])->name('cctv.create');
    Route::get('/table/edit/{cctvPoint:id}', [CctvPointController::class, 'edit'])->name('edit');
    Route::get('/setting/{mapSetting:id}', [MapSettingController::class, 'edit'])->name('setting');
    Route::get('/profile/{user:id}', [AuthController::class, 'edit'])->name('auth.edit');
    Route::get('/password', function () {
        return view('password');
    })->name('auth.password');

    Route::post('/store', [CctvPointController::class, 'store'])->name('store');
    Route::patch('/update/{cctvPoint:id}', [CctvPointController::class, 'update'])->name('update');
    Route::delete('/destroy/{cctvPoint:id}', [CctvPointController::class, 'destroy'])->name('destroy');
    Route::post('/upload', [CctvPointController::class, 'upload'])->name('upload');
    Route::post('/uploadEdit/{cctvPoint:id}', [CctvPointController::class, 'uploadEdit'])->name('uploadEdit');
    Route::post('/update/keterangan/{cctvPoint:id}', [CctvPointController::class, 'update_keterangan'])->name('cctv_keterangan');
    Route::patch('/update/roi/{cctvPoint:id}', [CctvPointController::class, 'updateRoi'])->name('cctv.roi');

    Route::post('/store/mapSetting', [MapSettingController::class, 'store'])->name('storeSetting');
    Route::patch('/updateSetting/{mapSetting:id}', [MapSettingController::class, 'update'])->name('updateSetting');

    Route::post('/store/agency', [AgencyListController::class, 'store'])->name('storeAgency');
    Route::delete('/destroyAgent/{agencyList:agency}', [AgencyListController::class, 'destroy'])->name('destroyAgent');

    Route::patch('/updateProfile/{user:id}', [AuthController::class, 'update'])->name('auth.update');
    Route::post('/uploadEditProfile/{user:id}', [AuthController::class, 'uploadEdit'])->name('auth.uploadEdit');
    Route::post('/changePassword/{user:id}', [AuthController::class, 'changePassword'])->name('auth.changePassword');
});
