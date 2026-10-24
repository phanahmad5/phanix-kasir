<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && $user->is_active && ($user->isAdmin() || $user->isCashier());
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'in:cash,qris,transfer,debit'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Custom validation messages in Indonesian.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Daftar item transaksi tidak boleh kosong.',
            'items.array' => 'Format item transaksi harus berupa daftar array.',
            'items.min' => 'Transaksi harus memiliki minimal 1 item produk.',
            'items.*.product_id.required' => 'ID produk wajib diisi pada setiap item.',
            'items.*.product_id.integer' => 'ID produk harus berupa bilangan bulat.',
            'items.*.product_id.exists' => 'Salah satu produk yang dipilih tidak ditemukan dalam sistem.',
            'items.*.quantity.required' => 'Kuantitas produk wajib diisi.',
            'items.*.quantity.integer' => 'Kuantitas produk harus berupa bilangan bulat.',
            'items.*.quantity.min' => 'Kuantitas setiap item minimal 1.',
            'discount.numeric' => 'Nominal diskon harus berupa angka.',
            'discount.min' => 'Nominal diskon tidak boleh bernilai negatif.',
            'payment_method.required' => 'Metode pembayaran wajib dipilih.',
            'payment_method.in' => 'Metode pembayaran harus berupa cash, qris, transfer, atau debit.',
            'paid_amount.required' => 'Nominal uang pembayaran wajib diisi.',
            'paid_amount.numeric' => 'Nominal uang pembayaran harus berupa angka.',
            'paid_amount.min' => 'Nominal uang pembayaran tidak boleh bernilai negatif.',
        ];
    }
}
