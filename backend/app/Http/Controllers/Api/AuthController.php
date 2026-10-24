<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Endpoint login pengguna (Admin & Kasir)
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau password yang Anda masukkan salah.',
            ], 401);
        }

        if (! $user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.',
            ], 403);
        }

        // Login ke session stateful web
        Auth::login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        // Buat token Sanctum untuk fleksibilitas request SPA / Bearer Token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_active' => $user->is_active,
                ],
                'token' => $token,
            ],
        ], 200);
    }

    /**
     * Endpoint logout pengguna
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Hapus token saat ini jika ada
        if ($user && method_exists($user, 'currentAccessToken') && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        // Logout dari guard web
        Auth::guard('web')->logout();

        // Invalidate session dan regenerasi CSRF token
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ], 200);
    }

    /**
     * Endpoint mendapatkan data profil pengguna yang sedang login
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ],
        ], 200);
    }

    /**
     * Endpoint health check status REST API
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'status' => 'online',
            'message' => 'Phanix POS REST API is running healthy.',
            'version' => '1.0.0',
            'timestamp' => now()->toIso8601String(),
        ], 200);
    }
}
