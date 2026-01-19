# Bridge Scan Web - Guia de Build e Instalacion

## Descripcion

Bridge Scan Web es una API REST que actua como puente para la integracion con escaner NAPS2. Permite escanear documentos, gestionar perfiles de escaneo y administrar archivos escaneados a traves de endpoints HTTP.

---

## Prerequisitos

### Para Development (Build)

- **Node.js** >= 18.0.0
- **npm** (incluido con Node.js)
- **Windows 10/11** (64-bit)

### Para Instalacion en Equipos de Destino

- **Windows 10/11** (64-bit, x64)
- **Arquitectura x64** (no compatible con sistemas ARM o x86)
- **NAPS2** (portable, incluido en el build)
- **Escaner compatible** con WIA (Windows Image Acquisition)
- **Permisos de administrador** (para instalar como servicio)
- **Puerto 3000** disponible

---

## Build de la Aplicacion

### 1. Clonar o descargar el proyecto

```bash
git clone <url-del-repositorio>
cd bridge-scan-web
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Compilar TypeScript y generar ejecutable

```bash
npm run pkg
```

Este comando ejecuta:
1. `npm run build` - Compila TypeScript a JavaScript (`dist/`)
2. `npm run pkg:api` - Genera el ejecutable `bin/bridge-scan-web.exe`
3. Copia el script PowerShell para WIA a `bin/scripts/`

### Estructura del Build

Despues del build, la carpeta `bin/` contendra:

```
bin/
├── bridge-scan-web.exe      # API ejecutable principal
├── WinSW-x64.exe            # Wrapper para servicio de Windows
├── WinSW-x64.xml            # Configuracion del servicio
├── naps2-8.2.1-win-x64/     # NAPS2 portable
│   ├── App/
│   │   ├── NAPS2.Console.exe
│   │   └── ...
│   └── Data/
│       └── profiles.xml     # Perfiles de escaneo
├── scripts/
│   └── list-wia-devices.ps1 # Script para detectar escaners
├── scans/                   # Carpeta de archivos escaneados (se crea automaticamente)
└── logs/                    # Logs de la aplicacion (se crea automaticamente)
```

---

## Instalacion en Equipos de Destino

### 1. Copiar archivos

Copiar toda la carpeta `bin/` al equipo de destino. Se recomienda ubicarla en:

```
C:\BridgeScanWeb\
```

### 2. Verificar conexion del escaner

1. Conectar y encender el escaner
2. Verificar que Windows lo detecte (Configuracion > Dispositivos > Impresoras y escaners)
3. Instalar drivers del fabricante si es necesario

### 3. Probar la aplicacion manualmente (opcional)

Antes de instalar como servicio, verificar que funciona:

```cmd
cd C:\BridgeScanWeb
bridge-scan-web.exe
```

Deberia mostrar:
```
Server running on http://localhost:3000
```

Probar en el navegador: `http://localhost:3000/api/devices`

Presionar `Ctrl+C` para detener.

### 4. Instalar como servicio de Windows

#### Usando WinSW (recomendado)

1. Abrir **CMD como administrador**
2. Navegar a la carpeta de instalacion:
   ```cmd
   cd C:\BridgeScanWeb
   ```
3. Instalar el servicio:
   ```cmd
   WinSW-x64.exe install
   ```
4. Iniciar el servicio:
   ```cmd
   WinSW-x64.exe start
   ```

#### Comandos utiles de WinSW

```cmd
WinSW-x64.exe status    # Ver estado del servicio
WinSW-x64.exe stop      # Detener servicio
WinSW-x64.exe restart   # Reiniciar servicio
WinSW-x64.exe uninstall # Desinstalar servicio
```

### 5. Verificar la instalacion

1. Abrir navegador: `http://localhost:3000/api/health`
2. Deberia responder: `{"status":"ok","timestamp":"..."}`

---

## Endpoints de la API

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/health` | Estado de la API |
| GET | `/api/devices` | Listar escaners disponibles |
| GET | `/api/profiles` | Listar perfiles de escaneo |
| POST | `/api/profiles` | Crear perfil de escaneo |
| PUT | `/api/profiles/:name` | Actualizar perfil |
| DELETE | `/api/profiles/:name` | Eliminar perfil |
| POST | `/api/scan` | Ejecutar escaneo |
| GET | `/api/files` | Listar archivos escaneados |
| GET | `/api/files/:filename` | Descargar archivo |
| DELETE | `/api/files/:filename` | Eliminar archivo |
| DELETE | `/api/files/clear` | Eliminar todos los archivos |

---

## Logs y Diagnostico

### Ubicacion de logs

```
bin/logs/
├── combined.log       # Todos los logs
├── error.log          # Solo errores
├── exceptions.log     # Excepciones no manejadas
└── rejections.log     # Promesas rechazadas
```

Los logs de WinSW se guardan junto al ejecutable:
```
bin/
├── WinSW-x64.out.log  # Salida estandar del servicio
└── WinSW-x64.err.log  # Errores del servicio
```

### Ver estado del servicio

```cmd
sc query bridgescanwebv3
```

O desde Services (services.msc), buscar "Bridge Scan Web".

---

## Solucion de Problemas

### El escaner no aparece en /api/devices

1. Verificar que el escaner esta encendido y conectado
2. Verificar que Windows lo detecta (Configuracion > Dispositivos)
3. Instalar drivers del fabricante
4. Reiniciar el servicio: `WinSW-x64.exe restart`

### Error "Puerto 3000 en uso"

Otro proceso esta usando el puerto. Cerrar el proceso que usa el puerto antes de iniciar la API.

### El servicio no inicia

1. Verificar logs en `WinSW-x64.err.log`
2. Verificar que el ejecutable existe y tiene permisos
3. Ejecutar manualmente para ver errores: `bridge-scan-web.exe`

### Error al escanear

1. Verificar que existe un perfil de escaneo configurado
2. Verificar que el Device ID en el perfil coincide con un escaner disponible
3. Revisar logs en `logs/combined.log`

---

## Desinstalacion

1. Abrir **CMD como administrador**
2. Navegar a la carpeta de instalacion:
   ```cmd
   cd C:\BridgeScanWeb
   ```
3. Desinstalar el servicio:
   ```cmd
   WinSW-x64.exe stop
   WinSW-x64.exe uninstall
   ```
4. Eliminar la carpeta `C:\BridgeScanWeb`

---

## Estructura del Proyecto (Development)

```
bridge-scan-web/
├── src/
│   ├── index.ts              # Punto de entrada
│   ├── config/
│   │   └── env.ts            # Configuracion de entorno
│   ├── controllers/          # Controladores de endpoints
│   ├── routes/               # Definicion de rutas
│   ├── services/             # Logica de negocio
│   ├── schemas/              # Esquemas de validacion (Zod)
│   ├── types/                # Tipos TypeScript
│   └── utils/                # Utilidades (logger, paths, etc.)
├── scripts/
│   └── list-wia-devices.ps1  # Script PowerShell para WIA
├── bin/                      # Build output
├── package.json
├── tsconfig.json
└── INSTALL.md                # Este archivo
```