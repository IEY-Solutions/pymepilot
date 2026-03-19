"use client";

import { Package } from "lucide-react";
import type { TopProduct } from "@/lib/key-accounts/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  products: TopProduct[];
}

export function DetailProducts({ products }: Props) {
  const maxRevenue = products.length > 0 ? products[0].total_revenue : 1;

  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60 flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" />
        Productos clave
      </h3>

      {products.length === 0 ? (
        <p className="text-xs text-white/30">Sin datos de productos</p>
      ) : (
        <div className="space-y-2">
          {products.slice(0, 10).map((product, i) => (
            <div key={product.product_name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70 truncate flex-1">
                  <span className="text-white/30 mr-1.5">{i + 1}.</span>
                  {product.product_name}
                </span>
                <span className="text-white font-medium ml-2 whitespace-nowrap">
                  {formatCurrency(product.total_revenue)}
                </span>
              </div>
              {/* Barra de proporcion */}
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#81b5a1]/40 rounded-full"
                  style={{
                    width: `${Math.max(2, (product.total_revenue / maxRevenue) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex gap-3 text-[10px] text-white/30">
                <span>{product.total_quantity} unidades</span>
                <span>{product.times_ordered} pedidos</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
