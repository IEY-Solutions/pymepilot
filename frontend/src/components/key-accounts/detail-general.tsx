"use client";

import { Phone, Mail, Calendar } from "lucide-react";
import type { KeyAccount } from "@/lib/key-accounts/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  account: KeyAccount;
}

export function DetailGeneral({ account }: Props) {
  const { customer } = account;

  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60">Datos generales</h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-white/70">
          <span className="text-white/40 w-24">Facturacion:</span>
          <span className="text-white font-medium">
            {customer.total_purchases_amount
              ? formatCurrency(customer.total_purchases_amount)
              : "—"}
          </span>
        </div>

        {customer.phone && (
          <div className="flex items-center gap-2 text-white/70">
            <Phone className="h-3.5 w-3.5 text-white/40" />
            <a
              href={`tel:${customer.phone}`}
              className="hover:text-[#81b5a1] transition-colors"
            >
              {customer.phone}
            </a>
          </div>
        )}

        {customer.email && (
          <div className="flex items-center gap-2 text-white/70">
            <Mail className="h-3.5 w-3.5 text-white/40" />
            <a
              href={`mailto:${customer.email}`}
              className="hover:text-[#81b5a1] transition-colors"
            >
              {customer.email}
            </a>
          </div>
        )}

        {customer.last_purchase_date && (
          <div className="flex items-center gap-2 text-white/70">
            <Calendar className="h-3.5 w-3.5 text-white/40" />
            <span>
              Ultima compra:{" "}
              {new Date(customer.last_purchase_date).toLocaleDateString("es-AR")}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-white/50 text-xs">
          <span>Origen: {account.source === "manual" ? "Manual" : "Sugerida"}</span>
          <span>·</span>
          <span>
            Desde {new Date(account.created_at).toLocaleDateString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
}
