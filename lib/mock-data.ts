export type UserRole = 'super_admin' | 'business_admin' | 'consumer'

export interface Building {
  id: string
  name: string
  address: string
  totalUnits: number
}

export interface User {
  id: string
  name: string
  email: string
  password?: string
  role: UserRole
  businessId?: string
  buildingId?: string
  createdAt: string
  avatar?: string
}

export interface Business {
  id: string
  name: string
  category: string
  description: string
  ownerId: string
  createdAt: string
  logo?: string
}

export interface Promotion {
  id: string
  businessId: string
  businessName: string
  title: string
  description: string
  discount: string
  category: string
  expirationDate: string
  usageCount: number
  buildingId?: string
  createdAt: string
  image?: string
}

export const CATEGORIES = [
  'Todas',
  'Gastronomía',
  'Compras',
  'Salud y Belleza',
  'Entretenimiento',
  'Viajes',
  'Tecnología',
  'Deportes y Fitness',
]

export const mockBuildings: Building[] = [
  {
    id: 'build_1',
    name: 'Torre del Parque',
    address: 'Av. Libertador 1234',
    totalUnits: 120,
  },
  {
    id: 'build_2',
    name: 'Edificio Central',
    address: 'Calle Corrientes 500',
    totalUnits: 85,
  },
  {
    id: 'build_3',
    name: 'Complejo Libertador',
    address: 'Av. Libertador 4500',
    totalUnits: 200,
  }
]

export const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Alex Rivera',
    email: 'admin@citify.com',
    role: 'super_admin',
    createdAt: '2024-01-01',
    avatar: 'AR',
  },
  {
    id: 'u2',
    name: 'Marcus Chen',
    email: 'business@citify.com',
    role: 'business_admin',
    businessId: 'b1',
    createdAt: '2024-02-15',
    avatar: 'MC',
  },
  {
    id: 'u3',
    name: 'Sofia Reyes',
    email: 'store2@citify.com',
    role: 'business_admin',
    businessId: 'b2',
    createdAt: '2024-03-01',
    avatar: 'SR',
  },
  {
    id: 'u4',
    name: 'Jordan Lee',
    email: 'user@citify.com',
    role: 'consumer',
    buildingId: 'build_1',
    createdAt: '2024-03-10',
    avatar: 'JL',
  },
  {
    id: 'u5',
    name: 'Priya Sharma',
    email: 'priya@citify.com',
    role: 'consumer',
    buildingId: 'build_1',
    createdAt: '2024-04-05',
    avatar: 'PS',
  },
  {
    id: 'u6',
    name: 'Omar Hassan',
    email: 'omar@citify.com',
    role: 'consumer',
    buildingId: 'build_2',
    createdAt: '2024-04-12',
    avatar: 'OH',
  },
]

export const mockBusinesses: Business[] = [
  {
    id: 'b1',
    name: 'Urban Bistro',
    category: 'Gastronomía',
    description: 'Experiencia gastronómica urbana premium con menús de temporada y coctelería de autor.',
    ownerId: 'u2',
    createdAt: '2024-02-15',
  },
  {
    id: 'b2',
    name: 'Luxe Boutique',
    category: 'Compras',
    description: 'Colecciones de moda y estilo de vida seleccionadas para el residente urbano exigente.',
    ownerId: 'u3',
    createdAt: '2024-03-01',
  },
  {
    id: 'b3',
    name: 'Serenity Spa',
    category: 'Salud y Belleza',
    description: 'Tratamientos integrales de belleza y bienestar para la renovación del cuerpo y la mente.',
    ownerId: 'u2',
    createdAt: '2024-02-20',
  },
  {
    id: 'b4',
    name: 'TechHaven',
    category: 'Tecnología',
    description: 'Los últimos productos tecnológicos y servicio técnico experto en el corazón de la ciudad.',
    ownerId: 'u3',
    createdAt: '2024-03-15',
  },
]

export const mockPromotions: Promotion[] = [
  {
    id: 'p1',
    businessId: 'b1',
    businessName: 'Urban Bistro',
    title: '20% DTO en Brunch de Fin de Semana',
    description: 'Disfrutá un 20% de descuento en nuestro brunch clásico de fin de semana. Válido solo en el local. Incluye café y jugo ilimitados.',
    discount: '20%',
    category: 'Gastronomía',
    expirationDate: '2025-12-31',
    usageCount: 47,
    createdAt: '2024-04-01',
  },
  {
    id: 'p2',
    businessId: 'b1',
    businessName: 'Urban Bistro',
    title: '2x1 en Cócteles EXCLUSIVO Torre del Parque',
    description: 'Especial de after office: exclusivo para vecinos del edificio. Disponible de lunes a jueves, de 17 a 20 hs.',
    discount: '50%',
    category: 'Gastronomía',
    expirationDate: '2025-11-30',
    usageCount: 83,
    buildingId: 'build_1',
    createdAt: '2024-04-05',
  },
  {
    id: 'p3',
    businessId: 'b2',
    businessName: 'Luxe Boutique',
    title: '30% DTO en Nueva Colección',
    description: 'Renová tu armario con nuestras nuevas llegadas de primavera con un 30% de descuento. Incluye todos los vestidos, blazers y accesorios nuevos.',
    discount: '30%',
    category: 'Compras',
    expirationDate: '2025-10-15',
    usageCount: 29,
    createdAt: '2024-04-10',
  },
  {
    id: 'p4',
    businessId: 'b2',
    businessName: 'Luxe Boutique',
    title: 'Envuelto para Regalo Gratis EXCLUSIVO Torre del Parque',
    description: 'Solo mostrando tu membresía vecinal, recibí envoltorio premium gratis para residentes del edificio.',
    discount: 'Gratis',
    category: 'Compras',
    buildingId: 'build_1',
    expirationDate: '2025-12-25',
    usageCount: 112,
    createdAt: '2024-04-12',
  },
  {
    id: 'p5',
    businessId: 'b3',
    businessName: 'Serenity Spa',
    title: '15% DTO en Masaje de Cuerpo Entero',
    description: 'Regalate un masaje rejuvenecedor de cuerpo entero de 60 minutos con un 15% de descuento. Incluye aromaterapia y piedras calientes.',
    discount: '15%',
    category: 'Salud y Belleza',
    expirationDate: '2025-09-30',
    usageCount: 61,
    createdAt: '2024-04-08',
  },
  {
    id: 'p6',
    businessId: 'b3',
    businessName: 'Serenity Spa',
    title: 'Paquete de Facial + Manicura',
    description: 'Dete un gusto con nuestro facial clásico combinado con una manicura de lujo. Ahorrá un 25% reservando ambos tratamientos juntos.',
    discount: '25%',
    category: 'Salud y Belleza',
    expirationDate: '2025-11-15',
    usageCount: 34,
    createdAt: '2024-04-15',
  },
  {
    id: 'p7',
    businessId: 'b4',
    businessName: 'TechHaven',
    title: 'Instalación de Protector de Pantalla Gratis',
    description: 'Comprá cualquier protector de pantalla y te lo instalamos gratis. Compatible con las principales marcas.',
    discount: 'Gratis',
    category: 'Tecnología',
    expirationDate: '2025-08-31',
    usageCount: 198,
    createdAt: '2024-04-02',
  },
  {
    id: 'p8',
    businessId: 'b4',
    businessName: 'TechHaven',
    title: '10% DTO en Accesorios',
    description: 'Ahorrá un 10% en todos los accesorios de tecnología, incluyendo fundas, cargadores, auriculares y relojes inteligentes.',
    discount: '10%',
    category: 'Tecnología',
    expirationDate: '2025-12-31',
    usageCount: 76,
    createdAt: '2024-04-18',
  },
]

export interface MarketplaceItem {
  id: string
  title: string
  description: string
  price: number
  condition: 'Nuevo' | 'Como Nuevo' | 'Buen Estado' | 'Usado'
  sellerId: string
  buildingId: string
  createdAt: string
  image?: string
}

export const mockMarketplaceItems: MarketplaceItem[] = [
  {
    id: 'm1',
    title: 'Silla de Oficina Ergonómica',
    description: 'Vendo silla ergonómica comprada hace 6 meses. La vendo porque me mudo y no tengo espacio. Funciona todo perfecto.',
    price: 45000,
    condition: 'Como Nuevo',
    sellerId: 'u4', // Jordan Lee (Torre del Parque)
    buildingId: 'build_1',
    createdAt: '2024-04-10',
  },
  {
    id: 'm2',
    title: 'Bicicleta Fija Olmo',
    description: 'Bicicleta fija magnética con monitor. Ideal para entrenar en el depto. Se retira por el 4to piso.',
    price: 85000,
    condition: 'Buen Estado',
    sellerId: 'u5', // Priya Sharma (Torre del Parque)
    buildingId: 'build_1',
    createdAt: '2024-04-14',
  },
  {
    id: 'm3',
    title: 'Monitor Dell 24 pulgadas',
    description: 'Monitor 1080p con 75hz. Incluye cable HDMI y su respectiva caja.',
    price: 120000,
    condition: 'Nuevo',
    sellerId: 'u6', // Omar Hassan (Edificio Central)
    buildingId: 'build_2',
    createdAt: '2024-04-15',
  }
]
