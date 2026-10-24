<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| REST API Routes - Phanix POS
|--------------------------------------------------------------------------
|
| Prefix otomatis: /api
|
*/

// Health check endpoint publik
Route::get('/health', [AuthController::class, 'health']);

// Protected routes (hanya pengguna terautentikasi)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'me']);

    // Kategori: Baca (Admin & Kasir)
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/{category}', [CategoryController::class, 'show']);

    // Kategori: Mutasi (Khusus Admin)
    Route::middleware('role:admin')->group(function () {
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::match(['put', 'patch'], '/categories/{category}', [CategoryController::class, 'update']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    });

    // Produk & Stok: Baca (Admin & Kasir)
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::get('/products/{product}/stock-movements', [ProductController::class, 'stockMovements']);

    // Produk & Stok: Mutasi (Khusus Admin)
    Route::middleware('role:admin')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::match(['put', 'patch'], '/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
        Route::post('/products/{product}/stock-adjustments', [ProductController::class, 'adjustStock']);
    });

    // Transaksi Penjualan (Admin & Kasir)
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::get('/transactions/{transaction}', [TransactionController::class, 'show']);
    Route::post('/transactions', [TransactionController::class, 'store']);

    // Dashboard & Laporan Penjualan (Admin & Kasir)
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/reports/summary', [ReportController::class, 'summary']);
    Route::get('/reports/export', [ReportController::class, 'export']);

    // Contoh rute khusus admin
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard-summary', function () {
            return response()->json([
                'success' => true,
                'message' => 'Admin dashboard summary authorized.',
            ]);
        });
    });

    // Contoh rute khusus kasir & admin
    Route::middleware('role:admin,cashier')->prefix('pos')->group(function () {
        Route::get('/status', function () {
            return response()->json([
                'success' => true,
                'message' => 'POS terminal authorized.',
            ]);
        });
    });
});
