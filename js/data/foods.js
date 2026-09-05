/* =============================================================
   ALLIANCE GYM — Catálogo profesional de alimentos
   Biblioteca enfocada a México y Latinoamérica.

   Todos los valores nutricionales son POR 100 g de porción
   comestible (o por 100 ml en las bebidas y leches líquidas).
   Los datos provienen de tablas nutricionales de uso común y son
   coherentes con la fórmula de Atwater: kcal ≈ 4P + 4C + 9G.
   Única excepción: la cerveza, cuyas calorías provienen en su
   mayoría del alcohol (7 kcal por gramo) y no de los macros.

   El campo carbos es el carbohidrato TOTAL; fibra va aparte y
   está incluida dentro de ese total.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Data = AG.Data || {};

  /* ---------- Categorías del catálogo ---------- */
  AG.Data.CATEGORIAS_ALIMENTO = [
    { id: 'proteina',     nombre: 'Proteínas',     color: '#e4322b', icono: 'pesa' },
    { id: 'carbohidrato', nombre: 'Carbohidratos', color: '#f0a03c', icono: 'rayo' },
    { id: 'grasa',        nombre: 'Grasas',        color: '#f2c94c', icono: 'fuego' },
    { id: 'verdura',      nombre: 'Verduras',      color: '#3fbf7f', icono: 'nutricion' },
    { id: 'fruta',        nombre: 'Frutas',        color: '#ef5da8', icono: 'manzana' },
    { id: 'lacteo',       nombre: 'Lácteos',       color: '#5aa9f0', icono: 'agua' },
    { id: 'bebida',       nombre: 'Bebidas',       color: '#38c6d9', icono: 'gota' },
    { id: 'suplemento',   nombre: 'Suplementos',   color: '#9b7bf0', icono: 'escudo' },
    { id: 'snack',        nombre: 'Snacks',        color: '#ff8a5b', icono: 'estrella' },
    { id: 'preparado',    nombre: 'Preparados',    color: '#8d9aa8', icono: 'clase' }
  ];

  /* =============================================================
     CATÁLOGO
     ============================================================= */
  AG.Data.foods = [

    /* ---------- PROTEÍNAS (35) ---------- */
    { id: 'al_pechuga_pollo', nombre: 'Pechuga de pollo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 165, proteina: 31, carbos: 0, grasa: 3.6, fibra: 0, medidaCasera: '1 pieza mediana ≈ 120 g', etiquetas: ['magro', 'alto en proteína', 'post-entreno'] },
    { id: 'al_muslo_pollo', nombre: 'Muslo de pollo sin piel', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 175, proteina: 24, carbos: 0, grasa: 8.5, fibra: 0, medidaCasera: '1 muslo ≈ 95 g', etiquetas: ['alto en proteína', 'económico'] },
    { id: 'al_huevo_entero', nombre: 'Huevo entero', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 143, proteina: 12.6, carbos: 1.1, grasa: 9.5, fibra: 0, medidaCasera: '1 pieza ≈ 55 g', etiquetas: ['económico', 'vegetariano', 'desayuno'] },
    { id: 'al_clara_huevo', nombre: 'Clara de huevo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 52, proteina: 11, carbos: 0.7, grasa: 0.2, fibra: 0, medidaCasera: '1 clara ≈ 33 g', etiquetas: ['magro', 'bajo en calorías', 'post-entreno'] },
    { id: 'al_yema_huevo', nombre: 'Yema de huevo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 322, proteina: 15.9, carbos: 3.6, grasa: 26.5, fibra: 0, medidaCasera: '1 yema ≈ 17 g', etiquetas: ['alto en grasa', 'vegetariano'] },
    { id: 'al_atun_agua', nombre: 'Atún en agua drenado', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 116, proteina: 26, carbos: 0, grasa: 1, fibra: 0, medidaCasera: '1 lata drenada ≈ 80 g', etiquetas: ['magro', 'económico', 'práctico'] },
    { id: 'al_atun_aceite', nombre: 'Atún en aceite drenado', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 186, proteina: 26.5, carbos: 0, grasa: 8, fibra: 0, medidaCasera: '1 lata drenada ≈ 80 g', etiquetas: ['práctico', 'alto en proteína'] },
    { id: 'al_salmon', nombre: 'Salmón', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 208, proteina: 20, carbos: 0, grasa: 13, fibra: 0, medidaCasera: '1 filete ≈ 140 g', etiquetas: ['omega 3', 'grasa saludable'] },
    { id: 'al_tilapia', nombre: 'Filete de tilapia', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 96, proteina: 20.1, carbos: 0, grasa: 1.7, fibra: 0, medidaCasera: '1 filete ≈ 130 g', etiquetas: ['magro', 'económico'] },
    { id: 'al_pescado_basa', nombre: 'Filete de pescado blanco (basa)', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 90, proteina: 16, carbos: 0, grasa: 2.6, fibra: 0, medidaCasera: '1 filete ≈ 150 g', etiquetas: ['magro', 'económico'] },
    { id: 'al_molida_res_90', nombre: 'Carne molida de res 90/10', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 176, proteina: 20, carbos: 0, grasa: 10, fibra: 0, medidaCasera: '1 porción ≈ 120 g', etiquetas: ['alto en proteína'] },
    { id: 'al_molida_res_80', nombre: 'Carne molida de res 80/20', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 254, proteina: 17.4, carbos: 0, grasa: 20, fibra: 0, medidaCasera: '1 porción ≈ 120 g', etiquetas: ['alto en grasa', 'económico'] },
    { id: 'al_bistec_res', nombre: 'Bistec de res (aguayón)', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 158, proteina: 22, carbos: 0, grasa: 7, fibra: 0, medidaCasera: '1 bistec ≈ 110 g', etiquetas: ['alto en proteína', 'hierro'] },
    { id: 'al_arrachera', nombre: 'Arrachera', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 198, proteina: 21, carbos: 0, grasa: 12, fibra: 0, medidaCasera: '1 porción ≈ 150 g', etiquetas: ['mexicano', 'alto en proteína'] },
    { id: 'al_lomo_cerdo', nombre: 'Lomo de cerdo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 137, proteina: 21.5, carbos: 0, grasa: 5, fibra: 0, medidaCasera: '1 medallón ≈ 100 g', etiquetas: ['magro', 'alto en proteína'] },
    { id: 'al_chuleta_cerdo', nombre: 'Chuleta de cerdo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 185, proteina: 22, carbos: 0, grasa: 10, fibra: 0, medidaCasera: '1 chuleta ≈ 130 g', etiquetas: ['alto en proteína'] },
    { id: 'al_pechuga_pavo', nombre: 'Pechuga de pavo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 117, proteina: 24, carbos: 0, grasa: 2, fibra: 0, medidaCasera: '1 filete ≈ 120 g', etiquetas: ['magro', 'bajo en grasa'] },
    { id: 'al_pavo_rebanadas', nombre: 'Pavo en rebanadas', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 100, proteina: 17, carbos: 2.5, grasa: 2, fibra: 0, medidaCasera: '2 rebanadas ≈ 40 g', etiquetas: ['práctico', 'alto en sodio'] },
    { id: 'al_camaron', nombre: 'Camarón', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 99, proteina: 20.1, carbos: 0.9, grasa: 1.4, fibra: 0, medidaCasera: '6 piezas medianas ≈ 85 g', etiquetas: ['magro', 'bajo en calorías'] },
    { id: 'al_sardina_tomate', nombre: 'Sardina en salsa de tomate', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 190, proteina: 20, carbos: 1, grasa: 11, fibra: 0.3, medidaCasera: '1 lata ≈ 105 g', etiquetas: ['omega 3', 'económico', 'práctico'] },
    { id: 'al_requeson', nombre: 'Requesón', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 98, proteina: 11, carbos: 3, grasa: 4, fibra: 0, medidaCasera: 'media taza ≈ 110 g', etiquetas: ['vegetariano', 'económico', 'mexicano'] },
    { id: 'al_queso_panela', nombre: 'Queso panela', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 215, proteina: 18, carbos: 2, grasa: 14, fibra: 0, medidaCasera: '1 rebanada ≈ 40 g', etiquetas: ['vegetariano', 'mexicano', 'alto en proteína'] },
    { id: 'al_queso_cottage', nombre: 'Queso cottage bajo en grasa', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 72, proteina: 11, carbos: 3.4, grasa: 1.2, fibra: 0, medidaCasera: 'media taza ≈ 113 g', etiquetas: ['bajo en grasa', 'vegetariano', 'alto en proteína'] },
    { id: 'al_proteina_aislada', nombre: 'Proteína de suero aislada', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 373, proteina: 90, carbos: 1, grasa: 0.5, fibra: 0, medidaCasera: '1 medida ≈ 30 g', etiquetas: ['post-entreno', 'magro', 'alto en proteína'] },
    { id: 'al_higado_res', nombre: 'Hígado de res', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 145, proteina: 20, carbos: 3.9, grasa: 4.9, fibra: 0, medidaCasera: '1 porción ≈ 100 g', etiquetas: ['económico', 'hierro'] },
    { id: 'al_chorizo', nombre: 'Chorizo de cerdo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 455, proteina: 24, carbos: 1.9, grasa: 38, fibra: 0, medidaCasera: '1 pieza ≈ 60 g', etiquetas: ['alto en grasa', 'ocasional', 'mexicano'] },
    { id: 'al_jamon_pavo', nombre: 'Jamón de pavo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 104, proteina: 16, carbos: 2, grasa: 3, fibra: 0, medidaCasera: '2 rebanadas ≈ 40 g', etiquetas: ['práctico', 'bajo en grasa'] },
    { id: 'al_jamon_pierna', nombre: 'Jamón de pierna', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 130, proteina: 18, carbos: 1.5, grasa: 5, fibra: 0, medidaCasera: '2 rebanadas ≈ 40 g', etiquetas: ['práctico', 'alto en sodio'] },
    { id: 'al_salchicha_pavo', nombre: 'Salchicha de pavo', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 180, proteina: 14, carbos: 3, grasa: 12, fibra: 0, medidaCasera: '1 pieza ≈ 45 g', etiquetas: ['práctico', 'alto en sodio', 'ocasional'] },
    { id: 'al_atun_fresco', nombre: 'Atún fresco de aleta amarilla', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 109, proteina: 24, carbos: 0, grasa: 1, fibra: 0, medidaCasera: '1 filete ≈ 150 g', etiquetas: ['magro', 'omega 3', 'alto en proteína'] },
    { id: 'al_pulpo', nombre: 'Pulpo cocido', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 164, proteina: 29.8, carbos: 4.4, grasa: 2.1, fibra: 0, medidaCasera: '1 porción ≈ 100 g', etiquetas: ['magro', 'alto en proteína'] },
    { id: 'al_bacalao', nombre: 'Filete de bacalao', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 82, proteina: 18, carbos: 0, grasa: 0.7, fibra: 0, medidaCasera: '1 filete ≈ 150 g', etiquetas: ['magro', 'bajo en calorías'] },
    { id: 'al_machaca', nombre: 'Machaca (carne seca de res)', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 335, proteina: 58, carbos: 3, grasa: 9, fibra: 0, medidaCasera: 'un cuarto de taza ≈ 25 g', etiquetas: ['mexicano', 'alto en proteína', 'alto en sodio'] },
    { id: 'al_tofu', nombre: 'Tofu firme', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 128, proteina: 12, carbos: 2.8, grasa: 7, fibra: 1, medidaCasera: '1 rebanada gruesa ≈ 80 g', etiquetas: ['vegano', 'vegetariano', 'sin gluten'] },
    { id: 'al_soya_texturizada', nombre: 'Soya texturizada seca', categoria: 'proteina', porcion: 100, unidad: 'g', kcal: 335, proteina: 52, carbos: 33, grasa: 1.5, fibra: 18, medidaCasera: 'media taza seca ≈ 40 g', etiquetas: ['vegano', 'económico', 'alto en fibra', 'alto en proteína'] },

    /* ---------- CARBOHIDRATOS (30) ---------- */
    { id: 'al_arroz_blanco', nombre: 'Arroz blanco cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 130, proteina: 2.7, carbos: 28, grasa: 0.3, fibra: 0.4, medidaCasera: '1 taza cocido ≈ 158 g', etiquetas: ['económico', 'sin gluten', 'pre-entreno'] },
    { id: 'al_arroz_integral', nombre: 'Arroz integral cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 112, proteina: 2.6, carbos: 23, grasa: 0.9, fibra: 1.8, medidaCasera: '1 taza cocido ≈ 195 g', etiquetas: ['alto en fibra', 'sin gluten', 'saciante'] },
    { id: 'al_tortilla_maiz', nombre: 'Tortilla de maíz', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 218, proteina: 5.7, carbos: 44.6, grasa: 1.8, fibra: 5.2, medidaCasera: '1 tortilla ≈ 30 g', etiquetas: ['mexicano', 'económico', 'sin gluten'] },
    { id: 'al_tortilla_harina', nombre: 'Tortilla de harina', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 310, proteina: 8, carbos: 50, grasa: 8, fibra: 3, medidaCasera: '1 tortilla ≈ 40 g', etiquetas: ['mexicano'] },
    { id: 'al_avena', nombre: 'Avena en hojuelas', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 380, proteina: 13.5, carbos: 68, grasa: 7, fibra: 10, medidaCasera: 'media taza ≈ 40 g', etiquetas: ['alto en fibra', 'económico', 'pre-entreno', 'saciante'] },
    { id: 'al_pan_integral', nombre: 'Pan integral', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 250, proteina: 13, carbos: 43, grasa: 3.5, fibra: 6, medidaCasera: '1 rebanada ≈ 28 g', etiquetas: ['alto en fibra', 'saciante'] },
    { id: 'al_pan_blanco', nombre: 'Pan blanco de caja', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 265, proteina: 8, carbos: 50, grasa: 3.2, fibra: 2.4, medidaCasera: '1 rebanada ≈ 26 g', etiquetas: ['económico'] },
    { id: 'al_pasta_cocida', nombre: 'Pasta cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 158, proteina: 5.8, carbos: 31, grasa: 1.1, fibra: 1.8, medidaCasera: '1 taza cocida ≈ 140 g', etiquetas: ['pre-entreno', 'económico'] },
    { id: 'al_papa_cocida', nombre: 'Papa cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 87, proteina: 2, carbos: 20, grasa: 0.1, fibra: 1.8, medidaCasera: '1 pieza mediana ≈ 150 g', etiquetas: ['económico', 'sin gluten', 'saciante'] },
    { id: 'al_camote', nombre: 'Camote cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 90, proteina: 1.6, carbos: 20.7, grasa: 0.1, fibra: 3.3, medidaCasera: '1 pieza mediana ≈ 130 g', etiquetas: ['alto en fibra', 'sin gluten', 'mexicano'] },
    { id: 'al_frijol_negro', nombre: 'Frijol negro cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 132, proteina: 8.9, carbos: 23.7, grasa: 0.5, fibra: 8.7, medidaCasera: 'media taza ≈ 86 g', etiquetas: ['alto en fibra', 'vegano', 'económico', 'mexicano'] },
    { id: 'al_frijol_bayo', nombre: 'Frijol bayo cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 130, proteina: 9.1, carbos: 23, grasa: 0.5, fibra: 7.9, medidaCasera: 'media taza ≈ 86 g', etiquetas: ['alto en fibra', 'vegano', 'económico', 'mexicano'] },
    { id: 'al_lenteja', nombre: 'Lenteja cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 116, proteina: 9, carbos: 20, grasa: 0.4, fibra: 7.9, medidaCasera: 'media taza ≈ 99 g', etiquetas: ['alto en fibra', 'vegano', 'económico'] },
    { id: 'al_garbanzo', nombre: 'Garbanzo cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 164, proteina: 8.9, carbos: 27.4, grasa: 2.6, fibra: 7.6, medidaCasera: 'media taza ≈ 82 g', etiquetas: ['alto en fibra', 'vegano', 'saciante'] },
    { id: 'al_elote', nombre: 'Elote desgranado cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 108, proteina: 3.3, carbos: 21, grasa: 1.4, fibra: 2.4, medidaCasera: '1 elote ≈ 90 g de grano', etiquetas: ['mexicano', 'sin gluten', 'económico'] },
    { id: 'al_quinoa', nombre: 'Quinoa cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 120, proteina: 4.4, carbos: 21.3, grasa: 1.9, fibra: 2.8, medidaCasera: '1 taza cocida ≈ 185 g', etiquetas: ['vegano', 'sin gluten', 'alto en fibra'] },
    { id: 'al_amaranto', nombre: 'Amaranto tostado', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 375, proteina: 14.5, carbos: 65, grasa: 7, fibra: 6.7, medidaCasera: 'un cuarto de taza ≈ 25 g', etiquetas: ['mexicano', 'sin gluten', 'vegano', 'alto en fibra'] },
    { id: 'al_tostada_maiz', nombre: 'Tostada de maíz horneada', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 380, proteina: 7.5, carbos: 77, grasa: 4, fibra: 7, medidaCasera: '1 tostada ≈ 15 g', etiquetas: ['mexicano', 'sin gluten', 'práctico'] },
    { id: 'al_yuca', nombre: 'Yuca cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 160, proteina: 1.4, carbos: 38, grasa: 0.3, fibra: 1.8, medidaCasera: '1 porción ≈ 120 g', etiquetas: ['sin gluten', 'económico', 'vegano'] },
    { id: 'al_platano_macho', nombre: 'Plátano macho cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 133, proteina: 1.3, carbos: 31.9, grasa: 0.4, fibra: 2.3, medidaCasera: 'media pieza ≈ 90 g', etiquetas: ['sin gluten', 'pre-entreno', 'vegano'] },
    { id: 'al_bolillo', nombre: 'Bolillo', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 277, proteina: 8.5, carbos: 57, grasa: 2, fibra: 2.4, medidaCasera: '1 pieza ≈ 70 g', etiquetas: ['mexicano', 'económico'] },
    { id: 'al_cereal_maiz', nombre: 'Cereal de maíz sin azúcar', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 360, proteina: 7.5, carbos: 84, grasa: 0.4, fibra: 3, medidaCasera: '1 taza ≈ 28 g', etiquetas: ['práctico', 'bajo en grasa'] },
    { id: 'al_granola', nombre: 'Granola', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 430, proteina: 10, carbos: 64, grasa: 14, fibra: 7, medidaCasera: 'un tercio de taza ≈ 40 g', etiquetas: ['alto en fibra', 'energético'] },
    { id: 'al_pan_pita', nombre: 'Pan pita integral', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 275, proteina: 9.8, carbos: 55.7, grasa: 1.7, fibra: 7.4, medidaCasera: '1 pieza ≈ 60 g', etiquetas: ['alto en fibra', 'práctico'] },
    { id: 'al_haba_cocida', nombre: 'Haba cocida', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 110, proteina: 7.6, carbos: 19.6, grasa: 0.4, fibra: 5.4, medidaCasera: 'media taza ≈ 85 g', etiquetas: ['vegano', 'alto en fibra', 'económico'] },
    { id: 'al_espagueti_integral', nombre: 'Espagueti integral cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 138, proteina: 5.3, carbos: 27, grasa: 1.4, fibra: 4.5, medidaCasera: '1 taza cocida ≈ 140 g', etiquetas: ['alto en fibra', 'saciante'] },
    { id: 'al_cuscus', nombre: 'Cuscús cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 112, proteina: 3.8, carbos: 23.2, grasa: 0.2, fibra: 1.4, medidaCasera: '1 taza cocido ≈ 157 g', etiquetas: ['práctico', 'bajo en grasa'] },
    { id: 'al_concha_pan_dulce', nombre: 'Concha (pan dulce)', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 360, proteina: 6.5, carbos: 55, grasa: 12, fibra: 2, medidaCasera: '1 pieza ≈ 75 g', etiquetas: ['mexicano', 'ocasional', 'alto en azúcar'] },
    { id: 'al_maiz_pozolero', nombre: 'Maíz pozolero cocido', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 115, proteina: 3.5, carbos: 23, grasa: 1.2, fibra: 3, medidaCasera: 'media taza ≈ 80 g', etiquetas: ['mexicano', 'sin gluten', 'económico'] },
    { id: 'al_masa_maiz', nombre: 'Masa de maíz nixtamalizada', categoria: 'carbohidrato', porcion: 100, unidad: 'g', kcal: 180, proteina: 4.4, carbos: 36, grasa: 2, fibra: 3.5, medidaCasera: '1 bola para tortilla ≈ 30 g', etiquetas: ['mexicano', 'sin gluten', 'económico'] },

    /* ---------- GRASAS (15) ---------- */
    { id: 'al_aguacate', nombre: 'Aguacate Hass', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 160, proteina: 2, carbos: 8, grasa: 14, fibra: 6.7, medidaCasera: 'media pieza ≈ 70 g', etiquetas: ['grasa saludable', 'vegano', 'alto en fibra', 'mexicano'] },
    { id: 'al_aceite_oliva', nombre: 'Aceite de oliva', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 884, proteina: 0, carbos: 0, grasa: 100, fibra: 0, medidaCasera: '1 cucharada ≈ 14 g', etiquetas: ['grasa saludable', 'vegano', 'sin gluten'] },
    { id: 'al_aceite_canola', nombre: 'Aceite vegetal de canola', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 884, proteina: 0, carbos: 0, grasa: 100, fibra: 0, medidaCasera: '1 cucharada ≈ 14 g', etiquetas: ['económico', 'vegano', 'sin gluten'] },
    { id: 'al_almendra', nombre: 'Almendra', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 579, proteina: 21.2, carbos: 21.6, grasa: 49.9, fibra: 12.5, medidaCasera: '1 puño ≈ 28 g (23 piezas)', etiquetas: ['grasa saludable', 'alto en fibra', 'vegano'] },
    { id: 'al_nuez', nombre: 'Nuez de Castilla', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 654, proteina: 15.2, carbos: 13.7, grasa: 65.2, fibra: 6.7, medidaCasera: '1 puño ≈ 28 g', etiquetas: ['omega 3', 'grasa saludable', 'vegano'] },
    { id: 'al_cacahuate', nombre: 'Cacahuate tostado sin sal', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 587, proteina: 26, carbos: 21, grasa: 49, fibra: 8, medidaCasera: '1 puño ≈ 28 g', etiquetas: ['económico', 'vegano', 'alto en proteína', 'mexicano'] },
    { id: 'al_crema_cacahuate', nombre: 'Crema de cacahuate natural', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 588, proteina: 25, carbos: 20, grasa: 50, fibra: 6, medidaCasera: '1 cucharada ≈ 16 g', etiquetas: ['saciante', 'vegano', 'alto en proteína'] },
    { id: 'al_chia', nombre: 'Semilla de chía', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 486, proteina: 17, carbos: 42, grasa: 31, fibra: 34, medidaCasera: '1 cucharada ≈ 12 g', etiquetas: ['alto en fibra', 'omega 3', 'vegano', 'mexicano'] },
    { id: 'al_linaza', nombre: 'Linaza', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 534, proteina: 18.3, carbos: 28.9, grasa: 42.2, fibra: 27.3, medidaCasera: '1 cucharada ≈ 10 g', etiquetas: ['alto en fibra', 'omega 3', 'vegano'] },
    { id: 'al_ajonjoli', nombre: 'Ajonjolí', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 573, proteina: 17.7, carbos: 23.4, grasa: 49.7, fibra: 11.8, medidaCasera: '1 cucharada ≈ 9 g', etiquetas: ['vegano', 'grasa saludable', 'alto en fibra'] },
    { id: 'al_nuez_india', nombre: 'Nuez de la India', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 553, proteina: 18, carbos: 30, grasa: 44, fibra: 3.3, medidaCasera: '1 puño ≈ 28 g', etiquetas: ['vegano', 'grasa saludable'] },
    { id: 'al_pistache', nombre: 'Pistache', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 560, proteina: 20, carbos: 28, grasa: 45, fibra: 10, medidaCasera: '1 puño ≈ 28 g', etiquetas: ['vegano', 'alto en fibra', 'grasa saludable'] },
    { id: 'al_pepita_calabaza', nombre: 'Pepita de calabaza', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 559, proteina: 30, carbos: 11, grasa: 49, fibra: 6, medidaCasera: '1 puño ≈ 28 g', etiquetas: ['mexicano', 'vegano', 'alto en proteína'] },
    { id: 'al_aceituna', nombre: 'Aceituna verde', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 145, proteina: 1, carbos: 3.8, grasa: 15.3, fibra: 3.3, medidaCasera: '5 piezas ≈ 20 g', etiquetas: ['vegano', 'alto en sodio', 'grasa saludable'] },
    { id: 'al_coco_rallado', nombre: 'Coco rallado sin azúcar', categoria: 'grasa', porcion: 100, unidad: 'g', kcal: 660, proteina: 6.9, carbos: 24, grasa: 65, fibra: 16, medidaCasera: '2 cucharadas ≈ 15 g', etiquetas: ['vegano', 'alto en fibra', 'sin gluten'] },

    /* ---------- VERDURAS (25) ---------- */
    { id: 'al_nopal', nombre: 'Nopal', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 20, proteina: 1.3, carbos: 3.3, grasa: 0.1, fibra: 2.2, medidaCasera: '1 penca mediana ≈ 85 g', etiquetas: ['mexicano', 'alto en fibra', 'bajo en calorías', 'vegano'] },
    { id: 'al_calabacita', nombre: 'Calabacita', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 19, proteina: 1.2, carbos: 3.1, grasa: 0.3, fibra: 1, medidaCasera: '1 pieza ≈ 120 g', etiquetas: ['bajo en calorías', 'vegano', 'económico'] },
    { id: 'al_brocoli', nombre: 'Brócoli', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 38, proteina: 2.8, carbos: 6.6, grasa: 0.4, fibra: 2.6, medidaCasera: '1 taza ≈ 90 g', etiquetas: ['alto en fibra', 'vegano', 'antioxidante'] },
    { id: 'al_espinaca', nombre: 'Espinaca', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 28, proteina: 2.9, carbos: 3.6, grasa: 0.4, fibra: 2.2, medidaCasera: '1 taza cruda ≈ 30 g', etiquetas: ['hierro', 'vegano', 'bajo en calorías'] },
    { id: 'al_jitomate', nombre: 'Jitomate', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 20, proteina: 0.9, carbos: 3.9, grasa: 0.2, fibra: 1.2, medidaCasera: '1 pieza mediana ≈ 120 g', etiquetas: ['mexicano', 'bajo en calorías', 'vegano'] },
    { id: 'al_chayote', nombre: 'Chayote', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 21, proteina: 0.8, carbos: 4.5, grasa: 0.1, fibra: 1.7, medidaCasera: '1 pieza ≈ 200 g', etiquetas: ['mexicano', 'bajo en calorías', 'vegano'] },
    { id: 'al_ejote', nombre: 'Ejote', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 35, proteina: 1.8, carbos: 7, grasa: 0.2, fibra: 2.7, medidaCasera: '1 taza ≈ 100 g', etiquetas: ['alto en fibra', 'vegano', 'económico'] },
    { id: 'al_pepino', nombre: 'Pepino', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 17, proteina: 0.7, carbos: 3.6, grasa: 0.1, fibra: 0.5, medidaCasera: '1 pieza ≈ 200 g', etiquetas: ['hidratante', 'bajo en calorías', 'vegano'] },
    { id: 'al_lechuga', nombre: 'Lechuga romana', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 20, proteina: 1.2, carbos: 3.3, grasa: 0.3, fibra: 2.1, medidaCasera: '2 tazas ≈ 90 g', etiquetas: ['bajo en calorías', 'vegano', 'económico'] },
    { id: 'al_champinon', nombre: 'Champiñón', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 27, proteina: 3.1, carbos: 3.3, grasa: 0.3, fibra: 1, medidaCasera: '1 taza rebanado ≈ 70 g', etiquetas: ['bajo en calorías', 'vegano'] },
    { id: 'al_pimiento', nombre: 'Pimiento morrón', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 30, proteina: 1, carbos: 6, grasa: 0.3, fibra: 2.1, medidaCasera: '1 pieza ≈ 120 g', etiquetas: ['antioxidante', 'vegano', 'bajo en calorías'] },
    { id: 'al_cebolla', nombre: 'Cebolla', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 40, proteina: 1.1, carbos: 9.3, grasa: 0.1, fibra: 1.7, medidaCasera: 'media pieza ≈ 55 g', etiquetas: ['económico', 'vegano', 'mexicano'] },
    { id: 'al_zanahoria', nombre: 'Zanahoria', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 41, proteina: 0.9, carbos: 9.6, grasa: 0.2, fibra: 2.8, medidaCasera: '1 pieza mediana ≈ 60 g', etiquetas: ['antioxidante', 'vegano', 'económico'] },
    { id: 'al_coliflor', nombre: 'Coliflor', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 28, proteina: 1.9, carbos: 5, grasa: 0.3, fibra: 2, medidaCasera: '1 taza ≈ 100 g', etiquetas: ['bajo en carbohidratos', 'vegano', 'bajo en calorías'] },
    { id: 'al_chile_poblano', nombre: 'Chile poblano', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 26, proteina: 1.3, carbos: 5, grasa: 0.2, fibra: 1.8, medidaCasera: '1 pieza ≈ 90 g', etiquetas: ['mexicano', 'vegano', 'bajo en calorías'] },
    { id: 'al_betabel', nombre: 'Betabel', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 44, proteina: 1.6, carbos: 9.6, grasa: 0.2, fibra: 2.8, medidaCasera: '1 pieza chica ≈ 80 g', etiquetas: ['antioxidante', 'vegano', 'pre-entreno'] },
    { id: 'al_apio', nombre: 'Apio', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 16, proteina: 0.7, carbos: 3, grasa: 0.2, fibra: 1.6, medidaCasera: '2 tallos ≈ 80 g', etiquetas: ['bajo en calorías', 'hidratante', 'vegano'] },
    { id: 'al_col', nombre: 'Col (repollo)', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 27, proteina: 1.3, carbos: 5.8, grasa: 0.1, fibra: 2.5, medidaCasera: '1 taza rallada ≈ 90 g', etiquetas: ['económico', 'vegano', 'alto en fibra'] },
    { id: 'al_chile_jalapeno', nombre: 'Chile jalapeño', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 31, proteina: 0.9, carbos: 6.5, grasa: 0.4, fibra: 2.8, medidaCasera: '1 pieza ≈ 25 g', etiquetas: ['mexicano', 'vegano', 'bajo en calorías'] },
    { id: 'al_chicharo', nombre: 'Chícharo cocido', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 84, proteina: 5.4, carbos: 15.6, grasa: 0.4, fibra: 5.5, medidaCasera: 'media taza ≈ 80 g', etiquetas: ['alto en fibra', 'vegano', 'económico'] },
    { id: 'al_esparrago', nombre: 'Espárrago', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 24, proteina: 2.2, carbos: 3.9, grasa: 0.1, fibra: 2.1, medidaCasera: '6 piezas ≈ 90 g', etiquetas: ['bajo en calorías', 'vegano'] },
    { id: 'al_cilantro', nombre: 'Cilantro', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 26, proteina: 2.1, carbos: 3.7, grasa: 0.5, fibra: 2.8, medidaCasera: 'un cuarto de taza ≈ 4 g', etiquetas: ['mexicano', 'vegano', 'bajo en calorías'] },
    { id: 'al_verdolaga', nombre: 'Verdolaga', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 20, proteina: 1.6, carbos: 2.5, grasa: 0.3, fibra: 1.5, medidaCasera: '1 taza ≈ 45 g', etiquetas: ['mexicano', 'omega 3', 'vegano'] },
    { id: 'al_calabaza_castilla', nombre: 'Calabaza de Castilla', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 30, proteina: 1, carbos: 6.5, grasa: 0.1, fibra: 0.5, medidaCasera: '1 taza en cubos ≈ 116 g', etiquetas: ['antioxidante', 'vegano', 'mexicano'] },
    { id: 'al_rabano', nombre: 'Rábano', categoria: 'verdura', porcion: 100, unidad: 'g', kcal: 17, proteina: 0.7, carbos: 3.4, grasa: 0.1, fibra: 1.6, medidaCasera: '5 piezas ≈ 50 g', etiquetas: ['bajo en calorías', 'mexicano', 'vegano'] },

    /* ---------- FRUTAS (23) ---------- */
    { id: 'al_platano', nombre: 'Plátano Tabasco', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 92, proteina: 1.1, carbos: 22.8, grasa: 0.3, fibra: 2.6, medidaCasera: '1 pieza mediana ≈ 118 g', etiquetas: ['pre-entreno', 'potasio', 'vegano'] },
    { id: 'al_manzana', nombre: 'Manzana', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 55, proteina: 0.3, carbos: 13.8, grasa: 0.2, fibra: 2.4, medidaCasera: '1 pieza mediana ≈ 180 g', etiquetas: ['alto en fibra', 'vegano', 'saciante'] },
    { id: 'al_papaya', nombre: 'Papaya', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 45, proteina: 0.5, carbos: 10.8, grasa: 0.3, fibra: 1.7, medidaCasera: '1 taza en cubos ≈ 145 g', etiquetas: ['digestiva', 'mexicano', 'vegano'] },
    { id: 'al_mango', nombre: 'Mango', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 63, proteina: 0.8, carbos: 15, grasa: 0.4, fibra: 1.6, medidaCasera: '1 pieza mediana ≈ 200 g', etiquetas: ['mexicano', 'vegano', 'antioxidante'] },
    { id: 'al_pina', nombre: 'Piña', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 52, proteina: 0.5, carbos: 13.1, grasa: 0.1, fibra: 1.4, medidaCasera: '1 taza en cubos ≈ 165 g', etiquetas: ['digestiva', 'vegano', 'mexicano'] },
    { id: 'al_fresa', nombre: 'Fresa', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 34, proteina: 0.7, carbos: 7.7, grasa: 0.3, fibra: 2, medidaCasera: '1 taza ≈ 150 g', etiquetas: ['antioxidante', 'bajo en calorías', 'vegano'] },
    { id: 'al_sandia', nombre: 'Sandía', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 32, proteina: 0.6, carbos: 7.6, grasa: 0.2, fibra: 0.4, medidaCasera: '1 taza en cubos ≈ 152 g', etiquetas: ['hidratante', 'bajo en calorías', 'vegano'] },
    { id: 'al_melon', nombre: 'Melón', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 36, proteina: 0.8, carbos: 8.2, grasa: 0.2, fibra: 0.9, medidaCasera: '1 taza en cubos ≈ 160 g', etiquetas: ['hidratante', 'vegano', 'bajo en calorías'] },
    { id: 'al_naranja', nombre: 'Naranja', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 49, proteina: 0.9, carbos: 11.8, grasa: 0.1, fibra: 2.4, medidaCasera: '1 pieza mediana ≈ 140 g', etiquetas: ['vitamina C', 'vegano', 'económico'] },
    { id: 'al_guayaba', nombre: 'Guayaba', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 71, proteina: 2.6, carbos: 14.3, grasa: 1, fibra: 5.4, medidaCasera: '2 piezas ≈ 110 g', etiquetas: ['alto en fibra', 'mexicano', 'vitamina C', 'vegano'] },
    { id: 'al_mandarina', nombre: 'Mandarina', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 55, proteina: 0.8, carbos: 13.3, grasa: 0.3, fibra: 1.8, medidaCasera: '1 pieza ≈ 90 g', etiquetas: ['vitamina C', 'vegano', 'práctico'] },
    { id: 'al_uva', nombre: 'Uva', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 72, proteina: 0.7, carbos: 18.1, grasa: 0.2, fibra: 0.9, medidaCasera: '15 piezas ≈ 90 g', etiquetas: ['antioxidante', 'vegano', 'pre-entreno'] },
    { id: 'al_toronja', nombre: 'Toronja', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 44, proteina: 0.8, carbos: 10.7, grasa: 0.1, fibra: 1.6, medidaCasera: 'media pieza ≈ 120 g', etiquetas: ['bajo en calorías', 'vegano', 'vitamina C'] },
    { id: 'al_pera', nombre: 'Pera', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 59, proteina: 0.4, carbos: 15.2, grasa: 0.1, fibra: 3.1, medidaCasera: '1 pieza mediana ≈ 178 g', etiquetas: ['alto en fibra', 'vegano', 'saciante'] },
    { id: 'al_kiwi', nombre: 'Kiwi', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 63, proteina: 1.1, carbos: 14.7, grasa: 0.5, fibra: 3, medidaCasera: '1 pieza ≈ 75 g', etiquetas: ['vitamina C', 'vegano', 'alto en fibra'] },
    { id: 'al_arandano', nombre: 'Arándano azul', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 59, proteina: 0.7, carbos: 14.5, grasa: 0.3, fibra: 2.4, medidaCasera: 'media taza ≈ 74 g', etiquetas: ['antioxidante', 'vegano'] },
    { id: 'al_tuna', nombre: 'Tuna', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 43, proteina: 0.7, carbos: 9.6, grasa: 0.5, fibra: 3.6, medidaCasera: '1 pieza ≈ 100 g', etiquetas: ['mexicano', 'alto en fibra', 'vegano'] },
    { id: 'al_mamey', nombre: 'Mamey', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 130, proteina: 1.5, carbos: 32, grasa: 0.5, fibra: 5.4, medidaCasera: 'media pieza ≈ 110 g', etiquetas: ['mexicano', 'energético', 'vegano'] },
    { id: 'al_durazno', nombre: 'Durazno', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 43, proteina: 0.9, carbos: 10, grasa: 0.3, fibra: 1.5, medidaCasera: '1 pieza ≈ 150 g', etiquetas: ['bajo en calorías', 'vegano'] },
    { id: 'al_ciruela', nombre: 'Ciruela', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 48, proteina: 0.7, carbos: 11.4, grasa: 0.3, fibra: 1.4, medidaCasera: '2 piezas ≈ 130 g', etiquetas: ['digestiva', 'vegano'] },
    { id: 'al_zarzamora', nombre: 'Zarzamora', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 45, proteina: 1.4, carbos: 9.6, grasa: 0.5, fibra: 5.3, medidaCasera: '1 taza ≈ 144 g', etiquetas: ['alto en fibra', 'antioxidante', 'vegano'] },
    { id: 'al_granada_roja', nombre: 'Granada roja', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 86, proteina: 1.7, carbos: 18.7, grasa: 1.2, fibra: 4, medidaCasera: 'media taza de granos ≈ 87 g', etiquetas: ['antioxidante', 'vegano', 'mexicano'] },
    { id: 'al_pasas', nombre: 'Pasas', categoria: 'fruta', porcion: 100, unidad: 'g', kcal: 310, proteina: 3.1, carbos: 79, grasa: 0.5, fibra: 3.7, medidaCasera: 'un cuarto de taza ≈ 40 g', etiquetas: ['energético', 'alto en azúcar', 'vegano'] },

    /* ---------- LÁCTEOS (14) ---------- */
    { id: 'al_leche_entera', nombre: 'Leche entera', categoria: 'lacteo', porcion: 100, unidad: 'ml', kcal: 62, proteina: 3.2, carbos: 4.8, grasa: 3.3, fibra: 0, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['vegetariano', 'calcio'] },
    { id: 'al_leche_descremada', nombre: 'Leche descremada', categoria: 'lacteo', porcion: 100, unidad: 'ml', kcal: 35, proteina: 3.4, carbos: 5, grasa: 0.2, fibra: 0, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['bajo en grasa', 'vegetariano', 'calcio'] },
    { id: 'al_leche_deslactosada', nombre: 'Leche deslactosada semidescremada', categoria: 'lacteo', porcion: 100, unidad: 'ml', kcal: 48, proteina: 3.2, carbos: 5, grasa: 1.7, fibra: 0, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['sin lactosa', 'vegetariano', 'digestiva'] },
    { id: 'al_yogur_griego', nombre: 'Yogur griego natural sin azúcar', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 59, proteina: 9, carbos: 3.6, grasa: 0.7, fibra: 0, medidaCasera: '1 vaso ≈ 150 g', etiquetas: ['alto en proteína', 'post-entreno', 'vegetariano'] },
    { id: 'al_yogur_natural', nombre: 'Yogur natural', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 63, proteina: 3.5, carbos: 4.7, grasa: 3.3, fibra: 0, medidaCasera: '1 vaso ≈ 150 g', etiquetas: ['probiótico', 'vegetariano'] },
    { id: 'al_yogur_bebible', nombre: 'Yogur bebible de sabor', categoria: 'lacteo', porcion: 100, unidad: 'ml', kcal: 74, proteina: 2.8, carbos: 12, grasa: 1.5, fibra: 0, medidaCasera: '1 botella ≈ 240 ml', etiquetas: ['alto en azúcar', 'práctico', 'ocasional'] },
    { id: 'al_queso_oaxaca', nombre: 'Queso Oaxaca', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 300, proteina: 24, carbos: 2, grasa: 21, fibra: 0, medidaCasera: '1 porción ≈ 30 g', etiquetas: ['mexicano', 'vegetariano', 'alto en proteína'] },
    { id: 'al_queso_manchego', nombre: 'Queso manchego', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 350, proteina: 25, carbos: 1.5, grasa: 26, fibra: 0, medidaCasera: '1 rebanada ≈ 25 g', etiquetas: ['alto en grasa', 'vegetariano'] },
    { id: 'al_queso_fresco', nombre: 'Queso fresco', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 232, proteina: 17, carbos: 3, grasa: 16, fibra: 0, medidaCasera: '1 porción ≈ 40 g', etiquetas: ['mexicano', 'vegetariano'] },
    { id: 'al_crema_acida', nombre: 'Crema ácida', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 214, proteina: 2.5, carbos: 4, grasa: 20, fibra: 0, medidaCasera: '1 cucharada ≈ 15 g', etiquetas: ['alto en grasa', 'mexicano', 'ocasional'] },
    { id: 'al_mantequilla', nombre: 'Mantequilla', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 717, proteina: 0.9, carbos: 0.1, grasa: 81, fibra: 0, medidaCasera: '1 cucharadita ≈ 5 g', etiquetas: ['alto en grasa', 'vegetariano', 'ocasional'] },
    { id: 'al_queso_crema', nombre: 'Queso crema', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 342, proteina: 6, carbos: 4, grasa: 34, fibra: 0, medidaCasera: '2 cucharadas ≈ 30 g', etiquetas: ['alto en grasa', 'vegetariano'] },
    { id: 'al_leche_polvo', nombre: 'Leche entera en polvo', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 496, proteina: 26, carbos: 38, grasa: 27, fibra: 0, medidaCasera: '2 cucharadas ≈ 25 g', etiquetas: ['práctico', 'económico', 'energético'] },
    { id: 'al_queso_chihuahua', nombre: 'Queso Chihuahua', categoria: 'lacteo', porcion: 100, unidad: 'g', kcal: 365, proteina: 24, carbos: 2, grasa: 28, fibra: 0, medidaCasera: '1 rebanada ≈ 30 g', etiquetas: ['mexicano', 'alto en grasa'] },

    /* ---------- BEBIDAS (13) ---------- */
    { id: 'al_agua', nombre: 'Agua natural', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0, medidaCasera: '1 vaso ≈ 250 ml', etiquetas: ['hidratante', 'sin azúcar', 'sin calorías'] },
    { id: 'al_agua_jamaica', nombre: 'Agua de jamaica sin azúcar', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 2, proteina: 0, carbos: 0.5, grasa: 0, fibra: 0, medidaCasera: '1 vaso ≈ 250 ml', etiquetas: ['mexicano', 'sin azúcar', 'hidratante'] },
    { id: 'al_cafe_negro', nombre: 'Café negro', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 2, proteina: 0.2, carbos: 0.3, grasa: 0, fibra: 0, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['sin azúcar', 'pre-entreno'] },
    { id: 'al_te_verde', nombre: 'Té verde sin azúcar', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 1, proteina: 0, carbos: 0.25, grasa: 0, fibra: 0, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['sin azúcar', 'antioxidante', 'hidratante'] },
    { id: 'al_refresco_cola', nombre: 'Refresco de cola', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 42, proteina: 0, carbos: 10.6, grasa: 0, fibra: 0, medidaCasera: '1 lata ≈ 355 ml', etiquetas: ['alto en azúcar', 'ocasional'] },
    { id: 'al_refresco_light', nombre: 'Refresco de cola light', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0, medidaCasera: '1 lata ≈ 355 ml', etiquetas: ['sin azúcar', 'sin calorías', 'ocasional'] },
    { id: 'al_jugo_naranja', nombre: 'Jugo de naranja natural', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 45, proteina: 0.7, carbos: 10.4, grasa: 0.2, fibra: 0.2, medidaCasera: '1 vaso ≈ 250 ml', etiquetas: ['vitamina C', 'pre-entreno'] },
    { id: 'al_bebida_deportiva', nombre: 'Bebida deportiva isotónica', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 25, proteina: 0, carbos: 6.2, grasa: 0, fibra: 0, medidaCasera: '1 botella ≈ 600 ml', etiquetas: ['post-entreno', 'hidratante', 'electrolitos'] },
    { id: 'al_cerveza_clara', nombre: 'Cerveza clara', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 43, proteina: 0.5, carbos: 3.6, grasa: 0, fibra: 0, medidaCasera: '1 botella ≈ 355 ml', etiquetas: ['contiene alcohol', 'ocasional'] },
    { id: 'al_leche_almendra', nombre: 'Leche de almendra sin azúcar', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 13, proteina: 0.5, carbos: 0.3, grasa: 1.1, fibra: 0.2, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['vegano', 'bajo en calorías', 'sin lactosa'] },
    { id: 'al_leche_soya', nombre: 'Leche de soya sin azúcar', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 37, proteina: 3.3, carbos: 1.8, grasa: 1.8, fibra: 0.4, medidaCasera: '1 taza ≈ 240 ml', etiquetas: ['vegano', 'alto en proteína', 'sin lactosa'] },
    { id: 'al_agua_coco', nombre: 'Agua de coco natural', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 19, proteina: 0.7, carbos: 3.7, grasa: 0.2, fibra: 1.1, medidaCasera: '1 vaso ≈ 250 ml', etiquetas: ['hidratante', 'post-entreno', 'vegano'] },
    { id: 'al_agua_horchata', nombre: 'Agua de horchata', categoria: 'bebida', porcion: 100, unidad: 'ml', kcal: 62, proteina: 0.6, carbos: 13, grasa: 1, fibra: 0.2, medidaCasera: '1 vaso ≈ 250 ml', etiquetas: ['mexicano', 'alto en azúcar', 'ocasional'] },

    /* ---------- SUPLEMENTOS (10) ---------- */
    { id: 'al_whey', nombre: 'Proteína de suero (whey) en polvo', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 400, proteina: 78, carbos: 8, grasa: 6, fibra: 1, medidaCasera: '1 medida ≈ 30 g', etiquetas: ['post-entreno', 'alto en proteína', 'práctico'] },
    { id: 'al_caseina', nombre: 'Caseína micelar en polvo', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 360, proteina: 80, carbos: 5, grasa: 2, fibra: 0.5, medidaCasera: '1 medida ≈ 30 g', etiquetas: ['alto en proteína', 'nocturno', 'saciante'] },
    { id: 'al_creatina', nombre: 'Creatina monohidratada', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0, medidaCasera: '1 cucharadita ≈ 5 g', etiquetas: ['fuerza', 'sin calorías', 'vegano'] },
    { id: 'al_bcaa', nombre: 'BCAA en polvo', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 360, proteina: 90, carbos: 0, grasa: 0, fibra: 0, medidaCasera: '1 medida ≈ 10 g', etiquetas: ['intra-entreno', 'recuperación'] },
    { id: 'al_multivitaminico', nombre: 'Multivitamínico', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 5, proteina: 0, carbos: 1.2, grasa: 0, fibra: 0, medidaCasera: '1 tableta ≈ 1.5 g', etiquetas: ['micronutrientes', 'sin calorías'] },
    { id: 'al_omega3', nombre: 'Omega 3 (aceite de pescado)', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 900, proteina: 0, carbos: 0, grasa: 100, fibra: 0, medidaCasera: '1 cápsula ≈ 1 g', etiquetas: ['omega 3', 'grasa saludable'] },
    { id: 'al_preentreno', nombre: 'Pre-entreno en polvo', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 40, proteina: 0, carbos: 10, grasa: 0, fibra: 0, medidaCasera: '1 medida ≈ 10 g', etiquetas: ['pre-entreno', 'energético'] },
    { id: 'al_ganador_peso', nombre: 'Ganador de peso en polvo', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 380, proteina: 20, carbos: 65, grasa: 4, fibra: 2, medidaCasera: '1 medida ≈ 100 g', etiquetas: ['volumen', 'energético', 'post-entreno'] },
    { id: 'al_barra_proteina', nombre: 'Barra de proteína', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 380, proteina: 30, carbos: 40, grasa: 12, fibra: 6, medidaCasera: '1 barra ≈ 60 g', etiquetas: ['práctico', 'post-entreno', 'alto en proteína'] },
    { id: 'al_colageno', nombre: 'Colágeno hidrolizado', categoria: 'suplemento', porcion: 100, unidad: 'g', kcal: 360, proteina: 90, carbos: 0, grasa: 0, fibra: 0, medidaCasera: '1 medida ≈ 10 g', etiquetas: ['articulaciones', 'alto en proteína'] },

    /* ---------- SNACKS (11) ---------- */
    { id: 'al_palomitas', nombre: 'Palomitas naturales', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 375, proteina: 12, carbos: 74, grasa: 4.5, fibra: 14, medidaCasera: '3 tazas ≈ 24 g', etiquetas: ['alto en fibra', 'vegano', 'saciante'] },
    { id: 'al_papas_fritas', nombre: 'Papas fritas de bolsa', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 536, proteina: 6.6, carbos: 53, grasa: 35, fibra: 4.4, medidaCasera: '1 bolsa chica ≈ 45 g', etiquetas: ['ocasional', 'alto en sodio', 'alto en grasa'] },
    { id: 'al_cacahuate_japones', nombre: 'Cacahuate japonés', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 470, proteina: 17, carbos: 50, grasa: 22, fibra: 4, medidaCasera: '1 puño ≈ 30 g', etiquetas: ['mexicano', 'ocasional'] },
    { id: 'al_galleta_maria', nombre: 'Galleta María', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 430, proteina: 7, carbos: 77, grasa: 9, fibra: 2.5, medidaCasera: '4 galletas ≈ 28 g', etiquetas: ['económico', 'ocasional'] },
    { id: 'al_chocolate_amargo', nombre: 'Chocolate amargo 70%', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 570, proteina: 7.8, carbos: 46, grasa: 43, fibra: 11, medidaCasera: '2 cuadros ≈ 20 g', etiquetas: ['antioxidante', 'ocasional', 'alto en grasa'] },
    { id: 'al_barra_granola', nombre: 'Barra de granola', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 420, proteina: 6, carbos: 67, grasa: 13, fibra: 5, medidaCasera: '1 barra ≈ 30 g', etiquetas: ['práctico', 'ocasional', 'energético'] },
    { id: 'al_gelatina_light', nombre: 'Gelatina light preparada', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 10, proteina: 1.5, carbos: 1, grasa: 0, fibra: 0, medidaCasera: '1 taza ≈ 130 g', etiquetas: ['bajo en calorías', 'sin azúcar'] },
    { id: 'al_galleta_arroz', nombre: 'Galleta de arroz inflado', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 387, proteina: 8, carbos: 81, grasa: 3, fibra: 4, medidaCasera: '2 piezas ≈ 18 g', etiquetas: ['bajo en grasa', 'sin gluten', 'práctico'] },
    { id: 'al_chicharron_cerdo', nombre: 'Chicharrón de cerdo', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 545, proteina: 61, carbos: 0, grasa: 31, fibra: 0, medidaCasera: '1 puño ≈ 20 g', etiquetas: ['mexicano', 'alto en proteína', 'alto en sodio'] },
    { id: 'al_helado_vainilla', nombre: 'Helado de vainilla', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 207, proteina: 3.5, carbos: 24, grasa: 11, fibra: 0.7, medidaCasera: '1 bola ≈ 65 g', etiquetas: ['ocasional', 'alto en azúcar'] },
    { id: 'al_totopos', nombre: 'Totopos de maíz', categoria: 'snack', porcion: 100, unidad: 'g', kcal: 490, proteina: 6, carbos: 62, grasa: 24, fibra: 5, medidaCasera: '10 piezas ≈ 30 g', etiquetas: ['mexicano', 'ocasional', 'sin gluten'] },

    /* ---------- PREPARADOS (18) ---------- */
    { id: 'al_pollo_asado', nombre: 'Pollo asado a la plancha', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 170, proteina: 29, carbos: 1, grasa: 5, fibra: 0.2, medidaCasera: '1 porción ≈ 150 g', etiquetas: ['magro', 'alto en proteína', 'post-entreno'] },
    { id: 'al_chilaquiles_verdes', nombre: 'Chilaquiles verdes con pollo', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 190, proteina: 9, carbos: 18, grasa: 9, fibra: 2, medidaCasera: '1 plato ≈ 250 g', etiquetas: ['mexicano', 'desayuno'] },
    { id: 'al_huevos_mexicana', nombre: 'Huevos a la mexicana', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 135, proteina: 9.5, carbos: 3, grasa: 9, fibra: 0.8, medidaCasera: '1 porción ≈ 180 g', etiquetas: ['mexicano', 'desayuno', 'vegetariano'] },
    { id: 'al_ensalada_atun', nombre: 'Ensalada de atún', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 125, proteina: 13, carbos: 4, grasa: 6, fibra: 1.2, medidaCasera: '1 porción ≈ 200 g', etiquetas: ['magro', 'práctico', 'alto en proteína'] },
    { id: 'al_caldo_pollo', nombre: 'Caldo de pollo con verduras', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 55, proteina: 6, carbos: 4, grasa: 1.5, fibra: 1, medidaCasera: '1 plato ≈ 350 g', etiquetas: ['bajo en calorías', 'mexicano', 'saciante'] },
    { id: 'al_tacos_bistec', nombre: 'Tacos de bistec', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 200, proteina: 13, carbos: 22, grasa: 7, fibra: 2.5, medidaCasera: '2 tacos ≈ 160 g', etiquetas: ['mexicano', 'alto en proteína'] },
    { id: 'al_molletes', nombre: 'Molletes', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 258, proteina: 11, carbos: 30, grasa: 10, fibra: 3, medidaCasera: '1 mollete ≈ 120 g', etiquetas: ['mexicano', 'desayuno', 'vegetariano'] },
    { id: 'al_avena_platano', nombre: 'Avena con plátano y leche', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 118, proteina: 4.5, carbos: 20, grasa: 2, fibra: 2, medidaCasera: '1 tazón ≈ 300 g', etiquetas: ['desayuno', 'pre-entreno', 'alto en fibra'] },
    { id: 'al_hotcakes_avena', nombre: 'Hot cakes de avena y clara', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 162, proteina: 10, carbos: 22, grasa: 3.5, fibra: 2.5, medidaCasera: '2 piezas ≈ 150 g', etiquetas: ['desayuno', 'post-entreno', 'alto en proteína'] },
    { id: 'al_licuado_proteina', nombre: 'Licuado de proteína con plátano', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 95, proteina: 9, carbos: 11, grasa: 1.5, fibra: 0.8, medidaCasera: '1 vaso ≈ 350 g', etiquetas: ['post-entreno', 'práctico', 'alto en proteína'] },
    { id: 'al_sandwich_pavo', nombre: 'Sándwich de pavo integral', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 200, proteina: 14, carbos: 24, grasa: 5, fibra: 3, medidaCasera: '1 sándwich ≈ 150 g', etiquetas: ['práctico', 'magro', 'alto en fibra'] },
    { id: 'al_bowl_pollo_arroz', nombre: 'Bowl de pollo con arroz y verduras', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 152, proteina: 13, carbos: 17, grasa: 3.5, fibra: 2, medidaCasera: '1 bowl ≈ 400 g', etiquetas: ['post-entreno', 'balanceado', 'alto en proteína'] },
    { id: 'al_enchiladas_verdes', nombre: 'Enchiladas verdes de pollo', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 192, proteina: 10, carbos: 17, grasa: 9, fibra: 2, medidaCasera: '3 piezas ≈ 250 g', etiquetas: ['mexicano'] },
    { id: 'al_pozole_rojo', nombre: 'Pozole rojo de pollo', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 110, proteina: 8, carbos: 10, grasa: 4, fibra: 1.8, medidaCasera: '1 plato ≈ 400 g', etiquetas: ['mexicano', 'saciante'] },
    { id: 'al_nopales_huevo', nombre: 'Nopales con huevo', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 110, proteina: 6, carbos: 5, grasa: 7, fibra: 2, medidaCasera: '1 porción ≈ 200 g', etiquetas: ['mexicano', 'vegetariano', 'alto en fibra'] },
    { id: 'al_frijoles_refritos', nombre: 'Frijoles refritos', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 130, proteina: 5.5, carbos: 15, grasa: 5, fibra: 5, medidaCasera: 'media taza ≈ 120 g', etiquetas: ['mexicano', 'económico', 'alto en fibra'] },
    { id: 'al_arroz_rojo', nombre: 'Arroz rojo mexicano', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 140, proteina: 2.8, carbos: 25, grasa: 3, fibra: 1, medidaCasera: '1 taza ≈ 160 g', etiquetas: ['mexicano', 'económico'] },
    { id: 'al_ensalada_nopales', nombre: 'Ensalada de nopales', categoria: 'preparado', porcion: 100, unidad: 'g', kcal: 55, proteina: 1.5, carbos: 5, grasa: 3, fibra: 2.5, medidaCasera: '1 porción ≈ 150 g', etiquetas: ['mexicano', 'bajo en calorías', 'vegano'] }
  ];

  /* =============================================================
     UTILIDADES DEL CATÁLOGO
     ============================================================= */

  /* Mapa de acentos para búsquedas sin acentos ni mayúsculas. */
  var ACENTOS = {
    'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
    'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
    'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
    'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
    'ñ': 'n', 'ç': 'c'
  };

  /* Normaliza texto: minúsculas, sin acentos y sin espacios de sobra. */
  function normalizar(texto) {
    if (texto === null || texto === undefined) return '';
    var s = String(texto).toLowerCase();
    var salida = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      salida += (ACENTOS[c] || c);
    }
    return salida.replace(/\s+/g, ' ').replace(/^ | $/g, '');
  }

  /* Convierte a número seguro (0 si no es válido). */
  function numero(valor) {
    var n = Number(valor);
    return isFinite(n) ? n : 0;
  }

  /* Redondea a un decimal. */
  function red1(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return 0;
    return Math.round(n * 10) / 10;
  }

  /* Convierte a arreglo cualquier entrada (string, arreglo o vacío). */
  function comoLista(valor) {
    if (valor === null || valor === undefined || valor === '') return [];
    if (Object.prototype.toString.call(valor) === '[object Array]') {
      return valor.filter(function (v) { return v !== null && v !== undefined && v !== ''; });
    }
    return [valor];
  }

  /* Índice por id, construido una sola vez al cargar el archivo. */
  var indicePorId = {};
  (function construirIndice() {
    for (var i = 0; i < AG.Data.foods.length; i++) {
      var a = AG.Data.foods[i];
      if (a && a.id) indicePorId[a.id] = a;
    }
  })();

  /* ---------- Categorías ---------- */

  /* Devuelve la definición de una categoría o null. */
  AG.Data.categoriaAlimento = function (id) {
    var lista = AG.Data.CATEGORIAS_ALIMENTO;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  };

  /* Nombre legible de una categoría (o el id si no existe). */
  function nombreCategoria(id) {
    var c = AG.Data.categoriaAlimento(id);
    return c ? c.nombre : (id || '');
  }

  /* ---------- Consulta ---------- */

  /* Devuelve el alimento con ese id, o null si no existe. */
  AG.Data.alimento = function (id) {
    if (!id) return null;
    var clave = String(id);
    if (indicePorId[clave]) return indicePorId[clave];
    for (var i = 0; i < AG.Data.foods.length; i++) {
      if (AG.Data.foods[i] && AG.Data.foods[i].id === clave) {
        indicePorId[clave] = AG.Data.foods[i];
        return AG.Data.foods[i];
      }
    }
    return null;
  };

  /* Todas las etiquetas del catálogo, ordenadas alfabéticamente. */
  AG.Data.etiquetasAlimento = function () {
    var vistas = {}, salida = [];
    for (var i = 0; i < AG.Data.foods.length; i++) {
      var etqs = comoLista(AG.Data.foods[i].etiquetas);
      for (var j = 0; j < etqs.length; j++) {
        var e = String(etqs[j]);
        if (!vistas[e]) { vistas[e] = true; salida.push(e); }
      }
    }
    return salida.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  };

  /*
    Filtra el catálogo.
    filtro = { categoria, texto, etiqueta }
      categoria : id de categoría o arreglo de ids (cualquiera coincide)
      texto     : búsqueda sin acentos en nombre, categoría, etiquetas y medida casera
      etiqueta  : etiqueta o arreglo de etiquetas (cualquiera coincide)
    Devuelve un arreglo nuevo ordenado por nombre.
  */
  AG.Data.alimentosPor = function (filtro) {
    var f = filtro || {};
    var categorias = comoLista(f.categoria).map(function (c) { return String(c); });
    var etiquetas = comoLista(f.etiqueta).map(function (e) { return normalizar(e); });
    var texto = normalizar(f.texto);

    var resultado = AG.Data.foods.filter(function (a) {
      if (!a) return false;

      if (categorias.length && categorias.indexOf(a.categoria) === -1) return false;

      if (etiquetas.length) {
        var propias = comoLista(a.etiquetas).map(function (e) { return normalizar(e); });
        var coincide = false;
        for (var k = 0; k < etiquetas.length; k++) {
          if (propias.indexOf(etiquetas[k]) !== -1) { coincide = true; break; }
        }
        if (!coincide) return false;
      }

      if (texto) {
        var heno = normalizar(
          (a.nombre || '') + ' ' +
          nombreCategoria(a.categoria) + ' ' +
          comoLista(a.etiquetas).join(' ') + ' ' +
          (a.medidaCasera || '')
        );
        if (heno.indexOf(texto) === -1) return false;
      }

      return true;
    });

    return resultado.sort(function (a, b) {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
  };

  /* ---------- Cálculo de macros ---------- */

  /*
    Macros de una cantidad concreta de un alimento.
    Los gramos se interpretan sobre la porción base del alimento
    (100 g, o 100 ml en bebidas y leches líquidas).
    Devuelve siempre un objeto, aunque el alimento no exista.
  */
  AG.Data.macrosDe = function (alimentoId, gramos) {
    var vacio = { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
    var a = AG.Data.alimento(alimentoId);
    var g = Number(gramos);
    if (!a || !isFinite(g) || g <= 0) return vacio;

    var base = numero(a.porcion) > 0 ? numero(a.porcion) : 100;
    var factor = g / base;

    return {
      kcal: red1(numero(a.kcal) * factor),
      proteina: red1(numero(a.proteina) * factor),
      carbos: red1(numero(a.carbos) * factor),
      grasa: red1(numero(a.grasa) * factor),
      fibra: red1(numero(a.fibra) * factor)
    };
  };

  /*
    Suma los macros de una lista de porciones.
    items = [{ alimentoId, gramos }]
    Devuelve { kcal, proteina, carbos, grasa, fibra } con un decimal.
  */
  AG.Data.sumaMacros = function (items) {
    var total = { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
    var lista = comoLista(items);

    for (var i = 0; i < lista.length; i++) {
      var it = lista[i];
      if (!it) continue;
      var a = AG.Data.alimento(it.alimentoId);
      var g = Number(it.gramos);
      if (!a || !isFinite(g) || g <= 0) continue;

      var base = numero(a.porcion) > 0 ? numero(a.porcion) : 100;
      var factor = g / base;

      total.kcal += numero(a.kcal) * factor;
      total.proteina += numero(a.proteina) * factor;
      total.carbos += numero(a.carbos) * factor;
      total.grasa += numero(a.grasa) * factor;
      total.fibra += numero(a.fibra) * factor;
    }

    return {
      kcal: red1(total.kcal),
      proteina: red1(total.proteina),
      carbos: red1(total.carbos),
      grasa: red1(total.grasa),
      fibra: red1(total.fibra)
    };
  };

  /*
    Top 15 alimentos con mayor densidad del macro pedido.
    objetivo: 'proteina' | 'carbos' | 'grasa'
    Ordena por gramos del macro por cada 100 g y, en empate,
    por el porcentaje de calorías que aporta ese macro.
  */
  AG.Data.buscarPorMacro = function (objetivo) {
    var alias = {
      proteina: 'proteina', proteinas: 'proteina',
      carbos: 'carbos', carbohidrato: 'carbos', carbohidratos: 'carbos',
      grasa: 'grasa', grasas: 'grasa'
    };
    var campo = alias[normalizar(objetivo)];
    if (!campo) return [];

    var kcalPorGramo = { proteina: 4, carbos: 4, grasa: 9 };

    var candidatos = AG.Data.foods.filter(function (a) {
      return a && numero(a[campo]) > 0;
    });

    candidatos.sort(function (a, b) {
      var da = numero(a[campo]), db = numero(b[campo]);
      if (db !== da) return db - da;

      var ka = numero(a.kcal) > 0 ? (da * kcalPorGramo[campo]) / numero(a.kcal) : 0;
      var kb = numero(b.kcal) > 0 ? (db * kcalPorGramo[campo]) / numero(b.kcal) : 0;
      if (kb !== ka) return kb - ka;

      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });

    return candidatos.slice(0, 15);
  };

  /* Se expone la normalización para que otros módulos busquen igual. */
  AG.Data.normalizarTexto = normalizar;

})(window.AG);
