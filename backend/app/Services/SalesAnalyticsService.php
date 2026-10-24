<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SalesAnalyticsService
{
    /**
     * Menyelesaikan rentang tanggal dan periode pembanding yang setara.
     *
     * @return array{
     *   period: string,
     *   start_date: Carbon,
     *   end_date: Carbon,
     *   prev_start_date: Carbon,
     *   prev_end_date: Carbon,
     *   days: int
     * }
     */
    public function resolveDateRange(?string $period = 'last_7_days', ?string $startDateStr = null, ?string $endDateStr = null): array
    {
        $period = $period ?: 'last_7_days';

        if ($period === 'today') {
            $start = Carbon::today()->startOfDay();
            $end = Carbon::today()->endOfDay();
            $days = 1;

            $prevEnd = Carbon::yesterday()->endOfDay();
            $prevStart = Carbon::yesterday()->startOfDay();
        } elseif ($period === 'last_30_days' || $period === '30days') {
            $end = Carbon::today()->endOfDay();
            $start = Carbon::today()->subDays(29)->startOfDay();
            $days = 30;

            $prevEnd = $start->copy()->subDay()->endOfDay();
            $prevStart = $prevEnd->copy()->subDays(29)->startOfDay();
        } elseif ($period === 'custom' && $startDateStr && $endDateStr) {
            $start = Carbon::parse($startDateStr)->startOfDay();
            $end = Carbon::parse($endDateStr)->endOfDay();
            $days = $start->diffInDays($end) + 1;

            $prevEnd = $start->copy()->subDay()->endOfDay();
            $prevStart = $prevEnd->copy()->subDays($days - 1)->startOfDay();
        } else {
            // Default: last_7_days
            $period = 'last_7_days';
            $end = Carbon::today()->endOfDay();
            $start = Carbon::today()->subDays(6)->startOfDay();
            $days = 7;

            $prevEnd = $start->copy()->subDay()->endOfDay();
            $prevStart = $prevEnd->copy()->subDays(6)->startOfDay();
        }

        return [
            'period' => $period,
            'start_date' => $start,
            'end_date' => $end,
            'prev_start_date' => $prevStart,
            'prev_end_date' => $prevEnd,
            'days' => $days,
        ];
    }

    /**
     * Mengambil ringkasan metrik KPI untuk periode saat ini dan perbandingan periode sebelumnya.
     */
    public function getKpiSummary(User $user, Carbon $start, Carbon $end, Carbon $prevStart, Carbon $prevEnd): array
    {
        $currentStats = $this->calculateBasicStats($user, $start, $end);
        $prevStats = $this->calculateBasicStats($user, $prevStart, $prevEnd);

        return [
            'net_turnover' => $this->buildMetricComparison($currentStats['net_turnover'], $prevStats['net_turnover']),
            'transaction_count' => $this->buildMetricComparison($currentStats['transaction_count'], $prevStats['transaction_count']),
            'average_transaction_value' => $this->buildMetricComparison($currentStats['average_transaction_value'], $prevStats['average_transaction_value']),
            'items_sold' => $this->buildMetricComparison($currentStats['items_sold'], $prevStats['items_sold']),
            'gross_profit' => $this->buildMetricComparison($currentStats['gross_profit'], $prevStats['gross_profit']),
        ];
    }

    /**
     * Menghitung statistik dasar transaksi penjualan selesai.
     */
    public function calculateBasicStats(User $user, Carbon $start, Carbon $end): array
    {
        $txQuery = Transaction::query()
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end]);

        if ($user->isCashier()) {
            $txQuery->where('user_id', $user->id);
        }

        $txAgg = (clone $txQuery)->selectRaw('
            COUNT(id) as tx_count,
            COALESCE(SUM(total), 0) as net_turnover,
            COALESCE(SUM(subtotal), 0) as gross_subtotal,
            COALESCE(SUM(discount), 0) as total_discount
        ')->first();

        $itemsQuery = TransactionItem::query()
            ->join('transactions', 'transaction_items.transaction_id', '=', 'transactions.id')
            ->where('transactions.status', 'completed')
            ->whereBetween('transactions.created_at', [$start, $end]);

        if ($user->isCashier()) {
            $itemsQuery->where('transactions.user_id', $user->id);
        }

        $itemsAgg = $itemsQuery->selectRaw('
            COALESCE(SUM(transaction_items.quantity), 0) as items_sold,
            COALESCE(SUM(transaction_items.cost_price * transaction_items.quantity), 0) as total_cogs
        ')->first();

        $txCount = (int) ($txAgg->tx_count ?? 0);
        $netTurnover = (float) ($txAgg->net_turnover ?? 0);
        $totalCogs = (float) ($itemsAgg->total_cogs ?? 0);
        $itemsSold = (int) ($itemsAgg->items_sold ?? 0);

        $avgValue = $txCount > 0 ? round($netTurnover / $txCount, 2) : 0.0;
        $grossProfit = round($netTurnover - $totalCogs, 2);

        return [
            'transaction_count' => $txCount,
            'net_turnover' => $netTurnover,
            'items_sold' => $itemsSold,
            'average_transaction_value' => $avgValue,
            'gross_profit' => $grossProfit,
            'total_cogs' => $totalCogs,
            'total_discount' => (float) ($txAgg->total_discount ?? 0),
        ];
    }

    /**
     * Membangun objek pembanding metrik.
     */
    protected function buildMetricComparison(float|int $current, float|int $previous): array
    {
        $change = 0.0;
        if ($previous > 0) {
            $change = round((($current - $previous) / $previous) * 100, 1);
        } elseif ($current > 0) {
            $change = 100.0;
        }

        $trend = $change > 0 ? 'up' : ($change < 0 ? 'down' : 'same');

        return [
            'current' => $current,
            'previous' => $previous,
            'change_percentage' => $change,
            'trend' => $trend,
        ];
    }

    /**
     * Mengambil data omzet per hari dalam rentang tanggal tanpa ada hari yang kosong.
     */
    public function getDailySales(User $user, Carbon $start, Carbon $end): array
    {
        $txQuery = Transaction::query()
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end]);

        if ($user->isCashier()) {
            $txQuery->where('user_id', $user->id);
        }

        $dailyTx = (clone $txQuery)
            ->selectRaw('
                DATE(created_at) as tx_date,
                COUNT(id) as count,
                COALESCE(SUM(total), 0) as total
            ')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->get()
            ->keyBy('tx_date');

        $itemsQuery = TransactionItem::query()
            ->join('transactions', 'transaction_items.transaction_id', '=', 'transactions.id')
            ->where('transactions.status', 'completed')
            ->whereBetween('transactions.created_at', [$start, $end]);

        if ($user->isCashier()) {
            $itemsQuery->where('transactions.user_id', $user->id);
        }

        $dailyItems = $itemsQuery
            ->selectRaw('
                DATE(transactions.created_at) as tx_date,
                COALESCE(SUM(transaction_items.quantity), 0) as items_sold
            ')
            ->groupBy(DB::raw('DATE(transactions.created_at)'))
            ->get()
            ->keyBy('tx_date');

        $result = [];
        $cursor = $start->copy()->startOfDay();
        $endCursor = $end->copy()->startOfDay();
        $dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

        while ($cursor->lte($endCursor)) {
            $dateStr = $cursor->format('Y-m-d');
            $dayOfWeek = $cursor->dayOfWeek; // 0 = Minggu
            $tx = $dailyTx->get($dateStr);
            $it = $dailyItems->get($dateStr);

            $result[] = [
                'date' => $dateStr,
                'day_name' => $dayNames[$dayOfWeek],
                'total' => $tx ? (float) $tx->total : 0.0,
                'count' => $tx ? (int) $tx->count : 0,
                'items_sold' => $it ? (int) $it->items_sold : 0,
            ];

            $cursor->addDay();
        }

        return $result;
    }

    /**
     * Mengambil ringkasan distribusi metode pembayaran.
     */
    public function getPaymentMethodSummary(User $user, Carbon $start, Carbon $end, float $totalTurnover): array
    {
        $query = Transaction::query()
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end]);

        if ($user->isCashier()) {
            $query->where('user_id', $user->id);
        }

        return $query
            ->selectRaw('
                payment_method,
                COUNT(id) as count,
                COALESCE(SUM(total), 0) as total
            ')
            ->groupBy('payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(function ($row) use ($totalTurnover) {
                $pct = $totalTurnover > 0 ? round(($row->total / $totalTurnover) * 100, 1) : 0.0;
                return [
                    'payment_method' => $row->payment_method,
                    'count' => (int) $row->count,
                    'total' => (float) $row->total,
                    'percentage' => $pct,
                ];
            })
            ->toArray();
    }

    /**
     * Mengambil daftar produk terlaris berdasarkan kuantitas terjual snapshot.
     */
    public function getTopProducts(User $user, Carbon $start, Carbon $end, int $limit = 5): array
    {
        $query = TransactionItem::query()
            ->join('transactions', 'transaction_items.transaction_id', '=', 'transactions.id')
            ->where('transactions.status', 'completed')
            ->whereBetween('transactions.created_at', [$start, $end]);

        if ($user->isCashier()) {
            $query->where('transactions.user_id', $user->id);
        }

        return $query
            ->selectRaw('
                transaction_items.product_name,
                transaction_items.sku,
                COALESCE(SUM(transaction_items.quantity), 0) as total_quantity,
                COALESCE(SUM(transaction_items.subtotal), 0) as total_revenue
            ')
            ->groupBy('transaction_items.product_name', 'transaction_items.sku')
            ->orderByDesc('total_quantity')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                return [
                    'product_name' => $row->product_name,
                    'sku' => $row->sku,
                    'total_quantity' => (int) $row->total_quantity,
                    'total_revenue' => (float) $row->total_revenue,
                ];
            })
            ->toArray();
    }

    /**
     * Mengambil ringkasan penjualan per kasir (khusus admin).
     */
    public function getCashierSummary(Carbon $start, Carbon $end): array
    {
        return Transaction::query()
            ->join('users', 'transactions.user_id', '=', 'users.id')
            ->where('transactions.status', 'completed')
            ->whereBetween('transactions.created_at', [$start, $end])
            ->selectRaw('
                users.id as user_id,
                users.name as user_name,
                COUNT(transactions.id) as transaction_count,
                COALESCE(SUM(transactions.total), 0) as total_sales
            ')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total_sales')
            ->get()
            ->map(function ($row) {
                return [
                    'user_id' => (int) $row->user_id,
                    'user_name' => $row->user_name,
                    'transaction_count' => (int) $row->transaction_count,
                    'total_sales' => (float) $row->total_sales,
                ];
            })
            ->toArray();
    }

    /**
     * Mengambil daftar produk stok menipis dan total produk aktif.
     */
    public function getStockAlerts(): array
    {
        $activeCount = Product::where('is_active', true)->count();
        $lowStockProducts = Product::where('is_active', true)
            ->whereColumn('stock', '<=', 'min_stock')
            ->select('id', 'name', 'sku', 'stock', 'min_stock')
            ->orderBy('stock', 'asc')
            ->limit(5)
            ->get();

        return [
            'active_products_count' => $activeCount,
            'low_stock_products' => $lowStockProducts,
        ];
    }

    /**
     * Mengekspor transaksi selesai ke file CSV stream.
     */
    public function exportCsv(User $user, Carbon $start, Carbon $end): StreamedResponse
    {
        $query = Transaction::with(['user:id,name', 'items'])
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end]);

        if ($user->isCashier()) {
            $query->where('user_id', $user->id);
        }

        $transactions = $query->orderBy('created_at', 'desc')->get();

        $filename = sprintf(
            'laporan-penjualan-%s-sd-%s.csv',
            $start->format('Ymd'),
            $end->format('Ymd')
        );

        $response = new StreamedResponse(function () use ($transactions) {
            $handle = fopen('php://output', 'w');

            // Tulis Byte Order Mark (BOM) UTF-8 agar karakter dibuka sempurna di Excel
            fputs($handle, "\xEF\xBB\xBF");

            // Header Kolom CSV
            fputcsv($handle, [
                'No. Invoice',
                'Waktu Transaksi',
                'Kasir',
                'Metode Pembayaran',
                'Jumlah Item',
                'Subtotal (Rp)',
                'Diskon (Rp)',
                'Total Akhir (Rp)',
                'Status',
            ]);

            foreach ($transactions as $t) {
                $totalItemsQty = $t->items->sum('quantity');

                fputcsv($handle, [
                    $t->invoice_number,
                    $t->created_at->format('Y-m-d H:i:s'),
                    $t->user->name ?? '-',
                    strtoupper($t->payment_method),
                    $totalItemsQty,
                    $t->subtotal,
                    $t->discount,
                    $t->total,
                    $t->status,
                ]);
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=UTF-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $filename . '"');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}
