export interface Product {
  id: number;
  nameEn: string;
  nameRu: string;
  nameArm: string;
  price: number;
  isKilogram: boolean;
  minimumWeight: number | null;
  weightStep: number | null;
  discountPercent: number;
  photo: string;
}

export interface ProductSearchResult {
  pageCount: number;
  itemCount: number;
  products: Product[];
}

export interface Address {
  id: number;
  lat: number;
  lng: number;
  street: string;
  city: string;
  title: string;
  isDefault: boolean;
}

/**
 * The delivery address recorded on a past order. `buliding` keeps the
 * yerevan-city.am API's own spelling of that field.
 */
export interface OrderAddress {
  city: string;
  street: string;
  buliding: string;
  entrance: number | null;
  floor: number | null;
  apartment: number | null;
}

/**
 * A past order as returned by Order/GetAll.
 *
 * `status`, `paymentMethod` and `orderOriginType` are numeric codes from
 * yerevan-city.am whose meanings are not documented anywhere public — they
 * are passed through verbatim rather than guessed at. See the TODO in
 * orders.ts.
 */
export interface Order {
  id: number;
  uniqueId: string;
  createDate: string;
  finishDate: string;
  status: number;
  orderOriginType: number;
  paymentMethod: number;
  paymentTypeLogo: string;
  isDelivery: boolean;
  cityId: number;
  totalPrice: number;
  totalToPay: number;
  userDeliveryFee: number;
  serviceFee: number;
  driverTipAmount: number;
  address: OrderAddress | null;
}

/**
 * One line of a past order, as Order/GetById sends it inside `orderItems`
 * (and again inside `deletedItems`, for lines that were in the cart before
 * the customer deleted them).
 *
 * `id` is the **catalogue product id**, not an id of the order line — the
 * same number `search_products` and `add_to_cart` use, so a line can be
 * matched against the catalogue.
 *
 * Piece-counted and weight-based products share one shape. A piece-counted
 * line has `quantity` at its piece count and `weight` 0; a weight-based
 * (`isKilogram`) line carries its gram amount in `weight` and **`quantity` 0**,
 * so the amount bought can only be read from `weight`. Never derive a line's
 * price from `quantity * price`: weight lines would come out as zero. The
 * per-line `totalPrice` is what the site itself charged for that line.
 *
 * `initialPrice` is the price before the order-level discount and `bonus` the
 * loyalty points the line earned, both as sent by the site.
 *
 * `categoryName` and `note` come back as null on some lines — a deleted line
 * can lose its category, and an item with no customer note has no `note` at
 * all — so both are optional rather than defaulted to an empty string.
 *
 * Nothing here is an enum this repo can label: yerevan-city.am never
 * documents its codes, so what is exposed is passed through verbatim. See the
 * TODO in order-details.ts.
 */
export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  weight: number;
  isKilogram: boolean;
  totalPrice: number;
  initialPrice: number;
  bonus: number;
  categoryName: string | null;
  isBag: boolean;
  visiblePrice: number;
  note: string | null;
  photo: string;
}

/**
 * A single past order with its line items, from Order/GetById.
 *
 * Deliberately narrow: the live response carries roughly twenty more keys per
 * order, among them the customer's `phoneNumbers`, the `paymentInfo` card
 * block, the customer's `name`, their free-text `comment` and the flattened
 * `street`/`city`/`building` copies of the address. Those are personal data
 * or duplicates, and they are not part of this type, so there is no way to
 * leak them into a tool result by accident.
 *
 * `address` is the delivery address of *this* order, in the same `OrderAddress`
 * shape `get_order_history` reports, mapped from the nested `address` object
 * rather than from the flattened copies beside it — the site sends both, and
 * only the nested object is read. `null` when the order carries no address:
 * the endpoint omits it on some orders and nulls it on others.
 *
 * `totalPrice` and `totalToPay` are the server's own figures and are the only
 * authoritative totals — they are never recomputed from `items`, because
 * weight-based lines report `quantity` 0 (see `OrderItem`).
 *
 * `items` and `deletedItems` are kept apart rather than merged: the first is
 * what was ordered, the second is what the customer removed before checkout.
 *
 * `status`, `orderOriginType` and `paymentMethod` are undocumented numeric
 * codes, passed through verbatim. See the TODO in order-details.ts.
 */
export interface OrderDetails {
  id: number;
  createDate: string;
  finishDate: string;
  status: number;
  orderOriginType: number;
  paymentMethod: number;
  paymentTypeLogo: string;
  isDelivery: boolean;
  cityId: number;
  totalPrice: number;
  totalToPay: number;
  userDeliveryFee: number;
  serviceFee: number;
  driverTipAmount: number;
  address: OrderAddress | null;
  items: OrderItem[];
  deletedItems: OrderItem[];
}

/**
 * `isMissing` and the available stock numbers are only populated by the
 * yerevan-city.am API when the cart is read with an explicit delivery
 * address — see ShopCart.contents. A missing item stays in the cart but
 * cannot actually be delivered, similar to the site's own "Out of Stock"
 * label.
 */
export interface CartItem {
  id: number;
  name: string;
  price: number;
  count: number;
  weight: number;
  isKilogram: boolean;
  isBag: boolean;
  isMissing: boolean;
  availableCount: number;
  availableWeight: number;
}

export interface CartAddress {
  id: number;
  lat: number;
  lng: number;
  street: string;
  city: string;
}

export interface Cart {
  totalPrice: number;
  deliveryFee: number;
  items: CartItem[];
  address: CartAddress | null;
}
