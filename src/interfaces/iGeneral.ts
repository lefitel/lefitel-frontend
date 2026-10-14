import { AdssInterface, BitacoraInterface, CiudadInterface, EventoInterface, MaterialInterface, ObsInterface, PosteInterface, PropietarioInterface, RolInterface, TipoObsInterface, Tramo, UsuarioInterface } from "./interfaces";
import { OrphanFileInfo } from "../api/Files.api";
import type { EjecucionDelHistorial, Programacion } from "../api/Programacion.api";

export type IGeneral =
    | EventoInterface
    | PosteInterface
    | UsuarioInterface
    | CiudadInterface
    | AdssInterface
    | MaterialInterface
    | PropietarioInterface
    | TipoObsInterface 
    | ObsInterface
    | OrphanFileInfo
    | BitacoraInterface
    | RolInterface
    | Programacion
    | EjecucionDelHistorial
    | Tramo;