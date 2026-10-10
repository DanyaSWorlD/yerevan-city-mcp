import { Addresses } from "./addresses.js";
import { ShopApiClient, ShopApiError } from "./shop-api-client.js";
import { Order, OrderAddress } from "./types.js";

/**
 * The address object Order/GetAll nests inside an order. Order/GetById sends
 * the same object, so both mappers share this shape and this mapper.
 */
export interface RawOrderAddress {
  city: string;
  street: string;
  buliding: string;
  entrance: number | null;
  floor: number | null;
  apartment: number | null;
}

interface RawOrder {
  id: number;
  createDate: string;
  finishDate: string;
  status: number;
  cityId: number;
  paymentMethod: number;
  totalPrice: number;
  totalToPay: number;
  uniqueId: string;
  paymentTypeLogo: string;
  orderOriginType: number;
  isDelivery: boolean;
  userDeliveryFee: number;
  serviceFee: number;
  driverTipAmount: number;
  // `createdOn` is null on every order the API returns, so it is not mapped.
  createdOn: null;
  address: RawOrderAddress | null;
}

interface RawOrderList {
  orders: RawOrder[] | null;
}

/**
 * The evidence Order/GetAll leaves behind when the session is gone: a 200
 * that looks like an account with no orders at all.
 */
const EMPTY_ORDER_LIST_REFUSAL =
  "Order/GetAll answers 200 with an empty order list even for an anonymous or expired token instead of failing, so this was caught by the Address/GetAll login check";

/**
 * The session was refused. The actionable half of the message is fixed —
 * log in again, with which two calls — while `reason` carries the one bit
 * that differs per caller: the evidence the calling endpoint left behind.
 * Order/GetAll (the default) hides a rejected session behind an empty order
 * list; Order/GetById hides it behind an ordinary-looking failure envelope,
 * which is a different trap and needs a different explanation.
 */
export class ExpiredSessionError extends Error {
  constructor(reason: string = EMPTY_ORDER_LIST_REFUSAL) {
    super(
      "yerevan-city.am rejected the stored session, log in again with request_login_code then confirm_login_code. " +
        reason,
    );
  }
}

/**
 * Reads the logged-in user's order history. Read-only: unlike the cart
 * tools, nothing here mutates anything on the account.
 *
 * TODO: `status`, `paymentMethod` and `orderOriginType` are numeric enums
 * that yerevan-city.am never documents. Map them to human-readable labels
 * only after confirming the real meaning of each code (e.g. against the
 * site's own order pages) — guessing would produce confidently wrong output.
 *
 * TODO: the endpoint returns the account's whole history in one response
 * and ignores paging parameters. Long histories will need either a limit or
 * date filtering, both of which have to be added here once the API offers a
 * way to ask for them.
 */
export class OrderHistory {
  constructor(private readonly client: ShopApiClient) {}

  async all(): Promise<Order[]> {
    const raw = await this.client.get<RawOrderList>("/api/Order/GetAll");
    const orders = (raw.orders ?? []).map(toOrder);
    if (orders.length === 0) await this.assertSessionWorks();
    return orders;
  }

  /**
   * Order/GetAll fails open: an anonymous or expired token gets the same
   * `200 {"success":true,"data":{"orders":[]}}` as a real account that has
   * never ordered anything, so an empty list on its own proves nothing.
   * Address/GetAll on the same host does answer 401, so when the order list
   * comes back empty we spend one extra call on it to tell "no orders yet"
   * apart from "not logged in" — the difference between telling the user
   * they have no orders and telling them to log in again.
   */
  private async assertSessionWorks(): Promise<void> {
    try {
      await new Addresses(this.client).all();
    } catch (error) {
      if (error instanceof ShopApiError && (error.status === 401 || error.status === 403)) {
        throw new ExpiredSessionError();
      }
      throw error;
    }
  }
}

function toOrder(raw: RawOrder): Order {
  return {
    id: raw.id,
    uniqueId: raw.uniqueId,
    createDate: raw.createDate,
    finishDate: raw.finishDate,
    status: raw.status,
    orderOriginType: raw.orderOriginType,
    paymentMethod: raw.paymentMethod,
    paymentTypeLogo: raw.paymentTypeLogo,
    isDelivery: raw.isDelivery,
    cityId: raw.cityId,
    totalPrice: raw.totalPrice,
    totalToPay: raw.totalToPay,
    userDeliveryFee: raw.userDeliveryFee,
    serviceFee: raw.serviceFee,
    driverTipAmount: raw.driverTipAmount,
    address: raw.address === null ? null : toOrderAddress(raw.address),
  };
}

/** Exported because Order/GetById sends the same address object. */
export function toOrderAddress(raw: RawOrderAddress): OrderAddress {
  return {
    city: raw.city,
    street: raw.street,
    buliding: raw.buliding,
    entrance: raw.entrance,
    floor: raw.floor,
    apartment: raw.apartment,
  };
}