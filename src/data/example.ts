import {
  CiudadInterface,
  EventoInterface,
  MaterialInterface,
  ObsInterface,
  PosteInterface,
  PropietarioInterface,
  RevicionInterface,
  SolucionInterface,
  TipoObsInterface,
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

export const propietarioExample: PropietarioInterface = {
  name: "",
};

export const tipoObsExample: TipoObsInterface = {
  name: "",
  description: "",
};
export const MaterialExample: MaterialInterface = {
  name: "",
  description: "",
};

export const eventoExample: EventoInterface = {
  description: "",
  image: "",
  date: new Date(),
  state: false,
  id_poste: 0,
  id_usuario: 0,
};
export const ciudadExample: CiudadInterface = {
  name: "",
  image: "",
  lat: lngExample,
  lng: lngExample,
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

export const obsExample: ObsInterface = {
  name: "",
  description: "",
  id_tipoObs: 0,
};

export const revicionExample: RevicionInterface = {
  description: "",
  date: new Date(),
  id_evento: 0,
};
export const uData = [40, 30, 20, 27, 18, 23, 34];
export const pData = [24, 13, 98, 39, 48, 38, 43];

export const timeData = [
  new Date(2015, 1, 0),
  new Date(2015, 2, 0),
  new Date(2015, 3, 0),
  new Date(2015, 4, 0),
  new Date(2015, 5, 0),
  new Date(2015, 6, 0),
  new Date(2015, 7, 0),
];
/*
export const columnsExample = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "name", headerName: "Name", width: 150 },
  { field: "age", headerName: "Age", width: 70 },
  // Nueva columna con botones
  {
    field: "actions",
    headerName: "Actions",
    width: 150,
    renderCell: (params) => (
      <div>
        <button onClick={() => {}}>Editar</button>
        <button onClick={() => {}}>Eliminar</button>
      </div>
    ),
  },
];

export const rowsExample = [
  { id: 1, name: "John Doe", age: 25 },
  { id: 2, name: "Jane Doe", age: 30 },
  // ...otros datos
];*/
