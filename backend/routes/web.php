<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'Phanix POS REST API',
        'status' => 'online',
        'version' => '1.0.0',
    ]);
});

// Authentication endpoints untuk Sanctum SPA
Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
