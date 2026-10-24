<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class CategoryController extends Controller
{
    /**
     * Menampilkan daftar seluruh kategori beserta jumlah produk.
     */
    public function index(): JsonResponse
    {
        $categories = Category::withCount('products')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Menyimpan kategori baru ke database (Khusus Admin).
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        try {
            $category = Category::create($request->validated());
            $category->loadCount('products');

            return response()->json([
                'success' => true,
                'message' => 'Kategori berhasil ditambahkan.',
                'data' => $category,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Gagal menambahkan kategori: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat menambahkan kategori.',
            ], 500);
        }
    }

    /**
     * Menampilkan detail satu kategori.
     */
    public function show(Category $category): JsonResponse
    {
        $category->loadCount('products');

        return response()->json([
            'success' => true,
            'data' => $category,
        ]);
    }

    /**
     * Memperbarui kategori yang sudah ada (Khusus Admin).
     */
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        try {
            $category->update($request->validated());
            $category->loadCount('products');

            return response()->json([
                'success' => true,
                'message' => 'Kategori berhasil diperbarui.',
                'data' => $category,
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal memperbarui kategori: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat memperbarui kategori.',
            ], 500);
        }
    }

    /**
     * Menghapus kategori jika tidak sedang digunakan oleh produk (Khusus Admin).
     */
    public function destroy(Category $category): JsonResponse
    {
        try {
            $productsCount = $category->products()->count();

            if ($productsCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Kategori tidak dapat dihapus karena masih digunakan oleh {$productsCount} produk.",
                ], 422);
            }

            $category->delete();

            return response()->json([
                'success' => true,
                'message' => 'Kategori berhasil dihapus.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal menghapus kategori: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat menghapus kategori.',
            ], 500);
        }
    }
}
