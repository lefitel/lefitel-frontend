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
import { EventoInterface } from "../../interfaces/interfaces";
import { getEvento, searchEvento } from "../../api/Evento.api";
import AddEventoDialog from "../../components/dialogs/add/AddEventoDialog";

import { eventoExample } from "../../data/example";
import EditEventoDialog from "../../components/dialogs/edits/EditEventoDialog";
import { SesionContext } from "../../context/SesionProvider";


const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  {
    field: 'poste', headerName: 'poste', width: 50,
    valueGetter: (params) => { return params.row.poste.name; }
  },

  { field: 'description', headerName: 'Descripción', width: 100 },
  {
    field: 'state', headerName: 'Estado', width: 100, type: 'boolean',
  },
  {
    field: 'createdAt', headerName: 'Creación', width: 150, type: 'dateTime',

    valueGetter: (params) => {
      const date = new Date(params.row.createdAt);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', width: 150, type: 'dateTime',
    valueGetter: (params) => {
      const date = new Date(params.row.updatedAt);
      return date
    }
  },
];

const EventoPage = () => {
  const [list, setList] = useState<EventoInterface[]>();
  const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [data, setData] = useState<EventoInterface>(eventoExample);
  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [open])
  const recibirDatos = async () => {
    setList(await getEvento(sesion.token))
  }

  const EventoSelect = async (params) => {
    setOpenEdit(true);
    setData(await searchEvento(params.row.id, sesion.token))
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
                <AddEventoDialog functionApp={recibirDatos} />
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
                onRowClick={EventoSelect}
                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditEventoDialog functionApp={recibirDatos} Evento={data} setEvento={setData} open={openEdit} setOpen={setOpenEdit} /> : null}

    </Grid>
  );
};

export default EventoPage;
