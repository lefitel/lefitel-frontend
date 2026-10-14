import {
  PosteInterface,
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
  id_tramo: 0,
  id_material: 0,
  id_propietario: 0,
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
