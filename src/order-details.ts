import { ExpiredSessionError, RawOrderAddress, toOrderAddress } from "./orders.js";
import { ShopApiClient, ShopApiError } from "./shop-api-client.js";
import { OrderDetails as OrderDetailsResult, OrderItem } from "./types.js";

/**
 * The evidence Order/GetById leaves behind when the session is gone: the
 * endpoint reports a rejected session exactly like it reports a missing
 * order, so the message is the only thing that tells the two apart.
 */
const FAILED_LOOKUP_REFUSAL =
  "Order/GetById refuses nothing up front either: an expired or anonymous session comes back as 200 {\"success\":false} with a \"User not found\" message, the same shape a missing order arrives in, so the rejected session only shows up in the body";

/**
 * A line of a past order, minus the ~15 fields this repo has no use for.
 * See the docblock above `OrderItem` in types.ts for what each field means.
 */
interface RawOrderItem {
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
 * Only the fields that may leave this server are declared here, which is
 * what keeps them from leaking: the live order object has 37 keys, and the
 * ones left out are the customer's `phoneNumbers`, the `paymentInfo` card
 * block, the customer's `name` and free-text `comment`, plus the flattened
 * `street`/`city`/`building`/`entrance`/`floor`/`apartment` address fields
 * that merely duplicate the nested `address` object. Adding one to this
 * interface would be the only way to map it, so leaving them undeclared is a
 * compile-time guarantee rather than a promise in a review.
 *
 * `address` is declared because a delivery address is not a secret — the same
 * object is already reported by `get_order_history` — and it is the nested
 * object that is read: on the live response the flattened copies beside it
 * carry nulls and sentinels while the nested object holds the real values.
 *
 * `orderActivities` (whose `activityType` is another undocumented numeric
 * code) is likewise not exposed yet — see the TODO on the class below.
 *
 * `uniqueId` is intentionally absent too: it exists on this response but is
 * not the key the endpoint looks orders up by, so mapping it would only
 * invite passing it back as an id.
 */
interface RawOrderDetail {
  id: number;
  createDate: string;
  finishDate: string;
  status: number;
  paymentMethod: number;
  orderOriginType: number;
  isDelivery: boolean;
  cityId: number;
  totalPrice: number;
  totalToPay: number;
  userDeliveryFee: number;
  serviceFee: number;
  driverTipAmount: number;
  paymentTypeLogo: string;
  address?: RawOrderAddress | null;
  orderItems: RawOrderItem[] | null;
  deletedItems: RawOrderItem[] | null;
}

export class OrderNotFoundError extends Error {
  constructor(orderId: number) {
    super(
      `yerevan-city.am has no order ${orderId} on this account. ` +
        "Check the numeric id from get_order_history: orders are looked up by that id, " +
        "and an order id from another account is reported as not found rather than refused",
    );
  }
}

export class InvalidOrderIdError extends Error {
  constructor(orderId: unknown) {
    super(
      `Order id must be the numeric id of an order (e.g. 1234567), got ${describe(orderId)}. ` +
        "Take it from the `id` field of get_order_history — `uniqueId` is a different code in a different " +
        "namespace and is not accepted here",
    );
  }
}

/** Renders the rejected id in the message, quotes it when it arrived as text. */
function describe(orderId: unknown): string {
  return typeof orderId === "string" ? JSON.stringify(orderId) : String(orderId);
}

/**
 * Reads one past order with its line items. Read-only: one GET per call, no
 * mutation of anything on the account, and no second request — a single order
 * is fetched, never a page of them.
 *
 * Two traps this class exists to defuse:
 *
 * 1. The lookup key is the numeric `id`, and nothing else. The `uniqueId` on
 *    this very response is a *different* namespace from the `uniqueId` that
 *    Order/GetAll happens to render as `str(id)`, so feeding a `uniqueId`
 *    back in would silently look in the wrong place. Input is therefore
 *    validated as numeric before the request goes out.
 * 2. The endpoint fails open. A missing order and an anonymous or expired
 *    session both come back as `200 {"success":false}`, so "no order here"
 *    and "log in again" have to be told apart by the message — see
 *    `explainFailure`. A non-numeric id is the one case that bypasses the
 *    envelope entirely and answers 400 with an RFC7807 body that has no
 *    `success` field at all.
 *
 * TODO: `status`, `paymentMethod` and `orderOriginType` are numeric enums
 * that yerevan-city.am never documents, and `orderActivities[].activityType`
 * is a fourth one on the same response. All are passed through verbatim
 * rather than guessed at; map them to labels only after confirming what each
 * code really means (e.g. against the site's own order pages). Note the
 * response also carries the site's own `paymentTypeName` label for the
 * payment method, which is a starting point but covers none of the others.
 *
 * TODO: `orderActivities` (a status timeline: `activityType` plus a
 * timestamp each) is left out of this tool. It would answer "when was this
 * order cancelled?" without a second endpoint, and should be added once
 * `activityType` can be labelled.
 */
export class OrderDetails {
  constructor(private readonly client: ShopApiClient) {}

  async get(orderId: number): Promise<OrderDetailsResult> {
    if (!Number.isInteger(orderId)) throw new InvalidOrderIdError(orderId);
    try {
      const raw = await this.client.get<RawOrderDetail>(`/api/Order/GetById/${orderId}`);
      return toOrderDetails(raw);
    } catch (error) {
      throw explainFailure(orderId, error);
    }
  }
}

/**
 * Turns the endpoint's several ways of saying no into errors a caller can act
 * on, because every one of them arrives as a plain ShopApiError: a missing
 * order and an expired session are both `200` with `success:false`, and a
 * non-numeric id is a `400` carrying a ProblemDetails body instead of the
 * usual envelope. Anything unrecognised is passed through untouched rather
 * than guessed at.
 */
function explainFailure(orderId: number, error: unknown): unknown {
  if (!(error instanceof ShopApiError)) return error;
  const message = error.body.toLowerCase();
  if (message.includes("user not found")) return new ExpiredSessionError(FAILED_LOOKUP_REFUSAL);
  if (message.includes("order not found")) return new OrderNotFoundError(orderId);
  // The only route parameter is the order id, so a 400 here is the id failing
  // to bind to the numeric route constraint rather than a rejected lookup.
  if (error.status === 400) return new InvalidOrderIdError(orderId);
  if (error.status === 401 || error.status === 403) return new ExpiredSessionError(FAILED_LOOKUP_REFUSAL);
  return error;
}

function toOrderDetails(raw: RawOrderDetail): OrderDetailsResult {
  return {
    id: raw.id,
    createDate: raw.createDate,
    finishDate: raw.finishDate,
    status: raw.status,
    orderOriginType: raw.orderOriginType,
    paymentMethod: raw.paymentMethod,
    paymentTypeLogo: raw.paymentTypeLogo,
    isDelivery: raw.isDelivery,
    cityId: raw.cityId,
    // The site's own totals, never a sum over `items`: weight-based lines
    // report quantity 0, so a sum would silently under-report the order.
    totalPrice: raw.totalPrice,
    totalToPay: raw.totalToPay,
    userDeliveryFee: raw.userDeliveryFee,
    serviceFee: raw.serviceFee,
    driverTipAmount: raw.driverTipAmount,
    // `address` is omitted on some orders and null on others, and both mean
    // the same thing, so one check covers the two shapes the endpoint sends.
    address: raw.address ? toOrderAddress(raw.address) : null,
    items: (raw.orderItems ?? []).map(toOrderItem),
    deletedItems: (raw.deletedItems ?? []).map(toOrderItem),
  };
}

function toOrderItem(raw: RawOrderItem): OrderItem {
  return {
    id: raw.id,
    name: raw.name,
    price: raw.price,
    quantity: raw.quantity,
    weight: raw.weight,
    isKilogram: raw.isKilogram,
    totalPrice: raw.totalPrice,
    initialPrice: raw.initialPrice,
    bonus: raw.bonus,
    categoryName: raw.categoryName,
    isBag: raw.isBag,
    visiblePrice: raw.visiblePrice,
    note: raw.note,
    photo: raw.photo,
  };
}