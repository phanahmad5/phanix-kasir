<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with demo accounts.
     */
    public function run(): void
    {
        // 1. Akun Admin
        User::updateOrCreate(
            ['email' => 'admin@phanixpos.test'],
            [
                'name' => 'Administrator Phanix',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        // 2. Akun Kasir Aktif
        User::updateOrCreate(
            ['email' => 'kasir@phanixpos.test'],
            [
                'name' => 'Ahmad Kasir',
                'password' => Hash::make('password123'),
                'role' => 'cashier',
                'is_active' => true,
            ]
        );

        // 3. Akun Nonaktif (untuk pengujian keamanan)
        User::updateOrCreate(
            ['email' => 'inactive@phanixpos.test'],
            [
                'name' => 'Kasir Nonaktif',
                'password' => Hash::make('password123'),
                'role' => 'cashier',
                'is_active' => false,
            ]
        );

        // 4. Kategori Awal (Master Data)
        $defaultCategories = [
            ['name' => 'Makanan & Sembako', 'description' => 'Kebutuhan pokok dan bahan makanan dapur'],
            ['name' => 'Minuman Segar', 'description' => 'Aneka minuman dingin, kopi, dan teh kemasan'],
            ['name' => 'Camilan & Snack', 'description' => 'Biskuit, keripik, dan makanan ringan santai'],
            ['name' => 'Kebutuhan Rumah', 'description' => 'Sabun cuci, pasta gigi, dan alat kebersihan'],
        ];

        foreach ($defaultCategories as $categoryData) {
            \App\Models\Category::firstOrCreate(
                ['name' => $categoryData['name']],
                $categoryData
            );
        }

        // 5. Produk Awal (Katalog Produk & Stok)
        $adminUser = User::where('email', 'admin@phanixpos.test')->first();
        $catSembako = \App\Models\Category::where('name', 'Makanan & Sembako')->first();
        $catMinuman = \App\Models\Category::where('name', 'Minuman Segar')->first();
        $catSnack = \App\Models\Category::where('name', 'Camilan & Snack')->first();
        $catRumah = \App\Models\Category::where('name', 'Kebutuhan Rumah')->first();

        $defaultProducts = [
            [
                'sku' => 'BRG-001',
                'name' => 'Beras Premium Ramos 5kg',
                'category_id' => $catSembako?->id,
                'cost_price' => 68000,
                'selling_price' => 75000,
                'stock' => 18,
                'min_stock' => 5,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-002',
                'name' => 'Minyak Goreng Pouch 2L',
                'category_id' => $catSembako?->id,
                'cost_price' => 32000,
                'selling_price' => 36000,
                'stock' => 8,
                'min_stock' => 5,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-003',
                'name' => 'Gula Pasir Kristal Putih 1kg',
                'category_id' => $catSembako?->id,
                'cost_price' => 15500,
                'selling_price' => 17500,
                'stock' => 3,
                'min_stock' => 5,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-004',
                'name' => 'Kopi Susu Espresso Botol 250ml',
                'category_id' => $catMinuman?->id,
                'cost_price' => 8500,
                'selling_price' => 12000,
                'stock' => 24,
                'min_stock' => 6,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-005',
                'name' => 'Teh Hijau Melati Botol 450ml',
                'category_id' => $catMinuman?->id,
                'cost_price' => 4000,
                'selling_price' => 6000,
                'stock' => 30,
                'min_stock' => 10,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-006',
                'name' => 'Keripik Singkong Balado 150g',
                'category_id' => $catSnack?->id,
                'cost_price' => 9000,
                'selling_price' => 13500,
                'stock' => 14,
                'min_stock' => 5,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-007',
                'name' => 'Biskuit Gandum Cokelat 200g',
                'category_id' => $catSnack?->id,
                'cost_price' => 11000,
                'selling_price' => 15000,
                'stock' => 4,
                'min_stock' => 6,
                'is_active' => true,
            ],
            [
                'sku' => 'BRG-008',
                'name' => 'Sabun Cuci Piring Ekstrak Jeruk Nipis 750ml',
                'category_id' => $catRumah?->id,
                'cost_price' => 12500,
                'selling_price' => 15500,
                'stock' => 12,
                'min_stock' => 4,
                'is_active' => true,
            ],
        ];

        foreach ($defaultProducts as $productData) {
            $product = \App\Models\Product::firstOrCreate(
                ['sku' => $productData['sku']],
                $productData
            );

            if ($product->wasRecentlyCreated && $product->stock > 0 && $adminUser) {
                \App\Models\StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $adminUser->id,
                    'type' => 'in',
                    'quantity' => $product->stock,
                    'note' => 'Stok awal demo produk',
                ]);
            }
        }
    }
}
