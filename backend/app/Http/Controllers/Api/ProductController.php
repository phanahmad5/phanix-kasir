<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\StoreStockMovementRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductController extends Controller
{
    /**
     * Menampilkan daftar produk dengan filter dan pencarian.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Product::with('category');

        // Kasir hanya boleh melihat produk aktif untuk operasional kasir
        if ($user && $user->isCashier()) {
            $query->where('is_active', true);
        } elseif ($request->filled('is_active') && $request->is_active !== 'ALL') {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        // Filter berdasarkan kategori
        if ($request->filled('category_id') && $request->category_id !== 'ALL') {
            $query->where('category_id', $request->category_id);
        }

        // Pencarian berdasarkan nama produk atau SKU
        if ($request->filled('search')) {
            $term = trim($request->search);
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('sku', 'like', "%{$term}%");
            });
        }

        $products = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Menyimpan produk baru beserta mutasi stok awal (Khusus Admin).
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validated();
            if (!isset($validated['is_active'])) {
                $validated['is_active'] = true;
            }
            if (!isset($validated['min_stock'])) {
                $validated['min_stock'] = 5;
            }

            $product = Product::create($validated);

            // Jika ada stok awal, catat dalam riwayat mutasi stok
            if ($product->stock > 0) {
                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $request->user()->id,
                    'type' => 'in',
                    'quantity' => $product->stock,
                    'note' => 'Stok awal saat pendaftaran produk.',
                ]);
            }

            DB::commit();

            $product->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Produk berhasil ditambahkan.',
                'data' => $product,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Gagal menambahkan produk: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat menambahkan produk.',
            ], 500);
        }
    }

    /**
     * Menampilkan detail satu produk.
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        $user = $request->user();

        // Jika kasir mencoba mengakses produk nonaktif
        if ($user && $user->isCashier() && !$product->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Produk ini sedang dinonaktifkan.',
            ], 404);
        }

        $product->load(['category', 'stockMovements' => function ($q) {
            $q->with('user:id,name,role')->latest()->limit(10);
        }]);

        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    /**
     * Memperbarui informasi produk (Khusus Admin).
     */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        try {
            $product->update($request->validated());
            $product->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Data produk berhasil diperbarui.',
                'data' => $product,
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal memperbarui produk: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat memperbarui data produk.',
            ], 500);
        }
    }

    /**
     * Menghapus produk jika tidak memiliki riwayat transaksi atau mutasi stok (Khusus Admin).
     */
    public function destroy(Product $product): JsonResponse
    {
        try {
            $hasTransactions = $product->transactionItems()->count() > 0;
            $hasStockMovements = $product->stockMovements()->count() > 0;

            if ($hasTransactions || $hasStockMovements) {
                return response()->json([
                    'success' => false,
                    'message' => 'Produk tidak dapat dihapus karena memiliki riwayat transaksi atau mutasi stok. Anda dapat menonaktifkan status produk.',
                ], 422);
            }

            $product->delete();

            return response()->json([
                'success' => true,
                'message' => 'Produk berhasil dihapus.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal menghapus produk: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat menghapus produk.',
            ], 500);
        }
    }

    /**
     * Melakukan mutasi penyesuaian stok secara manual dalam transaksi database (Khusus Admin).
     */
    public function adjustStock(StoreStockMovementRequest $request, Product $product): JsonResponse
    {
        $type = $request->input('type');
        $quantity = (int) $request->input('quantity');
        $note = $request->input('note', '');

        $currentStock = $product->stock;
        $newStock = $currentStock;
        $recordedQuantity = $quantity;

        if ($type === 'in') {
            if ($quantity <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Jumlah barang masuk harus lebih dari 0.',
                ], 422);
            }
            $newStock = $currentStock + $quantity;
            $recordedQuantity = $quantity;
        } elseif ($type === 'out') {
            if ($quantity <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Jumlah barang keluar harus lebih dari 0.',
                ], 422);
            }
            if ($currentStock < $quantity) {
                return response()->json([
                    'success' => false,
                    'message' => "Stok tidak mencukupi untuk pengurangan ini. Stok saat ini: {$currentStock}.",
                ], 422);
            }
            $newStock = $currentStock - $quantity;
            $recordedQuantity = -$quantity;
        } elseif ($type === 'adjustment') {
            if ($quantity < 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hasil penyesuaian fisik stok tidak boleh bernilai negatif.',
                ], 422);
            }
            $newStock = $quantity;
            $recordedQuantity = $newStock - $currentStock;
        }

        if ($newStock < 0) {
            return response()->json([
                'success' => false,
                'message' => 'Stok produk tidak boleh bernilai negatif.',
            ], 422);
        }

        try {
            $movement = DB::transaction(function () use ($product, $newStock, $type, $recordedQuantity, $note, $request) {
                // Update stok produk
                $product->update(['stock' => $newStock]);

                // Catat riwayat mutasi stok
                return StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $request->user()->id,
                    'type' => $type,
                    'quantity' => $recordedQuantity,
                    'note' => $note,
                ]);
            });

            $product->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Penyesuaian stok berhasil dicatat dan stok produk diperbarui.',
                'data' => [
                    'product' => $product,
                    'movement' => $movement,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal melakukan penyesuaian stok: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan pada server saat melakukan penyesuaian stok.',
            ], 500);
        }
    }

    /**
     * Menampilkan riwayat mutasi stok untuk produk tertentu.
     */
    public function stockMovements(Product $product): JsonResponse
    {
        $movements = $product->stockMovements()
            ->with('user:id,name,role')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $movements,
        ]);
    }
}
