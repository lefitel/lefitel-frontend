# `dev/` — material que solo existe en desarrollo

Nada de esta carpeta se publica. `vite build` no la mira, y el servidor de
desarrollo la sirve como ficheros estáticos corrientes bajo `/dev/...`.

**Por qué no está en `public/`.** Todo lo que hay en `public/` se copia tal cual
a `dist/` y queda publicado en Vercel, enlazado o no. Un diagrama que nombra los
servidores, los proveedores de correo y las rutas de almacenamiento no debe estar
a una dirección adivinada de distancia.

## `arquitectura-osefi.html`

El diagrama de la infraestructura, tal como lo muestra `/app/infraestructura` —
una pantalla que también existe solo en desarrollo (ver
`src/pages/menu/InfraestructuraPage.tsx`).

Es un HTML autocontenido: se abre igual con doble clic, sin servidor.

**Es una foto fija.** No consulta nada del sistema en marcha, así que es tan
cierto como el día en que se generó. Cuando cambie la infraestructura hay que
rehacerlo.

### Cómo regenerarlo

La fuente es `arquitectura-osefi.json`, la especificación que lee
[Archify](https://github.com/tt-a1i/archify). Se edita ese fichero, no el HTML.

```bash
cd ~/.claude/skills/archify

# Comprueba la geometría y las colisiones antes de dibujar nada.
node bin/archify.mjs validate architecture <ruta>/arquitectura-osefi.json --quality showcase

# Genera el HTML.
node bin/archify.mjs deliver architecture <ruta>/arquitectura-osefi.json <ruta>/arquitectura-osefi.html --quality showcase

# Opcional: mide en un navegador de verdad que no desborda en 1440x900 y demás.
node bin/archify.mjs visual-check <ruta>/arquitectura-osefi.html
```

`visual-check` deja capturas y un recibo al lado del HTML. **Bórralos**: son
subproductos, no entregables.
