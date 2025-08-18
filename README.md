# 🎯 CASTROMOTOR - Sistema de Sorteos y Rifas

## 📋 **Descripción del Proyecto**

Sistema web completo para la gestión de sorteos, rifas y loterías de Castromotor. Permite a los usuarios comprar números para sorteos y a los administradores gestionar todo el proceso desde la creación hasta el sorteo final.

## 🏗️ **Arquitectura del Sistema**

### **Frontend (Next.js 15.4.6)**
- **Framework:** Next.js con React 18
- **Estilos:** Tailwind CSS
- **Estado:** React Hooks (useState, useEffect, useMemo)
- **Animaciones:** CSS personalizado con keyframes
- **Responsive:** Diseño adaptativo para móviles y desktop

### **Backend (Node.js + Express)**
- **Runtime:** Node.js 18.20.8
- **Framework:** Express.js
- **Base de Datos:** PostgreSQL con Prisma ORM
- **Validación:** Zod para schemas
- **Autenticación:** JWT para admin
- **Email:** Nodemailer con SMTP
- **PDFs:** PDFKit para facturas

### **Base de Datos (PostgreSQL)**
- **ORM:** Prisma
- **Modelos principales:** sorteos, ordenes, clientes, numeros_sorteo, premios, paquetes, metodos_pago
- **Relaciones:** Complejas con foreign keys y constraints

## 🎲 **Lógica de Negocio**

### **1. Flujo de Usuario (Cliente)**
```
1. Usuario visita la página principal
2. Selecciona un sorteo disponible
3. Elige cantidad de números o paquete promocional
4. Completa formulario de datos personales
5. Verifica email con código de 3 dígitos
6. Sube comprobante de pago
7. Selecciona método de pago
8. Completa el pago
9. Recibe confirmación y números asignados
```

### **2. Flujo de Administrador**
```
1. Login con credenciales admin
2. Dashboard con estadísticas generales
3. Gestión de sorteos (crear, editar, publicar)
4. Gestión de premios y números ganadores
5. Aprobación/rechazo de órdenes pendientes
6. Gestión de métodos de pago
7. Reportes y métricas
```

### **3. Sistema de Números**
```
- Cada sorteo tiene una cantidad específica de dígitos (1-10)
- Los números se generan automáticamente al crear el sorteo
- Estados: disponible → reservado → vendido
- Sistema de reservas temporales durante el proceso de pago
- Liberación automática de reservas vencidas
```

### **4. Sistema de Paquetes**
```
- Paquetes promocionales con descuentos
- Combinaciones predefinidas de números
- Filtrado automático de paquetes de sorteos en borrador
- Cálculo automático de precios con descuentos
```

## 🔧 **Estado Actual de Implementación**

### **✅ Funcionalidades Completadas**
- (?) Sistema de usuarios y autenticación admin(OBTENEMOS UN FAILED TO FETCH A VECES, DESCONOZCO LA RAZON)
- ✅ CRUD completo de sorteos
- ✅ Gestión de premios y números ganadores
- ✅ Sistema de órdenes y aprobaciones
- ✅ Verificación de email con códigos
- ✅ Subida de comprobantes de pago
- ✅ Generación automática de facturas PDF
- ✅ Envío de emails de confirmación
- ✅ Dashboard administrativo con estadísticas
- ✅ Sistema de paquetes promocionales
- ✅ Métodos de pago básicos (transferencias)
- ✅ Frontend responsive con animaciones
- ✅ Carousel automático de imágenes
- ✅ Filtrado de paquetes por estado de sorteo

### **❌ Funcionalidades Pendientes**
- ❌ **Integración completa con Payphone** (PROBLEMA PRINCIPAL)
- ❌ Sistema de notificaciones push
- ❌ Reportes avanzados y exportación
- ❌ Sistema de cupones y descuentos
- ❌ Integración con redes sociales
- ❌ App móvil nativa

## 🚨 **PROBLEMA CRÍTICO: INTEGRACIÓN PAYPHONE**

### **Descripción del Error**
El sistema de pagos con Payphone **NO FUNCIONA** correctamente. Los usuarios experimentan:

1. **"Pago no aprobado"** - Error constante en producción
2. **Cajita de pagos no se muestra** - La interfaz de Payphone no aparece
3. **Redirección a otra pestaña** - Comportamiento inesperado
4. **Confirmación fallida** - El backend no puede confirmar los pagos

### **Estado Actual de Payphone**
- ✅ **SDK integrado** en el frontend
- ✅ **Endpoints backend** implementados
- ✅ **Base de datos** preparada para transacciones
- ❌ **Flujo de pago** no funciona
- ❌ **Callbacks** no se ejecutan correctamente
- ❌ **Confirmación** falla en el backend

### **Archivos Relacionados con Payphone**
```
Frontend:
- src/app/sorteos/[id]/page.tsx (lógica de pago)
- src/app/layout.tsx (SDK de Payphone)

Backend:
- src/routes/public.ts (endpoints de Payphone)
- src/routes/admin.ts (gestión de métodos de pago)
```

### **Variables de Entorno Requeridas**
```bash
PAYPHONE_STORE_ID=0704522101001
PAYPHONE_TOKEN=token_largo_de_payphone
PAYPHONE_MOCK=0  # 1 para desarrollo local
```

## 🔍 **Análisis del Problema**

### **Posibles Causas**
1. **Configuración incorrecta del SDK** - Parámetros faltantes o incorrectos
2. **Problema de callbacks** - Los eventos onSuccess/onError no se ejecutan
3. **Credenciales inválidas** - Token o Store ID incorrectos
4. **Problema de dominio** - Payphone no reconoce el dominio de producción
5. **Error en el flujo de confirmación** - Race condition entre frontend y backend

### **Síntomas Observados**
- Frontend: "Pago no aprobado" inmediatamente
- Backend: No logs de confirmación
- Usuario: No ve la interfaz de Payphone
- Sistema: Números quedan en estado "reservado"

## 🛠️ **Tareas Pendientes para Payphone**

### **Prioridad ALTA**
1. **Debuggear el flujo completo** - Identificar dónde falla exactamente
2. **Verificar credenciales** - Confirmar que Store ID y Token sean válidos
3. **Revisar configuración del SDK** - Asegurar que todos los parámetros estén correctos
4. **Implementar logging detallado** - Para identificar el punto de falla
5. **Probar en ambiente de desarrollo** - Con credenciales de sandbox
6. **Verificar por que a veces obtenemos failed to fetch en el login**

### **Prioridad MEDIA**
1. **Implementar retry logic** - Para confirmaciones fallidas
2. **Mejorar manejo de errores** - Mensajes más claros para el usuario
3. **Validar transacciones** - Verificar que no haya duplicados
4. **Implementar webhooks** - Como respaldo a los callbacks

### **Prioridad BAJA**
1. **Optimizar UX** - Mejorar la experiencia del usuario
2. **Implementar analytics** - Tracking de conversiones
3. **Sistema de notificaciones** - Para pagos exitosos/fallidos

## 📱 **Funcionalidades del Frontend**

### **Página Principal**
- ✅ Carousel automático de sorteos
- ✅ Lista de sorteos disponibles
- ✅ Paquetes destacados (top 3 por descuento)
- ✅ Footer con información de contacto
- ✅ Barra de progreso visual para cada sorteo
- ✅ Animaciones y transiciones suaves

### **Páginas de Sorteo**
- ✅ Información detallada del sorteo
- ✅ Selección de números o paquetes
- ✅ Formulario de datos personales
- ✅ Verificación de email
- ✅ Subida de comprobantes
- ✅ Selección de método de pago
- ✅ Integración con Payphone (con problemas)

### **Panel Administrativo**
- ✅ Dashboard con estadísticas
- ✅ Gestión de sorteos
- ✅ Gestión de premios
- ✅ Aprobación de órdenes
- ✅ Gestión de métodos de pago
- ✅ Gestión de paquetes
- ✅ Galería de imágenes por sorteo

## 🗄️ **Estructura de la Base de Datos**

### **Tablas Principales**
```sql
-- Sorteos y premios
sorteos (id, nombre, descripcion, estado, precio_por_numero, cantidad_digitos, cantidad_premios)
premios (id, sorteo_id, numero_texto, descripcion, vendido, cliente_id)
numeros_sorteo (id, sorteo_id, numero_texto, estado, orden_id)

-- Usuarios y clientes
usuarios (id, correo_electronico, contrasena_hash, rol)
clientes (id, nombres, apellidos, cedula, correo_electronico, telefono, direccion)

-- Órdenes y pagos
ordenes (id, codigo, cliente_id, sorteo_id, metodo_pago_id, estado_pago, monto_total, cantidad_numeros)
ordenes_items (id, orden_id, numero_sorteo_id, precio)
metodos_pago (id, nombre, descripcion, estado)
pagos_payphone (id, orden_id, client_txn_id, status, payphone_txn_id)

-- Paquetes y verificaciones
paquetes (id, sorteo_id, cantidad_numeros, precio_total, estado)
verificaciones_correo (id, correo_electronico, codigo, expiracion, usado)
```

## 🚀 **Instalación y Despliegue**

### **Requisitos del Sistema**
- **Node.js:** 18.x o superior
- **PostgreSQL:** 12.x o superior
- **PM2:** Para gestión de procesos
- **Nginx:** Como reverse proxy
- **SSL:** Certificado válido para producción

### **Variables de Entorno**
```bash
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/sorteos"

# JWT
JWT_SECRET="secret_muy_seguro"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu_email@gmail.com"
SMTP_PASS="tu_app_password"

# Payphone
PAYPHONE_STORE_ID="0704522101001"
PAYPHONE_TOKEN="token_de_payphone"
PAYPHONE_MOCK="0"

# Servidor
PORT="3001"
NODE_ENV="production"
```

### **Comandos de Despliegue**
```bash
# Backend
cd backend
npm install
npm run build
pm2 start npm --name "castromotor-backend" -- start

# Frontend
cd frontend
npm install
npm run build
pm2 start npm --name "castromotor-frontend" -- start

# Verificar estado
pm2 status
pm2 logs
```

## 📊 **Métricas y Estadísticas**

### **Dashboard Principal**
- Total de sorteos activos
- Total de órdenes pendientes
- Total de ingresos del día/mes
- Top 3 paquetes más vendidos
- Métodos de pago más utilizados
- Gráfico de ventas por período

### **Reportes Disponibles**
- Ventas por sorteo
- Rendimiento por paquete
- Clientes más activos
- Métodos de pago preferidos
- Tiempo promedio de aprobación

## 🔒 **Seguridad y Validaciones**

### **Validaciones Frontend**
- ✅ Validación de formularios en tiempo real
- ✅ Verificación de email obligatoria
- ✅ Validación de archivos subidos
- ✅ Prevención de envíos múltiples

### **Validaciones Backend**
- ✅ Validación de schemas con Zod
- ✅ Autenticación JWT para admin
- ✅ Validación de permisos por rol
- ✅ Sanitización de inputs
- ✅ Rate limiting básico

### **Protecciones de Seguridad**
- ✅ CORS configurado
- ✅ Headers de seguridad
- ✅ Validación de tipos de archivo
- ✅ Límites de tamaño de archivo
- ✅ Timeout en verificaciones de email

## 🧪 **Testing y Calidad**

### **Estado Actual**
- ❌ Tests unitarios
- ❌ Tests de integración
- ❌ Tests end-to-end
- ✅ Validación manual de funcionalidades
- ✅ Testing en producción

### **Recomendaciones**
1. **Implementar tests unitarios** para lógica de negocio
2. **Tests de integración** para endpoints de API
3. **Tests E2E** para flujos críticos
4. **Testing automatizado** en CI/CD
5. **Monitoreo de errores** en producción


## 🎯 **RESUMEN PARA EL NUEVO PROGRAMADOR**

**El proyecto está 90% completo y funcional, EXCEPTO por la integración de Payphone que es crítica para el negocio.**

**Tu tarea principal:** Hacer que Payphone funcione correctamente para que los usuarios puedan pagar y comprar números de sorteos.

**El problema:** Los usuarios ven "pago no aprobado" sin siquiera ver la interfaz de Payphone.

**Todo lo demás funciona perfectamente:** sorteos, paquetes, órdenes, admin, frontend, etc.

**Enfócate en:** Debuggear el flujo de Payphone desde el frontend hasta la confirmación en el backend.
