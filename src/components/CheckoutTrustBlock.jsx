import { useMemo } from "react";
import SocialProofStrip from "./SocialProofStrip";
import TrustStrip from "./TrustStrip";
import { getLoyaltyStatus, LOYALTY_PROMO_CODE } from "../lib/loyalty";

export default function CheckoutTrustBlock() {
  const loyalty = useMemo(() => getLoyaltyStatus(), []);

  return (
    <div className="checkout-trust-block">
      {loyalty.rewardPending || loyalty.remaining > 0 ? (
        <div className="checkout-trust-loyalty">
          {loyalty.rewardPending ? (
            <p>
              <strong>Reward pelanggan setia!</strong> Pakai <code>{LOYALTY_PROMO_CODE}</code> untuk diskon order ke-{loyalty.count + 1}.
            </p>
          ) : (
            <p>
              Order {loyalty.threshold}x dapat <code>{LOYALTY_PROMO_CODE}</code> - tinggal <strong>{loyalty.remaining}</strong> order lagi.
            </p>
          )}
        </div>
      ) : null}
      <SocialProofStrip limit={2} title="Pembeli lain sudah checkout" />
      <TrustStrip compact />
    </div>
  );
}
