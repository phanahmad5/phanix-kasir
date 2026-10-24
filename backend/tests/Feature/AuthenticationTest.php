<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    /**
     * Test endpoint health check
     */
    public function test_health_check_returns_healthy_status(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'status' => 'online',
                'message' => 'Phanix POS REST API is running healthy.',
            ]);
    }

    /**
     * Test login berhasil dengan kredensial valid
     */
    public function test_login_successful_with_valid_credentials(): void
    {
        $response = $this->postJson('/login', [
            'email' => 'admin@phanixpos.test',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login berhasil.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'is_active',
                    ],
                    'token',
                ],
            ]);

        $this->assertAuthenticated();
    }

    /**
     * Test login gagal dengan password salah
     */
    public function test_login_fails_with_invalid_credentials(): void
    {
        $response = $this->postJson('/login', [
            'email' => 'admin@phanixpos.test',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Email atau password yang Anda masukkan salah.',
            ]);

        $this->assertGuest();
    }

    /**
     * Test akun nonaktif ditolak saat login
     */
    public function test_inactive_account_is_rejected_on_login(): void
    {
        $response = $this->postJson('/login', [
            'email' => 'inactive@phanixpos.test',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.',
            ]);

        $this->assertGuest();
    }

    /**
     * Test akses /api/user tanpa autentikasi ditolak
     */
    public function test_unauthenticated_request_to_user_profile_is_unauthorized(): void
    {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    }

    /**
     * Test akses /api/user berhasil dengan user terautentikasi
     */
    public function test_authenticated_user_can_access_profile(): void
    {
        $user = User::where('email', 'kasir@phanixpos.test')->first();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/user');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'cashier',
                    'is_active' => true,
                ],
            ]);
    }

    /**
     * Test otorisasi role: kasir tidak boleh mengakses rute khusus admin
     */
    public function test_cashier_cannot_access_admin_route(): void
    {
        $cashier = User::where('email', 'kasir@phanixpos.test')->first();

        $response = $this->actingAs($cashier, 'sanctum')->getJson('/api/admin/dashboard-summary');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test otorisasi role: admin dapat mengakses rute khusus admin
     */
    public function test_admin_can_access_admin_route(): void
    {
        $admin = User::where('email', 'admin@phanixpos.test')->first();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard-summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /**
     * Test logout berhasil dan menghapus session
     */
    public function test_logout_invalidates_session(): void
    {
        $user = User::where('email', 'admin@phanixpos.test')->first();

        $response = $this->actingAs($user, 'web')->postJson('/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logout berhasil.',
            ]);

        $this->assertGuest();
    }
}
