<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStockMovementRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', 'in:in,out,adjustment'],
            'quantity' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:500'],
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
            'type.required' => 'Jenis mutasi stok wajib dipilih.',
            'type.in' => 'Jenis mutasi harus berupa in (masuk), out (keluar), atau adjustment (penyesuaian).',
            'quantity.required' => 'Jumlah kuantitas stok wajib diisi.',
            'quantity.integer' => 'Kuantitas harus berupa bilangan bulat.',
            'note.max' => 'Catatan mutasi maksimal 500 karakter.',
        ];
    }
}
