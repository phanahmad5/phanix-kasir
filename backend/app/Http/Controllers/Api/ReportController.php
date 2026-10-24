<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SalesAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        protected SalesAnalyticsService $analyticsService
    ) {}

    /**
     * Mengambil ringkasan laporan analitik penjualan berkala.
     */
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['nullable', 'string', 'in:today,last_7_days,last_30_days,custom'],
            'start_date' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom', 'after_or_equal:start_date'],
        ], [
            'period.in' => 'Pilihan periode harus salah satu dari: today, last_7_days, last_30_days, atau custom.',
            'start_date.required_if' => 'Tanggal mulai wajib diisi jika memilih periode custom.',
            'start_date.date_format' => 'Format tanggal mulai harus berupa YYYY-MM-DD.',
            'end_date.required_if' => 'Tanggal akhir wajib diisi jika memilih periode custom.',
            'end_date.date_format' => 'Format tanggal akhir harus berupa YYYY-MM-DD.',
            'end_date.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
        ]);

        $user = $request->user();
        $dateRange = $this->analyticsService->resolveDateRange(
            $validated['period'] ?? null,
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null
        );

        $start = $dateRange['start_date'];
        $end = $dateRange['end_date'];
        $prevStart = $dateRange['prev_start_date'];
        $prevEnd = $dateRange['prev_end_date'];

        // Metrik KPI & pembanding
        $kpi = $this->analyticsService->getKpiSummary($user, $start, $end, $prevStart, $prevEnd);

        // Rincian penjualan per hari
        $dailySales = $this->analyticsService->getDailySales($user, $start, $end);

        // Rekap metode pembayaran
        $netTurnover = $kpi['net_turnover']['current'] ?? 0.0;
        $paymentMethods = $this->analyticsService->getPaymentMethodSummary($user, $start, $end, $netTurnover);

        // Produk terlaris (Top 10)
        $topProducts = $this->analyticsService->getTopProducts($user, $start, $end, 10);

        // Rekap per kasir (khusus admin)
        $byCashier = $user->isAdmin() ? $this->analyticsService->getCashierSummary($start, $end) : null;

        return response()->json([
            'success' => true,
            'data' => [
                'period' => $dateRange['period'],
                'start_date' => $start->format('Y-m-d'),
                'end_date' => $end->format('Y-m-d'),
                'previous_start_date' => $prevStart->format('Y-m-d'),
                'previous_end_date' => $prevEnd->format('Y-m-d'),
                'days' => $dateRange['days'],
                'kpi' => $kpi,
                'daily_sales' => $dailySales,
                'by_payment_method' => $paymentMethods,
                'top_products' => $topProducts,
                'by_cashier' => $byCashier,
            ],
        ]);
    }

    /**
     * Mengekspor data laporan transaksi ke file CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'period' => ['nullable', 'string', 'in:today,last_7_days,last_30_days,custom'],
            'start_date' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom', 'after_or_equal:start_date'],
        ], [
            'period.in' => 'Pilihan periode harus salah satu dari: today, last_7_days, last_30_days, atau custom.',
            'start_date.required_if' => 'Tanggal mulai wajib diisi jika memilih periode custom.',
            'start_date.date_format' => 'Format tanggal mulai harus berupa YYYY-MM-DD.',
            'end_date.required_if' => 'Tanggal akhir wajib diisi jika memilih periode custom.',
            'end_date.date_format' => 'Format tanggal akhir harus berupa YYYY-MM-DD.',
            'end_date.after_or_equal' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
        ]);

        $user = $request->user();
        $dateRange = $this->analyticsService->resolveDateRange(
            $validated['period'] ?? null,
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null
        );

        return $this->analyticsService->exportCsv(
            $user,
            $dateRange['start_date'],
            $dateRange['end_date']
        );
    }
}
