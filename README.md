# Líriou API (liriou-nest)

API REST da loja Líriou: catálogo, sacola persistente, estoque (CRUD de produtos + movimentações), lista VIP e login do dashboard.
Consumida pelo front `../liriou-lp` (Next.js).

## Stack

| Tecnologia | Versão | Uso |
| --- | --- | --- |
| NestJS | ^11 | Framework HTTP |
| TypeORM | ^0.3.31 | ORM + **migrations** (`synchronize` sempre desligado) |
| PostgreSQL | 17/18 | Banco |
| @nestjs/jwt | ^11 | Token de acesso do dashboard |
| bcryptjs | ^3 | Hash de senha (custo 12, JS puro) |
| class-validator / class-transformer | ^0.15 / ^0.5 | Validação de DTOs |
| @nestjs/throttler | ^6 | Rate limit por IP |
| @nestjs/swagger | ^11 | Documentação em `/docs` (fora de produção) |

## Rodando local

```bash
cp .env.example .env          # preencha DATABASE_URL, JWT_SECRET e ADMIN_PASSWORD
npm install
npm run migration:run         # cria/atualiza as tabelas
npm run seed                  # admin inicial + catálogo inicial (idempotente)
npm run start:dev             # http://localhost:3333/api/v1  ·  docs: http://localhost:3333/docs
npm test                      # testes de domínio
```

Sem Postgres instalado: `docker compose up -d` sobe um em `localhost:5432` (`postgres/postgres`, banco `liriou`).

### Migrations

```bash
npm run migration:create -- src/infra/database/migrations/NomeDaMudanca   # migration vazia
npm run migration:generate -- src/infra/database/migrations/NomeDaMudanca # gera a partir do diff das entidades
npm run migration:show | migration:run | migration:revert
```

O schema é definido **só** pelas migrations (SQL explícito, CHECKs e índices parciais). As entidades `*.orm-entity.ts` espelham as tabelas.
`1794528000001-CreateLeads` usa `IF NOT EXISTS` porque a tabela `leads` já existia (criada pelo Drizzle no front) — os cadastros foram preservados.

## Arquitetura (Clean Architecture por módulo)

```
src/
├── main.ts                     bootstrap: prefixo api/v1, helmet, CORS, ValidationPipe, Swagger
├── app.module.ts               Config (env validado), Throttler, DomainExceptionFilter, health
├── config/env.ts               variáveis de ambiente validadas no boot
├── infra/database/             TypeORM (opções únicas p/ API e CLI), migrations, seeds
├── shared/
│   ├── domain/                 DomainError (validation/not_found/conflict/business_rule/unauthorized), money (centavos)
│   ├── application/            UseCase, paginação
│   ├── infra/persistence/      helpers de banco
│   └── presentation/http/      filtro de erros → HTTP, DTO/presenter de paginação
└── modules/<módulo>/
    ├── domain/                 entidades + regras + PORTAS (classes abstratas)   ← não conhece Nest/TypeORM
    ├── application/            casos de uso (1 responsabilidade cada, `execute()`)
    ├── infra/                  adaptadores: *.orm-entity.ts, repositórios TypeORM, bcrypt, JWT
    ├── presentation/http/      controllers, DTOs (class-validator), presenters (domínio → JSON)
    └── <módulo>.module.ts      liga porta → adaptador: { provide: Porta, useClass: Adaptador }
```

Regras que guiam o código:

- **Dependências apontam para dentro**: presentation → application → domain. Infra implementa as portas do domínio (DIP).
- **Domínio puro**: `Product`, `Cart`, `Lead`, `AdminUser` validam e protegem suas invariantes (ex.: estoque nunca negativo, quantidade máx. por item). Erros são `DomainError`; o `DomainExceptionFilter` traduz para HTTP.
- **Dinheiro em centavos** (`integer`) no domínio e no banco; a API expõe reais (`49.9`).
- **Estoque só muda por movimentação** (`entrada`/`saida`), com `SELECT … FOR UPDATE` na transação — sem corrida entre duas movimentações.
- **Preço nunca vem do front**: a sacola guarda só `productId + quantidade`; totais são recalculados do catálogo a cada resposta.
- Exclusão de produto é **lógica** (`deleted_at`): mantém o histórico de estoque; slug/SKU ficam livres (índices únicos parciais).

### Formato de erro

```json
{ "statusCode": 422, "code": "INSUFFICIENT_STOCK", "message": "Estoque insuficiente: disponível 3, solicitado 10" }
{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "Dados inválidos", "errors": { "whatsapp": "Informe um celular com DDD" } }
```

## Endpoints (`/api/v1`)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/health` | público | Saúde da API + banco |
| GET | `/catalog/products?q&category` | público | Vitrine (só ativos, ordem `sortOrder`) |
| GET | `/catalog/products/:slug` | público | Produto da vitrine |
| GET | `/store/settings` | público | Frete grátis, parcelas, opções de envio |
| POST | `/carts` | público | Cria sacola (opcional: `items` p/ migrar sacola antiga) |
| GET | `/carts/:id` | público | Sacola com totais recalculados |
| POST | `/carts/:id/items` | público | Soma quantidade de um produto |
| PUT / DELETE | `/carts/:id/items/:productId` | público | Define quantidade (0 remove) / remove |
| PUT / DELETE | `/carts/:id/coupon` | público | Aplica / remove cupom |
| PUT | `/carts/:id/shipping` | público | Escolhe opção de envio |
| PUT | `/carts/:id/checkout/customer` | público | Checkout etapa 1 concluída (registra a cliente para o acompanhamento) |
| PUT | `/carts/:id/checkout/delivery` | público | Checkout etapa 2 concluída (endereço + frete) |
| POST | `/orders` | público (10/min) | Checkout: sacola + compradora + endereço + frete → pedido `aguardando_pagamento` (a sacola fica marcada como convertida) |
| GET | `/admin/customers/funnel` | Bearer | Funil: quantas pararam em cada etapa + valores |
| GET | `/admin/customers?q&stage&page` | Bearer | Jornadas (uma por sacola), mais recentes primeiro |
| GET | `/admin/customers/:cartId` | Bearer | Detalhe: linha do tempo, itens, cliente, entrega, pedido e outras visitas do mesmo e-mail |
| GET | `/orders/:id` | público | Pedido (CPF mascarado) — usado na etapa de pagamento |
| POST | `/leads` | público (5/min) | Cadastro na lista VIP (204, também p/ e-mail repetido) |
| GET | `/leads/pain-options` | público | Opções da pergunta "pesadelo ao acordar" |
| POST | `/auth/login` | público (5/min) | Login do dashboard → `accessToken` |
| GET | `/auth/me` | Bearer | Admin logado |
| GET / POST | `/admin/products` | Bearer | Lista (`q, category, isActive, lowStock, page, pageSize`) / cria (`initialStock` opcional) |
| GET | `/admin/products/summary` | Bearer | Indicadores: produtos, na vitrine, estoque baixo, esgotados, unidades, valor em estoque |
| GET / PATCH / DELETE | `/admin/products/:id` | Bearer | Detalhe / edita / exclui (lógico) |
| GET / POST | `/admin/products/:id/stock-movements` | Bearer | Histórico / registra entrada ou saída |
| GET | `/admin/leads?q&pain&page&pageSize` | Bearer | Cadastros da lista VIP |
| GET | `/admin/leads/stats` | Bearer | Totais, últimos 14 dias, respostas |
| GET | `/admin/leads/export?q&pain` | Bearer | CSV (Excel pt-BR) |

## Sacola persistente (como o front usa)

1. No 1º "Adicionar", o front chama `POST /carts` e guarda o `id` + a última resposta no `localStorage` (`liriou:cart:v2`).
2. Ao voltar ao site, mostra a cópia local na hora e revalida com `GET /carts/:id` (preço/estoque atuais). 404 → começa outra.
3. O id é um UUID v4 aleatório: funciona como credencial da sacola anônima.
4. Tabela `carts.updated_at` indexada para, no futuro, limpar sacolas abandonadas ou disparar recuperação de carrinho.

## Próximos passos sugeridos

- Cupons e frete em tabela própria (trocar o provider de `StoreSettings` no `CartModule`; casos de uso não mudam).
- Checkout/pedidos: baixa de estoque via `RegisterStockMovementUseCase` (`saida`) ao confirmar pagamento.
- Upload de imagens (hoje são URLs).
