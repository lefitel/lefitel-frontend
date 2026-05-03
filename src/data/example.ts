import {
  EventoInterface,
  PosteInterface,
  RevisionInterface,
  SolucionInterface,
  UsuarioInterface,
} from "../interfaces/interfaces";

export const lngExample = -63.166498;
export const latExample = -17.82594;

export const posteExample: PosteInterface = {
  name: "",
  image: "",
  date: new Date(),
  lat: latExample,
  lng: lngExample,
  id_adss: 0,
  id_ciudadA: 0,
  id_ciudadB: 0,
  id_material: 0,
  id_propietario: 0,
  id_usuario: 0,
};

export const eventoExample: EventoInterface = {
  description: "",
  image: "",
  date: new Date(),
  state: false,
  id_poste: 0,
  id_usuario: 0,
};

export const usuarioExample: UsuarioInterface = {
  name: "",
  lastname: "",
  birthday: new Date(),
  image: "",
  phone: "",
  user: "",
  pass: "",
  id_rol: 0,
};

export const solucionExample: SolucionInterface = {
  description: "",
  image: "",
  date: new Date(),
  id_evento: 0,
};

export const revisionExample: RevisionInterface = {
  description: "",
  date: new Date(),
  id_evento: 0,
};
