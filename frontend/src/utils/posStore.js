/**
 * In-memory global store untuk state kasir POS
 * Mempertahankan isi keranjang, filter pencarian, dan pilihan kategori
 * saat berpindah antar halaman sehingga tidak perlu loading ulang dan keranjang tidak hilang.
 */

let posState = {
  cart: [],
  discount: '',
  cashGiven: '',
  selectedCategory: 'ALL',
  searchQuery: '',
}

const listeners = new Set()

export function getPosState() {
  return posState
}

export function setPosState(updates) {
  posState = { ...posState, ...updates }
  listeners.forEach((listener) => listener(posState))
}

export function resetPosCart() {
  posState = {
    ...posState,
    cart: [],
    discount: '',
    cashGiven: '',
  }
  listeners.forEach((listener) => listener(posState))
}

export function subscribePosState(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
