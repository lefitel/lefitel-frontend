
import { useContext, useEffect, useState } from "react";
import { DataGridPremium, GridColDef, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";
import { RolInterface, UsuarioInterface } from "../../interfaces/interfaces";
import { SesionContext } from "../../context/SesionProvider";
import { getUsuario, searchUsuario } from "../../api/Usuario.api";
import { Box, ButtonGroup, Card, CardActions, CardContent, Grid } from "@mui/material";
import AddUserDialog from "../../components/dialogs/add/AddUserDialog";
import { usuarioExample } from "../../data/example";
import EditUserDialog from "../../components/dialogs/edits/EditUserDialog";

const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
  { field: 'lastname', headerName: 'Apellido' },
  { field: 'phone', headerName: 'Telefono' },
  {
    field: 'birthday', headerName: 'Nacimiento', type: 'date',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  { field: 'user', headerName: 'Usuario' },
  {
    field: 'rol', headerName: 'Rol',
    valueGetter: (value: RolInterface) => {
      return value.name;
    }
  },
  {
    field: 'createdAt', headerName: 'Creación', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
];

const SeguridadPage = () => {
  const [openEdit, setOpenEdit] = useState(false);
  const [list, setList] = useState<UsuarioInterface[]>();
  const [data, setData] = useState<UsuarioInterface>(usuarioExample);
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
    console.log(list)
  }, [openEdit])

  const recibirDatos = async () => {
    setList(await getUsuario(sesion.token))
  }

  const userSelect = async (params: GridRowParams) => {
    setOpenEdit(true);
    setData(await searchUsuario(params.row.id, sesion.token))
  }

  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
        margin: 0,
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} style={{}}>
          <CardActions >
            <ButtonGroup >
              <AddUserDialog functionApp={recibirDatos} />
            </ButtonGroup>
          </CardActions>
          <CardContent style={{}}>
            <Box
              sx={{
                height: {
                  xs: "calc(100vh - 105px)",
                  md: "calc(100vh - 200px)",
                },
                width: {
                  xs: "calc(100vw - 100px)",
                  sm: "calc(100vw - 115px)",
                  md: "calc(100vw - 115px)",
                },
              }}
            >
              <DataGridPremium
                rows={list ? list : []}
                columns={columns}
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                  //loadingOverlay: LinearProgress,
                }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                onRowClick={userSelect}

                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditUserDialog functionApp={recibirDatos} user={data} setUser={setData} open={openEdit} setOpen={setOpenEdit} /> : null}
    </Grid>
  );
};

export default SeguridadPage;
