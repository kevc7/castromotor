# 🔍 Debugging de Payphone - Sistema de Sorteos

## 📋 **Problema Identificado**
El sistema de pagos con Payphone está fallando en producción con el error "pago no aprobado".

## 🔧 **Correcciones Implementadas**

### **1. Frontend (SDK de Payphone)**
- ✅ **Parámetros obligatorios añadidos:**
  - `currency: 'USD'`
  - `countryCode: 'EC'`
  - `storeId` (en lugar de `token` vacío)
- ✅ **Lógica de confirmación mejorada:**
  - Espera 5 segundos para procesamiento interno
  - Sistema de retry (3 intentos)
  - Logging detallado en consola
- ✅ **Manejo de estados:**
  - Mensajes informativos durante el proceso
  - Botón de debug para testing

### **2. Backend (Confirmación de Pagos)**
- ✅ **Logging detallado:**
  - Request/response completo
  - Headers de respuesta
  - Validación de credenciales
- ✅ **Manejo robusto de errores:**
  - Parsing seguro de respuestas JSON
  - Validación múltiple del estado de éxito
  - Timestamps para debugging
- ✅ **Endpoint de debug:**
  - `/api/payments/payphone/debug`
  - Prueba conexión básica con Payphone

## 🧪 **Cómo Debuggear**

### **Opción 1: Botón de Debug en Frontend**
1. Ve a cualquier página de sorteo
2. Selecciona "Payphone" como método de pago
3. Haz clic en "🔍 Debug Payphone"
4. Revisa la consola del navegador
5. Revisa los logs del backend

### **Opción 2: Endpoint Directo**
```bash
curl -X POST http://localhost:3001/api/payments/payphone/debug \
  -H "Content-Type: application/json"
```

### **Opción 3: Logs del Backend**
```bash
# En el servidor
pm2 logs backend

# O directamente
tail -f /var/log/nginx/error.log
```

## 🔑 **Variables de Entorno Requeridas**

```bash
# .env o .env.production
PAYPHONE_STORE_ID=0704522101001
PAYPHONE_TOKEN=tu_token_aqui
PAYPHONE_MOCK=0  # 1 para desarrollo local
```

## 📊 **Flujo de Pago Corregido**

1. **Usuario selecciona Payphone** → Botón aparece
2. **Usuario hace clic en "Pagar con Payphone"** → SDK se abre
3. **Usuario completa el pago** → Callback `onSuccess` se ejecuta
4. **Frontend espera 5 segundos** → Para procesamiento interno
5. **Frontend llama al backend** → `/api/payments/payphone/confirm`
6. **Backend valida con Payphone** → API `Sale/Confirm`
7. **Backend procesa la orden** → Números vendidos, factura, email
8. **Usuario recibe confirmación** → Redirección a página principal

## 🚨 **Posibles Causas del Error**

### **1. Credenciales Incorrectas**
- `PAYPHONE_STORE_ID` mal configurado
- `PAYPHONE_TOKEN` expirado o inválido
- Token usado en múltiples proyectos

### **2. Configuración de la Aplicación Payphone**
- Dominio no autorizado
- IP del servidor bloqueada
- Aplicación en estado "borrador"

### **3. Problemas de Red**
- Firewall bloqueando conexiones
- Timeout en la API de Payphone
- DNS no resolviendo correctamente

## 🔍 **Pasos de Debugging**

### **Paso 1: Verificar Credenciales**
```bash
# En el servidor
echo "Store ID: $PAYPHONE_STORE_ID"
echo "Token length: ${#PAYPHONE_TOKEN}"
echo "Token preview: ${PAYPHONE_TOKEN:0:20}..."
```

### **Paso 2: Probar Conexión Básica**
```bash
curl -X POST https://pay.payphonetodoesposible.com/api/Sale/Confirm \
  -H "Authorization: Bearer $PAYPHONE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"$PAYPHONE_STORE_ID","clientTransactionId":"TEST_123"}'
```

### **Paso 3: Revisar Logs del Backend**
```bash
# Buscar logs específicos de Payphone
grep -i payphone /var/log/nginx/error.log
grep -i payphone ~/.pm2/logs/backend-error.log
```

### **Paso 4: Verificar Estado de la Aplicación Payphone**
1. Acceder al panel de Payphone
2. Verificar que la aplicación esté "Activa"
3. Confirmar que el dominio esté autorizado
4. Verificar que no haya restricciones de IP

## 🎯 **Solución Esperada**

Con las correcciones implementadas:
- ✅ El SDK debería abrirse correctamente
- ✅ Los callbacks deberían funcionar
- ✅ La confirmación debería ser exitosa
- ✅ Los logs deberían mostrar el proceso completo

## 📞 **Soporte Adicional**

Si el problema persiste:
1. Revisar logs del backend con el nuevo logging
2. Usar el botón de debug para identificar el punto de falla
3. Verificar credenciales en el panel de Payphone
4. Contactar soporte de Payphone con los logs detallados

## 🔄 **Próximos Pasos**

1. **Desplegar las correcciones** en producción
2. **Probar el botón de debug** para verificar conexión
3. **Intentar un pago real** con logging completo
4. **Analizar logs** para identificar cualquier problema restante
