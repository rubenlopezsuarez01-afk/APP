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

## 3. Los 26 ambientes (categorías oficiales × secciones)

Cada una de las **26 categorías oficiales** de la tienda online es un **ambiente**. Para cada uno:

- **Sección oficial**: la sección del modelo por ambientes a la que pertenece (alimentación, droguería, perfumería, carnicería, charcutería, pescadería, horno, fruta y verdura).
- **Color**: solo cuando Mercadona lo ha publicado.
- **Conservación**: si el producto es fresco, va a temperatura ambiente, refrigerado o congelado. Sirve para dejar el frío para el final de la ruta. Si una subcategoría está en un mueble distinto al de su ambiente, se indica al lado.

Los datos completos están en [`mercadona-ambientes.json`](mercadona-ambientes.json): 26 ambientes, 152 subcategorías, sus grupos y **4.286 productos con su nombre oficial**. Servirán para que la app adivine en qué ambiente va cada ingrediente. Todo se sacó de `tienda.mercadona.es/api/categories/` el 23/11/2026, con el surtido online de Valencia.

La sección oficial y la conservación de cada ambiente las he asignado yo a partir de las fuentes anteriores; no vienen en la API de Mercadona.

| # | Ambiente | Sección oficial | Color | Conservación | Subcat. | Productos |
|---|---|---|---|---|---|---|
| 1 | Aceite, especias y salsas | Alimentación | —  | temp. ambiente | 4 | 131 |
| 2 | Agua y refrescos | Alimentación · bebidas | —  | temp. ambiente | 6 | 93 |
| 3 | Aperitivos | Alimentación | —  | temp. ambiente | 3 | 146 |
| 4 | Arroz, legumbres y pasta | Alimentación | —  | temp. ambiente | 3 | 84 |
| 5 | Azúcar, caramelos y chocolate | Alimentación | —  | temp. ambiente | 6 | 179 |
| 6 | Bebé | Perfumería | ⬜ gris claro | temp. ambiente | 4 | 75 |
| 7 | Bodega | Alimentación · bebidas | —  | temp. ambiente | 9 | 172 |
| 8 | Cacao, café e infusiones | Alimentación | —  | temp. ambiente | 5 | 94 |
| 9 | Carne | Carnicería | 🟥 rojo | ❄️ refrigerado | 9 | 213 |
| 10 | Cereales y galletas | Alimentación | —  | temp. ambiente | 3 | 108 |
| 11 | Charcutería y quesos | Charcutería | —  | ❄️ refrigerado | 9 | 272 |
| 12 | Congelados | Alimentación · congelados | —  | 🧊 congelado | 10 | 258 |
| 13 | Conservas, caldos y cremas | Alimentación | —  | temp. ambiente | 6 | 134 |
| 14 | Cuidado del cabello | Perfumería | ⬜ gris claro | temp. ambiente | 4 | 178 |
| 15 | Cuidado facial y corporal | Perfumería | ⬜ gris claro | temp. ambiente | 11 | 471 |
| 16 | Fitoterapia y parafarmacia | Perfumería | ⬜ gris claro | temp. ambiente | 2 | 56 |
| 17 | Fruta y verdura | Fruta y verdura | 🟩 verde | fresco | 3 | 155 |
| 18 | Huevos, leche y mantequilla | Alimentación · lácteos | 🟨 amarillo | ❄️ refrigerado | 3 | 85 |
| 19 | Limpieza y hogar | Droguería | —  | temp. ambiente | 14 | 347 |
| 20 | Maquillaje | Perfumería | ⬜ gris claro | temp. ambiente | 5 | 173 |
| 21 | Marisco y pescado | Pescadería | 🟦 azul | ❄️ refrigerado | 4 | 132 |
| 22 | Mascotas | Droguería | —  | temp. ambiente | 3 | 76 |
| 23 | Panadería y pastelería | Horno | —  | temp. ambiente | 9 | 321 |
| 24 | Pizzas y platos preparados | Alimentación · platos preparados | —  | ❄️ refrigerado | 4 | 146 |
| 25 | Postres y yogures | Alimentación · lácteos | 🟨 amarillo | ❄️ refrigerado | 9 | 144 |
| 26 | Zumos | Alimentación · bebidas | —  | temp. ambiente | 4 | 43 |

### 1. Aceite, especias y salsas

*Alimentación*

- **Aceite, vinagre y sal** (28): Aceite de oliva, Vinagre y otros aderezos, Otros aceites, Sal y bicarbonato
- **Especias** (49): Hierbas, Colorante y pimentón, Pimienta, Otras especias, Sazonadores
- **Mayonesa, ketchup y mostaza** (14): Mayonesa, Ketchup, Mostaza, Allioli
- **Otras salsas** (40): Tomate frito, Salsas para carnes, Salsas para pasta, Salsas orientales, Otras salsas

### 2. Agua y refrescos

*Alimentación · bebidas*

- **Agua** (23): Agua sin gas, Agua con gas, Gaseosa
- **Isotónico y energético** (21): Isotónico, Energético
- **Refresco de cola** (9): Cola clásica, Cola zero, Cola sin cafeína
- **Refresco de naranja y de limón** (13): Limón, Lima limón, Naranja
- **Tónica y bitter** (4): Tónica y bitter
- **Refresco de té y sin gas** (23): Té, Otros refrescos sin gas

### 3. Aperitivos

*Alimentación*

- **Aceitunas y encurtidos** (35): Aceitunas verdes, Aceitunas negras, Cóctel y banderillas, Pepinillos y otros encurtidos
- **Frutos secos y fruta desecada** (69): Frutos secos, Cocktails, Fruta desecada
- **Patatas fritas y snacks** (42): Patatas fritas, Snacks

### 4. Arroz, legumbres y pasta

*Alimentación*

- **Arroz** (15): Arroz
- **Legumbres** (15): Garbanzos, Alubias, Lentejas y otros
- **Pasta y fideos** (54): Fideos, Macarrones, pajaritas y hélices, Spaghetti y tallarines, Pasta rellena, Fideos orientales, Lasaña y canelones

### 5. Azúcar, caramelos y chocolate

*Alimentación*

- **Azúcar y edulcorante** (15): Azúcar, Edulcorante y otros
- **Chicles y caramelos** (18): Chicles, Caramelos
- **Chocolate** (84): Chocolate negro, Chocolate con leche, Chocolate blanco, Chocolatinas, Bombones, Cremas de untar
- **Golosinas** (22): Golosinas
- **Mermelada y miel** (16): Mermelada, Miel, Confitura y otros
- **Turrones** (24): Turrones

### 6. Bebé

*Perfumería* · color gris claro

- **Alimentación infantil** (33): Tarritos salados, Tarritos de fruta, Yogures y postres, Leche, Leche en polvo, Papillas
- **Biberón y chupete** (7): Biberón, Chupete
- **Higiene y cuidado** (14): Champú y jabón, Aceite y crema, Colonia, Accesorios
- **Toallitas y pañales** (21): Toallitas, Braguita y otros, Pañal talla de 0 a 3, Pañal talla de 4 a XL

### 7. Bodega

*Alimentación · bebidas*

- **Cerveza** (30): Cerveza lata, Cerveza botella y botellín, Combinado de cerveza
- **Cerveza sin alcohol** (9): Cerveza botella y botellín, Cerveza lata
- **Licores** (53): Vermouth y aperitivos, Ginebra, Brandy, Whisky, Ron, Cremas, Vodka, Anís, Otros licores, Licores sin alcohol
- **Sidra y cava** (10): Sidra, Cava brut, Cava semi seco
- **Tinto de verano y sangría** (7): Tinto de verano y sangría
- **Vino blanco** (25): Vino blanco de mesa, Rioja y otras denominaciones, Rueda, Vinos semidulces, Vinos dulces y mosto
- **Vino lambrusco y espumoso** (4): Vino lambrusco y espumoso
- **Vino rosado** (5): Vino rosado
- **Vino tinto** (29): Vino tinto de mesa, Rioja, Castilla la Mancha, Ribera del Duero, Otros vinos tintos

### 8. Cacao, café e infusiones

*Alimentación*

- **Cacao soluble y chocolate a la taza** (9): Cacao soluble, Chocolate a la taza
- **Café cápsula y monodosis** (27): Cápsulas compatibles Nespresso, Cápsulas compatibles Dolce gusto, Cápsulas compatibles Tassimo, Monodosis
- **Café molido y en grano** (16): Café molido, Café en grano
- **Café soluble y otras bebidas** (15): Café soluble, Bebidas frías, Otros
- **Té e infusiones** (27): Té, Infusiones

### 9. Carne

*Carnicería* · color rojo

- **Arreglos** (18): Arreglos
- **Aves y pollo** (50): Pavo y otras aves, Pollo
- **Carne congelada** (20) — **🧊 congelado**: Carne congelada
- **Cerdo** (38): Cerdo
- **Conejo y cordero** (9): Conejo, Cordero
- **Embutido** (14): Embutido
- **Hamburguesas y picadas** (23): Hamburguesas, Picadas y otros
- **Vacuno** (12): Vacuno
- **Empanados y elaborados** (29): Empanados y rebozados congelados, Empanados y elaborados

### 10. Cereales y galletas

*Alimentación*

- **Cereales** (42): Cereales, Cereales integrales y muesli, Barritas de cereales
- **Galletas** (58): Galletas desayuno, Galletas integrales y digestive, Con chocolate y rellenas, Galletas surtidas
- **Tortitas** (8): Tortitas

### 11. Charcutería y quesos

*Charcutería*

- **Aves y jamón cocido** (41): Pavo y otros, Jamón cocido
- **Bacón y salchichas** (26): Bacón, Salchichas
- **Chopped y mortadela** (11): Chopped, Mortadela
- **Embutido curado** (49): Salchichón, Chorizo, Lomo y otros
- **Jamón serrano** (26): Jamón serrano
- **Paté y sobrasada** (20): Paté, Sobrasada
- **Queso curado, semicurado y tierno** (34): Queso curado, Queso semicurado, Queso tierno
- **Queso lonchas, rallado y en porciones** (26): Queso lonchas, Queso rallado, Queso en porciones
- **Queso untable, fresco y especialidades** (39): Queso untable, Queso fresco, Queso especialidades

### 12. Congelados

*Alimentación · congelados*

- **Arroz y pasta** (14): Arroz, Pasta
- **Carne** (20): Carne
- **Fruta y verdura** (61): Fruta, Verdura, Patatas
- **Helados** (41): Bombones, Cucuruchos, Granizados y helados de hielo, Otros Helados, Sándwiches, Tarrinas, Barras de helado y barquillos
- **Hielo** (2): Hielo
- **Marisco** (20): Marisco, Marisco de concha y otros
- **Pescado** (36): Pescado
- **Pizzas** (15): Pizzas, Base de pizza
- **Rebozados** (31): Carne rebozada, Pescado rebozado, Verdura rebozada y otros
- **Tartas y churros** (18): Tartas, Tartas infantiles, Churros

### 13. Conservas, caldos y cremas

*Alimentación*

- **Atún y otras conservas de pescado** (28): Atún, Bonito, Caballa y melva, Sardinas, Otras conservas de pescado
- **Berberechos y mejillones** (12): Berberechos y almejas, Mejillones
- **Conservas de verdura y frutas** (44): Conservas verdura, Conservas fruta
- **Gazpacho y cremas** (14): Gazpacho y salmorejo, Cremas y puré
- **Sopa y caldo** (22): Sopa, Caldo líquido, Caldo en pastillas
- **Tomate** (14): Tomate

### 14. Cuidado del cabello

*Perfumería* · color gris claro

- **Acondicionador y mascarilla** (31): Acondicionador, Mascarilla, Sérum y otros
- **Champú** (30): Champú, Champú anticaspa, Champú infantil
- **Coloración cabello** (94): Coloración negro y castaño oscuro, Coloración castaño, marrón y rubio oscuro, Coloración rubio, Coloración superaclarante y platino, Coloración rojo, cobre y violín, Coloración hombre, Retoca raíces y otros
- **Fijación cabello** (23): Espuma y laca, Gomina y cera

### 15. Cuidado facial y corporal

*Perfumería* · color gris claro

- **Afeitado y cuidado para hombre** (31): Espuma de afeitar, After shave, Maquinillas de afeitar, Recambios maquinilla de afeitar, Crema y gel de cara
- **Cuidado corporal** (45): Aceite corporal, Crema corporal, Crema manos, Crema pies, Toallitas
- **Cuidado e higiene facial** (51): Limpieza de cara, Crema de cara, Contorno de ojos, Sérum y ampollas
- **Depilación** (19): Bandas, cera y crema, Cuchilla
- **Desodorante** (41): Desodorante roll on y stick, Desodorante Spray, Otros desodorantes
- **Gel y jabón de manos** (44): Gel, Jabón de manos, Esponjas
- **Higiene bucal** (57): Pasta de dientes, Cepillo de dientes, Colutorio e hilo dental
- **Higiene íntima** (50): Compresas, Protegeslips, Tampones, Pañales para adulto, Toallitas y gel
- **Manicura y pedicura** (28): Laca de uñas, Cuidado de uñas y complementos
- **Perfume y colonia** (102): Perfume y colonia mujer, Lotes mujer, Perfume y colonia hombre, Lotes hombre, Colonia infantil
- **Protector solar y aftersun** (3): Protector solar y aftersun

### 16. Fitoterapia y parafarmacia

*Perfumería* · color gris claro

- **Fitoterapia** (24): Fitoterapia
- **Parafarmacia** (32): Botiquín, Preservativos

### 17. Fruta y verdura

*Fruta y verdura* · color verde

- **Fruta** (43): Plátano y uva, Manzana y pera, Melón y sandía, Cítricos, Fruta tropical, Otras frutas
- **Lechuga y ensalada preparada** (29): Lechuga, Ensalada preparada
- **Verdura** (83): Patata, Cebolla y ajo, Tomate, Pepino y zanahoria, Calabacín y pimiento, Repollo y col, Setas y champiñones, Hierbas aromáticas, Otras verduras y hortalizas, Verduras al vapor

### 18. Huevos, leche y mantequilla

*Alimentación · lácteos* · color amarillo

- **Huevos** (9) — **temp. ambiente**: Huevos
- **Leche y bebidas vegetales** (55) — **temp. ambiente**: Leche semidesnatada, Leche desnatada, Leche entera, Bebidas vegetales, Batidos, Leche Infantil, Leche condensada y otros
- **Mantequilla y margarina** (21): Mantequilla, Margarina, Nata

### 19. Limpieza y hogar

*Droguería*

- **Detergente y suavizante ropa** (38): Detergente líquido y gel, Detergente en polvo y monodosis, Detergente lavado a mano, Quitamanchas, Activador y antical lavadora, Suavizante, Planchado
- **Estropajo, bayeta y guantes** (24): Estropajo, Bayeta, Guantes
- **Insecticida y ambientador** (68): Insecticida spray, Insecticida eléctrico y otros, Ambientador spray, Ambientador eléctrico, Ambientador automático, Ambientador coche, Ambientador decorativo y otros, Absorbeolores y antihumedad
- **Lejía y líquidos fuertes** (19): Lejía, Amoníaco y salfumán, Tratamiento piscina
- **Limpiacristales** (6): Limpiacristales
- **Limpiahogar y friegasuelos** (20): Friegasuelos, Limpiahogar
- **Limpieza baño y WC** (16): Limpieza baño y WC
- **Limpieza cocina** (11): Limpieza cocina
- **Limpieza muebles y multiusos** (17): Limpieza muebles, Multiusos y otros
- **Limpieza vajilla** (18): Limpiavajilla a mano, Limpiavajilla a máquina
- **Menaje y conservación de alimentos** (52): Herméticos y moldes, Papel y bolsas de conservación, Cubiertos, vajilla y mantel, Encendedores, velas y carbón
- **Papel higiénico y celulosa** (19): Servilletas, Rollo cocina, Papel higiénico, Pañuelos, Toallitas
- **Pilas y bolsas de basura** (12): Pilas, Bolsas de basura
- **Utensilios de limpieza y calzado** (27): Fregonas, escobas y mopas, Cubos y barreños, Otros utensilios de limpieza, Limpieza de calzado

### 20. Maquillaje

*Perfumería* · color gris claro

- **Bases de maquillaje y corrector** (40): Maquillaje fluido, Maquillaje compacto, Correctores y prebase
- **Colorete y polvos** (28): Colorete, Polvos
- **Labios** (57): Cuidado, Perfilador labios, Pintalabios cremoso y brillos, Pintalabios mate
- **Ojos** (44): Perfilador de ojos, Cejas, Máscara de pestañas, Sombra de ojos
- **Pinceles y brochas** (4): Pinceles y brochas

### 21. Marisco y pescado

*Pescadería* · color azul

- **Marisco** (34): Marisco, Marisco de concha, Surimi y otros
- **Pescado congelado** (50) — **🧊 congelado**: Pescado congelado, Pescado rebozado congelado, Sepia, pulpo y calamar congelado
- **Pescado fresco** (34): Salmón, Dorada, Lubina, Merluza, Sepia, pulpo y calamar, Trucha, Rodaballo, Sardina, Otros
- **Salazones y ahumados** (14): Salazones, Ahumados

### 22. Mascotas

*Droguería*

- **Gato** (38): Alimentación húmeda, Alimentación seca, Aseo y cuidado, Snacks
- **Perro** (34): Alimentación húmeda, Alimentación seca, Aseo y cuidado, Snacks
- **Otros** (4): Pájaro, Otros

### 23. Panadería y pastelería

*Horno*

- **Bollería de horno** (41): Bollería dulce, Bollería salada
- **Bollería envasada** (61): Bollería envasada, Pastelitos surtidos, Polvorones y mazapanes
- **Harina y preparado repostería** (41): Harina, Levadura y preparado repostería, Masas
- **Pan de horno** (48): Barra de pan, Pan de bocadillo, Pan rebanado
- **Pan de molde y otras especialidades** (39): Pan de molde, Otros panes, Pan de hamburguesa y wrap
- **Pan tostado y rallado** (30): Pan tostado, Pan rallado, Crakers y tartaletas
- **Picos, rosquilletas y picatostes** (26): Picos, Rosquilletas, Picatostes
- **Tartas y pasteles** (16): Tartas, Tartas infantiles, Pastelería
- **Velas y decoración** (19): Velas, Decoración

### 24. Pizzas y platos preparados

*Alimentación · platos preparados*

- **Listo para Comer** (23): Platos calientes, Platos fríos
- **Pizzas** (40): Pizzas refrigeradas, Pizzas congeladas, Base de pizza, Roscas, quiche y baguettes
- **Platos preparados calientes** (59): Pasta, Arroz, Carne, Tortilla, Fideos orientales, Platos de cuchara, Otros
- **Platos preparados fríos** (24): Gazpacho y salmorejo, Ensaladilla, Hummus y otros, Sándwich

### 25. Postres y yogures

*Alimentación · lácteos* · color amarillo

- **Bífidus** (15): Bífidus de sabores, Bífidus naturales
- **Flan y natillas** (11): Flan, Natillas
- **Gelatina y otros postres** (26): Gelatina, Otros postres
- **Postres de soja** (9): Postres de soja
- **Yogures desnatados** (16): Yogures desnatados
- **Yogures griegos** (8): Yogures griegos
- **Yogures líquidos** (31): Yogures líquidos, L-Casei, Colesterol y otros
- **Yogures naturales y sabores** (19): Yogures naturales, Yogures de sabores
- **Yogures y postres infantiles** (9): Yogures y postres infantiles

### 26. Zumos

*Alimentación · bebidas*

- **Fruta variada** (23): Fruta + leche, Fruta variada y otros sabores, Smoothie
- **Melocotón y piña** (7): Melocotón, Piña
- **Naranja** (7): Naranja
- **Tomate y otros sabores** (6): Otros sabores


## 4. Cómo se colocan los productos dentro de cada ambiente

**Mercadona no publica sus planogramas**, es decir, los planos que dicen dónde va cada producto en la estantería. Lo que se sabe sale de observaciones de terceros:

**Distribución de la tienda.** Fuente: [TFG de la Universidad de Jaén, 2021](https://creapre.ujaen.es/bitstreams/88ec43f5-4b14-4952-baef-5d71c030de4f/download), basado en observar tiendas.
- Los muebles están **en parrilla**: pasillos paralelos que se pueden recorrer en cualquier orden. En la tienda estudiada había 2 pasillos de entrada, 3 principales y 11 de acceso a las estanterías.
- Los 2 pasillos de entrada pasan por **Fruta y verdura** y por **Listo para Comer**, las secciones que Mercadona quiere potenciar.
- La gente tiende a recorrer la tienda en el sentido de las agujas del reloj. Por eso Mercadona pone **lo más buscado en las zonas de menos paso**: droguería y hogar, panadería, perfumería, carne, legumbres y lácteos.
- La sección de Perfumería tiene **4 categorías**: maquillaje, cuidado del cabello, cuidado facial y corporal, y fitoterapia y parafarmacia. Coinciden con 4 de las categorías online.

**Dentro de la estantería.**
- Predomina la **presentación vertical**: cada familia de productos ocupa una franja de arriba abajo de la estantería. En algunas estanterías también se colocan en horizontal, una familia por balda.
- **Altura de los ojos y de las manos**: los productos que más se venden y la marca propia (Hacendado). **Arriba**: productos de poca venta (en el ejemplo del cacao, el cacao puro). **Abajo**: formatos grandes y pesados (en el ejemplo, el formato familiar de Cola Cao y Nesquik).
- Fuentes: el mismo TFG, [Grado en Marketing de la Universidad de Málaga](https://gradomarketing.uma.es/lineales-en-un-supermercado-donde-colocamos-los-productos-2/) y [Categoría MAC (2012)](https://categoriamac.blogspot.com/2012/02/colocacion-de-los-productos-en-los.html).

**Otras observaciones.**
- Los yogures están en la zona de lácteos refrigerados, junto a los zumos.
- Lo que más se vende está cerca de la puerta del almacén, para reponerlo rápido.
- Mercadona **no pone juntas las categorías complementarias**, para que el cliente recorra toda la tienda.
- Fuente: [Categoría MAC (2012)](https://categoriamac.blogspot.com/2012/02/plano-mercadona-encontramos-la.html).

**Qué supone para la app.** No hay datos para saber en qué estantería exacta está cada producto. Como cada familia ocupa su propia franja de estantería, **ordenar por ambiente y después por subcategoría** sigue bien el recorrido real. Cada tienda solo necesita su orden de ambientes y, si se quiere, el orden de las subcategorías dentro de cada ambiente.

## 5. Ajustes en la app (sentido común)

La app parte de la clasificación online, pero la adapta a cómo se recorre la tienda. Están en `scripts/build-mercadona.js` y `js/aisles.js`.

- **27 ambientes en vez de 26.** Se añade **Comidas preparadas**, que corresponde a la sección *Listo para Comer*. Incluye *Listo para Comer*, *Platos preparados calientes* y *Platos preparados fríos*. El antiguo "Pizzas y platos preparados" se queda solo con las **Pizzas**.
- **Carne congelada** y **Pescado congelado** pasan al ambiente **Congelados**, que es donde están en la tienda.
- **Ingredientes con sitio fijo**, porque los nombres de la web despistan:
  - **Pescadería:** salmón (el fresco no se vende online), almejas, pulpo, atún fresco, boquerones, rape, pescadilla y tinta de calamar.
  - **Fruta y verdura:** fresas, sandía y judías verdes.
  - **Panadería:** el pan va al pan de horno.
  - **Carne:** alitas de pollo y secreto ibérico.
  - **Aperitivos:** frutos secos.
  - **Comidas preparadas:** pollo asado, croquetas y tortilla de patatas.
  - **Congelados:** varitas de merluza.
- **Reglas:**
  - Si el nombre dice *lata*, *bote* o *conserva*, va a Conservas.
  - Si dice *fresco/a*, nunca va a Conservas ni a Congelados.
  - Lo congelado solo va a Congelados si el nombre lo dice.
  - Mascotas y Bebé solo se usan si el nombre lo pide, y *perro* o *gato* deciden el apartado.

Cualquier ingrediente se puede cambiar a mano desde la lista de la compra, y la app lo recuerda.

## Casos a tener en cuenta

- **"Carne congelada"** (dentro de *Carne*) y **"Pescado congelado"** (dentro de *Marisco y pescado*) suelen estar en el mueble de congelados, no en la carnicería ni en la pescadería.
- En *Panadería y pastelería* conviven el horno (pan y bollería de horno, tartas) y productos envasados de alimentación seca (pan de molde, pan tostado, harina, bollería envasada).
- **"Embutido"** aparece en *Carne* y también en *Charcutería y quesos* (embutido curado).
- **"Listo para Comer"** suele tener una zona propia.
- *Bebé* mezcla alimentación infantil con higiene y pañales.
