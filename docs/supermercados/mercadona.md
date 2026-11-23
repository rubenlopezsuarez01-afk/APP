# Mercadona: organización de la tienda

Investigación para ordenar la lista de la compra por secciones. La ubicación física y el mapa de cada tienda los define el usuario; aquí solo están el modelo de Mercadona y su clasificación de productos.

## 1. Modelo "Tienda por Ambientes" (desde 2000)

- Mercadona lo puso en marcha en el año 2000. En 2015 estaba en el 99 % de sus tiendas (más de 1.500).
- Las secciones con nombre propio son **alimentación, droguería, perfumería, carnicería, charcutería** y los "frescos nuevos": **pescadería, horno y fruta y verdura**.
- "Todas las secciones están ordenadas racionalmente para que el acto de compra sea cómodo y rápido". Cada sección tiene diseño, iluminación e imágenes propias, y además **un color**:

| Color | Sección |
|---|---|
| Verde | Frutas y hortalizas |
| Rojo | Carnes |
| Azul | Pescadería |
| Amarillo | Lácteos |
| Gris claro | Perfumería |

- Otras características: pasillos anchos (pueden pasar tres carros a la vez), mobiliario bajo para ver más lejos, suelos y techos claros, y una sala de ventas de unos 1.500 m².

Fuente: [El Periódico de Aquí (2015)](https://www.elperiodicodeaqui.com/economia/mercadona-implanta-la-tienda-por-ambientes-en-el-99-de-sus-establecimientos-en-espana_78092_102.html)

## 2. "Nuevo Modelo de Tienda Eficiente" (desde diciembre de 2016)

Se basa en dos pilares: más espacio y una mejor disposición del surtido. Cambios por sección:

- **Fruta y verdura** pasa a estar **a la entrada**, con exprimidor de naranja y una "zona de corte" visible.
- **Horno**: la sección más ampliada (unos 60 m²).
- **Pescadería**: más grande, con módulo de marisco y mueble de sushi.
- **Carnicería**: "punto de acabado de carne" y bandejas transparentes (antes se diferenciaban por colores).
- **Charcutería**: punto de corte de jamón renovado.
- **Bodega**: estanterías reforzadas.
- **Perfumería**: una **góndola central independiente** para el maquillaje.
- **Congelados**: todos los muebles tienen puertas, y la verdura congelada está en muebles verticales **al fondo de la sección**.

Fuente: [Alimarket (2017)](https://www.alimarket.es/alimentacion/noticia_amp/237012/-como-es-la-experiencia-de-compra-en-un-nuevo--mercadona--)

Cambios recientes (2023-2026), según la prensa:

- Sección **"Listo para Comer"**, que ya aparece como subcategoría en la tienda online.
- Prototipo nuevo **sin venta asistida**: sin mostrador de pescadería ni de charcutería.
- Organización interna por procesos de trabajo en vez de por secciones.

## 3. Clasificación oficial de productos (tienda online)

Mercadona usa la misma clasificación en todas sus tiendas online: **26 categorías y 152 subcategorías**. La lista completa, con sus identificadores, está en [`mercadona-categorias.json`](mercadona-categorias.json), sacada de `tienda.mercadona.es/api/categories/` el 23/11/2026.

Es la mejor base para clasificar cada ingrediente, porque es la propia Mercadona quien decide dónde va cada producto.

## 4. Propuesta: categorías online → ambientes de la tienda

*Esta agrupación es una propuesta, no un dato oficial.* Junta las 26 categorías en los ambientes físicos que describe Mercadona, para que el usuario solo tenga que ordenar unos 12 bloques en su mapa.

| Ambiente (color) | Categorías online |
|---|---|
| Fruta y verdura (verde) | Fruta y verdura |
| Horno | Panadería y pastelería |
| Carnicería (rojo) | Carne |
| Pescadería (azul) | Marisco y pescado |
| Charcutería y quesos | Charcutería y quesos; Pizzas y platos preparados |
| Lácteos (amarillo) | Huevos, leche y mantequilla; Postres y yogures |
| Alimentación seca | Aceite, especias y salsas; Arroz, legumbres y pasta; Conservas, caldos y cremas; Cereales y galletas; Cacao, café e infusiones; Azúcar, caramelos y chocolate; Aperitivos |
| Bebidas | Agua y refrescos; Zumos; Bodega |
| Congelados | Congelados |
| Droguería | Limpieza y hogar |
| Perfumería (gris) | Cuidado del cabello; Cuidado facial y corporal; Maquillaje; Fitoterapia y parafarmacia |
| Bebé y mascotas | Bebé; Mascotas |

Casos a tener en cuenta:

- Online, **"Carne congelada"** está dentro de *Carne* y **"Pescado congelado"** dentro de *Marisco y pescado*, pero en la tienda suelen estar en el mueble de congelados. Conviene asignarlas al ambiente *Congelados*.
- **"Harina y preparado repostería"** está online en *Panadería y pastelería*, pero en la tienda suele estar en alimentación seca.
- **"Embutido"** aparece en *Carne* y también en *Charcutería y quesos* (embutido curado).
- **"Listo para Comer"** suele tener un mostrador o una zona propia.
