import { randomUUID } from 'node:crypto'

export enum StockMovementType {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
}

export interface StockMovementProps {
  id: string
  productId: string
  type: StockMovementType
  quantity: number
  balanceAfter: number
  reason: string | null
  createdBy: string | null
  createdAt: Date
}

/** Registro imutável de uma entrada/saída de estoque (histórico/auditoria). */
export class StockMovement {
  private constructor(private readonly props: StockMovementProps) {}

  static record(input: Omit<StockMovementProps, 'id' | 'createdAt'>): StockMovement {
    return new StockMovement({ ...input, id: randomUUID(), createdAt: new Date() })
  }

  static restore(props: StockMovementProps): StockMovement {
    return new StockMovement(props)
  }

  get id() { return this.props.id }
  get productId() { return this.props.productId }
  get type() { return this.props.type }
  get quantity() { return this.props.quantity }
  get balanceAfter() { return this.props.balanceAfter }
  get reason() { return this.props.reason }
  get createdBy() { return this.props.createdBy }
  get createdAt() { return this.props.createdAt }
}
