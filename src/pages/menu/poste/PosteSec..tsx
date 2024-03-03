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
import AddPosteDialog from "../../../components/dialogs/add/AddPosteDialog";
import { getPoste } from "../../../api/Poste.api";
import { PosteInterface } from "../../../interfaces/interfaces";
import { useEffect, useState } from "react";

const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 100 },
  { field: 'lat', headerName: 'Latitud', width: 150 },
  { field: 'lng', headerName: 'Longitud', width: 150 },
  { field: 'id_material', headerName: 'Material', width: 150 },
  { field: 'id_propietario', headerName: 'Propietario', width: 150 },
  { field: 'id_ciudadA', headerName: 'Tramo de Inicio', width: 150 },
  { field: 'id_ciudadB', headerName: 'Tramo de Fin', width: 150 },
  {
    field: 'createdAt', headerName: 'Creación', width: 150,
    valueGetter: (params) => {
      const date = new Date(params.row.createdAt);
      return date.toLocaleString();

    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', width: 150,
    valueGetter: (params) => {
      const date = new Date(params.row.updatedAt);
      return date.toLocaleString();

    }
  },
];
interface PosteSecProps {
  setposte: React.Dispatch<React.SetStateAction<number | null>>;
}
const PosteSec: React.FC<PosteSecProps> = ({ setposte }) => {
  const [list, setList] = useState<PosteInterface[]>();

  useEffect(() => {
    recibirDatos()
  }, [open])


  const recibirDatos = async () => {
    setList(await getPoste())
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
                <AddPosteDialog functionApp={recibirDatos} />
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
                //className="datagrid-content"
                rows={list ? list : []}
                columns={columns}
                experimentalFeatures={{ lazyLoading: true }}
                rowsLoadingMode="server"
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                  loadingOverlay: LinearProgress,
                }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                onRowClick={(params) => {
                  //console.log(params.row.id)
                  setposte(params.row.id);
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
export default PosteSec;
