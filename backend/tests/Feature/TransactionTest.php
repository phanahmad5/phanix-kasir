<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class TransactionTest extends TestCase
{
    private function getAdmin(): User
    {
        return User::firstOrCreate(
            ['email' => 'admin@phanixpos.test'],
            [
                'name' => 'Administrator',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );
    }

    private function getCashier(): User
    {
        return User::firstOrCreate(
            ['email' => 'kasir@phanixpos.test'],
            [
                'name' => 'Ahmad Kasir',
                'password' => bcrypt('password123'),
                'role' => 'cashier',
                'is_active' => true,
            ]
        );
    }

    private function getOtherCashier(): User
    {
        return User::firstOrCreate(
            ['email' => 'kasir2@phanixpos.test'],
            [
                'name' => 'Siti Kasir 2',
                'password' => bcrypt('password123'),
                'role' => 'cashier',
                'is_active' => true,
            ]
        );
    }

    private function createTestProduct(array $overrides = []): Product
    {
        $category = Category::firstOrCreate(
            ['name' => 'Kategori Penjualan'],
            ['description' => 'Kategori untuk pengujian transaksi']
        );

        return Product::create(array_merge([
            'category_id' => $category->id,
            'sku' => 'TX-' . strtoupper(Str::random(6)),
            'name' => 'Produk Penjualan ' . Str::random(4),
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 50,
            'min_stock' => 5,
            'is_active' => true,
        ], $overrides));
    }

    /**
     * Menolak akses tanpa login (401 Unauthorized)
     */
    public function test_unauthenticated_user_cannot_access_transactions(): void
    {
        $this->getJson('/api/transactions')->assertStatus(401);
        $this->postJson('/api/transactions', [])->assertStatus(401);
    }

    /**
     * Transaksi sukses: menyimpan invoice, detail item snapshot, mengurangi stok, dan mencatat mutasi stok
     */
    public function test_successful_transaction_creates_invoice_items_and_decrements_stock(): void
    {
        $cashier = $this->getCashier();
        $product1 = $this->createTestProduct(['selling_price' => 20000, 'cost_price' => 15000, 'stock' => 20]);
        $product2 = $this->createTestProduct(['selling_price' => 10000, 'cost_price' => 7000, 'stock' => 15]);

        $payload = [
            'items' => [
                ['product_id' => $product1->id, 'quantity' => 2], // 40.000
                ['product_id' => $product2->id, 'quantity' => 3], // 30.000
            ],
            'discount' => 5000,
            'payment_method' => 'cash',
            'paid_amount' => 100000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Transaksi penjualan berhasil diproses.',
                'data' => [
                    'subtotal' => '70000.00',
                    'discount' => '5000.00',
                    'total' => '65000.00',
                    'paid_amount' => '100000.00',
                    'change_amount' => '35000.00',
                    'status' => 'completed',
                ],
            ]);

        $transactionId = $response->json('data.id');
        $invoiceNumber = $response->json('data.invoice_number');

        $this->assertNotEmpty($invoiceNumber);
        $this->assertStringStartsWith('INV-', $invoiceNumber);

        // 1. Cek stok produk berkurang tepat
        $this->assertEquals(18, $product1->fresh()->stock);
        $this->assertEquals(12, $product2->fresh()->stock);

        // 2. Cek snapshot item transaksi
        $this->assertDatabaseHas('transaction_items', [
            'transaction_id' => $transactionId,
            'product_id' => $product1->id,
            'sku' => $product1->sku,
            'product_name' => $product1->name,
            'quantity' => 2,
            'unit_price' => '20000.00',
            'cost_price' => '15000.00',
            'subtotal' => '40000.00',
        ]);

        // 3. Cek mutasi stok bertipe out
        $this->assertDatabaseHas('stock_movements', [
            'transaction_id' => $transactionId,
            'product_id' => $product1->id,
            'type' => 'out',
            'quantity' => -2,
        ]);
    }

    /**
     * Memastikan harga dari database yang digunakan meskipun frontend mengirim harga palsu
     */
    public function test_server_uses_database_prices_ignoring_manipulated_client_prices(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 50000, 'cost_price' => 35000, 'stock' => 10]);

        // Klien jahat mencoba mengirim harga Rp 100
        $payload = [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'price' => 100, // manipulasi diabaikan
                    'unit_price' => 100, // manipulasi diabaikan
                    'subtotal' => 200, // manipulasi diabaikan
                ],
            ],
            'discount' => 0,
            'payment_method' => 'cash',
            'paid_amount' => 100000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(201);

        // Subtotal harus tetap Rp 100.000 (2 x 50.000)
        $this->assertEquals('100000.00', $response->json('data.subtotal'));
        $this->assertEquals('100000.00', $response->json('data.total'));
        $this->assertEquals('0.00', $response->json('data.change_amount'));
    }

    /**
     * Transaksi ditolak jika stok tidak mencukupi (422)
     */
    public function test_transaction_fails_if_insufficient_stock(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 5]);
        $beforeTxCount = Transaction::count();

        $payload = [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 10], // minta 10 padahal stok 5
            ],
            'payment_method' => 'cash',
            'paid_amount' => 100000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // Stok tidak berubah
        $this->assertEquals(5, $product->fresh()->stock);

        // Tidak ada transaksi baru yang dibuat
        $this->assertEquals($beforeTxCount, Transaction::count());
        $this->assertDatabaseMissing('transaction_items', [
            'product_id' => $product->id,
        ]);
    }

    /**
     * Kegagalan satu item membatalkan seluruh transaksi secara atomik (rollback)
     */
    public function test_transaction_rolls_back_atomically_if_single_item_fails(): void
    {
        $cashier = $this->getCashier();
        $product1 = $this->createTestProduct(['stock' => 20]);
        $product2 = $this->createTestProduct(['stock' => 2]); // stok kurang

        $payload = [
            'items' => [
                ['product_id' => $product1->id, 'quantity' => 5],
                ['product_id' => $product2->id, 'quantity' => 10], // akan gagal di sini
            ],
            'payment_method' => 'cash',
            'paid_amount' => 200000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);
        $response->assertStatus(422);

        // Stok produk 1 TIDAK boleh terpotong parsial
        $this->assertEquals(20, $product1->fresh()->stock);
        $this->assertEquals(2, $product2->fresh()->stock);
    }

    /**
     * Produk yang berstatus nonaktif ditolak dari transaksi
     */
    public function test_inactive_product_cannot_be_transacted(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['is_active' => false, 'stock' => 10]);

        $payload = [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);
        $response->assertStatus(422);
    }

    /**
     * Validasi: kuantitas nol, negatif, dan item kosong ditolak
     */
    public function test_invalid_items_validation(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct();

        // 1. Item kosong
        $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ])->assertStatus(422)->assertJsonValidationErrors(['items']);

        // 2. Kuantitas 0
        $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 0]],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity']);

        // 3. Kuantitas negatif
        $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => -5]],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity']);
    }

    /**
     * Validasi: diskon melebihi subtotal atau negatif ditolak
     */
    public function test_invalid_discount_rejected(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 10]);

        // Diskon negatif
        $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'discount' => -500,
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ])->assertStatus(422)->assertJsonValidationErrors(['discount']);

        // Diskon melebihi subtotal (subtotal 10.000, diskon 20.000)
        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'discount' => 20000,
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ]);
        $response->assertStatus(422);
    }

    /**
     * Validasi: pembayaran kurang dari total belanja ditolak
     */
    public function test_insufficient_payment_rejected(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 50000, 'stock' => 10]);

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 30000, // kurang 20.000
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Produk yang sama dikirim lebih dari sekali dalam payload digabungkan secara aman
     */
    public function test_duplicate_products_in_item_payload_are_consolidated(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 20]);

        $payload = [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
                ['product_id' => $product->id, 'quantity' => 3], // duplikat produk ID sama
            ],
            'payment_method' => 'cash',
            'paid_amount' => 100000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);
        $response->assertStatus(201);

        // Total kuantitas terpotong = 5, subtotal = 50.000
        $this->assertEquals(15, $product->fresh()->stock);
        $this->assertEquals('50000.00', $response->json('data.subtotal'));
    }

    /**
     * Otorisasi riwayat transaksi: kasir hanya melihat transaksi miliknya, admin melihat semua
     */
    public function test_authorization_and_history_isolation_between_roles(): void
    {
        $admin = $this->getAdmin();
        $cashier1 = $this->getCashier();
        $cashier2 = $this->getOtherCashier();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 50]);

        // Kasir 1 membuat transaksi
        $res1 = $this->actingAs($cashier1, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $res1->assertStatus(201);
        $tx1Id = $res1->json('data.id');

        // Kasir 2 melihat riwayat transaksi -> tidak boleh melihat transaksi milik Kasir 1
        $listRes = $this->actingAs($cashier2, 'sanctum')->getJson('/api/transactions');
        $listRes->assertStatus(200);
        $txIds = collect($listRes->json('data'))->pluck('id')->toArray();
        $this->assertNotContains($tx1Id, $txIds);

        // Kasir 2 mencoba akses detail transaksi Kasir 1 -> 403 Forbidden
        $detailRes = $this->actingAs($cashier2, 'sanctum')->getJson("/api/transactions/{$tx1Id}");
        $detailRes->assertStatus(403);

        // Admin dapat melihat seluruh riwayat dan detail transaksi kasir 1
        $adminListRes = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions');
        $adminListRes->assertStatus(200);
        $adminTxIds = collect($adminListRes->json('data'))->pluck('id')->toArray();
        $this->assertContains($tx1Id, $adminTxIds);

        $adminDetailRes = $this->actingAs($admin, 'sanctum')->getJson("/api/transactions/{$tx1Id}");
        $adminDetailRes->assertStatus(200);
    }

    /**
     * Mekanisme idempotensi mencegah transaksi ganda saat resubmit
     */
    public function test_idempotency_prevents_duplicate_transactions(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 15000, 'stock' => 20]);
        $idempotencyKey = 'idemp-' . Str::uuid()->toString();

        $payload = [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ];

        // Request pertama
        $res1 = $this->actingAs($cashier, 'sanctum')
            ->withHeader('X-Idempotency-Key', $idempotencyKey)
            ->postJson('/api/transactions', $payload);

        $res1->assertStatus(201);
        $invoice1 = $res1->json('data.invoice_number');

        // Request kedua dengan idempotency key yang sama persis
        $res2 = $this->actingAs($cashier, 'sanctum')
            ->withHeader('X-Idempotency-Key', $idempotencyKey)
            ->postJson('/api/transactions', $payload);

        $res2->assertStatus(200);
        $invoice2 = $res2->json('data.invoice_number');

        // Invoice harus sama persis
        $this->assertEquals($invoice1, $invoice2);

        // Stok HANYA terpotong 2 pcs (bukan 4 pcs)
        $this->assertEquals(18, $product->fresh()->stock);
    }

    /**
     * Transaksi sukses dengan banyak ragam produk (multiple products)
     */
    public function test_transaction_with_multiple_different_products(): void
    {
        $cashier = $this->getCashier();
        $prodA = $this->createTestProduct(['selling_price' => 10000, 'cost_price' => 7000, 'stock' => 30]);
        $prodB = $this->createTestProduct(['selling_price' => 25000, 'cost_price' => 18000, 'stock' => 20]);
        $prodC = $this->createTestProduct(['selling_price' => 15000, 'cost_price' => 10000, 'stock' => 15]);

        $payload = [
            'items' => [
                ['product_id' => $prodA->id, 'quantity' => 2], // 20.000
                ['product_id' => $prodB->id, 'quantity' => 1], // 25.000
                ['product_id' => $prodC->id, 'quantity' => 3], // 45.000
            ],
            'discount' => 10000, // Subtotal 90.000 - 10.000 = 80.000
            'payment_method' => 'cash',
            'paid_amount' => 100000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'subtotal' => '90000.00',
                    'discount' => '10000.00',
                    'total' => '80000.00',
                    'paid_amount' => '100000.00',
                    'change_amount' => '20000.00',
                ],
            ]);

        $this->assertCount(3, $response->json('data.items'));
        $this->assertEquals(28, $prodA->fresh()->stock);
        $this->assertEquals(19, $prodB->fresh()->stock);
        $this->assertEquals(12, $prodC->fresh()->stock);
    }

    /**
     * Transaksi dengan diskon nol (0)
     */
    public function test_transaction_with_zero_discount(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 15000, 'stock' => 10]);

        $payload = [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'discount' => 0,
            'payment_method' => 'cash',
            'paid_amount' => 30000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'subtotal' => '30000.00',
                    'discount' => '0.00',
                    'total' => '30000.00',
                    'paid_amount' => '30000.00',
                    'change_amount' => '0.00',
                ],
            ]);
    }

    /**
     * Transaksi dengan diskon sama persis dengan subtotal (total belanja 0 / voucher 100%)
     */
    public function test_transaction_with_discount_equal_to_subtotal(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 25000, 'stock' => 10]);

        $payload = [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'discount' => 25000, // Diskon 100%
            'payment_method' => 'cash',
            'paid_amount' => 0,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'subtotal' => '25000.00',
                    'discount' => '25000.00',
                    'total' => '0.00',
                    'paid_amount' => '0.00',
                    'change_amount' => '0.00',
                ],
            ]);

        $this->assertEquals(9, $product->fresh()->stock);
    }

    /**
     * Validasi gagal jika produk tidak ditemukan di database (422)
     */
    public function test_transaction_fails_if_product_not_found(): void
    {
        $cashier = $this->getCashier();

        $payload = [
            'items' => [
                ['product_id' => 999999, 'quantity' => 1],
            ],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ];

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.product_id']);
    }

    /**
     * Hak akses: Baik Admin maupun Kasir memiliki izin membuat transaksi
     */
    public function test_both_admin_and_cashier_can_create_transactions(): void
    {
        $admin = $this->getAdmin();
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 20]);

        // 1. Admin membuat transaksi
        $adminRes = $this->actingAs($admin, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $adminRes->assertStatus(201);

        // 2. Kasir membuat transaksi
        $cashierRes = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $cashierRes->assertStatus(201);
    }

    /**
     * Hak akses: Pengguna yang dinonaktifkan (is_active = false) ditolak dari membuat transaksi (403)
     */
    public function test_inactive_user_cannot_create_transaction(): void
    {
        $inactiveCashier = User::firstOrCreate(
            ['email' => 'inactive_kasir@phanixpos.test'],
            [
                'name' => 'Kasir Nonaktif',
                'password' => bcrypt('password123'),
                'role' => 'cashier',
                'is_active' => false,
            ]
        );
        $inactiveCashier->update(['is_active' => false]);

        $product = $this->createTestProduct(['stock' => 10]);

        $response = $this->actingAs($inactiveCashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 20000,
        ]);

        $response->assertStatus(403);
    }

    /**
     * Idempotensi via body payload key (idempotency_key) mencegah transaksi ganda
     */
    public function test_idempotency_via_payload_body_key(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 20000, 'stock' => 10]);
        $idempotencyKey = 'idemp-body-' . Str::uuid()->toString();

        $payload = [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 50000,
            'idempotency_key' => $idempotencyKey,
        ];

        // Request 1
        $res1 = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);
        $res1->assertStatus(201);
        $invoice1 = $res1->json('data.invoice_number');

        // Request 2 dengan idempotency_key yang sama
        $res2 = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', $payload);
        $res2->assertStatus(200);
        $invoice2 = $res2->json('data.invoice_number');

        $this->assertEquals($invoice1, $invoice2);
        // Stok terpotong hanya 1
        $this->assertEquals(9, $product->fresh()->stock);
    }

    /**
     * Pengujian pencarian transaksi berdasarkan nomor invoice
     */
    public function test_search_transactions_by_invoice_number(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 20]);

        // Buat 2 transaksi
        $res1 = $this->actingAs($admin, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $inv1 = $res1->json('data.invoice_number');

        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $inv2 = $res2->json('data.invoice_number');

        // Cari transaksi 1 secara spesifik
        $searchRes = $this->actingAs($admin, 'sanctum')->getJson("/api/transactions?search={$inv1}");
        $searchRes->assertStatus(200);

        $results = collect($searchRes->json('data'))->pluck('invoice_number')->toArray();
        $this->assertContains($inv1, $results);
        $this->assertNotContains($inv2, $results);
    }

    /**
     * Pengujian filter tanggal dan validasi penolakan format tanggal tidak valid
     */
    public function test_filter_transactions_by_date_and_invalid_date_validation(): void
    {
        $admin = $this->getAdmin();

        // 1. Format tanggal tidak valid ditolak 422
        $invalidRes = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions?start_date=not-a-date');
        $invalidRes->assertStatus(422)->assertJsonValidationErrors(['start_date']);

        // 2. Tanggal akhir lebih awal dari tanggal mulai ditolak 422
        $rangeRes = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions?start_date=2026-12-31&end_date=2026-01-01');
        $rangeRes->assertStatus(422)->assertJsonValidationErrors(['end_date']);

        // 3. Filter tanggal valid diterima 200
        $today = date('Y-m-d');
        $validRes = $this->actingAs($admin, 'sanctum')->getJson("/api/transactions?start_date={$today}&end_date={$today}");
        $validRes->assertStatus(200);
    }

    /**
     * Pengujian pembatasan hasil melalui pagination server-side
     */
    public function test_pagination_limits_transaction_results(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 50]);

        // Buat 3 transaksi
        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($admin, 'sanctum')->postJson('/api/transactions', [
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
                'payment_method' => 'cash',
                'paid_amount' => 10000,
            ]);
        }

        // Minta per_page = 2
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions?per_page=2');
        $res->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        $this->assertLessThanOrEqual(2, count($res->json('data')));
        $this->assertEquals(2, $res->json('meta.per_page'));
    }

    /**
     * Detail transaksi menyertakan snapshot item dan data kasir yang aman
     */
    public function test_transaction_detail_includes_correct_item_snapshots(): void
    {
        $cashier = $this->getCashier();
        $product = $this->createTestProduct(['selling_price' => 25000, 'cost_price' => 18000, 'stock' => 10]);

        $createRes = $this->actingAs($cashier, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'discount' => 5000,
            'payment_method' => 'cash',
            'paid_amount' => 50000,
        ]);
        $txId = $createRes->json('data.id');

        // Buka detail transaksi
        $detailRes = $this->actingAs($cashier, 'sanctum')->getJson("/api/transactions/{$txId}");
        $detailRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $txId,
                    'subtotal' => '50000.00',
                    'discount' => '5000.00',
                    'total' => '45000.00',
                    'paid_amount' => '50000.00',
                    'change_amount' => '5000.00',
                    'payment_method' => 'cash',
                    'status' => 'completed',
                    'user' => [
                        'id' => $cashier->id,
                        'name' => $cashier->name,
                        'role' => 'cashier',
                    ],
                ],
            ]);

        // Verifikasi snapshot item
        $items = $detailRes->json('data.items');
        $this->assertCount(1, $items);
        $this->assertEquals($product->name, $items[0]['product_name']);
        $this->assertEquals($product->sku, $items[0]['sku']);
        $this->assertEquals('25000.00', $items[0]['unit_price']);
        $this->assertEquals(2, $items[0]['quantity']);
        $this->assertEquals('50000.00', $items[0]['subtotal']);

        // Data sensitif kasir tidak boleh bocor
        $this->assertArrayNotHasKey('password', $detailRes->json('data.user'));
    }

    /**
     * Meminta detail transaksi dengan ID yang tidak ditemukan menghasilkan 404
     */
    public function test_non_existent_transaction_detail_returns_404(): void
    {
        $admin = $this->getAdmin();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions/999999');
        $response->assertStatus(404);
    }

    /**
     * Membaca riwayat dan detail tidak mengubah stok atau menambah transaksi baru
     */
    public function test_viewing_history_and_detail_does_not_modify_stock_or_create_transactions(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createTestProduct(['selling_price' => 10000, 'stock' => 15]);

        $createRes = $this->actingAs($admin, 'sanctum')->postJson('/api/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'paid_amount' => 10000,
        ]);
        $txId = $createRes->json('data.id');

        $stockBefore = $product->fresh()->stock;
        $txCountBefore = Transaction::count();

        // 1. Panggil list riwayat
        $this->actingAs($admin, 'sanctum')->getJson('/api/transactions')->assertStatus(200);

        // 2. Panggil detail transaksi
        $this->actingAs($admin, 'sanctum')->getJson("/api/transactions/{$txId}")->assertStatus(200);

        // Pastikan tidak ada mutasi stok atau penambahan transaksi baru
        $this->assertEquals($stockBefore, $product->fresh()->stock);
        $this->assertEquals($txCountBefore, Transaction::count());
    }
}
