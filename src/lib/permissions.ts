export const ROLES = {
    ADMIN:  1,
    EDITOR: 2,
    VIEWER: 3,
} as const;

type Rol = typeof ROLES[keyof typeof ROLES];

type Acciones = {
    ver:      boolean;
    crear:    boolean;
    editar:   boolean;
    archivar: boolean;
};

type Modulos = {
    postes:     Acciones;
    eventos:    Acciones;
    ciudades:   Acciones;
    parametros: Acciones;
    reportes:   Acciones;
    seguridad:  Acciones;
    archivos:   Acciones;
    bitacora:   Acciones;
};

const TODO: Acciones    = { ver: true,  crear: true,  editar: true,  archivar: true};
const LECTURA: Acciones = { ver: true,  crear: false, editar: false, archivar: false };
const EDICION: Acciones = { ver: true,  crear: true,  editar: true,  archivar: false };
const NADA: Acciones    = { ver: false, crear: false, editar: false, archivar: false };

const PERMISOS: Record<Rol, Modulos> = {
    [ROLES.ADMIN]: {
        postes:     TODO,
        eventos:    TODO,
        ciudades:   TODO,
        parametros: TODO,
        reportes:   TODO,
        seguridad:  TODO,
        archivos:   TODO,
        bitacora:   TODO,
    },
    [ROLES.EDITOR]: {
        postes:     EDICION,
        eventos:    EDICION,
        ciudades:   EDICION,
        parametros: EDICION,
        reportes:   LECTURA,
        seguridad:  NADA,
        archivos:   NADA,
        bitacora:   NADA,
    },
    [ROLES.VIEWER]: {
        postes:     LECTURA,
        eventos:    LECTURA,
        ciudades:   LECTURA,
        parametros: NADA,
        reportes:   LECTURA,
        seguridad:  NADA,
        archivos:   NADA,
        bitacora:   NADA,
    },
};

export const can = (
    rol: number,
    modulo: keyof Modulos,
    accion: keyof Acciones,
): boolean => PERMISOS[rol as Rol]?.[modulo]?.[accion] ?? false;
