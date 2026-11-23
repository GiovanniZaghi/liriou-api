import { toCents } from '../../../shared/domain/money'
import type { ProductDetails } from '../../../modules/products/domain/product'
import { ProductCategory } from '../../../modules/products/domain/product-category'

const ph = (size: string, bg: string, fg: string, text: string) =>
  `https://placehold.co/${size}/${bg}/${fg}?text=${encodeURIComponent(text).replace(/%20/g, '+')}`

/** Catálogo inicial (o mesmo que estava fixo no front). Depois passa a ser gerido pelo dashboard. */
export const CATALOG_SEED: Array<{ details: ProductDetails; initialStock: number }> = [
  {
    initialStock: 50,
    details: {
      slug: 'scrunchie-classica-salvia',
      sku: 'SCR-CLA-SAL',
      name: 'Scrunchie Clássica Alta Gramatura',
      description:
        'Desenvolvida com cetim de alta gramatura e etiqueta de alfaiataria. Garante zero frizz e elegância em qualquer produção, com acabamento impecável.',
      category: ProductCategory.SCRUNCHIE,
      priceCents: toCents(49.9),
      compareAtPriceCents: null,
      colorName: 'Verde Sálvia',
      colorHex: '#6A7B6C',
      badge: 'Best Seller',
      imageUrl: ph('500x600', '6A7B6C', 'FFFFFF', 'Lirio.u Salvia'),
      hoverImageUrl: ph('500x600', '546356', 'FFFFFF', 'Uso Real Salvia'),
      gallery: [ph('600x600', '6A7B6C', 'FFFFFF', 'Salvia Detalhe'), ph('600x600', 'F4EFEB', '2C2A29', 'Uso Real')],
      kit: null,
      minStock: 10,
      isActive: true,
      sortOrder: 10,
      weightGrams: 60, lengthCm: 16, widthCm: 11, heightCm: 4,
    },
  },
  {
    initialStock: 50,
    details: {
      slug: 'scrunchie-chiclete-rose',
      sku: 'SCR-CHI-ROS',
      name: 'Scrunchie Chiclete Rose',
      description:
        'O toque de cor perfeito para a estética "clean girl". Zero atrito: não marca e cuida dos fios no uso diário ou noturno.',
      category: ProductCategory.SCRUNCHIE,
      priceCents: toCents(49.9),
      compareAtPriceCents: null,
      colorName: 'Rosa Chiclete',
      colorHex: '#F2D3D8',
      badge: 'Exclusivo',
      imageUrl: ph('500x600', 'F2D3D8', '2C2A29', 'Lirio.u Pink'),
      hoverImageUrl: ph('500x600', 'FAF0F2', '2C2A29', 'Uso Real Pink'),
      gallery: [ph('600x600', 'F2D3D8', '2C2A29', 'Pink Detalhe'), ph('600x600', 'F4EFEB', '2C2A29', 'Uso Real')],
      kit: null,
      minStock: 10,
      isActive: true,
      sortOrder: 20,
      weightGrams: 60, lengthCm: 16, widthCm: 11, heightCm: 4,
    },
  },
  {
    initialStock: 30,
    details: {
      slug: 'kit-noite-perfeita',
      sku: 'KIT-NOI-PER',
      name: 'Kit Noite Perfeita (Touca + Scrunchie)',
      description:
        'O ápice do ritual de alta performance noturna. Proteção total contra o frizz e a quebra capilar enquanto você descansa.',
      category: ProductCategory.KIT,
      priceCents: toCents(119.9),
      compareAtPriceCents: null,
      colorName: 'Sálvia & Off-White',
      colorHex: '#6A7B6C',
      badge: 'Essencial Noturno',
      imageUrl: ph('500x600', '6A7B6C', 'FFFFFF', 'Kit Noite Perfeita'),
      hoverImageUrl: ph('500x600', 'F4EFEB', '2C2A29', 'Touca Uso'),
      gallery: [ph('600x600', '6A7B6C', 'FFFFFF', 'Touca Detalhe'), ph('600x600', 'F4EFEB', '2C2A29', 'Touca Uso')],
      kit: {
        tag: 'Mais desejado',
        contents: 'Contém: 1 Touca Dupla Face em Cetim + 1 Scrunchie Clássica.',
        perks: ['Proteção total contra quebra capilar', 'Embalagem presenteável exclusiva'],
        note: 'Economize R$ 10,00',
      },
      minStock: 5,
      isActive: true,
      sortOrder: 30,
      weightGrams: 250, lengthCm: 20, widthCm: 15, heightCm: 8,
    },
  },
  {
    initialStock: 20,
    details: {
      slug: 'kit-trio-ritual',
      sku: 'KIT-TRI-RIT',
      name: 'Kit Trio Ritual High-Ticket',
      description:
        'O kit completo com as cores essenciais da temporada, na nossa caixa especial de presente. O presente perfeito para quem você mais ama.',
      category: ProductCategory.KIT,
      priceCents: toCents(129.9),
      compareAtPriceCents: null,
      colorName: 'Trio Variado Exclusivo',
      colorHex: '#D8D2CD',
      badge: 'High Ticket',
      imageUrl: ph('500x600', 'E8E2DD', '2C2A29', 'Kit Trio Lirio.u'),
      hoverImageUrl: ph('500x600', 'D8D2CD', '2C2A29', 'Caixa Exclusiva'),
      gallery: [ph('600x600', 'E8E2DD', '2C2A29', 'Kit Detalhe'), ph('600x600', 'F4EFEB', '2C2A29', 'Caixa Exclusiva')],
      kit: {
        tag: 'Colecionador',
        contents: 'Contém: 3 Scrunchies Clássicas de alta gramatura em cores selecionadas.',
        perks: ['Versatilidade para o cabelo e o pulso', 'Caixa especial de colecionador'],
        note: 'Edição limitada',
      },
      minStock: 5,
      isActive: true,
      sortOrder: 40,
      weightGrams: 250, lengthCm: 20, widthCm: 15, heightCm: 8,
    },
  },
]
