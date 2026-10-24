<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardAndReportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Bersihkan data transaksi uji pengujian sebelumnya agar pengujian sepenuhnya terisolasi
        Transaction::where('invoice_number', 'like', 'INV-DSH-%')->delete();
    }

    private function getAdmin(): User
    {
        return User::firstOrCreate(
            ['email' => 'admin_dash@phanixpos.test'],
            [
                'name' => 'Admin Dashboard',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );
    }

    private function getCashier1(): User
    {
        return User::firstOrCreate(
            ['email' => 'kasir1_dash@phanixpos.test'],
            [
                'name' => 'Budi Kasir 1',
                'password' => bcrypt('password123'),
                'role' => 'cashier',
                'is_active' => true,
            ]
        );
    }

    private function getCashier2(): User
    {
        return User::firstOrCreate(
            ['email' => 'kasir2_dash@phanixpos.test'],
            [
                'name' => 'Dewi Kasir 2',
                'password' => bcrypt('password123'),
                'role' => 'cashier',
                'is_active' => true,
            ]
        );
    }

    private function createProduct(array $overrides = []): Product
    {
        $category = Category::firstOrCreate(
            ['name' => 'Kategori Dashboard'],
            ['description' => 'Kategori pengujian laporan dashboard']
        );

        return Product::create(array_merge([
            'category_id' => $category->id,
            'sku' => 'DSH-' . strtoupper(Str::random(6)),
            'name' => 'Produk Lap ' . Str::random(4),
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 50,
            'min_stock' => 5,
            'is_active' => true,
        ], $overrides));
    }

    private function createManualTransaction(User $user, array $itemSpecs, array $txOverrides = []): Transaction
    {
        $subtotal = 0;
        foreach ($itemSpecs as $spec) {
            $subtotal += $spec['unit_price'] * $spec['quantity'];
        }

        $discount = $txOverrides['discount'] ?? 0;
        $total = max(0, $subtotal - $discount);

        $txData = array_merge([
            'invoice_number' => 'INV-DSH-' . strtoupper(Str::random(8)),
            'user_id' => $user->id,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'total' => $total,
            'payment_method' => 'cash',
            'paid_amount' => $total + 5000,
            'change_amount' => 5000,
            'status' => 'completed',
        ], $txOverrides);

        $tx = Transaction::create($txData);
        if (isset($txOverrides['created_at'])) {
            $tx->created_at = $txOverrides['created_at'];
            $tx->updated_at = $txOverrides['created_at'];
            $tx->save();
        }

        foreach ($itemSpecs as $spec) {
            $item = TransactionItem::create([
                'transaction_id' => $tx->id,
                'product_id' => $spec['product']->id ?? null,
                'product_name' => $spec['product_name'] ?? $spec['product']->name,
                'sku' => $spec['sku'] ?? $spec['product']->sku,
                'quantity' => $spec['quantity'],
                'unit_price' => $spec['unit_price'],
                'cost_price' => $spec['cost_price'] ?? 10000,
                'subtotal' => $spec['unit_price'] * $spec['quantity'],
            ]);

            if (isset($txOverrides['created_at'])) {
                $item->created_at = $txOverrides['created_at'];
                $item->updated_at = $txOverrides['created_at'];
                $item->save();
            }
        }

        return $tx;
    }

    /**
     * 1. Endpoint dashboard dan laporan menolak pengguna yang belum login (401 Unauthorized)
     */
    public function test_unauthenticated_user_cannot_access_dashboard_or_reports(): void
    {
        $this->getJson('/api/dashboard/summary')->assertStatus(401);
        $this->getJson('/api/reports/summary')->assertStatus(401);
        $this->getJson('/api/reports/export')->assertStatus(401);
    }

    /**
     * 2. Agregasi omzet dan jumlah transaksi sesuai fixture database
     */
    public function test_aggregates_net_turnover_and_transaction_count_match_database(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createProduct(['selling_price' => 20000, 'cost_price' => 15000]);

        $targetDate = Carbon::parse('2024-02-10 10:00:00');

        // Buat 2 transaksi pada tanggal target
        $tx1 = $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 2, 'unit_price' => 20000], // subtotal 40000
        ], ['created_at' => $targetDate, 'discount' => 5000]); // total = 35000

        $tx2 = $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 1, 'unit_price' => 20000], // subtotal 20000
        ], ['created_at' => $targetDate, 'discount' => 0]); // total = 20000

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-10&end_date=2024-02-10');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'kpi' => ['net_turnover', 'transaction_count', 'average_transaction_value', 'items_sold'],
                    'daily_sales',
                    'by_payment_method',
                    'top_products',
                ],
            ]);

        $kpi = $response->json('data.kpi');
        $this->assertEquals(2, $kpi['transaction_count']['current']);
        $this->assertEquals(55000, $kpi['net_turnover']['current']); // 35000 + 20000
        $this->assertEquals(3, $kpi['items_sold']['current']); // 2 + 1
        $this->assertEquals(27500, $kpi['average_transaction_value']['current']); // 55000 / 2
    }

    /**
     * 3. Transaksi yang belum selesai (pending / canceled) tidak dihitung sebagai penjualan selesai
     */
    public function test_non_completed_transactions_are_excluded_from_turnover(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createProduct(['selling_price' => 50000]);
        $targetDate = Carbon::parse('2024-02-11 12:00:00');

        // 1 transaksi completed
        $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 1, 'unit_price' => 50000],
        ], ['created_at' => $targetDate, 'status' => 'completed']);

        // 1 transaksi pending (tidak boleh masuk omzet)
        $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 2, 'unit_price' => 50000],
        ], ['created_at' => $targetDate, 'status' => 'pending']);

        // 1 transaksi canceled (tidak boleh masuk omzet)
        $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 3, 'unit_price' => 50000],
        ], ['created_at' => $targetDate, 'status' => 'canceled']);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-11&end_date=2024-02-11');
        $res->assertStatus(200);

        $kpi = $res->json('data.kpi');
        $this->assertEquals(1, $kpi['transaction_count']['current']);
        $this->assertEquals(50000, $kpi['net_turnover']['current']);
        $this->assertEquals(1, $kpi['items_sold']['current']);
    }

    /**
     * 4. Filter tanggal berfungsi dan validasi tanggal tidak valid ditolak (422)
     */
    public function test_date_filter_works_and_invalid_date_inputs_are_rejected(): void
    {
        $admin = $this->getAdmin();

        // Periode tidak valid
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/dashboard/summary?period=invalid_period')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['period']);

        // Format tanggal mulai tidak valid
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/dashboard/summary?period=custom&start_date=2026/10/01&end_date=2026-10-10')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['start_date']);

        // Tanggal akhir mendahului tanggal mulai
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/dashboard/summary?period=custom&start_date=2026-10-15&end_date=2026-10-10')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);

        // Filter valid
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/dashboard/summary?period=custom&start_date=2026-10-01&end_date=2026-10-10')
            ->assertStatus(200);
    }

    /**
     * 5. Periode pembanding dihitung dengan benar dengan durasi setara
     */
    public function test_comparison_previous_period_is_calculated_accurately(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createProduct(['selling_price' => 10000]);

        $currDate = Carbon::parse('2024-02-20 14:00:00');
        $prevDate = Carbon::parse('2024-02-19 14:00:00');

        // Periode saat ini (2024-02-20): omzet 30.000
        $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 3, 'unit_price' => 10000],
        ], ['created_at' => $currDate]);

        // Periode pembanding (2024-02-19): omzet 20.000
        $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 2, 'unit_price' => 10000],
        ], ['created_at' => $prevDate]);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-20&end_date=2024-02-20');
        $res->assertStatus(200);

        $kpi = $res->json('data.kpi');
        $this->assertEquals(30000, $kpi['net_turnover']['current']);
        $this->assertEquals(20000, $kpi['net_turnover']['previous']);
        // Pertumbuhan: (30000 - 20000) / 20000 * 100 = +50.0%
        $this->assertEquals(50.0, $kpi['net_turnover']['change_percentage']);
        $this->assertEquals('up', $kpi['net_turnover']['trend']);
    }

    /**
     * 6. Admin melihat agregat seluruh kasir dan mendapatkan ringkasan by_cashier
     */
    public function test_admin_sees_storewide_aggregate_and_cashier_breakdown(): void
    {
        $admin = $this->getAdmin();
        $c1 = $this->getCashier1();
        $c2 = $this->getCashier2();
        $product = $this->createProduct(['selling_price' => 10000]);

        $targetDate = Carbon::parse('2024-02-25 11:00:00');

        // Kasir 1 membuat transaksi 20.000
        $this->createManualTransaction($c1, [
            ['product' => $product, 'quantity' => 2, 'unit_price' => 10000],
        ], ['created_at' => $targetDate]);

        // Kasir 2 membuat transaksi 30.000
        $this->createManualTransaction($c2, [
            ['product' => $product, 'quantity' => 3, 'unit_price' => 10000],
        ], ['created_at' => $targetDate]);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-25&end_date=2024-02-25');
        $res->assertStatus(200);

        $kpi = $res->json('data.kpi');
        $this->assertEquals(50000, $kpi['net_turnover']['current']); // 20k + 30k
        $this->assertEquals(2, $kpi['transaction_count']['current']);

        // Admin mendapatkan data ringkasan per kasir
        $byCashier = $res->json('data.by_cashier');
        $this->assertIsArray($byCashier);

        $c1Data = collect($byCashier)->firstWhere('user_id', $c1->id);
        $c2Data = collect($byCashier)->firstWhere('user_id', $c2->id);

        $this->assertNotNull($c1Data);
        $this->assertNotNull($c2Data);
        $this->assertEquals(20000, $c1Data['total_sales']);
        $this->assertEquals(30000, $c2Data['total_sales']);
    }

    /**
     * 7. Kasir hanya melihat agregat transaksinya sendiri dan tidak mendapatkan ringkasan kasir lain
     */
    public function test_cashier_only_sees_own_transactions_and_no_cashier_breakdown(): void
    {
        $c1 = $this->getCashier1();
        $c2 = $this->getCashier2();
        $product = $this->createProduct(['selling_price' => 15000]);

        $targetDate = Carbon::parse('2024-02-28 15:00:00');

        // Kasir 1: 15.000
        $this->createManualTransaction($c1, [
            ['product' => $product, 'quantity' => 1, 'unit_price' => 15000],
        ], ['created_at' => $targetDate]);

        // Kasir 2: 45.000
        $this->createManualTransaction($c2, [
            ['product' => $product, 'quantity' => 3, 'unit_price' => 15000],
        ], ['created_at' => $targetDate]);

        // Kasir 1 mengecek dashboard
        $res1 = $this->actingAs($c1, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-28&end_date=2024-02-28');
        $res1->assertStatus(200);

        $kpi1 = $res1->json('data.kpi');
        $this->assertEquals(15000, $kpi1['net_turnover']['current']);
        $this->assertEquals(1, $kpi1['transaction_count']['current']);
        $this->assertNull($res1->json('data.by_cashier')); // Kasir tidak boleh mendapatkan by_cashier

        // Kasir 2 mengecek dashboard
        $res2 = $this->actingAs($c2, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-02-28&end_date=2024-02-28');
        $res2->assertStatus(200);

        $kpi2 = $res2->json('data.kpi');
        $this->assertEquals(45000, $kpi2['net_turnover']['current']);
        $this->assertEquals(1, $kpi2['transaction_count']['current']);
        $this->assertNull($res2->json('data.by_cashier'));
    }

    /**
     * 8. Daftar produk terlaris memakai snapshot item transaksi (bukan harga/nama master produk saat ini)
     */
    public function test_top_products_uses_transaction_item_snapshot(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createProduct(['name' => 'Kopi Awal', 'selling_price' => 10000]);
        $targetDate = Carbon::parse('2024-03-05 16:00:00');

        // Catat transaksi dengan snapshot nama 'Kopi Snapshot Spesial' dan harga 10000
        $this->createManualTransaction($admin, [
            [
                'product' => $product,
                'product_name' => 'Kopi Snapshot Spesial',
                'sku' => $product->sku,
                'quantity' => 10,
                'unit_price' => 10000,
            ],
        ], ['created_at' => $targetDate]);

        // Ubah nama produk master di tabel products setelah transaksi
        $product->update(['name' => 'Nama Baru Diubah Master']);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary?period=custom&start_date=2024-03-05&end_date=2024-03-05');
        $res->assertStatus(200);

        $top = $res->json('data.top_products');
        $this->assertNotEmpty($top);
        $this->assertEquals('Kopi Snapshot Spesial', $top[0]['product_name']);
        $this->assertEquals(10, $top[0]['total_quantity']);
        $this->assertEquals(100000, $top[0]['total_revenue']);
    }

    /**
     * 9. Membuka dashboard tidak mengubah stok atau membuat transaksi baru
     */
    public function test_viewing_dashboard_does_not_mutate_stock_or_transactions(): void
    {
        $admin = $this->getAdmin();
        $product = $this->createProduct(['stock' => 25]);

        $stockBefore = $product->fresh()->stock;
        $txCountBefore = Transaction::count();

        $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary')->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->getJson('/api/reports/summary')->assertStatus(200);

        $this->assertEquals($stockBefore, $product->fresh()->stock);
        $this->assertEquals($txCountBefore, Transaction::count());
    }

    /**
     * 10. Ekspor laporan mengikuti filter dan otorisasi role
     */
    public function test_report_csv_export_follows_filter_and_role_authorization(): void
    {
        $admin = $this->getAdmin();
        $cashier = $this->getCashier1();
        $product = $this->createProduct(['selling_price' => 25000]);

        $targetDate = Carbon::parse('2024-03-10 10:00:00');

        // Transaksi kasir 1
        $tx1 = $this->createManualTransaction($cashier, [
            ['product' => $product, 'quantity' => 1, 'unit_price' => 25000],
        ], ['created_at' => $targetDate]);

        // Transaksi admin
        $tx2 = $this->createManualTransaction($admin, [
            ['product' => $product, 'quantity' => 2, 'unit_price' => 25000],
        ], ['created_at' => $targetDate]);

        // Kasir mengekspor CSV -> hanya berisi transaksinya sendiri
        $cashierExport = $this->actingAs($cashier, 'sanctum')->get('/api/reports/export?period=custom&start_date=2024-03-10&end_date=2024-03-10');
        $cashierExport->assertStatus(200);
        $cashierExport->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csvContent = $cashierExport->streamedContent();
        $this->assertStringContainsString($tx1->invoice_number, $csvContent);
        $this->assertStringNotContainsString($tx2->invoice_number, $csvContent);

        // Admin mengekspor CSV -> berisi seluruh transaksi
        $adminExport = $this->actingAs($admin, 'sanctum')->get('/api/reports/export?period=custom&start_date=2024-03-10&end_date=2024-03-10');
        $adminExport->assertStatus(200);

        $adminCsvContent = $adminExport->streamedContent();
        $this->assertStringContainsString($tx1->invoice_number, $adminCsvContent);
        $this->assertStringContainsString($tx2->invoice_number, $adminCsvContent);
    }
}
