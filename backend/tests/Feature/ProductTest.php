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

class ProductTest extends TestCase
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

    private function getTestCategory(): Category
    {
        return Category::firstOrCreate(
            ['name' => 'Kategori Uji Produk'],
            ['description' => 'Kategori untuk pengujian produk']
        );
    }

    /**
     * Menolak akses tanpa login (401 Unauthorized)
     */
    public function test_unauthenticated_user_cannot_access_products(): void
    {
        $this->getJson('/api/products')->assertStatus(401);
        $this->postJson('/api/products', [])->assertStatus(401);
    }

    /**
     * Kasir hanya dapat membaca produk aktif dan tidak dapat melakukan mutasi
     */
    public function test_cashier_can_only_read_active_products_and_cannot_mutate(): void
    {
        $cashier = $this->getCashier();
        $category = $this->getTestCategory();

        $activeProduct = Product::create([
            'category_id' => $category->id,
            'sku' => 'ACT-' . Str::random(5),
            'name' => 'Produk Aktif ' . Str::random(5),
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 10,
            'min_stock' => 2,
            'is_active' => true,
        ]);

        $inactiveProduct = Product::create([
            'category_id' => $category->id,
            'sku' => 'INACT-' . Str::random(5),
            'name' => 'Produk Nonaktif ' . Str::random(5),
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 10,
            'min_stock' => 2,
            'is_active' => false,
        ]);

        // Kasir membaca daftar produk
        $response = $this->actingAs($cashier, 'sanctum')->getJson('/api/products');
        $response->assertStatus(200);

        $skuList = collect($response->json('data'))->pluck('sku')->toArray();
        $this->assertContains($activeProduct->sku, $skuList);
        $this->assertNotContains($inactiveProduct->sku, $skuList);

        // Kasir dilarang menambah produk (403)
        $this->actingAs($cashier, 'sanctum')->postJson('/api/products', [
            'sku' => 'FORBIDDEN-01',
            'name' => 'Produk Kasir',
            'category_id' => $category->id,
            'cost_price' => 1000,
            'selling_price' => 2000,
            'stock' => 5,
        ])->assertStatus(403);

        // Kasir dilarang mengubah produk (403)
        $this->actingAs($cashier, 'sanctum')->putJson("/api/products/{$activeProduct->id}", [
            'name' => 'Ubah Nama Kasir',
        ])->assertStatus(403);

        // Kasir dilarang menghapus produk (403)
        $this->actingAs($cashier, 'sanctum')->deleteJson("/api/products/{$activeProduct->id}")
            ->assertStatus(403);

        // Kasir dilarang menyesuaikan stok manual (403)
        $this->actingAs($cashier, 'sanctum')->postJson("/api/products/{$activeProduct->id}/stock-adjustments", [
            'type' => 'in',
            'quantity' => 10,
        ])->assertStatus(403);

        $activeProduct->delete();
        $inactiveProduct->delete();
    }

    /**
     * Validasi SKU unik, harga negatif, stok negatif, dan kategori tidak valid
     */
    public function test_product_validation_rules(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();

        $existingProduct = Product::create([
            'category_id' => $category->id,
            'sku' => 'SKU-DUP-' . Str::random(4),
            'name' => 'Produk Duplikat',
            'cost_price' => 5000,
            'selling_price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);

        // 1. SKU duplikat
        $this->actingAs($admin, 'sanctum')->postJson('/api/products', [
            'sku' => $existingProduct->sku,
            'name' => 'Produk SKU Sama',
            'category_id' => $category->id,
            'cost_price' => 5000,
            'selling_price' => 10000,
            'stock' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['sku']);

        // 2. Harga negatif & stok negatif
        $this->actingAs($admin, 'sanctum')->postJson('/api/products', [
            'sku' => 'SKU-NEG-' . Str::random(4),
            'name' => 'Produk Negatif',
            'category_id' => $category->id,
            'cost_price' => -500,
            'selling_price' => -1000,
            'stock' => -10,
        ])->assertStatus(422)->assertJsonValidationErrors(['cost_price', 'selling_price', 'stock']);

        // 3. Kategori tidak valid (non-existent ID)
        $this->actingAs($admin, 'sanctum')->postJson('/api/products', [
            'sku' => 'SKU-NOCAT-' . Str::random(4),
            'name' => 'Produk Tanpa Kategori Valid',
            'category_id' => 999999,
            'cost_price' => 5000,
            'selling_price' => 10000,
            'stock' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['category_id']);

        $existingProduct->delete();
    }

    /**
     * Admin dapat membuat, membaca, memperbarui, dan menghapus produk baru (tanpa riwayat)
     */
    public function test_admin_can_crud_product(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();
        $sku = 'TEST-CRUD-' . Str::random(4);

        // 1. Create (stok 0 agar tidak otomatis membuat stock movement untuk pengujian hapus)
        $createResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/products', [
            'sku' => $sku,
            'name' => 'Produk Baru Admin',
            'category_id' => $category->id,
            'description' => 'Deskripsi produk baru',
            'cost_price' => 25000,
            'selling_price' => 35000,
            'stock' => 0,
            'min_stock' => 5,
            'is_active' => true,
        ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Produk berhasil ditambahkan.',
            ]);

        $productId = $createResponse->json('data.id');

        // 2. Read detail
        $this->actingAs($admin, 'sanctum')->getJson("/api/products/{$productId}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $productId,
                    'sku' => $sku,
                ],
            ]);

        // 3. Update
        $this->actingAs($admin, 'sanctum')->putJson("/api/products/{$productId}", [
            'sku' => $sku,
            'name' => 'Produk Baru Admin (Diperbarui)',
            'category_id' => $category->id,
            'cost_price' => 26000,
            'selling_price' => 38000,
            'min_stock' => 8,
            'is_active' => true,
        ])->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Produk Baru Admin (Diperbarui)',
                    'selling_price' => '38000.00',
                ],
            ]);

        // 4. Delete produk aman (tanpa riwayat)
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/products/{$productId}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Produk berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('products', ['id' => $productId]);
    }

    /**
     * Pencarian berdasarkan nama/SKU dan filter kategori
     */
    public function test_search_and_filter_products(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();

        $uniqueKeyword = 'KataKunci' . Str::random(4);
        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'SKU-' . $uniqueKeyword,
            'name' => 'Barang Khusus ' . $uniqueKeyword,
            'cost_price' => 5000,
            'selling_price' => 8000,
            'stock' => 10,
            'is_active' => true,
        ]);

        // Pencarian dengan keyword
        $searchResponse = $this->actingAs($admin, 'sanctum')->getJson("/api/products?search={$uniqueKeyword}");
        $searchResponse->assertStatus(200);
        $this->assertCount(1, $searchResponse->json('data'));
        $this->assertEquals($product->id, $searchResponse->json('data.0.id'));

        // Filter kategori yang cocok
        $filterResponse = $this->actingAs($admin, 'sanctum')->getJson("/api/products?category_id={$category->id}&search={$uniqueKeyword}");
        $filterResponse->assertStatus(200);
        $this->assertCount(1, $filterResponse->json('data'));

        $product->delete();
    }

    /**
     * Produk dengan riwayat mutasi stok tidak dapat dihapus
     */
    public function test_product_with_stock_movement_cannot_be_deleted(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();

        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'HIST-' . Str::random(5),
            'name' => 'Produk Dengan Mutasi',
            'cost_price' => 5000,
            'selling_price' => 8000,
            'stock' => 15,
            'is_active' => true,
        ]);

        StockMovement::create([
            'product_id' => $product->id,
            'user_id' => $admin->id,
            'type' => 'in',
            'quantity' => 15,
            'note' => 'Stok awal',
        ]);

        // Coba hapus
        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/products/{$product->id}");
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('products', ['id' => $product->id]);

        // Cleanup
        $product->stockMovements()->delete();
        $product->delete();
    }

    /**
     * Mutasi stok manual mencatat riwayat dan memperbarui stok secara konsisten
     */
    public function test_stock_adjustment_creates_movement_and_updates_stock(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();

        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'MUTASI-' . Str::random(5),
            'name' => 'Produk Uji Mutasi',
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 20,
            'is_active' => true,
        ]);

        // 1. Stok Masuk (type: in) +10
        $inResponse = $this->actingAs($admin, 'sanctum')->postJson("/api/products/{$product->id}/stock-adjustments", [
            'type' => 'in',
            'quantity' => 10,
            'note' => 'Penerimaan stok dari supplier',
        ]);

        $inResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'product' => [
                        'stock' => 30,
                    ],
                ],
            ]);

        $this->assertEquals(30, $product->fresh()->stock);

        // 2. Stok Keluar (type: out) -5
        $outResponse = $this->actingAs($admin, 'sanctum')->postJson("/api/products/{$product->id}/stock-adjustments", [
            'type' => 'out',
            'quantity' => 5,
            'note' => 'Barang rusak / kedaluwarsa',
        ]);

        $outResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'product' => [
                        'stock' => 25,
                    ],
                ],
            ]);

        $this->assertEquals(25, $product->fresh()->stock);

        // 3. Stok Penyesuaian Fisik (type: adjustment) -> diatur ke 40
        $adjResponse = $this->actingAs($admin, 'sanctum')->postJson("/api/products/{$product->id}/stock-adjustments", [
            'type' => 'adjustment',
            'quantity' => 40,
            'note' => 'Stok opname bulanan',
        ]);

        $adjResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'product' => [
                        'stock' => 40,
                    ],
                ],
            ]);

        $this->assertEquals(40, $product->fresh()->stock);

        // 4. Verifikasi riwayat mutasi
        $movementsResponse = $this->actingAs($admin, 'sanctum')->getJson("/api/products/{$product->id}/stock-movements");
        $movementsResponse->assertStatus(200);
        $this->assertCount(3, $movementsResponse->json('data'));

        // Cleanup
        $product->stockMovements()->delete();
        $product->delete();
    }

    /**
     * Mencegah stok menjadi bernilai negatif
     */
    public function test_negative_stock_is_prevented(): void
    {
        $admin = $this->getAdmin();
        $category = $this->getTestCategory();

        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'NO-NEG-' . Str::random(5),
            'name' => 'Produk Uji Stok Negatif',
            'cost_price' => 5000,
            'selling_price' => 8000,
            'stock' => 5,
            'is_active' => true,
        ]);

        // Coba kurangi 10 saat stok hanya 5
        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/products/{$product->id}/stock-adjustments", [
            'type' => 'out',
            'quantity' => 10,
            'note' => 'Pengurangan melebihi stok',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // Stok tidak berubah
        $this->assertEquals(5, $product->fresh()->stock);

        // Coba adjustment dengan nilai negatif
        $negResponse = $this->actingAs($admin, 'sanctum')->postJson("/api/products/{$product->id}/stock-adjustments", [
            'type' => 'adjustment',
            'quantity' => -1,
            'note' => 'Adjustment negatif',
        ]);

        $negResponse->assertStatus(422);

        $product->delete();
    }
}
