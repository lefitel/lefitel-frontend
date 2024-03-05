import { useContext, useEffect, useState } from "react";
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
import { AdssPosteInterface, PosteInterface } from "../../interfaces/interfaces";
import { getPoste, searchPoste } from "../../api/Poste.api";
import AddPosteDialog from "../../components/dialogs/add/AddPosteDialog";

import { posteExample } from "../../data/example";
import EditPosteDialog from "../../components/dialogs/edits/EditPosteDialog";
import { getAdssPoste } from "../../api/AdssPoste.api";
import { SesionContext } from "../../context/SesionProvider";


const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Número', width: 100 },
  { field: 'lat', headerName: 'Lat', width: 50 },
  { field: 'lng', headerName: 'Lng', width: 50 },
  {
    field: 'material', headerName: 'Material', width: 150,
    valueGetter: (params) => { return params.row.material.name; }
  },
  {
    field: 'propietario', headerName: 'Propietario', width: 150,
    valueGetter: (params) => { return params.row.propietario.name; }
  },
  {
    field: 'ciudadA', headerName: 'Tramo de Inicio', width: 150,
    valueGetter: (params) => { return params.row.ciudadA.name; }
  },
  {
    field: 'ciudadB', headerName: 'Tramo de Fin', width: 150,
    valueGetter: (params) => { return params.row.ciudadB.name; }
  },
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

const PostePage = () => {
  const [list, setList] = useState<PosteInterface[]>();
  const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [data, setData] = useState<PosteInterface>(posteExample);
  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [open])
  const recibirDatos = async () => {
    setList(await getPoste(sesion.token))
  }

  const posteSelect = async (params) => {
    setOpenEdit(true);
    setData(await searchPoste(params.row.id, sesion.token))
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
                onRowClick={posteSelect}
                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditPosteDialog functionApp={recibirDatos} poste={data} setPoste={setData} open={openEdit} setOpen={setOpenEdit} /> : null}

    </Grid>
  );
};

export default PostePage;
