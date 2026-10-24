<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class CategoryTest extends TestCase
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

    /**
     * Menolak akses tanpa login (401 Unauthorized)
     */
    public function test_unauthenticated_user_cannot_access_categories(): void
    {
        $response = $this->getJson('/api/categories');
        $response->assertStatus(401);
    }

    /**
     * Membaca kategori setelah login (Admin & Kasir)
     */
    public function test_authenticated_user_can_read_categories(): void
    {
        $cashier = $this->getCashier();

        $category = Category::create([
            'name' => 'Kategori Uji ' . Str::random(5),
            'description' => 'Deskripsi uji',
        ]);

        $response = $this->actingAs($cashier, 'sanctum')->getJson('/api/categories');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['id', 'name', 'description', 'products_count', 'created_at', 'updated_at'],
                ],
            ]);

        $category->delete();
    }

    /**
     * Menolak mutasi kategori oleh kasir (403 Forbidden)
     */
    public function test_cashier_cannot_mutate_categories(): void
    {
        $cashier = $this->getCashier();

        $category = Category::create([
            'name' => 'Kategori Khusus ' . Str::random(5),
            'description' => 'Deskripsi',
        ]);

        // Coba Create
        $createResponse = $this->actingAs($cashier, 'sanctum')->postJson('/api/categories', [
            'name' => 'Coba Tambah Kasir',
        ]);
        $createResponse->assertStatus(403);

        // Coba Update
        $updateResponse = $this->actingAs($cashier, 'sanctum')->putJson("/api/categories/{$category->id}", [
            'name' => 'Coba Edit Kasir',
        ]);
        $updateResponse->assertStatus(403);

        // Coba Delete
        $deleteResponse = $this->actingAs($cashier, 'sanctum')->deleteJson("/api/categories/{$category->id}");
        $deleteResponse->assertStatus(403);

        $category->delete();
    }

    /**
     * Validasi nama kategori (wajib diisi & unik)
     */
    public function test_category_validation_rules(): void
    {
        $admin = $this->getAdmin();

        // 1. Nama wajib diisi
        $emptyResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/categories', [
            'name' => '',
        ]);
        $emptyResponse->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // 2. Nama harus unik
        $uniqueName = 'Unik ' . Str::random(6);
        $category = Category::create(['name' => $uniqueName]);

        $duplicateResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/categories', [
            'name' => $uniqueName,
        ]);
        $duplicateResponse->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $category->delete();
    }

    /**
     * Admin dapat membuat, mengedit, dan menghapus kategori
     */
    public function test_admin_can_crud_category(): void
    {
        $admin = $this->getAdmin();
        $name = 'Kategori CRUD ' . Str::random(5);

        // Create
        $createResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/categories', [
            'name' => $name,
            'description' => 'Deskripsi CRUD',
        ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Kategori berhasil ditambahkan.',
            ]);

        $categoryId = $createResponse->json('data.id');

        // Update
        $updatedName = $name . ' Diperbarui';
        $updateResponse = $this->actingAs($admin, 'sanctum')->putJson("/api/categories/{$categoryId}", [
            'name' => $updatedName,
            'description' => 'Deskripsi setelah edit',
        ]);

        $updateResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Kategori berhasil diperbarui.',
                'data' => [
                    'id' => $categoryId,
                    'name' => $updatedName,
                ],
            ]);

        // Delete
        $deleteResponse = $this->actingAs($admin, 'sanctum')->deleteJson("/api/categories/{$categoryId}");
        $deleteResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Kategori berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('categories', ['id' => $categoryId]);
    }

    /**
     * Menolak penghapusan kategori jika masih digunakan produk
     */
    public function test_cannot_delete_category_with_existing_products(): void
    {
        $admin = $this->getAdmin();

        $category = Category::create([
            'name' => 'Kategori Dengan Produk ' . Str::random(5),
            'description' => 'Kategori terikat produk',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'TEST-' . strtoupper(Str::random(6)),
            'name' => 'Produk Pengetesan',
            'cost_price' => 10000,
            'selling_price' => 15000,
            'stock' => 10,
            'min_stock' => 2,
            'is_active' => true,
        ]);

        // Coba hapus
        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);

        // Cleanup
        $product->delete();
        $category->delete();
    }
}
