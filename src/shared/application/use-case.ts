/** Contrato comum dos casos de uso: uma única responsabilidade, exposta por `execute`. */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>
}
