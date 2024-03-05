import {
  EventoInterface,
  ObsInterface,
  PosteInterface,
  RevicionInterface,
  SolucionInterface,
  UsuarioInterface,
} from "../interfaces/interfaces";

export const columnsData = [
  { field: "id", headerName: "ID", width: 90 },
  {
    field: "firstName",
    headerName: "First name",
    width: 150,
    editable: true,
  },
  {
    field: "lastName",
    headerName: "Last name",
    width: 150,
    editable: true,
  },
  {
    field: "age",
    headerName: "Age",
    type: "number",
    width: 110,
    editable: true,
  },
  {
    field: "fullName",
    headerName: "Full name",
    description: "This column has a value getter and is not sortable.",
    sortable: false,
    width: 160,
    valueGetter: (params) =>
      `${params.row.firstName || ""} ${params.row.lastName || ""}`,
  },
];

export const rowsData = [
  { id: 1, lastName: "Snow", firstName: "Jon", age: 14 },
  { id: 2, lastName: "Lannister", firstName: "Cersei", age: 31 },
  { id: 3, lastName: "Lannister", firstName: "Jaime", age: 31 },
  { id: 4, lastName: "Stark", firstName: "Arya", age: 11 },
  { id: 5, lastName: "Targaryen", firstName: "Daenerys", age: null },
  { id: 6, lastName: "Melisandre", firstName: null, age: 150 },
  { id: 7, lastName: "Clifford", firstName: "Ferrara", age: 44 },
  { id: 8, lastName: "Frances", firstName: "Rossini", age: 36 },
  { id: 9, lastName: "Roxie", firstName: "Harvey", age: 65 },
];

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
};

export const eventoExample: EventoInterface = {
  description: "",
  image: "",

  state: false,
  id_poste: 0,
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

export const markersData = [
  [-17.82594, -63.166498],
  [-17.754984, -63.195137],
  [-18.085152, -65.742328],
  [-17.531549, -66.179223],
  [-17.317623, -63.281997],
  [-17.103143, -63.237709],
  [-16.842419, -63.40216],
  [-16.675418, -63.617767],
];
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
