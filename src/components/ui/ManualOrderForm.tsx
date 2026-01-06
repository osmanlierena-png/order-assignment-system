'use client'

import { useState } from 'react'
import Button from './Button'

interface ManualOrderFormProps {
  onSubmit: (orders: OrderInput[]) => void
  onClose: () => void
}

interface OrderInput {
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
}

export default function ManualOrderForm({ onSubmit, onClose }: ManualOrderFormProps) {
  const [orders, setOrders] = useState<OrderInput[]>([
    {
      orderNumber: '',
      pickupTime: '',
      pickupAddress: '',
      dropoffTime: '',
      dropoffAddress: '',
    },
  ])

  const addOrder = () => {
    setOrders([
      ...orders,
      {
        orderNumber: '',
        pickupTime: '',
        pickupAddress: '',
        dropoffTime: '',
        dropoffAddress: '',
      },
    ])
  }

  const removeOrder = (index: number) => {
    if (orders.length > 1) {
      setOrders(orders.filter((_, i) => i !== index))
    }
  }

  const updateOrder = (index: number, field: keyof OrderInput, value: string) => {
    const newOrders = [...orders]
    newOrders[index][field] = value
    setOrders(newOrders)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validOrders = orders.filter(
      (o) => o.orderNumber && o.pickupTime && o.pickupAddress
    )
    if (validOrders.length > 0) {
      onSubmit(validOrders)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Manuel Sipariş Girişi</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {orders.map((order, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-gray-700">
                    Sipariş #{index + 1}
                  </span>
                  {orders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrder(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Kaldır
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sipariş No *
                    </label>
                    <input
                      type="text"
                      value={order.orderNumber}
                      onChange={(e) =>
                        updateOrder(index, 'orderNumber', e.target.value)
                      }
                      placeholder="Ez7X2A4G"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup Time *
                      </label>
                      <input
                        type="text"
                        value={order.pickupTime}
                        onChange={(e) =>
                          updateOrder(index, 'pickupTime', e.target.value)
                        }
                        placeholder="10:15 AM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Time
                      </label>
                      <input
                        type="text"
                        value={order.dropoffTime}
                        onChange={(e) =>
                          updateOrder(index, 'dropoffTime', e.target.value)
                        }
                        placeholder="10:45 AM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Address *
                    </label>
                    <input
                      type="text"
                      value={order.pickupAddress}
                      onChange={(e) =>
                        updateOrder(index, 'pickupAddress', e.target.value)
                      }
                      placeholder="144 National Plaza, Oxon Hill, MD 20745"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Address
                    </label>
                    <input
                      type="text"
                      value={order.dropoffAddress}
                      onChange={(e) =>
                        updateOrder(index, 'dropoffAddress', e.target.value)
                      }
                      placeholder="6228 Oxon Hill Rd, Oxon Hill, MD 20745"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addOrder}
            className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            + Yeni Sipariş Ekle
          </button>
        </form>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}>
            {orders.length} Sipariş Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}
