Historial de Movimientos de Productos y Estados de Cuenta
Plan de implementación para vistas detalladas de productos y contactos.

Proposed Changes
Product Movement History
[NEW] 
src/app/dashboard/inventory/[id]/page.tsx
Página de detalle de producto que muestra:

Información del producto (nombre, SKU, precio, stock actual)
Historial de movimientos con:
Fecha
Tipo (Entrada/Salida)
Cantidad
Comprobante origen (Factura de Venta/Compra)
Stock resultante
Gráfico de evolución de stock (opcional)
Datos necesarios:

// Query InvoiceItems filtrados por productId
// Incluir invoice con flow, letter, number, date
// Calcular stock acumulado
[MODIFY] 
src/app/dashboard/inventory/product-manager.tsx
Agregar enlace en cada fila de producto para navegar al detalle:

Hacer el nombre del producto clickeable
Navegar a /dashboard/inventory/[productId]
Contact Account Statements
[NEW] 
src/app/dashboard/contacts/[id]/page.tsx
Página de estado de cuenta del contacto que muestra:

Información del contacto:

Nombre, CUIT, dirección
Tipo (Cliente/Proveedor)
Saldo actual
Movimientos:

Facturas emitidas/recibidas con:
Fecha
Tipo y número
Monto total
Estado (Pendiente/Pagada)
Pagos/Cobranzas con:
Fecha
Método
Monto
Factura relacionada (si aplica)
Cálculo de saldo:

// Para CLIENTES:
// Saldo = Σ(Facturas de Venta) - Σ(Cobranzas)
// Para PROVEEDORES:
// Saldo = Σ(Facturas de Compra) - Σ(Pagos)
[MODIFY] 
src/app/dashboard/contacts/contact-manager.tsx
Agregar enlace en cada fila de contacto:

Hacer el nombre clickeable
Navegar a /dashboard/contacts/[contactId]
Mostrar saldo actual en la lista (opcional)
Server Actions
[NEW] 
src/actions/product-movements.ts
export async function getProductMovements(productId: string) {
  // Query InvoiceItems where productId
  // Include invoice with flow, letter, number, date
  // Order by invoice.date DESC
  // Calculate running stock balance
}
[NEW] 
src/actions/contact-statement.ts
export async function getContactStatement(contactId: string) {
  // Get contact info
  // Get all invoices for this contact
  // Get all payments for this contact
  // Calculate balance
  // Return combined timeline
}
UI Components
Product Detail View
Header con info del producto
Tabla de movimientos con columnas:
Fecha
Tipo (Entrada 🟢 / Salida 🔴)
Cantidad
Comprobante (link a factura)
Stock resultante
Badge con stock actual destacado
Contact Statement View
Header con info del contacto y saldo
Timeline combinado de facturas y pagos:
Facturas con badge de estado (Pendiente/Pagada)
Pagos con método y referencia
Ordenado por fecha descendente
Resumen de saldo al final
Verification Plan
Manual Verification
Producto:

Crear facturas de venta y compra con el mismo producto
Verificar que los movimientos se muestren correctamente
Verificar que el stock acumulado sea correcto
Contacto:

Crear facturas para un cliente
Registrar cobranzas
Verificar que el saldo se calcule correctamente
Verificar que las facturas muestren estado correcto (pagada/pendiente)
