import {
  Box,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Grid,
  LinearProgress,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import AddUserDialog from "../../../components/dialogs/add/AddUserDialog";
import { useContext, useEffect, useState } from "react";
import { getUsuario } from "../../../api/Usuario.api";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { SesionContext } from "../../../context/SesionProvider";



const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 100 },
  { field: 'lastname', headerName: 'Apellido', width: 150 },
  { field: 'phone', headerName: 'Telefono', width: 150 },
  {
    field: 'birthday', headerName: 'Nacimiento', width: 150,
    valueGetter: ({ value }: { value: string }) => {
      const date = new Date(value);
      return date.toLocaleDateString();

    }
  },

  { field: 'user', headerName: 'Usuario', width: 100 },
  {
    field: 'rol', headerName: 'Rol', width: 100,
    valueGetter: ({ value }: { value: RolInterface }) => {
      return value.name;

    }
  },

  {
    field: 'createdAt', headerName: 'Creación', width: 150,
    valueGetter: ({ value }: { value: string }) => {
      const date = new Date(value);
      return date.toLocaleString();

    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', width: 150,
    valueGetter: ({ value }: { value: string }) => {
      const date = new Date(value);
      return date.toLocaleString();

    }
  },
];
interface SeguridadSecProps {
  setuser: React.Dispatch<React.SetStateAction<number | null>>;
}
const SeguridadSec: React.FC<SeguridadSecProps> = ({ setuser }) => {
  const [list, setList] = useState<UsuarioInterface[]>();
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [])


  const recibirDatos = async () => {
    setList(await getUsuario(sesion.token))

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
        <Card sx={{ flex: 1 }} variant="outlined" style={{}}>
          <CardContent style={{}}>
            <CardActions
              style={{
                paddingInline: 0,
              }}
            >
              <ButtonGroup
                size="small"
                variant="outlined"
                aria-label="outlined primary button group"
              >
                <AddUserDialog functionApp={recibirDatos} />
              </ButtonGroup>
            </CardActions>
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
              <DataGrid
                rows={list ? list : []}
                columns={columns}

                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                  loadingOverlay: LinearProgress,
                }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                onRowClick={(params) => {
                  setuser(params.row.id);
                }}
                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
export default SeguridadSec;
