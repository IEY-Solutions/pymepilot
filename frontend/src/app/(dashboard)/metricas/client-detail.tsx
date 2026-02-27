"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  times_ordered: number;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function ClientDetail({ customerId }: { customerId: string }) {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("get_client_top_products", {
        p_customer_id: customerId,
        p_limit: 5,
      })
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, [customerId]);

  if (loading) {
    return (
      <div className="text-xs text-gray-400 py-2">Cargando productos...</div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        Sin productos registrados
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 mb-2">
        Top 5 productos
      </h4>
      <div className="space-y-1.5">
        {products.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-gray-700 truncate flex-1 mr-3">
              {p.product_name}
            </span>
            <div className="flex gap-4 text-xs text-gray-500 shrink-0">
              <span>{formatCurrency(Number(p.total_revenue))}</span>
              <span>{Number(p.total_quantity)} uds</span>
              <span>{p.times_ordered}x</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
