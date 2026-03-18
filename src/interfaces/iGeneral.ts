import { AdssInterface, BitacoraInterface, CiudadInterface, EventoInterface, MaterialInterface, ObsInterface, PosteInterface, PropietarioInterface, TipoObsInterface, UsuarioInterface } from "./interfaces";
import { OrphanFileInfo } from "../api/Files.api";

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
    | BitacoraInterface;