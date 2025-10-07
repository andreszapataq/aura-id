# 🖥️ Guía del Sistema de Roles y Modo Kiosco - Aura ID

## 📋 Resumen de la Implementación

Se ha implementado exitosamente un sistema completo de roles de usuario con modo kiosco para el sistema Aura ID. Esta implementación permite diferenciar entre usuarios **administradores** que gestionan el sistema y **terminales kiosco** dedicadas exclusivamente al control de acceso.

---

## ✨ Características Implementadas

### 1. **Sistema de Roles**
- ✅ Tres roles de usuario: `admin`, `user`, `kiosk`
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Políticas RLS optimizadas en Supabase
- ✅ Aislamiento multi-tenant por organización

### 2. **Modo Kiosco**
- ✅ Interfaz dedicada para terminales de acceso
- ✅ Navegación bloqueada (solo /access)
- ✅ Sin opción de cerrar sesión
- ✅ Sin header ni menús de navegación
- ✅ Pantalla completa optimizada para tablets

### 3. **Administración**
- ✅ Panel de gestión de terminales kiosco
- ✅ Creación automática de usuarios kiosco
- ✅ Reseteo seguro de contraseñas
- ✅ Estado en tiempo real de las terminales

---

## 🗄️ Cambios en Base de Datos

### Migraciones Aplicadas:

#### 1. **Tabla `users` - Nuevos campos:**
```sql
- is_kiosk: BOOLEAN (indica si es terminal kiosco)
- lock_session: BOOLEAN (bloquea el cierre de sesión)
- role: TEXT (valores: 'admin', 'user', 'kiosk')
```

#### 2. **Funciones SQL creadas:**
```sql
- get_user_role() - Obtiene el rol del usuario actual
- is_kiosk_user() - Verifica si es usuario kiosco
- is_admin_user() - Verifica si es administrador
- get_user_org_id() - Obtiene ID de organización
```

#### 3. **Políticas RLS optimizadas:**
- Todas las políticas ahora usan `(SELECT auth.uid())` en lugar de `auth.uid()`
- Mejora significativa en rendimiento de consultas
- Restricciones por organización implementadas

---

## 🚀 Cómo Usar el Sistema

### Para Administradores:

#### **Paso 1: Crear Terminal Kiosco**
1. Inicie sesión como administrador
2. Vaya a **Kioscos** en el menú de navegación
3. Haga clic en "Crear Terminal Kiosco"
4. **IMPORTANTE:** Guarde las credenciales generadas inmediatamente

#### **Paso 2: Configurar Terminal**
1. En la terminal/tablet dedicada, abra el navegador
2. Vaya a la URL de su aplicación Aura ID
3. Inicie sesión con las credenciales del kiosco
4. La terminal quedará bloqueada en modo kiosco

#### **Paso 3: Gestión Continua**
- Puede resetear la contraseña desde el panel de administración
- Solo puede haber una terminal kiosco por organización
- Para crear una nueva, contacte soporte (requiere eliminar la anterior)

---

## 🔐 Seguridad

### Credenciales del Kiosco:
- **Email:** `kiosk-{organization_id}@aura-id.local`
- **Contraseña:** Generada aleatoriamente (16 caracteres)
- Las contraseñas no se almacenan en texto plano
- Solo se muestran una vez al crear/resetear

### Restricciones de Kiosco:
- ❌ No puede cerrar sesión
- ❌ No puede navegar a otras páginas
- ❌ No puede acceder al panel de administración
- ❌ No puede ver reportes
- ✅ Solo puede registrar entradas/salidas

---

## 📱 Modo Kiosco - Experiencia de Usuario

### Interfaz Optimizada:
```
┌─────────────────────────────────────────────┐
│ 🖥️ Terminal Kiosco    |    10:30 AM        │
│ Sistema de Control de Acceso                │
├─────────────────────────────────────────────┤
│                                             │
│         ┌───────────────────┐              │
│         │                   │              │
│         │  Verificación     │              │
│         │     Facial        │              │
│         │                   │              │
│         └───────────────────┘              │
│                                             │
│    [ Registrar Entrada ]  [ Registrar      │
│                              Salida ]       │
│                                             │
└─────────────────────────────────────────────┘
```

### Características:
- Header personalizado con hora en tiempo real
- Sin menú de navegación
- Botones grandes para facilitar el uso
- Reinicio automático después de cada registro
- Mensajes de bienvenida personalizados

---

## 🛠️ Archivos Modificados/Creados

### Backend (APIs):
```
app/api/kiosk/
├── create/route.ts          # Crear terminal kiosco
├── reset-password/route.ts  # Resetear contraseña
└── status/route.ts          # Estado del kiosco
```

### Frontend (Componentes):
```
contexts/AuthContext.tsx     # Sistema de roles y perfiles
components/Header.tsx        # Filtrado por roles
middleware.ts               # Protección de rutas
app/(with-header)/
├── page.tsx                 # Redirección kiosco
├── access/page.tsx          # Modo kiosco adaptativo
└── admin/kiosks/page.tsx    # Panel de administración
```

### Base de Datos:
```
migrations/
├── add_kiosk_roles_and_fields.sql
└── optimize_rls_policies_and_add_role_functions.sql
```

---

## 🔧 Configuración Recomendada para Tablets

### Hardware Recomendado:
- Tablet Android/iPad (mínimo 10 pulgadas)
- Soporte de pared o mesa
- Cámara frontal de buena calidad

### Configuración del Navegador:
1. **Chrome/Safari:**
   - Habilitar "Solicitar sitio de escritorio"
   - Agregar a pantalla de inicio (PWA)
   - Deshabilitar modo de ahorro de energía

2. **Modo Kiosko del SO:**
   - Android: Usar "Modo Kiosko" o app como Kiosk Browser
   - iOS: Usar "Acceso Guiado"

### Tips de Seguridad:
- Bloquear el navegador en modo pantalla completa
- Deshabilitar acceso a configuración del dispositivo
- Configurar reinicio automático diario
- Red WiFi dedicada para las terminales

---

## 📊 Permisos por Rol

| Función                  | Admin | User | Kiosk |
|--------------------------|-------|------|-------|
| Ver Dashboard            | ✅    | ✅   | ❌    |
| Registrar Empleados      | ✅    | ❌   | ❌    |
| Control de Acceso        | ✅    | ✅   | ✅    |
| Ver Reportes             | ✅    | ❌   | ❌    |
| Gestionar Kioscos        | ✅    | ❌   | ❌    |
| Cerrar Sesión            | ✅    | ✅   | ❌    |
| Navegar Libremente       | ✅    | ✅   | ❌    |

---

## 🐛 Solución de Problemas

### Problema: Terminal kiosco puede navegar a otras páginas
**Solución:** El middleware está bloqueando correctamente. Verifique que el perfil del usuario tenga `is_kiosk = true` en la base de datos.

### Problema: No puedo crear terminal kiosco
**Solución:** Verifique que:
1. Sea usuario administrador
2. No exista ya una terminal para su organización
3. Tenga `organization_id` asignado en su perfil

### Problema: Credenciales no funcionan
**Solución:** 
1. Verifique que esté usando el email y contraseña correctos
2. Use la función "Resetear Contraseña" en el panel de administración
3. Asegúrese de que el usuario no haya sido eliminado

### Problema: La terminal muestra el header
**Solución:** El componente Header verifica `isKiosk`. Asegúrese de que:
1. El usuario tenga `is_kiosk = true` en la BD
2. El AuthContext esté cargando correctamente el perfil
3. No hay errores en la consola del navegador

---

## 🎯 Próximos Pasos Recomendados

### Mejoras Opcionales:
1. **Modo Offline:**
   - Implementar sincronización cuando vuelva la conexión
   - Almacenar registros localmente temporalmente

2. **Estadísticas de Kiosco:**
   - Dashboard de uso por terminal
   - Reportes de actividad
   - Alertas de inactividad

3. **Configuración Avanzada:**
   - Permitir múltiples kioscos por organización
   - Asignar kioscos a ubicaciones específicas
   - Horarios de operación por terminal

4. **Mantenimiento Remoto:**
   - Reinicio remoto de terminales
   - Actualización de configuración sin tocar el dispositivo
   - Monitoreo de estado en tiempo real

---

## 📞 Soporte

Si tiene problemas o preguntas:
1. Revise esta documentación
2. Verifique los logs del navegador (F12 → Console)
3. Verifique los logs de la API en desarrollo
4. Contacte al equipo de soporte técnico

---

## ✅ Checklist de Producción

Antes de desplegar a producción, verifique:

- [ ] Migraciones aplicadas correctamente en Supabase
- [ ] Políticas RLS probadas y funcionando
- [ ] Al menos un usuario admin creado
- [ ] Variables de entorno configuradas
- [ ] Terminal kiosco de prueba creada y probada
- [ ] Flujo completo de registro de acceso funcional
- [ ] Credenciales de kiosco guardadas de forma segura
- [ ] Tablets configuradas en modo kiosco
- [ ] Backup de la base de datos realizado

---

**Fecha de Implementación:** Octubre 7, 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Implementación Completa

---

¡El sistema está listo para producción! 🚀

