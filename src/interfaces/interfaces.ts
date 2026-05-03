export interface SesionInterface {
  usuario: UsuarioInterface;
  token: string;
}
export interface ReporteInterface {
  TramoInicial: number | null;
  TramoFinal: number | null;
  fechaInicial: Date;
  fechaFinal: Date;
  excludeOld?: boolean;
}
export interface AdssInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface AdssPosteInterface {
  id?: number | null;
  id_adss: number;
  id_poste: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface EventoObsInterface {
  id?: number | null;
  id_evento: number;
  id_obs: number;
  ob?: ObsInterface | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface RolInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BitacoraInterface {
  id?: number | null;
  action: string;
  detail: string;
  entity: string;
  entity_id?: number | null;
  id_usuario: number;
  usuario?: UsuarioInterface | null;
  metadata?: Record<string, unknown> | null;
  severity?: 'info' | 'warning' | 'critical' | null;
  ip_address?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface MaterialInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface CiudadInterface {
  id?: number | null;
  name: string;
  image: string;
  lat: number;
  lng: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface ObsInterface {
  id?: number | null;
  name: string;
  description: string;
  id_tipoObs: number;
  /** Criticidad 1-9 (1 = catastrófico, 9 = mantenimiento). Null = sin clasificar. */
  criticality?: number | null;
  tipoObs?: TipoObsInterface | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface TipoObsInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface PropietarioInterface {
  id?: number | null;
  name: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface PosteInterface {
  id?: number | null;
  name: string;
  image: string;
  date: Date;
  lat: number;
  lng: number;
  id_adss: number;
  id_material: number;
  id_propietario: number;
  id_ciudadA: number;
  id_ciudadB: number;
  id_usuario: number;
  adss_ids?: number[];

  adss?: AdssInterface | null;
  material?: MaterialInterface | null;
  propietario?: PropietarioInterface | null;
  ciudadA?: CiudadInterface | null;
  ciudadB?: CiudadInterface | null;
  adsspostes?: AdssPosteInterface | null;
  usuario?: UsuarioInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface EventoInterface {
  id?: number | null;
  description: string;
  image: string;
  state: boolean;
  date: Date;
  id_poste: number;
  id_usuario: number;
  obs_ids?: number[];
  revision?: { description: string; date: Date };

  poste?: PosteInterface | null;
  solucions?: SolucionInterface[] | null;
  revisions?: RevisionInterface[] | null;
  eventoObs?: EventoObsInterface[] | null;
  usuario?: UsuarioInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  priority?: boolean;
}

export interface RevisionInterface {
  id?: number | null;
  description: string;
  date: Date;
  id_evento: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UsuarioInterface {
  id?: number | null;
  name: string;
  lastname: string;
  birthday: Date;
  image: string;
  phone: string;
  user: string;
  pass: string;
  id_rol: number;

  rol?: RolInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface SolucionInterface {
  id?: number | null;
  description: string;
  image: string;
  date: Date;
  id_evento: number;

  evento?: EventoInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
}
