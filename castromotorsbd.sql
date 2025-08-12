-- =====================================================
-- Script SQL: Esquema base para sistema de sorteos/rifas
-- Ejecutar en PostgreSQL
-- =====================================================

-- 1) TABLA: usuarios del sistema
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    correo_electronico TEXT UNIQUE NOT NULL, -- Email único
    nombre_usuario TEXT, -- Alias o nombre de usuario
    contrasena_hash TEXT NOT NULL, -- Contraseña en hash seguro
    rol TEXT NOT NULL, -- 'admin' o 'cliente'
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE usuarios IS 'Usuarios del sistema (administradores y clientes)';

-- 2) TABLA: clientes
CREATE TABLE clientes (
    id BIGSERIAL PRIMARY KEY,
    nombres TEXT NOT NULL,
    apellidos TEXT,
    cedula TEXT,
    correo_electronico TEXT,
    telefono TEXT,
    direccion TEXT
);
COMMENT ON TABLE clientes IS 'Información de clientes que participan en sorteos';

-- 3) TABLA: sorteos
CREATE TABLE sorteos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    cantidad_digitos INT NOT NULL, -- Ej: 3 -> números 000..999
    precio_por_numero NUMERIC(10,2) NOT NULL,
    cantidad_premios INT DEFAULT 1,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado TEXT DEFAULT 'borrador', -- 'borrador', 'publicado', 'cerrado'
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE sorteos IS 'Sorteos o rifas disponibles en el sistema';

-- 4) TABLA: ordenes (antes de numeros_sorteo porque numeros_sorteo referencia ordenes)
CREATE TABLE ordenes (
    id BIGSERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL, -- Código único de la orden (ej: OR-YYYYMMDD-xxxxx o UUID)
    cliente_id BIGINT NULL REFERENCES clientes(id),
    metodo_pago TEXT, -- transferencia, paypal, tarjeta
    estado_pago TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'rechazado'
    ruta_comprobante TEXT, -- Ruta archivo comprobante en uploads/
    monto_total NUMERIC(12,2),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE ordenes IS 'Órdenes realizadas por clientes';
COMMENT ON COLUMN ordenes.ruta_comprobante IS 'Ruta del comprobante de pago dentro de uploads/ (no pública)';

-- 5) TABLA: numeros_sorteo
CREATE TABLE numeros_sorteo (
    id BIGSERIAL PRIMARY KEY,
    sorteo_id BIGINT REFERENCES sorteos(id) ON DELETE CASCADE,
    numero_texto TEXT NOT NULL, -- Ej: '001', '257'
    estado TEXT DEFAULT 'disponible', -- 'disponible' o 'vendido'
    orden_id BIGINT NULL REFERENCES ordenes(id) ON DELETE SET NULL, -- Se llena al aprobar la orden
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (sorteo_id, numero_texto)
);
COMMENT ON TABLE numeros_sorteo IS 'Números generados automáticamente para cada sorteo';
COMMENT ON COLUMN numeros_sorteo.estado IS 'Estado: disponible o vendido';
COMMENT ON COLUMN numeros_sorteo.orden_id IS 'Orden asociada al número (NULL si no está vendido)';

-- 6) TABLA: premios
CREATE TABLE premios (
    id BIGSERIAL PRIMARY KEY,
    sorteo_id BIGINT REFERENCES sorteos(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL, -- Ej: "Televisor 50 pulgadas"
    numero_sorteo_id BIGINT NULL REFERENCES numeros_sorteo(id) ON DELETE SET NULL, -- Número ganador asignado
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE premios IS 'Premios definidos para cada sorteo';
COMMENT ON COLUMN premios.numero_sorteo_id IS 'Número ganador asignado a este premio (NULL hasta asignación)';

-- Evitar duplicados de número entre premios del mismo sorteo
CREATE UNIQUE INDEX IF NOT EXISTS idx_premios_numero_unico_por_sorteo
ON premios (sorteo_id, numero_sorteo_id)
WHERE numero_sorteo_id IS NOT NULL;

-- 7) TABLA: paquetes
CREATE TABLE paquetes (
    id BIGSERIAL PRIMARY KEY,
    sorteo_id BIGINT REFERENCES sorteos(id) ON DELETE CASCADE,
    nombre TEXT,
    descripcion TEXT,
    cantidad_numeros INT,
    porcentaje_descuento NUMERIC(5,2),
    precio_total NUMERIC(12,2)
);
COMMENT ON TABLE paquetes IS 'Paquetes de números a precio especial';

-- 8) TABLA: ordenes_items (se llena solo cuando la orden es aprobada)
CREATE TABLE ordenes_items (
    id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT REFERENCES ordenes(id) ON DELETE CASCADE,
    numero_sorteo_id BIGINT REFERENCES numeros_sorteo(id),
    precio NUMERIC(10,2)
);
COMMENT ON TABLE ordenes_items IS 'Detalle de números vendidos en cada orden (se inserta solo cuando la orden es aprobada)';

-- 9) TABLA: facturas
CREATE TABLE facturas (
    id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT REFERENCES ordenes(id),
    usuario_admin_id BIGINT REFERENCES usuarios(id),
    ruta_factura TEXT, -- Ruta PDF factura en uploads/
    datos_factura JSONB,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE facturas IS 'Facturas emitidas para órdenes aprobadas';

-- Índices recomendados
CREATE INDEX idx_numeros_estado ON numeros_sorteo(sorteo_id, estado);
CREATE INDEX idx_ordenes_estado ON ordenes(estado_pago);