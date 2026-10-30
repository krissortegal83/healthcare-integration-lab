# Integración hospitalaria

**Conectar órdenes y estudios sin confundir pacientes.**

Procesa una orden de ejemplo, evita duplicados y recupera mensajes cuando una conexión falla.

👉 [Probar el proyecto](https://krissortegal83.github.io/healthcare-integration-lab/) · [Ver todos los proyectos](https://krissortegal83.github.io/) · [Hablar conmigo](https://www.linkedin.com/in/christian-ortega-lugo-7523a518b/)

## Pruébalo en unos minutos

Prueba una orden, repítela y comprueba que solo se registra una vez. Después asocia el estudio al paciente correcto.

## Qué puedes ver

Una demostración con datos ficticios. Puedes cambiar el escenario, comprobar sus reglas y ver qué sucede cuando algo no coincide. Los casos nuevos permiten descargar el historial y un resumen.

## Mi enfoque

Entender el proceso, definir reglas claras, hacer visibles los errores y comprobar el resultado antes de entregar. Este proyecto es independiente y se creó con ayuda de IA. No representa un trabajo realizado para antiguos empleadores ni resultados de clientes.

## Para revisar el código

El proyecto usa HTML, CSS y JavaScript. Las reglas se mantienen separadas de la pantalla para poder probarlas. El catálogo conserva el origen y el historial compartido: [Enterprise Solutions Lab](https://github.com/krissortegal83/enterprise-solutions-lab).

Los datos son ficticios. Las conexiones hospitalarias, comerciales y ERP son simuladas dentro del alcance indicado. Una operación real necesita integraciones, permisos, almacenamiento y aceptación propios.

## ¿Te sirve para un problema parecido?

Cuéntame qué proceso quieres mejorar, qué herramientas usas y cómo sabrías que el resultado funciona. [Platiquemos en LinkedIn](https://www.linkedin.com/in/christian-ortega-lugo-7523a518b/).

## Ejecutarlo en tu equipo

Necesitas Python 3 para abrir la demo y Node.js 22 o posterior para comprobar sus reglas. No hace falta instalar paquetes.

```bash
python -m http.server 8000
# Abre http://localhost:8000
npm test
```

## Organización

- `index.html`: la demostración.
- `assets/`: presentación y reglas de negocio.
- `tests/`: pruebas de los casos y sus errores.
- `docs/ORIGEN.md`: procedencia, alcance y mantenimiento.
- `.github/workflows/`: comprobaciones automáticas y publicación.

Este repositorio puede ejecutarse y publicarse sin depender de otros repositorios. La base compartida se distribuye como una copia versionada sin servicios externos; consulta su origen antes de actualizarla.
