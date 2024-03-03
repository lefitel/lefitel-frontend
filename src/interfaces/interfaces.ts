export interface AdssInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
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
  name: string;
  description: string;
  id_usuario: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface MaterialInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface CiudadInterface {
  id?: number | null;
  name: string;
  lat: number;
  lng: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface ObsInterface {
  id?: number | null;
  name: string;
  description: string;
  id_tipoObs: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface TipoObsInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface PropietarioInterface {
  id?: number | null;
  name: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
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
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface EventoInterface {
  id?: number | null;
  description: string;
  image: string;
  state: boolean;
  id_poste: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface RevicionInterface {
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
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
