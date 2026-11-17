import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Cents } from '../../../shared/domain/money'
import type { CheckoutStage } from '../../cart/domain/cart'
import type { Customer, ShippingAddress } from '../../cart/domain/checkout-data'
import type { OrderStatus } from '../../orders/domain/order'

/**
 * Lado de leitura (CQRS) do acompanhamento de clientes no dashboard.
 * Junta sacolas, itens, produtos e pedidos num modelo pensado para a tela — sem regras de escrita.
 */

export interface JourneyFilters {
  /** Nome, e-mail ou telefone */
  q?: string
  stage?: CheckoutStage
}

export interface JourneyOrderRef {
  id: string
  number: number
  status: OrderStatus
  totalCents: Cents
}

export interface JourneyRow {
  cartId: string
  stage: CheckoutStage
  customer: Customer | null
  city: string | null
  state: string | null
  itemCount: number
  /** Sacola aberta: itens × preço atual. Pedido: total do pedido. */
  valueCents: Cents
  order: JourneyOrderRef | null
  createdAt: Date
  lastActivityAt: Date
}

export interface JourneyItem {
  productId: string
  name: string
  sku: string
  image: string
  unitPriceCents: Cents
  quantity: number
}

export interface JourneyDetail extends JourneyRow {
  shippingAddress: ShippingAddress | null
  /** Frete escolhido na sacola (ex.: "Correios · SEDEX"), se ainda não virou pedido */
  cartShippingLabel: string | null
  couponCode: string | null
  /** Pedido: foto do momento da compra. Sacola aberta: preços atuais do catálogo. */
  items: JourneyItem[]
  orderTotals: { subtotalCents: Cents; discountCents: Cents; shippingCents: Cents; totalCents: Cents } | null
  orderShippingLabel: string | null
  timeline: { createdAt: Date; identifiedAt: Date | null; deliveryAt: Date | null; orderedAt: Date | null }
  /** Outras sessões/pedidos com o mesmo e-mail */
  otherSessions: Pick<JourneyRow, 'cartId' | 'stage' | 'valueCents' | 'order' | 'lastActivityAt'>[]
}

export interface JourneyFunnel {
  cart: number
  identified: number
  delivery: number
  ordered: number
  orderedValueCents: Cents
  /** Sacolas abertas com itens (potencial de recuperação) */
  openValueCents: Cents
}

export abstract class CustomerJourneyQuery {
  abstract funnel(): Promise<JourneyFunnel>
  abstract list(filters: JourneyFilters, page: PageRequest): Promise<Paginated<JourneyRow>>
  abstract detail(cartId: string): Promise<JourneyDetail | null>
}
