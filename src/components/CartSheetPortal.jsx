import { useCart } from "../context/CartContext";
import MobileCartSheet from "./MobileCartSheet";

/** Must render inside <BrowserRouter> — MobileCartSheet uses useLocation(). */
export default function CartSheetPortal() {
  const cart = useCart();
  return (
    <MobileCartSheet
      open={cart.isCartSheetOpen}
      onClose={cart.closeCartSheet}
    />
  );
}