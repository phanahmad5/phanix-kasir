<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionRequest;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TransactionController extends Controller
{
    /**
     * Menampilkan daftar riwayat transaksi penjualan.
     * Admin dapat melihat seluruh transaksi, sedangkan kasir dibatasi hanya transaksi miliknya.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:50'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ], [
            'start_date.date_format' => 'Format tanggal mulai harus berupa YYYY-MM-DD.',
            'end_date.date_format' => 'Format tanggal akhir harus berupa YYYY-MM-DD.',
            'end_date.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
        ]);

        $user = $request->user();
        $query = Transaction::with(['user:id,name,role', 'items']);

        // Kebijakan Akses: Kasir hanya dapat melihat riwayat transaksinya sendiri
        if ($user->isCashier()) {
            $query->where('user_id', $user->id);
        }

        // Filter pencarian nomor invoice
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where('invoice_number', 'like', "%{$search}%");
        }

        // Filter rentang tanggal transaksi
        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Filter metode pembayaran
        if ($request->filled('payment_method') && $request->payment_method !== 'ALL') {
            $query->where('payment_method', $request->payment_method);
        }

        // Filter status transaksi
        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);
        $transactions = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    /**
     * Menampilkan detail satu transaksi penjualan beserta item belanjanya.
     */
    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        $user = $request->user();

        // Otorisasi: Kasir tidak boleh mengakses transaksi milik kasir lain
        if ($user->isCashier() && $transaction->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat riwayat transaksi kasir lain.',
            ], 403);
        }

        $transaction->load(['user:id,name,role', 'items', 'stockMovements']);

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }

    /**
     * Menyimpan transaksi penjualan baru dari kasir.
     * Menggunakan transaksi database dengan lockForUpdate untuk mencegah race condition stok.
     */
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        // Dukungan Idempotency Key untuk mencegah transaksi ganda akibat klik ganda / resubmit
        $idempotencyKey = $request->header('X-Idempotency-Key') ?? $request->input('idempotency_key');
        if ($idempotencyKey) {
            $cacheKey = 'pos_tx_idempotency:' . $user->id . ':' . $idempotencyKey;
            $cachedResponse = Cache::get($cacheKey);
            if ($cachedResponse) {
                return response()->json($cachedResponse, 200);
            }
        }

        // 1. Konsolidasikan item jika produk yang sama dikirim lebih dari sekali
        $consolidatedItems = [];
        foreach ($validated['items'] as $item) {
            $productId = (int) $item['product_id'];
            $qty = (int) $item['quantity'];

            if (isset($consolidatedItems[$productId])) {
                $consolidatedItems[$productId] += $qty;
            } else {
                $consolidatedItems[$productId] = $qty;
            }
        }

        // Urutkan ID produk secara konsisten untuk mencegah deadlock pada tingkat basis data
        ksort($consolidatedItems);
        $productIds = array_keys($consolidatedItems);

        try {
            $transactionRecord = DB::transaction(function () use (
                $validated,
                $user,
                $consolidatedItems,
                $productIds
            ) {
                // 2. Kunci baris produk dengan lockForUpdate()
                $products = Product::whereIn('id', $productIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $subtotal = 0;
                $preparedItems = [];

                // 3. Validasi keberadaan, status aktif, dan ketersediaan stok produk
                foreach ($consolidatedItems as $productId => $quantity) {
                    if (!isset($products[$productId])) {
                        throw new \InvalidArgumentException("Produk dengan ID {$productId} tidak ditemukan di sistem.");
                    }

                    $product = $products[$productId];

                    if (!$product->is_active) {
                        throw new \InvalidArgumentException("Produk '{$product->name}' sedang dinonaktifkan dan tidak dapat dijual.");
                    }

                    if ($product->stock < $quantity) {
                        throw new \InvalidArgumentException(
                            "Stok produk '{$product->name}' tidak mencukupi (tersedia: {$product->stock}, diminta: {$quantity})."
                        );
                    }

                    // Selalu gunakan harga jual dan harga modal dari database, bukan dari input frontend!
                    $unitPrice = (float) $product->selling_price;
                    $costPrice = (float) $product->cost_price;
                    $itemSubtotal = $unitPrice * $quantity;
                    $subtotal += $itemSubtotal;

                    $preparedItems[] = [
                        'product' => $product,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'sku' => $product->sku,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'cost_price' => $costPrice,
                        'subtotal' => $itemSubtotal,
                    ];
                }

                // 4. Validasi diskon
                $discount = (float) ($validated['discount'] ?? 0);
                if ($discount > $subtotal) {
                    throw new \InvalidArgumentException(
                        "Nominal diskon (Rp " . number_format($discount, 0, ',', '.') . ") tidak boleh melebihi subtotal belanja (Rp " . number_format($subtotal, 0, ',', '.') . ")."
                    );
                }

                // 5. Hitung total dan kembalian
                $total = max(0, $subtotal - $discount);
                $paidAmount = (float) $validated['paid_amount'];

                if ($paidAmount < $total) {
                    throw new \InvalidArgumentException(
                        "Nominal pembayaran (Rp " . number_format($paidAmount, 0, ',', '.') . ") kurang dari total belanja (Rp " . number_format($total, 0, ',', '.') . ")."
                    );
                }

                $changeAmount = $paidAmount - $total;

                // 6. Generate nomor invoice unik (INV-YYYYMMDD-XXXXXX)
                $prefix = 'INV-' . date('Ymd') . '-';
                do {
                    $invoiceNumber = $prefix . strtoupper(Str::random(6));
                } while (Transaction::where('invoice_number', $invoiceNumber)->exists());

                // 7. Simpan transaksi utama
                $transaction = Transaction::create([
                    'invoice_number' => $invoiceNumber,
                    'user_id' => $user->id,
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'total' => $total,
                    'payment_method' => $validated['payment_method'],
                    'paid_amount' => $paidAmount,
                    'change_amount' => $changeAmount,
                    'status' => 'completed',
                ]);

                // 8. Simpan snapshot item transaksi, kurangi stok, dan catat mutasi stok
                foreach ($preparedItems as $item) {
                    $product = $item['product'];
                    $qty = $item['quantity'];

                    // Snapshot detail transaksi
                    TransactionItem::create([
                        'transaction_id' => $transaction->id,
                        'product_id' => $product->id,
                        'product_name' => $item['product_name'],
                        'sku' => $item['sku'],
                        'quantity' => $qty,
                        'unit_price' => $item['unit_price'],
                        'cost_price' => $item['cost_price'],
                        'subtotal' => $item['subtotal'],
                    ]);

                    // Kurangi stok produk secara langsung
                    $product->decrement('stock', $qty);

                    // Catat riwayat mutasi stok keluar ('out')
                    StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => $user->id,
                        'transaction_id' => $transaction->id,
                        'type' => 'out',
                        'quantity' => -$qty,
                        'note' => "Penjualan kasir invoice #{$invoiceNumber}",
                    ]);
                }

                return $transaction;
            });

            // Muat relasi lengkap untuk respons JSON
            $transactionRecord->load(['user:id,name,role', 'items']);

            $responsePayload = [
                'success' => true,
                'message' => 'Transaksi penjualan berhasil diproses.',
                'data' => $transactionRecord,
            ];

            // Simpan cache idempotensi selama 5 menit jika kunci disediakan
            if ($idempotencyKey) {
                Cache::put('pos_tx_idempotency:' . $user->id . ':' . $idempotencyKey, $responsePayload, 300);
            }

            return response()->json($responsePayload, 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Gagal memproses transaksi kasir: ' . $e->getMessage(), [
                'exception' => $e,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan sistem saat memproses transaksi.',
            ], 500);
        }
    }
}
